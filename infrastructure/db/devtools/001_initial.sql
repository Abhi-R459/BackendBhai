-- BackendBhai: DevTools Database Schema
-- Contracts source: contracts/DATA_MODEL.md

CREATE TABLE IF NOT EXISTS traces (
    trace_id        VARCHAR(32) PRIMARY KEY,       -- 32-char hex trace ID
    root_service    VARCHAR(100) NOT NULL,          -- Service that received initial request
    method          VARCHAR(10) NOT NULL,           -- HTTP method (GET, POST, etc.)
    path            VARCHAR(2000) NOT NULL,         -- URL path
    status_code     INTEGER NOT NULL,               -- HTTP response status code
    duration_ms     INTEGER NOT NULL,               -- Total trace duration in milliseconds
    timestamp       TIMESTAMPTZ NOT NULL,           -- Trace start time
    has_error       BOOLEAN NOT NULL DEFAULT FALSE, -- Whether any span has error
    request_body    JSONB,                          -- Request body (root span)
    response_body   JSONB,                          -- Response body (root span)
    request_headers  JSONB,                         -- Request headers (redacted)
    response_headers JSONB,                         -- Response headers (redacted)
    services        TEXT[] NOT NULL DEFAULT '{}',    -- Array of unique service names
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spans (
    span_id         VARCHAR(16) PRIMARY KEY,        -- 16-char hex span ID
    trace_id        VARCHAR(32) NOT NULL REFERENCES traces(trace_id) ON DELETE CASCADE,
    parent_span_id  VARCHAR(16) REFERENCES spans(span_id) ON DELETE CASCADE,  -- Self-referencing FK
    service         VARCHAR(100) NOT NULL,           -- Service name
    operation       VARCHAR(500) NOT NULL,           -- Span name/operation
    kind            VARCHAR(20) NOT NULL,            -- "server", "client", "internal"
    start_timestamp TIMESTAMPTZ NOT NULL,            -- Span start time
    duration_ms     INTEGER NOT NULL,                -- Span duration in milliseconds
    status          VARCHAR(10) NOT NULL DEFAULT 'OK',  -- "OK" or "ERROR"
    status_code     INTEGER,                         -- HTTP status code (for HTTP spans)
    attributes      JSONB DEFAULT '{}',              -- Span attributes (key-value pairs)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS span_events (
    id              SERIAL PRIMARY KEY,
    span_id         VARCHAR(16) NOT NULL REFERENCES spans(span_id) ON DELETE CASCADE,
    trace_id        VARCHAR(32) NOT NULL REFERENCES traces(trace_id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,           -- Event name (e.g., "exception")
    timestamp       TIMESTAMPTZ NOT NULL,            -- Event timestamp
    attributes      JSONB DEFAULT '{}',              -- Event attributes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_events (
    id              SERIAL PRIMARY KEY,
    trace_id        VARCHAR(32) NOT NULL REFERENCES traces(trace_id) ON DELETE CASCADE,
    span_id         VARCHAR(16),                     -- Optional span correlation
    service         VARCHAR(100) NOT NULL,           -- Service name
    level           VARCHAR(10) NOT NULL,            -- "debug", "info", "warn", "error"
    message         TEXT NOT NULL,                   -- Log message
    timestamp       TIMESTAMPTZ NOT NULL,            -- Log timestamp
    attributes      JSONB DEFAULT '{}',              -- Additional log attributes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    name            VARCHAR(100) PRIMARY KEY,        -- Service name
    first_seen      TIMESTAMPTZ NOT NULL,            -- First trace timestamp
    last_seen       TIMESTAMPTZ NOT NULL,            -- Most recent trace timestamp
    trace_count     INTEGER NOT NULL DEFAULT 0,      -- Number of traces involving this service
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_dependencies (
    id              SERIAL PRIMARY KEY,
    source_service  VARCHAR(100) NOT NULL,           -- Calling service
    target_service  VARCHAR(100) NOT NULL,           -- Called service
    protocol        VARCHAR(20) NOT NULL,            -- "HTTP", "pg", "redis"
    avg_latency_ms  REAL,                            -- Average latency
    call_count      INTEGER NOT NULL DEFAULT 0,      -- Number of observed calls
    UNIQUE(source_service, target_service, protocol)
);

CREATE TABLE IF NOT EXISTS replay_sessions (
    replay_id           VARCHAR(100) PRIMARY KEY,    -- Unique replay ID
    original_trace_id   VARCHAR(32) NOT NULL REFERENCES traces(trace_id) ON DELETE CASCADE,
    replay_trace_id     VARCHAR(32) REFERENCES traces(trace_id) ON DELETE SET NULL,  -- May be NULL initially
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',   -- "pending", "in_progress", "completed", "failed"
    overrides           JSONB,                       -- Request overrides
    duration_ms         INTEGER,                     -- Replay duration
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

-- Performance Indexes per contracts/DATA_MODEL.md §4
CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traces_method ON traces(method);
CREATE INDEX IF NOT EXISTS idx_traces_status_code ON traces(status_code);
CREATE INDEX IF NOT EXISTS idx_traces_root_service ON traces(root_service);
CREATE INDEX IF NOT EXISTS idx_traces_duration ON traces(duration_ms);
CREATE INDEX IF NOT EXISTS idx_traces_has_error ON traces(has_error);
CREATE INDEX IF NOT EXISTS idx_traces_services ON traces USING GIN(services);

CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_parent_span_id ON spans(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_spans_service ON spans(service);
CREATE INDEX IF NOT EXISTS idx_spans_kind ON spans(kind);
CREATE INDEX IF NOT EXISTS idx_spans_status ON spans(status);
CREATE INDEX IF NOT EXISTS idx_spans_trace_service ON spans(trace_id, service);

CREATE INDEX IF NOT EXISTS idx_span_events_trace_id ON span_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_span_events_span_id ON span_events(span_id);

CREATE INDEX IF NOT EXISTS idx_log_events_trace_id ON log_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_log_events_service ON log_events(service);
CREATE INDEX IF NOT EXISTS idx_log_events_level ON log_events(level);
CREATE INDEX IF NOT EXISTS idx_log_events_trace_level ON log_events(trace_id, level);

CREATE INDEX IF NOT EXISTS idx_service_deps_source ON service_dependencies(source_service);
CREATE INDEX IF NOT EXISTS idx_service_deps_target ON service_dependencies(target_service);
