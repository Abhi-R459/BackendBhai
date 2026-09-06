# Backend DevTools — Implementation Blueprint

> **Date:** September 3, 2026  
> **Source of Truth:** [planning/01-product-research-validation.md](./01-product-research-validation.md)  
> **Status:** Architecture Complete

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Component Diagram](#2-component-diagram)
3. [Data Flow](#3-data-flow)
4. [Instrumentation](#4-instrumentation)
5. [Trace Model](#5-trace-model)
6. [Database Schema](#6-database-schema)
7. [API Specification](#7-api-specification)
8. [WebSocket Specification](#8-websocket-specification)
9. [Replay Architecture](#9-replay-architecture)
10. [Comparison Architecture](#10-comparison-architecture)
11. [Service Topology](#11-service-topology)
12. [Security](#12-security)
13. [Performance](#13-performance)
14. [Testing](#14-testing)
15. [Hackathon Architecture](#15-hackathon-architecture)
16. [Production Architecture](#16-production-architecture)
17. [Technical Risks](#17-technical-risks)
18. [Final Architecture Recommendations](#18-final-architecture-recommendations)

---

## 1. Architecture

### 1.1 High-Level Architecture

The system has three major layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│                        (React SPA)                              │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ │
│  │  Request     │ │  Trace       │ │  Context   │ │ Replay   │ │
│  │  Explorer    │ │  Waterfall   │ │  Panel     │ │ & Compare│ │
│  └─────────────┘ └──────────────┘ └────────────┘ └──────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST + WebSocket
┌───────────────────────────┼─────────────────────────────────────┐
│                      API LAYER                                  │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │                 Backend DevTools Server                    │  │
│  │            (Node.js + TypeScript + Fastify)               │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │  │
│  │  │ Request  │ │ Trace    │ │  Replay   │ │ Topology  │  │  │
│  │  │ API      │ │ API      │ │  API      │ │ API       │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │              PostgreSQL (Trace Storage)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   TELEMETRY LAYER                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              OpenTelemetry Collector                      │  │
│  │           (OTLP gRPC In → OTLP Export Out)               │  │
│  └──────────────────────┬────────────────────────────────────┘  │
│                         │ OTLP Export                           │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                   SIMULATED BACKEND                             │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐ │
│  │  API     │  │  Auth        │  │  Order   │  │  Payment   │ │
│  │  Gateway │──│  Service     │──│  Service  │──│  Service   │ │
│  │  :3000   │  │  :3001       │  │  :3002   │  │  :3003     │ │
│  └──────────┘  └──────────────┘  └──────────┘  └────────────┘ │
│       │              │                │              │          │
│       │              │          ┌─────┴─────┐   ┌───┴────┐    │
│       │              │          │ PostgreSQL │   │ Redis  │    │
│       │              │          │   :5432    │   │ :6379  │    │
│       │              │          └───────────┘   └────────┘    │
│       │              │                                        │
│       └──────────────┴────────────┬───────────────────────────│
│                                   │                           │
│                          ┌────────┴────────┐                  │
│                          │  Mock Payment   │                  │
│                          │  API  :4000     │                  │
│                          │  (WireMock)     │                  │
│                          └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Principles

| Principle | Decision | Rationale |
|-----------|----------|-----------|
| **Separation of Concerns** | Simulated backend ≠ DevTools server ≠ UI | Each layer can be developed, tested, and debugged independently |
| **OTel as Data Source** | All telemetry flows through OTel Collector | Industry standard, vendor-neutral, demonstrates real-world pattern |
| **Pull, Don't Push** | DevTools server pulls traces from OTel Collector (pull-based) | Simpler for hackathon; avoids real-time streaming complexity |
| **Stateless API** | All API endpoints are stateless | Simpler scaling, easier testing, no sticky sessions |
| **Fail-Open Telemetry** | Instrumentation failures don't break services | Production best practice, safe for demo |

---

## 2. Component Diagram

### 2.1 Frontend Components

```mermaid
graph TB
    subgraph "Frontend (React + TypeScript)"
        App["App Shell"]
        
        subgraph "Navigation"
            CommandPalette["Command Palette<br/>(Cmd+K)"]
            Sidebar["Sidebar Nav"]
        end
        
        subgraph "Request Explorer"
            RequestList["Request List<br/>(Virtual Scroll)"]
            RequestFilters["Request Filters<br/>(Method, Status, Service)"]
            RequestSearch["Search Bar"]
        end
        
        subgraph "Request Detail"
            DetailTabs["Detail Tabs"]
            TabOverview["Overview"]
            TabWaterfall["Waterfall"]
            TabLogs["Logs"]
            TabDB["DB Queries"]
            TabAPI["External APIs"]
            TabTopology["Topology"]
            TabReplay["Replay"]
            TabCompare["Compare"]
        end
        
        subgraph "Shared"
            CommandBar["Command Bar"]
            StatusBar["Status Bar"]
            ErrorBoundary["Error Boundary"]
        end
        
        App --> Sidebar
        App --> CommandPalette
        App --> RequestList
        RequestList --> DetailTabs
        DetailTabs --> TabOverview
        DetailTabs --> TabWaterfall
        DetailTabs --> TabLogs
        DetailTabs --> TabDB
        DetailTabs --> TabAPI
        DetailTabs --> TabTopology
        DetailTabs --> TabReplay
        DetailTabs --> TabCompare
    end
```

### 2.2 Backend Components

```mermaid
graph TB
    subgraph "Backend DevTools Server (Node.js)"
        subgraph "API Layer"
            FastifyServer["Fastify Server"]
            RequestRoutes["/api/requests/*"]
            TraceRoutes["/api/traces/*"]
            ReplayRoutes["/api/replay/*"]
            CompareRoutes["/api/compare/*"]
            TopologyRoutes["/api/topology/*"]
            WebSocketHandler["WebSocket Handler"]
        end
        
        subgraph "Service Layer"
            RequestService["RequestService"]
            TraceService["TraceService"]
            ReplayService["ReplayService"]
            CompareService["CompareService"]
            TopologyService["TopologyService"]
            LogService["LogService"]
        end
        
        subgraph "Data Layer"
            OTelExporter["OTLP Trace Receiver"]
            TraceRepository["TraceRepository"]
            ReplayRepository["ReplayRepository"]
        end
        
        subgraph "Infrastructure"
            Database["PostgreSQL"]
            RedisCache["Redis Cache<br/>(Optional)"]
        end
        
        FastifyServer --> RequestRoutes
        FastifyServer --> TraceRoutes
        FastifyServer --> ReplayRoutes
        FastifyServer --> CompareRoutes
        FastifyServer --> TopologyRoutes
        FastifyServer --> WebSocketHandler
        
        RequestRoutes --> RequestService
        TraceRoutes --> TraceService
        ReplayRoutes --> ReplayService
        CompareRoutes --> CompareService
        TopologyRoutes --> TopologyService
        
        OTelExporter --> TraceRepository
        TraceRepository --> Database
        ReplayRepository --> Database
        RequestService --> TraceRepository
        TraceService --> TraceRepository
        ReplayService --> ReplayRepository
        CompareService --> TraceRepository
        TopologyService --> TraceRepository
        LogService --> TraceRepository
        WebSocketHandler --> TraceRepository
    end
```

---

## 3. Data Flow

### 3.1 Request Capture Flow

```mermaid
sequenceDiagram
    participant Client as Browser/App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Order as Order Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Cache as Redis
    participant External as Mock Payment API
    participant OTel as OTel Collector
    participant DevTools as DevTools Server

    Client->>Gateway: POST /api/orders
    Note over Gateway: OTel creates root span<br/>traceparent header
    
    Gateway->>Auth: Verify Token (HTTP + traceparent)
    Note over Auth: OTel creates child span<br/>inherits trace ID
    
    Auth-->>Gateway: 200 OK (user verified)
    
    Gateway->>Order: Create Order (HTTP + traceparent)
    Note over Order: OTel creates child span
    
    Order->>Cache: GET cart:session-123
    Note over Cache: OTel creates child span<br/>db.system = redis
    
    Order->>DB: INSERT INTO orders (HTTP + traceparent)
    Note over DB: OTel pg instrumentation<br/>creates child span<br/>captures SQL statement
    
    DB-->>Order: 201 Created
    
    Order->>Payment: Process Payment (HTTP + traceparent)
    Note over Payment: OTel creates child span
    
    Payment->>External: POST /charges (HTTP + traceparent)
    Note over External: OTel creates child span<br/>external HTTP call
    
    External-->>Payment: 200 OK (charge succeeded)
    
    Payment-->>Order: 200 OK (payment processed)
    Order-->>Gateway: 201 Created
    Gateway-->>Client: 201 Created

    Note over OTel: All spans exported via OTLP
    
    OTel->>DevTools: OTLP Export (traces + logs)
    Note over DevTools: Store in PostgreSQL<br/>index by trace_id<br/>index by service
    
    DevTools-->>Client: WebSocket: new_request event
```

### 3.2 Trace Storage Flow

```mermaid
flowchart TB
    subgraph "OTel Collector"
        OTLP["OTLP Receiver<br/>(gRPC :4317)"]
        Batch["Batch Processor"]
        Export["OTLP Exporter"]
    end

    subgraph "DevTools Server"
        Receiver["OTLP Trace Receiver<br/>(Same process)"]
        Transformer["Trace Transformer"]
        Validator["Span Validator"]
        Redactor["Secret Redactor"]
        Store["Trace Store"]
    end

    subgraph "PostgreSQL"
        TracesTable["traces table"]
        SpansTable["spans table"]
        LogsTable["log_events table"]
        Indexes["Indexes"]
    end

    OTLP --> Batch --> Export
    Export --> Receiver
    Receiver --> Transformer
    Transformer --> Validator
    Validator --> Redactor
    Redactor --> Store
    Store --> TracesTable
    Store --> SpansTable
    Store --> LogsTable
    TracesTable --> Indexes
    SpansTable --> Indexes
```

### 3.3 Replay Flow

```mermaid
sequenceDiagram
    participant UI as Browser UI
    participant API as DevTools API
    participant Replay as Replay Service
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Order as Order Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Redis as Redis

    UI->>API: POST /api/replay {originalRequestId, overrides?}
    API->>Replay: ReplayService.replay(request)
    
    Replay->>Replay: Load original request snapshot
    Replay->>Replay: Generate new replay_id
    Replay->>Replay: Seed database to known state
    
    Replay->>Gateway: Re-execute HTTP request
    Note over Gateway: Fresh OTel trace created<br/>new trace_id, same payload
    
    Gateway->>Auth: Verify Token
    Auth-->>Gateway: 200 OK
    
    Gateway->>Order: Create Order
    Order->>DB: INSERT
    Order->>Payment: Process Payment
    Payment-->>Order: 200 OK
    Order-->>Gateway: 201 Created
    Gateway-->>Replay: 201 Created
    
    Replay->>Replay: Capture new trace
    Replay->>Replay: Store replay session
    
    Replay-->>API: {replayId, originalTraceId, replayTraceId}
    API-->>UI: WebSocket: replay_complete event
```

### 3.4 Realtime Flow

```mermaid
sequenceDiagram
    participant UI as Browser UI
    participant WS as WebSocket Client
    participant Server as DevTools Server
    
    UI->>WS: Connect ws://localhost:4001/ws
    WS->>Server: Connection established
    
    loop New Request
        OTel->>Server: OTLP Export (new trace)
        Server->>Server: Store trace
        Server->>WS: {type: "new_request", data: {id, method, path, status, duration, services}}
        WS->>UI: Update Request List
    end
    
    loop Request Selected
        UI->>Server: {type: "subscribe_trace", traceId: "abc123"}
        Server->>WS: {type: "trace_update", data: {spans, logs, status}}
        WS->>UI: Update Waterfall + Context Panel
    end
    
    loop Replay Event
        UI->>Server: {type: "start_replay", requestId: "xyz"}
        Server->>WS: {type: "replay_progress", data: {step: "calling_auth_service", status: "pending"}}
        WS->>UI: Show progress
        Server->>WS: {type: "replay_complete", data: {replayId, status, duration}}
        WS->>UI: Show result
    end
```

---

## 4. Instrumentation

### 4.1 How Requests Are Captured

Every HTTP request to any simulated service creates a span. We use the OpenTelemetry Node.js SDK with auto-instrumentation for Express.js.

```typescript
// packages/simulated-backend/services/shared/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export function initTracing(serviceName: string) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
      'deployment.environment': 'hackathon-demo',
    }),
    traceExporter: new OTLPTraceExporter({
      url: 'http://otel-collector:4317',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Auto-instrument Express, HTTP, pg, redis
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
      }),
    ],
  });
  sdk.start();
  process.on('SIGTERM', () => sdk.shutdown());
}
```

### 4.2 How Trace IDs Are Generated

OpenTelemetry automatically generates trace IDs. The W3C `traceparent` header format is:

```
traceparent: 00-<trace-id>-<span-id>-<trace-flags>
```

Example:
```
traceparent: 00-5b8efff798038103d269b633813fc60c-eee19b7ec3c1b174-01
```

When the API Gateway receives an incoming request without a `traceparent` header, OTel auto-instrumentation creates a new root span with a fresh trace ID. This trace ID is then propagated to all downstream services via the `traceparent` header.

```typescript
// In our simulated backend, requests arrive from the browser.
// The OTel HTTP instrumentation automatically:
// 1. Checks for incoming traceparent header
// 2. If missing → creates new root span with new trace_id
// 3. If present → creates child span, inherits trace_id
// 4. Sets outgoing traceparent header on all outbound HTTP calls
```

### 4.3 How Spans Are Created

Each service operation creates a span. Auto-instrumentation creates spans for:
- HTTP server requests (Express middleware)
- HTTP client requests (outgoing HTTP calls)
- PostgreSQL queries (`pg` library instrumentation)
- Redis commands (`redis` library instrumentation)

For operations NOT captured by auto-instrumentation, we create manual spans:

```typescript
// packages/simulated-backend/services/order-service/src/order.handler.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

export async function createOrder(req: any, res: any) {
  // Auto-instrumentation already created an HTTP span.
  // We add a child span for the business logic.
  return tracer.startActiveSpan('order.process', async (span) => {
    try {
      span.setAttribute('order.user_id', req.body.userId);
      span.setAttribute('order.item_count', req.body.items.length);
      
      // Check cache — auto-instrumented by redis instrumentation
      const cart = await redis.get(`cart:${req.body.sessionId}`);
      
      // Database insert — auto-instrumented by pg instrumentation
      const order = await db.query(
        'INSERT INTO orders (user_id, items, status) VALUES ($1, $2, $3) RETURNING *',
        [req.body.userId, JSON.stringify(req.body.items), 'pending']
      );
      
      span.setAttribute('order.id', order.rows[0].id);
      span.setStatus({ code: SpanStatusCode.OK });
      return res.status(201).json(order.rows[0]);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      span.end();
    }
  });
}
```

### 4.4 How Spans Propagate Across Services

Context propagation uses the W3C Trace Context standard via HTTP headers:

```typescript
// Service A (API Gateway) → Service B (Auth Service)
// OTel HTTP instrumentation automatically injects these headers:

// Outgoing request from Gateway:
// POST /auth/verify HTTP/1.1
// Host: auth-service:3001
// traceparent: 00-5b8efff798038103d269b633813fc60c-aaa111bbb222ccc3-01
// tracestate: vendor=value

// Incoming request at Auth Service:
// OTel HTTP instrumentation extracts traceparent
// Creates child span with parent_id = aaa111bbb222ccc3
// trace_id = 5b8efff798038103d269b633813fc60c (inherited)
```

### 4.5 How Logs Are Correlated

Logs are correlated to traces via `trace_id` and `span_id` fields. We use the OTel Logs SDK and attach trace context to structured logs:

```typescript
// packages/simulated-backend/services/shared/logger.ts
import { trace, context } from '@opentelemetry/api';

export function createLogger(serviceName: string) {
  return {
    info(message: string, meta?: Record<string, any>) {
      const span = trace.getActiveSpan();
      const spanContext = span?.spanContext();
      
      console.log(JSON.stringify({
        level: 'info',
        message,
        service: serviceName,
        trace_id: spanContext?.traceId || null,
        span_id: spanContext?.spanId || null,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    },
    
    error(message: string, error?: Error, meta?: Record<string, any>) {
      const span = trace.getActiveSpan();
      const spanContext = span?.spanContext();
      
      console.error(JSON.stringify({
        level: 'error',
        message,
        service: serviceName,
        trace_id: spanContext?.traceId || null,
        span_id: spanContext?.spanId || null,
        timestamp: new Date().toISOString(),
        error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
        ...meta,
      }));
    },
  };
}
```

The OTel Collector receives these logs via the OTLP Logs protocol and our DevTools server correlates them by matching `trace_id`.

### 4.6 How Services Are Identified

Each service identifies itself via OTel Resource attributes:

```typescript
// Each service is initialized with:
const resource = new Resource({
  [ATTR_SERVICE_NAME]: 'order-service',
  [ATTR_SERVICE_VERSION]: '1.0.0',
  'deployment.environment': 'hackathon-demo',
  'service.instance.id': `order-service-${process.env.INSTANCE_ID}`,
});
```

The OTel Collector receives spans tagged with these resource attributes, allowing our DevTools server to:
- Identify which service created each span
- Build the service topology
- Group logs by service

### 4.7 How SQL Queries Are Captured

The `@opentelemetry/instrumentation-pg` package automatically instruments the `pg` library:

```typescript
// The pg instrumentation automatically creates spans with:
// - db.system: "postgresql"
// - db.statement: "INSERT INTO orders (user_id, items, status) VALUES ($1, $2, $3) RETURNING *"
// - db.operation: "INSERT"
// - db.sql.table: "orders"
// - db.user: "app_user"
// - db.name: "ecommerce"
// - net.peer.name: "postgres:5432"
// - http.request.method: (not applicable for DB spans)

// Our DevTools server extracts these attributes to build the "DB Queries" tab.
```

### 4.8 How External HTTP Requests Are Captured

The `@opentelemetry/instrumentation-http` package automatically instruments outbound HTTP calls:

```typescript
// When Payment Service calls Mock Payment API:
// OTel HTTP client instrumentation creates a span with:
// - http.request.method: "POST"
// - url.full: "http://mock-payment-api:4000/charges"
// - http.response.status_code: 200
// - http.response.body.size: 256
// - http.duration: 145ms
// - server.address: "mock-payment-api"
// - server.port: 4000

// Our DevTools server identifies spans where server.address is NOT
// one of our known internal services → classified as "External API call"
```

### 4.9 How Errors Are Captured

Errors are captured via span status and span events:

```typescript
// When an error occurs in a service:
try {
  await processPayment(order);
} catch (error) {
  // 1. Set span status to ERROR
  span.setStatus({ 
    code: SpanStatusCode.ERROR, 
    message: error.message 
  });
  
  // 2. Record the exception as a span event
  span.recordException(error);
  
  // 3. Log the error with trace context
  logger.error('Payment processing failed', error, { orderId: order.id });
}

// The span now contains:
// - status.code: ERROR
// - status.message: "Payment declined"
// - events: [{ name: "exception", attributes: { "exception.type": "PaymentError", "exception.message": "Payment declined" } }]
```

### 4.10 How Latency Is Captured

Latency is captured automatically by OTel as span duration:

```typescript
// Every span records:
// - startTime: [seconds, nanoseconds] (performance.now())
// - endTime: [seconds, nanoseconds]
// - duration = endTime - startTime (calculated by OTel SDK)

// The HTTP instrumentation also captures:
// - http.duration (explicit metric)
// - http.request.time_to_first_byte (for server spans)

// Our DevTools server uses span.duration for waterfall rendering.
```

### 4.11 How Secrets Are Redacted

Secrets are redacted at the OTel Collector level before reaching our storage:

```yaml
# otel-collector-config.yaml
processors:
  attributes:
    actions:
      # Redact sensitive HTTP headers
      - key: http.request.header.authorization
        action: hash
      - key: http.request.header.cookie
        action: hash
      # Redact SQL parameter values (keep structure)
      - key: db.statement
        action: update
        value: "REDACTED_PARAMETERS"
        # Only for known sensitive tables
      # Redact request bodies containing PII
      - key: http.request.body
        action: hash
      
  # Optional: Use the transform processor for more complex redaction
  transform:
    statements:
      - set(attributes["http.request.header.authorization"], "**REDACTED**") 
        where attributes["http.request.header.authorization"] != nil
      - set(attributes["http.request.header.x-api-key"], "**REDACTED**") 
        where attributes["http.request.header.x-api-key"] != nil
```

Additionally, our DevTools server performs a second pass of redaction before storing:

```typescript
// packages/devtools-server/src/services/redactor.ts
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
const SENSITIVE_BODY_FIELDS = ['password', 'token', 'secret', 'credit_card', 'ssn'];

export function redactSpanAttributes(attributes: Record<string, any>): Record<string, any> {
  const redacted = { ...attributes };
  
  for (const key of Object.keys(redacted)) {
    // Redact sensitive headers
    if (SENSITIVE_HEADERS.some(h => key.toLowerCase().includes(h))) {
      redacted[key] = '**REDACTED**';
    }
    
    // Redact sensitive body fields
    if (key.includes('body') && typeof redacted[key] === 'string') {
      try {
        const body = JSON.parse(redacted[key]);
        for (const field of SENSITIVE_BODY_FIELDS) {
          if (body[field]) body[field] = '***';
        }
        redacted[key] = JSON.stringify(body);
      } catch {
        // Not JSON, leave as-is
      }
    }
  }
  
  return redacted;
}
```

---

## 5. Trace Model

### 5.1 Entity Relationship Diagram

```mermaid
erDiagram
    TRACE ||--o{ SPAN : contains
    TRACE ||--o{ LOG_EVENT : has
    TRACE ||--o{ REPLAY_SESSION : replays
    SPAN ||--o{ SPAN : parent_child
    SPAN ||--o{ SPAN_EVENT : has
    SPAN }o--|| SERVICE : belongs_to
    SERVICE ||--o{ SERVICE_DEPENDENCY : has
    
    TRACE {
        uuid id PK "trace_id from OTel"
        varchar name "root operation name"
        varchar root_service "service that started trace"
        bigint start_time "trace start (unix ms)"
        bigint end_time "trace end (unix ms)"
        int duration_ms "total duration"
        varchar status "ok|error|unset"
        varchar method "HTTP method (for root span)"
        varchar path "URL path (for root span)"
        int status_code "HTTP status (for root span)"
        jsonb request_headers "redacted headers"
        jsonb request_body "redacted body"
        jsonb response_headers "response headers"
        jsonb response_body "response body"
        int response_size "response body size"
        jsonb services "unique services in trace"
        jsonb metadata "additional context"
        timestamp created_at "insertion time"
    }
    
    SPAN {
        uuid id PK "span_id from OTel"
        uuid trace_id FK "references trace"
        uuid parent_span_id FK "parent span (nullable for root)"
        varchar service_name "which service"
        varchar operation_name "span name"
        varchar span_type "server|client|producer|consumer|internal"
        bigint start_time "span start (unix ms)"
        bigint end_time "span end (unix ms)"
        int duration_ms "span duration"
        varchar status "ok|error|unset"
        varchar status_message "error message if any"
        jsonb attributes "span-specific attributes"
        int depth "nesting depth in waterfall"
        int order "ordering for waterfall display"
    }
    
    SPAN_EVENT {
        uuid id PK "auto-increment"
        uuid span_id FK "references span"
        varchar event_name "e.g., exception"
        bigint timestamp "event time (unix ms)"
        jsonb attributes "event-specific attributes"
    }
    
    LOG_EVENT {
        uuid id PK "auto-increment"
        uuid trace_id FK "references trace (nullable)"
        varchar service_name "which service"
        varchar level "info|warn|error|debug"
        varchar message "log message"
        jsonb attributes "additional log fields"
        bigint timestamp "log time (unix ms)"
    }
    
    SERVICE {
        varchar name PK "service name"
        varchar version "service version"
        varchar environment "hackathon-demo"
        int request_count "total requests seen"
        int error_count "total errors seen"
        decimal avg_duration_ms "running average"
        timestamp last_seen "last activity"
        timestamp first_seen "first activity"
    }
    
    SERVICE_DEPENDENCY {
        uuid id PK "auto-increment"
        varchar source_service FK "caller"
        varchar target_service FK "callee"
        varchar dependency_type "http|database|cache|external"
        int request_count "calls observed"
        int error_count "errors observed"
        decimal avg_duration_ms "average call duration"
        varchar protocol "http|grpc|sql|redis"
    }
    
    REPLAY_SESSION {
        uuid id PK "replay session ID"
        uuid original_trace_id FK "references original trace"
        uuid replay_trace_id FK "references replay trace"
        varchar status "pending|running|completed|failed"
        jsonb request_snapshot "captured request data"
        jsonb overrides "user-provided overrides"
        bigint original_duration_ms "original request duration"
        bigint replay_duration_ms "replay request duration"
        timestamp created_at "replay creation time"
        timestamp completed_at "replay completion time"
    }
```

### 5.2 Example Records

**Trace Record:**
```json
{
  "id": "5b8efff798038103d269b633813fc60c",
  "name": "POST /api/orders",
  "root_service": "api-gateway",
  "start_time": 1725345600000,
  "end_time": 1725345601234,
  "duration_ms": 1234,
  "status": "ok",
  "method": "POST",
  "path": "/api/orders",
  "status_code": 201,
  "request_headers": {
    "content-type": "application/json",
    "authorization": "**REDACTED**",
    "x-request-id": "req-abc-123"
  },
  "request_body": "{\"userId\": \"user-42\", \"items\": [{\"id\": \"item-1\", \"qty\": 2}]}",
  "response_headers": { "content-type": "application/json" },
  "response_body": "{\"id\": \"order-789\", \"status\": \"pending\"}",
  "response_size": 256,
  "services": ["api-gateway", "auth-service", "order-service", "payment-service"],
  "metadata": {},
  "created_at": "2026-09-03T12:00:01.234Z"
}
```

**Span Record:**
```json
{
  "id": "eee19b7ec3c1b174",
  "trace_id": "5b8efff798038103d269b633813fc60c",
  "parent_span_id": "abc123def456",
  "service_name": "payment-service",
  "operation_name": "POST /charges",
  "span_type": "server",
  "start_time": 1725345600800,
  "end_time": 1725345601050,
  "duration_ms": 250,
  "status": "ok",
  "status_message": null,
  "attributes": {
    "http.method": "POST",
    "http.url": "http://mock-payment-api:4000/charges",
    "http.status_code": 200,
    "payment.amount": 4999,
    "payment.currency": "USD",
    "payment.provider": "mock-stripe"
  },
  "depth": 3,
  "order": 4
}
```

**Log Event Record:**
```json
{
  "id": 1001,
  "trace_id": "5b8efff798038103d269b633813fc60c",
  "service_name": "order-service",
  "level": "info",
  "message": "Order created successfully",
  "attributes": {
    "order_id": "order-789",
    "user_id": "user-42",
    "item_count": 1,
    "total_amount": 4999
  },
  "timestamp": 1725345600950
}
```

---

## 6. Database Schema

### 6.1 PostgreSQL Schema

```sql
-- Migration 001: Initial Schema
-- File: packages/devtools-server/src/db/migrations/001_initial.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TRACES
-- ============================================
CREATE TABLE traces (
    id              VARCHAR(64) PRIMARY KEY,      -- trace_id from OTel (hex string)
    name            VARCHAR(255) NOT NULL,         -- root operation name
    root_service    VARCHAR(128) NOT NULL,         -- service that started the trace
    start_time      BIGINT NOT NULL,               -- trace start (unix milliseconds)
    end_time        BIGINT NOT NULL,               -- trace end (unix milliseconds)
    duration_ms     INTEGER GENERATED ALWAYS AS (end_time - start_time) STORED,
    status          VARCHAR(16) NOT NULL DEFAULT 'ok',  -- ok | error | unset
    method          VARCHAR(16),                   -- HTTP method (root span)
    path            VARCHAR(1024),                 -- URL path (root span)
    status_code     INTEGER,                       -- HTTP status (root span)
    request_headers JSONB DEFAULT '{}',            -- redacted request headers
    request_body    TEXT,                          -- redacted request body
    response_headers JSONB DEFAULT '{}',           -- response headers
    response_body   TEXT,                          -- response body
    response_size   INTEGER,                       -- response body size in bytes
    services        JSONB DEFAULT '[]',            -- ["api-gateway", "auth-service", ...]
    metadata        JSONB DEFAULT '{}',            -- additional context
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_traces_root_service ON traces(root_service);
CREATE INDEX idx_traces_status ON traces(status);
CREATE INDEX idx_traces_method ON traces(method);
CREATE INDEX idx_traces_start_time ON traces(start_time DESC);
CREATE INDEX idx_traces_created_at ON traces(created_at DESC);
CREATE INDEX idx_traces_status_code ON traces(status_code);
CREATE INDEX idx_traces_services ON traces USING GIN(services);
CREATE INDEX idx_traces_path ON traces(path);

-- Full-text search on path and name
CREATE INDEX idx_traces_search ON traces 
    USING GIN(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(path, '')));

-- ============================================
-- SPANS
-- ============================================
CREATE TABLE spans (
    id              VARCHAR(64) PRIMARY KEY,       -- span_id from OTel (hex string)
    trace_id        VARCHAR(64) NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    parent_span_id  VARCHAR(64),                   -- parent span (nullable for root)
    service_name    VARCHAR(128) NOT NULL,         -- which service
    operation_name  VARCHAR(512) NOT NULL,         -- span name
    span_type       VARCHAR(32) NOT NULL,          -- server | client | producer | consumer | internal
    start_time      BIGINT NOT NULL,               -- span start (unix ms)
    end_time        BIGINT NOT NULL,               -- span end (unix ms)
    duration_ms     INTEGER GENERATED ALWAYS AS (end_time - start_time) STORED,
    status          VARCHAR(16) NOT NULL DEFAULT 'ok',  -- ok | error | unset
    status_message  TEXT,                          -- error message if any
    attributes      JSONB DEFAULT '{}',            -- span-specific attributes
    depth           INTEGER DEFAULT 0,             -- nesting depth
    "order"         INTEGER DEFAULT 0              -- ordering for waterfall
);

CREATE INDEX idx_spans_trace_id ON spans(trace_id);
CREATE INDEX idx_spans_parent_span_id ON spans(parent_span_id);
CREATE INDEX idx_spans_service_name ON spans(service_name);
CREATE INDEX idx_spans_status ON spans(status);
CREATE INDEX idx_spans_span_type ON spans(span_type);
CREATE INDEX idx_spans_trace_service ON spans(trace_id, service_name);
CREATE INDEX idx_spans_start_time ON spans(start_time);
CREATE INDEX idx_spans_attributes ON spans USING GIN(attributes);

-- ============================================
-- SPAN EVENTS
-- ============================================
CREATE TABLE span_events (
    id              SERIAL PRIMARY KEY,
    span_id         VARCHAR(64) NOT NULL REFERENCES spans(id) ON DELETE CASCADE,
    event_name      VARCHAR(255) NOT NULL,         -- e.g., "exception"
    "timestamp"     BIGINT NOT NULL,               -- event time (unix ms)
    attributes      JSONB DEFAULT '{}'
);

CREATE INDEX idx_span_events_span_id ON span_events(span_id);

-- ============================================
-- LOG EVENTS
-- ============================================
CREATE TABLE log_events (
    id              SERIAL PRIMARY KEY,
    trace_id        VARCHAR(64) REFERENCES traces(id) ON DELETE SET NULL,
    service_name    VARCHAR(128) NOT NULL,
    "level"         VARCHAR(16) NOT NULL,           -- info | warn | error | debug
    message         TEXT NOT NULL,
    attributes      JSONB DEFAULT '{}',
    "timestamp"     BIGINT NOT NULL,               -- log time (unix ms)
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_log_events_trace_id ON log_events(trace_id);
CREATE INDEX idx_log_events_service_name ON log_events(service_name);
CREATE INDEX idx_log_events_level ON log_events(level);
CREATE INDEX idx_log_events_timestamp ON log_events("timestamp" DESC);
CREATE INDEX idx_log_events_trace_service ON log_events(trace_id, service_name);
CREATE INDEX idx_log_events_message ON log_events USING GIN(to_tsvector('english', message));

-- ============================================
-- SERVICES
-- ============================================
CREATE TABLE services (
    name            VARCHAR(128) PRIMARY KEY,
    version         VARCHAR(64) DEFAULT '1.0.0',
    environment     VARCHAR(64) DEFAULT 'hackathon-demo',
    request_count   INTEGER DEFAULT 0,
    error_count     INTEGER DEFAULT 0,
    avg_duration_ms NUMERIC(10,2) DEFAULT 0,
    last_seen       TIMESTAMPTZ,
    first_seen      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SERVICE DEPENDENCIES
-- ============================================
CREATE TABLE service_dependencies (
    id              SERIAL PRIMARY KEY,
    source_service  VARCHAR(128) NOT NULL REFERENCES services(name),
    target_service  VARCHAR(128) NOT NULL REFERENCES services(name),
    dependency_type VARCHAR(32) NOT NULL,          -- http | database | cache | external
    request_count   INTEGER DEFAULT 0,
    error_count     INTEGER DEFAULT 0,
    avg_duration_ms NUMERIC(10,2) DEFAULT 0,
    protocol        VARCHAR(32),                   -- http | grpc | sql | redis
    
    UNIQUE(source_service, target_service, dependency_type)
);

CREATE INDEX idx_service_deps_source ON service_dependencies(source_service);
CREATE INDEX idx_service_deps_target ON service_dependencies(target_service);

-- ============================================
-- REPLAY SESSIONS
-- ============================================
CREATE TABLE replay_sessions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_trace_id     VARCHAR(64) NOT NULL REFERENCES traces(id),
    replay_trace_id       VARCHAR(64) REFERENCES traces(id),
    status                VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
    request_snapshot      JSONB NOT NULL,           -- captured request data
    overrides             JSONB DEFAULT '{}',       -- user-provided overrides
    original_duration_ms  INTEGER,                  -- original request duration
    replay_duration_ms    INTEGER,                  -- replay request duration
    error_message         TEXT,                     -- error if replay failed
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_replay_sessions_original ON replay_sessions(original_trace_id);
CREATE INDEX idx_replay_sessions_status ON replay_sessions(status);
CREATE INDEX idx_replay_sessions_created ON replay_sessions(created_at DESC);

-- ============================================
-- VIEWS (convenience)
-- ============================================

-- Request summary view (used by Request Explorer)
CREATE VIEW request_summary AS
SELECT 
    t.id AS trace_id,
    t.method,
    t.path,
    t.status_code,
    t.status,
    t.duration_ms,
    t.root_service,
    t.services,
    t.start_time,
    t.created_at,
    (SELECT COUNT(*) FROM spans s WHERE s.trace_id = t.id) AS span_count,
    (SELECT COUNT(*) FROM log_events l WHERE l.trace_id = t.id) AS log_count,
    (SELECT COUNT(*) FROM log_events l WHERE l.trace_id = t.id AND l."level" = 'error') AS error_count
FROM traces t
ORDER BY t.start_time DESC;
```

### 6.2 Retention Considerations

For the hackathon, we keep all data. In production:

| Data | Retention | Rationale |
|------|-----------|-----------|
| traces | 7 days | Older traces rarely needed for debugging |
| spans | 7 days | Cascading delete with traces |
| log_events | 7 days | Correlated with traces |
| span_events | 7 days | Cascading delete with spans |
| services | Permanent | Reference data |
| service_dependencies | Permanent | Reference data |
| replay_sessions | 30 days | May need to revisit replays |

---

## 7. API Specification

### 7.1 REST API

All endpoints are prefixed with `/api/v1`. Responses use JSON. Errors follow RFC 7807 Problem Details format.

#### Requests

```
GET /api/v1/requests
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 25 | Items per page (max 100) |
| `method` | string | — | Filter by HTTP method (GET, POST, etc.) |
| `status` | string | — | Filter by status (ok, error, unset) |
| `status_code` | integer | — | Filter by HTTP status code |
| `service` | string | — | Filter by service name |
| `path` | string | — | Filter by path (partial match) |
| `search` | string | — | Full-text search across path, name |
| `from` | integer | — | Start time (unix ms) |
| `to` | integer | — | End time (unix ms) |
| `min_duration` | integer | — | Minimum duration (ms) |
| `max_duration` | integer | — | Maximum duration (ms) |
| `sort` | string | `start_time` | Sort field |
| `order` | string | `desc` | Sort order (asc, desc) |

**Response:**
```json
{
  "requests": [
    {
      "trace_id": "5b8efff798038103d269b633813fc60c",
      "method": "POST",
      "path": "/api/orders",
      "status_code": 201,
      "status": "ok",
      "duration_ms": 1234,
      "root_service": "api-gateway",
      "services": ["api-gateway", "auth-service", "order-service", "payment-service"],
      "span_count": 8,
      "log_count": 3,
      "error_count": 0,
      "start_time": 1725345600000,
      "created_at": "2026-09-03T12:00:01.234Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "pages": 6
  }
}
```

---

```
GET /api/v1/requests/:traceId
```

**Response:**
```json
{
  "trace": {
    "id": "5b8efff798038103d269b633813fc60c",
    "name": "POST /api/orders",
    "root_service": "api-gateway",
    "start_time": 1725345600000,
    "end_time": 1725345601234,
    "duration_ms": 1234,
    "status": "ok",
    "method": "POST",
    "path": "/api/orders",
    "status_code": 201,
    "request_headers": { "content-type": "application/json", "authorization": "**REDACTED**" },
    "request_body": "{\"userId\": \"user-42\", \"items\": [{\"id\": \"item-1\", \"qty\": 2}]}",
    "response_headers": { "content-type": "application/json" },
    "response_body": "{\"id\": \"order-789\", \"status\": \"pending\"}",
    "response_size": 256,
    "services": ["api-gateway", "auth-service", "order-service", "payment-service"],
    "metadata": {}
  },
  "spans": [
    {
      "id": "root-span-001",
      "trace_id": "5b8efff798038103d269b633813fc60c",
      "parent_span_id": null,
      "service_name": "api-gateway",
      "operation_name": "POST /api/orders",
      "span_type": "server",
      "start_time": 1725345600000,
      "end_time": 1725345601234,
      "duration_ms": 1234,
      "status": "ok",
      "attributes": {},
      "depth": 0,
      "order": 0
    }
  ],
  "logs": [
    {
      "id": 1001,
      "trace_id": "5b8efff798038103d269b633813fc60c",
      "service_name": "order-service",
      "level": "info",
      "message": "Order created successfully",
      "attributes": { "order_id": "order-789" },
      "timestamp": 1725345600950
    }
  ],
  "db_queries": [
    {
      "span_id": "db-span-001",
      "operation": "INSERT",
      "table": "orders",
      "statement": "INSERT INTO orders (user_id, items, status) VALUES ($1, $2, $3) RETURNING *",
      "duration_ms": 45,
      "status": "ok",
      "service_name": "order-service"
    }
  ],
  "external_calls": [
    {
      "span_id": "ext-span-001",
      "method": "POST",
      "url": "http://mock-payment-api:4000/charges",
      "status_code": 200,
      "duration_ms": 250,
      "status": "ok",
      "service_name": "payment-service"
    }
  ]
}
```

---

#### Traces

```
GET /api/v1/traces/:traceId/waterfall
```

**Response:**
```json
{
  "trace_id": "5b8efff798038103d269b633813fc60c",
  "total_duration_ms": 1234,
  "spans": [
    {
      "id": "root-span-001",
      "parent_span_id": null,
      "service_name": "api-gateway",
      "operation_name": "POST /api/orders",
      "span_type": "server",
      "start_time": 1725345600000,
      "end_time": 1725345601234,
      "duration_ms": 1234,
      "status": "ok",
      "depth": 0,
      "order": 0,
      "start_offset_ms": 0,
      "percentage_of_total": 100
    },
    {
      "id": "auth-span-001",
      "parent_span_id": "root-span-001",
      "service_name": "auth-service",
      "operation_name": "POST /auth/verify",
      "span_type": "server",
      "start_time": 1725345600050,
      "end_time": 1725345600162,
      "duration_ms": 112,
      "status": "ok",
      "depth": 1,
      "order": 1,
      "start_offset_ms": 50,
      "percentage_of_total": 9.1
    }
  ]
}
```

---

```
GET /api/v1/traces/:traceId/logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | string | Filter by log level |
| `service` | string | Filter by service |
| `search` | string | Full-text search on message |

**Response:**
```json
{
  "trace_id": "5b8efff798038103d269b633813fc60c",
  "logs": [...],
  "total": 3
}
```

---

#### Replay

```
POST /api/v1/replay
```

**Request:**
```json
{
  "original_trace_id": "5b8efff798038103d269b633813fc60c",
  "overrides": {
    "path": null,
    "headers": {},
    "body": null
  }
}
```

**Response:**
```json
{
  "replay_session": {
    "id": "replay-uuid-1234",
    "original_trace_id": "5b8efff798038103d269b633813fc60c",
    "replay_trace_id": null,
    "status": "pending",
    "created_at": "2026-09-03T12:00:00.000Z"
  }
}
```

---

```
GET /api/v1/replay/:replayId
```

**Response:**
```json
{
  "replay_session": {
    "id": "replay-uuid-1234",
    "original_trace_id": "5b8efff798038103d269b633813fc60c",
    "replay_trace_id": "6c9fgg0849049214e370c744924ed71d",
    "status": "completed",
    "original_duration_ms": 1234,
    "replay_duration_ms": 1180,
    "created_at": "2026-09-03T12:00:00.000Z",
    "completed_at": "2026-09-03T12:00:02.500Z"
  }
}
```

---

#### Comparison

```
POST /api/v1/compare
```

**Request:**
```json
{
  "trace_id_a": "5b8efff798038103d269b633813fc60c",
  "trace_id_b": "6c9fgg0849049214e370c744924ed71d"
}
```

**Response:**
```json
{
  "comparison": {
    "trace_a": {
      "trace_id": "5b8efff798038103d269b633813fc60c",
      "total_duration_ms": 1234,
      "status": "ok",
      "status_code": 201,
      "services": ["api-gateway", "auth-service", "order-service", "payment-service"]
    },
    "trace_b": {
      "trace_id": "6c9fgg0849049214e370c744924ed71d",
      "total_duration_ms": 1180,
      "status": "ok",
      "status_code": 201,
      "services": ["api-gateway", "auth-service", "order-service", "payment-service"]
    },
    "duration_diff_ms": -54,
    "duration_diff_percentage": -4.4,
    "status_match": true,
    "status_code_match": true,
    "service_diff": {
      "added": [],
      "removed": [],
      "unchanged": ["api-gateway", "auth-service", "order-service", "payment-service"]
    },
    "span_diff": {
      "total_spans_a": 8,
      "total_spans_b": 8,
      "matched": 8,
      "unmatched_a": 0,
      "unmatched_b": 0,
      "details": [
        {
          "operation_name": "POST /charges",
          "service_name": "payment-service",
          "duration_a_ms": 250,
          "duration_b_ms": 198,
          "diff_ms": -52,
          "status_a": "ok",
          "status_b": "ok",
          "status_match": true
        }
      ]
    },
    "db_query_diff": {
      "queries_a": 2,
      "queries_b": 2,
      "matched": 2,
      "details": []
    }
  }
}
```

---

#### Topology

```
GET /api/v1/topology
```

**Response:**
```json
{
  "nodes": [
    { "id": "api-gateway", "label": "API Gateway", "type": "service", "request_count": 50, "error_count": 2, "avg_duration_ms": 1200 },
    { "id": "auth-service", "label": "Auth Service", "type": "service", "request_count": 50, "error_count": 0, "avg_duration_ms": 112 },
    { "id": "order-service", "label": "Order Service", "type": "service", "request_count": 48, "error_count": 1, "avg_duration_ms": 800 },
    { "id": "payment-service", "label": "Payment Service", "type": "service", "request_count": 45, "error_count": 3, "avg_duration_ms": 350 },
    { "id": "postgresql", "label": "PostgreSQL", "type": "database", "request_count": 96, "error_count": 1, "avg_duration_ms": 15 },
    { "id": "redis", "label": "Redis", "type": "cache", "request_count": 48, "error_count": 0, "avg_duration_ms": 2 },
    { "id": "mock-payment-api", "label": "Mock Payment API", "type": "external", "request_count": 45, "error_count": 3, "avg_duration_ms": 300 }
  ],
  "edges": [
    { "source": "api-gateway", "target": "auth-service", "type": "http", "request_count": 50, "error_count": 0, "avg_duration_ms": 112 },
    { "source": "api-gateway", "target": "order-service", "type": "http", "request_count": 48, "error_count": 1, "avg_duration_ms": 800 },
    { "source": "order-service", "target": "payment-service", "type": "http", "request_count": 45, "error_count": 3, "avg_duration_ms": 350 },
    { "source": "order-service", "target": "postgresql", "type": "database", "request_count": 96, "error_count": 1, "avg_duration_ms": 15 },
    { "source": "order-service", "target": "redis", "type": "cache", "request_count": 48, "error_count": 0, "avg_duration_ms": 2 },
    { "source": "payment-service", "target": "mock-payment-api", "type": "external", "request_count": 45, "error_count": 3, "avg_duration_ms": 300 },
    { "source": "payment-service", "target": "postgresql", "type": "database", "request_count": 45, "error_count": 0, "avg_duration_ms": 10 }
  ]
}
```

---

### 7.2 Error Response Format

```json
{
  "error": {
    "type": "https://api.devtools.local/errors/not-found",
    "title": "Trace Not Found",
    "status": 404,
    "detail": "No trace found with ID: abc123"
  }
}
```

### 7.3 Authentication

**For hackathon:** No authentication. All endpoints are open.

**For production:** Local-only access (localhost). Optional API key for remote deployment.

---

## 8. WebSocket Specification

### 8.1 Connection

```
ws://localhost:4001/ws
```

No authentication required (hackathon).

### 8.2 Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe_requests` | `{}` | Subscribe to new request updates |
| `unsubscribe_requests` | `{}` | Unsubscribe from request updates |
| `subscribe_trace` | `{ traceId: string }` | Subscribe to updates for a specific trace |
| `unsubscribe_trace` | `{ traceId: string }` | Unsubscribe from trace updates |
| `start_replay` | `{ requestId: string, overrides?: object }` | Start replaying a request |
| `ping` | `{}` | Keepalive ping |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new_request` | `{ trace_id, method, path, status_code, status, duration_ms, root_service, services, start_time }` | New request captured |
| `trace_update` | `{ trace_id, spans: [...], logs: [...] }` | Trace data updated (new spans added) |
| `replay_progress` | `{ replay_id, step: string, status: "pending"\|"running"\|"completed"\|"failed" }` | Replay progress update |
| `replay_complete` | `{ replay_id, original_trace_id, replay_trace_id, status, duration_ms }` | Replay completed |
| `service_update` | `{ service_name, request_count, error_count, avg_duration_ms }` | Service health update |
| `pong` | `{}` | Keepalive response |
| `error` | `{ message: string, code: string }` | Error occurred |

### 8.3 Reconnect Behavior

```typescript
// Client-side reconnection logic
class WebSocketClient {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1 second

  connect() {
    this.ws = new WebSocket('ws://localhost:4001/ws');
    
    this.ws.onclose = (event) => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
        const jitter = Math.random() * delay * 0.1;
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay + jitter);
      }
    };
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // Reset on successful connection
    };
  }
}
```

### 8.4 Ordering

Events are not guaranteed to be ordered. The client should use `start_time` to order requests and `trace_id` to group updates.

### 8.5 Duplicate Handling

Events may be duplicated. The client should use `trace_id` as a unique key and ignore duplicates (last-write-wins).

### 8.6 Error Handling

The server sends error events for recoverable errors. For fatal errors, the connection is closed with a close code:

| Close Code | Reason |
|-----------|--------|
| 1000 | Normal closure |
| 1001 | Server shutting down |
| 1008 | Policy violation |
| 1011 | Internal server error |

---

## 9. Replay Architecture

### 9.1 What Is Captured

When a request is observed by the DevTools server, we capture:

| Data | Captured? | How |
|------|-----------|-----|
| HTTP method | ✅ | Span attribute: `http.request.method` |
| URL path | ✅ | Span attribute: `url.full` or `http.route` |
| Request headers | ✅ | Span attribute: `http.request.header.*` (redacted) |
| Request body | ✅ | Custom span attribute or log event |
| Query parameters | ✅ | Extracted from URL |
| Trace context | ✅ | `traceparent` header |
| All spans in trace | ✅ | Full trace tree |
| Log events | ✅ | Correlated by trace_id |
| Database queries | ✅ | Span attributes: `db.statement`, `db.operation` |
| External API calls | ✅ | HTTP client spans |
| Response status | ✅ | Span attribute: `http.response.status_code` |
| Response body | ✅ | Custom span attribute or log event |

### 9.2 What Is Stored

```typescript
interface RequestSnapshot {
  // Request data
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;  // redacted
  body: string | null;
  
  // Trace context
  trace_id: string;
  
  // Metadata
  service: string;           // target service (API Gateway)
  timestamp: number;         // when request was captured
  duration_ms: number;       // original request duration
  status_code: number;       // original response status
}
```

### 9.3 What Can Be Reproduced

| Aspect | Reproducible? | Notes |
|--------|--------------|-------|
| HTTP request (method, path, body) | ✅ | Exact replay |
| Request timing | ❌ | New execution has new timing |
| Database state | ⚠️ | Seeded to known state, not identical |
| External API responses | ✅ | Mocked, deterministic |
| Authentication | ✅ | Use same credentials |
| Timestamps | ⚠️ | May differ (clock skew, Date header) |
| Randomness | ⚠️ | UUIDs, nonces will differ |
| Concurrency | ❌ | Different execution context |
| Side effects | ⚠️ | Database writes will create new records |

### 9.4 What Cannot Be Reproduced

| Aspect | Why |
|--------|-----|
| Exact timing | Execution environment differs |
| Database state (exact) | Previous writes may have changed state |
| Network latency | Infrastructure timing varies |
| Connection pooling state | Ephemeral runtime state |
| File system state | Not captured by OTel |
| In-memory state | Not captured by OTel |

### 9.5 Safe Replay Environment

Our replay is safe because:

1. **Isolated database:** Replay operates against the same PostgreSQL but creates new records
2. **Idempotent external APIs:** Mock Payment API returns deterministic responses
3. **No side effects beyond DB writes:** No emails, no real payments, no file system changes
4. **Clean DB seed option:** Before replay, optionally reset DB to seed state
5. **New trace ID:** Each replay gets a unique trace ID, no collision with original

### 9.6 Replay Implementation

```typescript
// packages/devtools-server/src/services/replay.service.ts
import { randomUUID } from 'crypto';

interface ReplayResult {
  replay_id: string;
  original_trace_id: string;
  replay_trace_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  original_duration_ms: number;
  replay_duration_ms: number | null;
  error_message: string | null;
}

export class ReplayService {
  constructor(
    private traceRepo: TraceRepository,
    private replayRepo: ReplayRepository,
    private httpClient: HttpClient,
    private wsBroadcast: WebSocketBroadcast,
  ) {}

  async replay(request: {
    original_trace_id: string;
    overrides?: {
      path?: string;
      headers?: Record<string, string>;
      body?: string;
    };
  }): Promise<ReplayResult> {
    const replayId = randomUUID();
    
    // 1. Load original trace
    const originalTrace = await this.traceRepo.getTrace(request.original_trace_id);
    if (!originalTrace) {
      throw new NotFoundError(`Trace ${request.original_trace_id} not found`);
    }
    
    // 2. Extract request snapshot from original trace
    const snapshot = this.extractRequestSnapshot(originalTrace);
    
    // 3. Apply overrides
    const replayRequest = {
      ...snapshot,
      ...(request.overrides?.path && { path: request.overrides.path }),
      ...(request.overrides?.headers && { 
        headers: { ...snapshot.headers, ...request.overrides.headers } 
      }),
      ...(request.overrides?.body && { body: request.overrides.body }),
    };
    
    // 4. Store replay session
    await this.replayRepo.create({
      id: replayId,
      original_trace_id: request.original_trace_id,
      status: 'running',
      request_snapshot: replayRequest,
      overrides: request.overrides || {},
      original_duration_ms: originalTrace.duration_ms,
    });
    
    // 5. Broadcast progress
    this.wsBroadcast.send({
      type: 'replay_progress',
      data: { replay_id: replayId, step: 'executing', status: 'running' },
    });
    
    try {
      // 6. Re-execute the request against the simulated backend
      const startTime = Date.now();
      const response = await this.httpClient.request({
        method: replayRequest.method,
        url: `http://localhost:3000${replayRequest.path}`,
        headers: replayRequest.headers,
        body: replayRequest.body,
      });
      const duration_ms = Date.now() - startTime;
      
      // 7. Find the new trace created by the replay
      // Wait briefly for OTel to export the trace
      await this.sleep(500);
      
      // 8. Update replay session
      const replayTraceId = await this.findReplayTrace(replayRequest, startTime);
      
      await this.replayRepo.update(replayId, {
        status: 'completed',
        replay_trace_id: replayTraceId,
        replay_duration_ms: duration_ms,
        completed_at: new Date(),
      });
      
      // 9. Broadcast completion
      this.wsBroadcast.send({
        type: 'replay_complete',
        data: {
          replay_id: replayId,
          original_trace_id: request.original_trace_id,
          replay_trace_id: replayTraceId,
          status: 'completed',
          duration_ms,
        },
      });
      
      return {
        replay_id: replayId,
        original_trace_id: request.original_trace_id,
        replay_trace_id: replayTraceId,
        status: 'completed',
        original_duration_ms: originalTrace.duration_ms,
        replay_duration_ms: duration_ms,
        error_message: null,
      };
    } catch (error) {
      await this.replayRepo.update(replayId, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date(),
      });
      
      return {
        replay_id: replayId,
        original_trace_id: request.original_trace_id,
        replay_trace_id: null,
        status: 'failed',
        original_duration_ms: originalTrace.duration_ms,
        replay_duration_ms: null,
        error_message: error.message,
      };
    }
  }
  
  private extractRequestSnapshot(trace: Trace) {
    return {
      method: trace.method,
      path: trace.path,
      query: {},
      headers: trace.request_headers,
      body: trace.request_body,
      trace_id: trace.id,
      service: trace.root_service,
      timestamp: trace.start_time,
      duration_ms: trace.duration_ms,
      status_code: trace.status_code,
    };
  }
  
  private async findReplayTrace(
    request: any, 
    startTime: number
  ): Promise<string | null> {
    // Search for traces matching the replay request within a time window
    const traces = await this.traceRepo.findTraces({
      method: request.method,
      path: request.path,
      from: startTime - 1000,
      to: startTime + 5000,
    });
    // Return the trace closest to our replay start time
    return traces[0]?.id || null;
  }
  
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 9.7 Database Cleanup

For the hackathon, replay traces are stored alongside original traces. No cleanup needed.

For production, a scheduled job would clean up old replay sessions:

```sql
-- Cleanup old replays (production only)
DELETE FROM replay_sessions 
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 10. Comparison Architecture

### 10.1 Comparison Logic

```typescript
// packages/devtools-server/src/services/compare.service.ts

interface SpanMatch {
  operation_name: string;
  service_name: string;
  span_a: Span | null;
  span_b: Span | null;
  duration_diff_ms: number;
  status_match: boolean;
}

interface ComparisonResult {
  trace_a: TraceSummary;
  trace_b: TraceSummary;
  duration_diff_ms: number;
  duration_diff_percentage: number;
  status_match: boolean;
  status_code_match: boolean;
  service_diff: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  span_diff: {
    total_spans_a: number;
    total_spans_b: number;
    matched: number;
    unmatched_a: number;
    unmatched_b: number;
    details: SpanMatch[];
  };
  db_query_diff: {
    queries_a: number;
    queries_b: number;
    matched: number;
    details: any[];
  };
  external_call_diff: {
    calls_a: number;
    calls_b: number;
    matched: number;
    details: any[];
  };
}

export class CompareService {
  constructor(private traceRepo: TraceRepository) {}

  async compare(traceIdA: string, traceIdB: string): Promise<ComparisonResult> {
    const [traceA, traceB] = await Promise.all([
      this.traceRepo.getTraceWithSpans(traceIdA),
      this.traceRepo.getTraceWithSpans(traceIdB),
    ]);
    
    if (!traceA) throw new NotFoundError(`Trace ${traceIdA} not found`);
    if (!traceB) throw new NotFoundError(`Trace ${traceIdB} not found`);
    
    // 1. Duration comparison
    const durationDiff = traceB.duration_ms - traceA.duration_ms;
    const durationDiffPct = traceA.duration_ms > 0
      ? (durationDiff / traceA.duration_ms) * 100
      : 0;
    
    // 2. Status comparison
    const statusMatch = traceA.status === traceB.status;
    const statusCodeMatch = traceA.status_code === traceB.status_code;
    
    // 3. Service comparison
    const servicesA = new Set(traceA.services);
    const servicesB = new Set(traceB.services);
    const serviceDiff = {
      added: [...servicesB].filter(s => !servicesA.has(s)),
      removed: [...servicesA].filter(s => !servicesB.has(s)),
      unchanged: [...servicesA].filter(s => servicesB.has(s)),
    };
    
    // 4. Span matching (by operation_name + service_name)
    const spanDiff = this.matchSpans(traceA.spans, traceB.spans);
    
    // 5. DB query comparison
    const dbQueryDiff = this.compareDBQueries(traceA.spans, traceB.spans);
    
    // 6. External call comparison
    const externalCallDiff = this.compareExternalCalls(traceA.spans, traceB.spans);
    
    return {
      trace_a: this.summarizeTrace(traceA),
      trace_b: this.summarizeTrace(traceB),
      duration_diff_ms: durationDiff,
      duration_diff_percentage: durationDiffPct,
      status_match: statusMatch,
      status_code_match: statusCodeMatch,
      service_diff: serviceDiff,
      span_diff: spanDiff,
      db_query_diff: dbQueryDiff,
      external_call_diff: externalCallDiff,
    };
  }
  
  private matchSpans(spansA: Span[], spansB: Span[]): ComparisonResult['span_diff'] {
    const keyFor = (s: Span) => `${s.service_name}::${s.operation_name}`;
    
    const mapA = new Map(spansA.map(s => [keyFor(s), s]));
    const mapB = new Map(spansB.map(s => [keyFor(s), s]));
    
    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const details: SpanMatch[] = [];
    let matched = 0;
    let unmatchedA = 0;
    let unmatchedB = 0;
    
    for (const key of allKeys) {
      const spanA = mapA.get(key) || null;
      const spanB = mapB.get(key) || null;
      
      if (spanA && spanB) {
        matched++;
      } else if (spanA && !spanB) {
        unmatchedA++;
      } else {
        unmatchedB++;
      }
      
      details.push({
        operation_name: key.split('::')[1],
        service_name: key.split('::')[0],
        span_a: spanA,
        span_b: spanB,
        duration_diff_ms: (spanB?.duration_ms || 0) - (spanA?.duration_ms || 0),
        status_match: spanA?.status === spanB?.status,
      });
    }
    
    return {
      total_spans_a: spansA.length,
      total_spans_b: spansB.length,
      matched,
      unmatched_a: unmatchedA,
      unmatched_b: unmatchedB,
      details,
    };
  }
  
  private compareDBQueries(spansA: Span[], spansB: Span[]) {
    const dbSpansA = spansA.filter(s => s.span_type === 'client' && s.attributes?.['db.system']);
    const dbSpansB = spansB.filter(s => s.span_type === 'client' && s.attributes?.['db.system']);
    
    return {
      queries_a: dbSpansA.length,
      queries_b: dbSpansB.length,
      matched: Math.min(dbSpansA.length, dbSpansB.length),
      details: [], // Simplified for hackathon
    };
  }
  
  private compareExternalCalls(spansA: Span[], spansB: Span[]) {
    const extSpansA = spansA.filter(s => 
      s.span_type === 'client' && s.attributes?.['http.url']?.includes('external')
    );
    const extSpansB = spansB.filter(s => 
      s.span_type === 'client' && s.attributes?.['http.url']?.includes('external')
    );
    
    return {
      calls_a: extSpansA.length,
      calls_b: extSpansB.length,
      matched: Math.min(extSpansA.length, extSpansB.length),
      details: [],
    };
  }
  
  private summarizeTrace(trace: Trace): TraceSummary {
    return {
      trace_id: trace.id,
      total_duration_ms: trace.duration_ms,
      status: trace.status,
      status_code: trace.status_code,
      services: trace.services,
    };
  }
}
```

---

## 11. Service Topology

### 11.1 How Topology Is Derived from Traces

The service topology is derived from span relationships:

1. **Nodes** = unique `service_name` values across all spans
2. **Edges** = parent-child relationships between spans in different services

```typescript
export class TopologyService {
  constructor(private traceRepo: TraceRepository) {}

  async getTopology(options?: {
    trace_id?: string;  // Per-request topology (optional)
    from?: number;      // Time range start
    to?: number;        // Time range end
  }): Promise<TopologyResult> {
    const spans = options?.trace_id
      ? await this.traceRepo.getSpansByTrace(options.trace_id)
      : await this.traceRepo.getAllSpans(options?.from, options?.to);
    
    // Build nodes
    const serviceMap = new Map<string, ServiceNode>();
    
    for (const span of spans) {
      if (!serviceMap.has(span.service_name)) {
        serviceMap.set(span.service_name, {
          id: span.service_name,
          label: span.service_name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: this.getServiceType(span),
          request_count: 0,
          error_count: 0,
          avg_duration_ms: 0,
          total_duration_ms: 0,
        });
      }
      
      const node = serviceMap.get(span.service_name)!;
      node.request_count++;
      node.total_duration_ms += span.duration_ms;
      if (span.status === 'error') node.error_count++;
    }
    
    // Calculate averages
    for (const node of serviceMap.values()) {
      node.avg_duration_ms = Math.round(node.total_duration_ms / node.request_count);
      delete (node as any).total_duration_ms;
    }
    
    // Build edges
    const edgeMap = new Map<string, ServiceEdge>();
    
    for (const span of spans) {
      if (!span.parent_span_id) continue;
      
      const parentSpan = spans.find(s => s.id === span.parent_span_id);
      if (!parentSpan) continue;
      if (parentSpan.service_name === span.service_name) continue; // Same service
      
      const edgeKey = `${parentSpan.service_name}->${span.service_name}`;
      
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          source: parentSpan.service_name,
          target: span.service_name,
          type: this.getDependencyType(span),
          request_count: 0,
          error_count: 0,
          avg_duration_ms: 0,
          total_duration_ms: 0,
          protocol: this.getProtocol(span),
        });
      }
      
      const edge = edgeMap.get(edgeKey)!;
      edge.request_count++;
      edge.total_duration_ms += span.duration_ms;
      if (span.status === 'error') edge.error_count++;
    }
    
    // Calculate averages
    for (const edge of edgeMap.values()) {
      edge.avg_duration_ms = Math.round(edge.total_duration_ms / edge.request_count);
      delete (edge as any).total_duration_ms;
    }
    
    return {
      nodes: [...serviceMap.values()],
      edges: [...edgeMap.values()],
    };
  }
  
  private getServiceType(span: Span): string {
    if (span.attributes?.['db.system']) return 'database';
    if (span.attributes?.['net.peer.name']?.includes('redis')) return 'cache';
    if (span.span_type === 'client' && span.attributes?.['http.url']?.includes('external')) return 'external';
    return 'service';
  }
  
  private getDependencyType(span: Span): string {
    if (span.attributes?.['db.system']) return 'database';
    if (span.attributes?.['net.peer.name']?.includes('redis')) return 'cache';
    if (span.span_type === 'client') return 'external';
    return 'http';
  }
  
  private getProtocol(span: Span): string {
    if (span.attributes?.['db.system']) return 'sql';
    if (span.attributes?.['net.peer.name']?.includes('redis')) return 'redis';
    return 'http';
  }
}
```

### 11.2 Per-Request Topology

When viewing a single trace, the topology shows only the services involved in that specific request. This is the "execution story" — how the request flowed through the system.

```mermaid
graph LR
    A["API Gateway<br/>1234ms"] -->|HTTP 112ms| B["Auth Service<br/>112ms"]
    A -->|HTTP 800ms| C["Order Service<br/>800ms"]
    C -->|SQL 45ms| D["PostgreSQL<br/>45ms"]
    C -->|Redis 2ms| E["Redis<br/>2ms"]
    C -->|HTTP 350ms| F["Payment Service<br/>350ms"]
    F -->|SQL 10ms| D
    F -->|HTTP 300ms| G["Mock Payment API<br/>300ms"]
```

---

## 12. Security

### 12.1 Secret Redaction

| Layer | Approach | What's Redacted |
|-------|----------|----------------|
| OTel Collector | Attribute processor | `authorization`, `cookie`, `x-api-key` headers |
| DevTools Server | Redactor service | Sensitive body fields (password, token, credit_card) |
| Database | Schema-level | Request/response bodies stored but redacted before storage |
| API Response | Output filter | No raw secrets in API responses |

### 12.2 Request Body Handling

- Request/response bodies are captured as span attributes or log events
- Bodies are truncated at 64KB to prevent memory issues
- Bodies containing sensitive fields are redacted
- For the hackathon, bodies are stored in plaintext (redacted)

### 12.3 Replay Safety

- Replay only executes against the simulated backend (localhost:3000)
- No replay against external services
- No replay of real production traffic
- Database state can be optionally reset before replay
- All replay traces are marked with `replay: true` in metadata

### 12.4 Local/Private Deployment

For the hackathon:
- All services run locally via Docker Compose
- No external network exposure
- API server binds to localhost only

For production:
- Optional API key authentication
- TLS termination at reverse proxy
- Network policies restrict access

### 12.5 Telemetry Protection

- OTel Collector runs locally (no external export)
- No telemetry data leaves the local environment
- Trace data is stored in local PostgreSQL only

---

## 13. Performance

### 13.1 Hackathon Performance Limits

| Metric | Limit | Rationale |
|--------|-------|-----------|
| Requests captured | 10,000 | Enough for demo, simple to manage |
| Spans per trace | 50 | Typical microservices request has 10-20 spans |
| Log events per trace | 100 | Rich logging for demo |
| Concurrent WebSocket connections | 10 | Single-user hackathon demo |
| API response time | < 200ms | Responsive UI |
| Replay execution time | < 5s | Acceptable wait time |
| Database size | < 1GB | Hackathon storage limits |

### 13.2 Instrumentation Overhead

| Instrumentation | Overhead | Acceptable? |
|----------------|----------|-------------|
| Express HTTP | ~1-2ms per request | ✅ Yes |
| PostgreSQL queries | ~0.5ms per query | ✅ Yes |
| Redis commands | ~0.3ms per command | ✅ Yes |
| HTTP client calls | ~1ms per call | ✅ Yes |
| Log serialization | ~0.1ms per log | ✅ Yes |
| **Total per request** | ~5-10ms | ✅ Acceptable |

### 13.3 Telemetry Volume

For a single order request with typical instrumentation:

| Data | Estimated Size |
|------|---------------|
| Root span + 8 child spans | ~10 KB |
| Log events (3-5 logs) | ~2 KB |
| **Total per request** | ~12 KB |
| **Per 1000 requests** | ~12 MB |
| **Storage per hour (100 req/s)** | ~4.3 GB |

For the hackathon (100 req/s for 30 min): **~2.2 GB total**

### 13.4 WebSocket Traffic

| Event | Frequency | Size |
|-------|-----------|------|
| `new_request` | Per request | ~200 bytes |
| `trace_update` | Per span batch | ~2 KB |
| `replay_progress` | Per replay step | ~100 bytes |
| **Total per second (100 req/s)** | ~100 events | ~20 KB/s |

### 13.5 UI Rendering

- **Virtual scrolling** for request list (handles 10,000+ items)
- **Lazy loading** for trace details (load on demand)
- **Request-level memoization** (avoid re-rendering unchanged data)
- **Web Worker** for waterfall rendering (if needed)

### 13.6 Sampling

For the hackathon: **No sampling** (capture 100% of traffic).

For production: Configurable sampling:
- Head-based sampling: 10% of requests
- Tail-based sampling: 100% of errors, 100% of slow requests (>2s)

---

## 14. Testing

### 14.1 Testing Strategy

| Test Type | Scope | Tool | Priority |
|-----------|-------|------|----------|
| **Unit** | Services, utilities | Vitest | High |
| **Integration** | API endpoints, DB queries | Vitest + testcontainers | High |
| **API** | REST API contracts | Vitest + supertest | High |
| **Trace** | OTel instrumentation | Vitest + mock collector | Medium |
| **Replay** | Replay logic | Vitest + mock HTTP | Medium |
| **WebSocket** | WS events | Vitest + mock WS | Medium |
| **Failure** | Deliberate failures | Docker Compose + manual | Medium |
| **E2E** | Full workflow | Playwright or Cypress | Low (hackathon) |
| **Performance** | Load testing | k6 or autocannon | Low (hackathon) |

### 14.2 Key Test Scenarios

#### Unit Tests

```typescript
// packages/devtools-server/src/services/__tests__/compare.service.test.ts
describe('CompareService', () => {
  it('should match spans by operation name and service', () => {
    const spansA = [{ service_name: 'order-service', operation_name: 'POST /orders', duration_ms: 100, status: 'ok' }];
    const spansB = [{ service_name: 'order-service', operation_name: 'POST /orders', duration_ms: 120, status: 'ok' }];
    
    const result = service.matchSpans(spansA, spansB);
    expect(result.matched).toBe(1);
    expect(result.details[0].duration_diff_ms).toBe(20);
  });
  
  it('should detect added/removed services', () => {
    const traceA = { services: ['api-gateway', 'order-service'] };
    const traceB = { services: ['api-gateway', 'order-service', 'payment-service'] };
    
    const result = service.compareServiceDiff(traceA.services, traceB.services);
    expect(result.added).toEqual(['payment-service']);
    expect(result.removed).toEqual([]);
  });
});
```

#### Integration Tests

```typescript
// packages/devtools-server/src/api/__tests__/requests.test.ts
describe('GET /api/v1/requests', () => {
  it('should return paginated requests', async () => {
    const response = await supertest(app)
      .get('/api/v1/requests?page=1&limit=10')
      .expect(200);
    
    expect(response.body.requests).toHaveLength(10);
    expect(response.body.pagination.total).toBeGreaterThan(0);
  });
  
  it('should filter by method', async () => {
    const response = await supertest(app)
      .get('/api/v1/requests?method=POST')
      .expect(200);
    
    response.body.requests.forEach((req: any) => {
      expect(req.method).toBe('POST');
    });
  });
});
```

#### Failure Scenario Tests

```typescript
describe('Deliberate Failures', () => {
  it('should capture slow external API calls', async () => {
    // Trigger a request that hits the slow payment API
    const response = await supertest(app)
      .post('/api/orders')
      .send({ userId: 'user-42', items: [{ id: 'item-1', qty: 1 }] })
      .expect(201);
    
    // Wait for trace to be stored
    await sleep(1000);
    
    // Verify the trace contains a slow payment span
    const trace = await supertest(app)
      .get(`/api/v1/traces/${response.body.trace_id}`)
      .expect(200);
    
    const paymentSpan = trace.body.spans.find(
      (s: any) => s.service_name === 'payment-service'
    );
    expect(paymentSpan.duration_ms).toBeGreaterThan(3000);
  });
});
```

---

## 15. Hackathon Architecture

### 15.1 What We Build

| Component | Hackathon Version | Complexity |
|-----------|-------------------|------------|
| **Simulated Backend** | 5 Node.js services + PostgreSQL + Redis + WireMock | Docker Compose |
| **OTel Collector** | Single instance, OTLP receiver → OTLP exporter to DevTools server | Docker |
| **DevTools Server** | Fastify REST API + WebSocket + OTLP receiver + PostgreSQL | Node.js |
| **Frontend** | React SPA with Request Explorer, Waterfall, Context Panel, Replay | Vite + React |
| **Database** | PostgreSQL (same instance as simulated backend or separate) | Docker |

### 15.2 What We Don't Build

| Component | Why Not |
|-----------|---------|
| Multi-tenancy | Single user |
| Authentication | Local-only |
| Horizontal scaling | Single instance |
| Production-grade storage | PostgreSQL is sufficient |
| Real-time streaming | Polling + WebSocket for key events |
| Complex sampling | No sampling |
| Production replay | Simulated replay only |
| Custom dashboards | APM territory |

### 15.3 Simplifications

1. **Single PostgreSQL instance** for both simulated backend data and DevTools trace storage (different databases, same server)
2. **OTel Collector runs inside DevTools server process** (not a separate Docker container) — simplifies deployment
3. **Frontend served by DevTools server** (built assets) — single port, no CORS
4. **Replay uses direct HTTP calls** (not through OTel) — simpler, faster
5. **WebSocket for key events only** (new requests, replay completion) — not full real-time streaming

### 15.4 Docker Compose (Simplified)

```yaml
# docker-compose.hackathon.yml
version: '3.8'

services:
  # === SIMULATED BACKEND ===
  api-gateway:
    build: ./services/api-gateway
    ports: ["3000:3000"]
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      SERVICE_NAME: api-gateway
    depends_on: [auth-service, order-service]

  auth-service:
    build: ./services/auth-service
    ports: ["3001:3001"]
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      SERVICE_NAME: auth-service

  order-service:
    build: ./services/order-service
    ports: ["3002:3002"]
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      SERVICE_NAME: order-service
      DATABASE_URL: postgresql://app:secret@postgres:5432/ecommerce
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]

  payment-service:
    build: ./services/payment-service
    ports: ["3003:3003"]
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      SERVICE_NAME: payment-service
      MOCK_PAYMENT_API_URL: http://mock-payment-api:4000
    depends_on: [mock-payment-api]

  mock-payment-api:
    image: wiremock/wiremock:latest
    ports: ["4000:8080"]
    volumes: ["./mocks/payment-api:/home/wiremock"]

  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: ecommerce
    volumes:
      - ./db/seed.sql:/docker-entrypoint-initdb.d/seed.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  # === DEVTOOLS ===
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports: ["4317:4317"]
    volumes: ["./otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml"]

  devtools-server:
    build: ./packages/devtools-server
    ports: ["4001:4001"]
    environment:
      DATABASE_URL: postgresql://app:secret@postgres:5432/devtools
      OTLP_ENDPOINT: http://otel-collector:4317
      SIMULATED_BACKEND_URL: http://api-gateway:3000
    depends_on: [postgres, otel-collector, api-gateway]

  frontend:
    build: ./packages/frontend
    ports: ["4002:80"]
    depends_on: [devtools-server]
```

---

## 16. Production Architecture

### 16.1 What Changes

| Component | Hackathon | Production |
|-----------|-----------|------------|
| **OTel Collector** | Single instance | Clustered, multiple pipelines |
| **Storage** | PostgreSQL | ClickHouse (columnar, fast analytics) |
| **Trace ingestion** | Pull from Collector | Push from Collector → Kafka → Consumer |
| **Frontend** | Served by DevTools server | CDN-backed static assets |
| **API** | Single Node.js instance | Kubernetes deployment, autoscaling |
| **WebSocket** | Single instance | Redis Pub/Sub for multi-instance broadcast |
| **Replay** | Direct HTTP calls | Sidecar proxy with request capture |
| **Sampling** | 100% capture | Configurable head/tail sampling |
| **Multi-tenancy** | None | Organization-based isolation |
| **Authentication** | None | SSO + API keys |
| **Data retention** | Keep all | 7-day rolling with archival |
| **Deployment** | Docker Compose | Kubernetes + Helm |

### 16.2 Production Components

```mermaid
graph TB
    subgraph "Production Architecture"
        subgraph "Ingestion"
            OTelAgents["OTel Agents<br/>(per service)"]
            OTelCollector["OTel Collector<br/>(clustered)"]
            Kafka["Kafka<br/>(trace streaming)"]
        end
        
        subgraph "Processing"
            Consumer["Trace Consumer<br/>(Kafka consumer)"]
            Processor["Trace Processor<br/>(enrichment, redaction)"]
            Storage["ClickHouse<br/>(trace storage)"]
        end
        
        subgraph "Serving"
            API["DevTools API<br/>(Kubernetes)"]
            WebSocket["WebSocket<br/>(Redis Pub/Sub)"]
            CDN["CDN<br/>(static assets)"]
        end
        
        subgraph "Frontend"
            SPA["React SPA"]
        end
        
        OTelAgents --> OTelCollector
        OTelCollector --> Kafka
        Kafka --> Consumer
        Consumer --> Processor
        Processor --> Storage
        
        Storage --> API
        API --> SPA
        WebSocket --> SPA
        CDN --> SPA
    end
```

### 16.3 Production Replay

Production replay would use a **sidecar proxy** approach:

1. Traffic flows through a sidecar proxy (Envoy/NGINX)
2. Proxy captures request/response pairs
3. Requests are stored in a replay buffer (Kafka topic)
4. Replay service reads from buffer and re-executes against staging
5. Staging environment mirrors production (with isolated data)

This is significantly more complex than the hackathon approach and would require:
- Staging environment with production-like data
- Mock external APIs
- Database state management
- Authentication token management
- Rate limiting to prevent replay storms

---

## 17. Technical Risks

### 17.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OTel auto-instrumentation misses critical spans | Medium | High | Manual instrumentation for key operations |
| Trace data too large for PostgreSQL | Low | Medium | Truncate large bodies, use JSONB indexing |
| WebSocket performance degrades with many connections | Low | Medium | Limit connections, use polling fallback |
| Replay produces different trace structure | High | Medium | Match spans by operation name, not exact structure |
| Mock Payment API too simple for compelling demo | Medium | Low | Add realistic latency and error injection |
| Frontend rendering slow with large traces | Medium | Medium | Virtual scrolling, lazy loading, pagination |
| Docker Compose startup complexity | Medium | Low | Pre-built images, clear startup scripts |
| Time synchronization across services | Medium | Low | Use consistent timestamps, don't rely on wall clock |

### 17.2 Mitigation Details

**OTel Auto-Instrumentation Gaps:**
- Pre-test all instrumentation before hackathon
- Have manual instrumentation templates ready for Express, pg, redis
- Accept that some spans may be missing — our demo is controlled

**Trace Data Size:**
- Truncate request/response bodies at 64KB
- Store large bodies in separate table (linked by trace_id)
- Use JSONB for flexible attribute storage with GIN indexing

**Replay Trace Structure Differences:**
- Match spans by `(service_name, operation_name)` not by exact timing
- Show timing differences as colored indicators (faster/slower)
- Don't claim exact reproduction — show "similar execution path"

---

## 18. Final Architecture Recommendations

### 18.1 Decisions to Freeze

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL | Simplicity, JSONB support, familiar |
| **Backend Framework** | Fastify | Fast, TypeScript-native, good OTel support |
| **Frontend Framework** | React + TypeScript | Large ecosystem, team familiarity |
| **UI Library** | shadcn/ui + Tailwind | Beautiful, accessible, customizable |
| **Waterfall Viz** | Custom SVG (React) | Full control, no heavy dependencies |
| **Topology Viz** | React Flow | Mature, interactive, well-documented |
| **OTel Collector** | Docker (contrib image) | Feature-rich, production-ready |
| **WebSocket** | ws (Node.js) | Simple, fast, no extra dependencies |
| **Build Tool** | Vite | Fast HMR, modern, TypeScript support |
| **Package Manager** | pnpm | Fast, efficient, monorepo support |

### 18.2 Architecture Anti-Patterns to Avoid

| Anti-Pattern | Why | Alternative |
|-------------|-----|-------------|
| Over-engineering for production | Hackathon scope creep | Build for demo, document production path |
| Custom OTel implementation | Reimplements wheel | Use official OTel SDKs |
| Complex state management | Redux overkill for this scope | React state + React Query |
| Premature optimization | Unnecessary complexity | Measure first, optimize if needed |
| Too many microservices | Deployment complexity | 5 services is enough for demo |

### 18.3 Architecture Strengths

1. **Industry-standard foundation** — OTel is the CNCF standard, not a toy
2. **Clean separation** — Simulated backend ≠ DevTools ≠ Frontend
3. **Realistic architecture** — Mirrors real microservices patterns
4. **Demonstrable complexity** — Enough to impress judges, not enough to overwhelm
5. **Extensible** — Production path is clear

---

## RECOMMENDED STACK

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Frontend** | React | 18.x | Large ecosystem, team familiarity |
| **Frontend Language** | TypeScript | 5.x | Type safety, better DX |
| **UI Components** | shadcn/ui | latest | Beautiful, accessible, customizable |
| **CSS** | Tailwind CSS | 3.x | Utility-first, rapid styling |
| **Waterfall Viz** | Custom SVG | — | Full control, lightweight |
| **Topology Viz** | React Flow | 11.x | Interactive graph visualization |
| **State Management** | React Query + Zustand | latest | Server state + client state |
| **Build Tool** | Vite | 5.x | Fast HMR, modern |
| **Backend** | Fastify | 4.x | Fast, TypeScript-native |
| **Backend Language** | TypeScript | 5.x | Type safety, shared models |
| **OTel SDK** | @opentelemetry/sdk-node | 1.x | Official, well-supported |
| **OTel Auto-Instr** | @opentelemetry/auto-instrumentations-node | 0.x | Zero-code instrumentation |
| **OTel Exporter** | @opentelemetry/exporter-trace-otlp-grpc | 1.x | OTLP gRPC export |
| **Database** | PostgreSQL | 16 | JSONB, full-text search, reliable |
| **ORM/Query** | pg (node-postgres) | 8.x | Simple, fast, no ORM overhead |
| **WebSocket** | ws | 8.x | Simple, fast |
| **HTTP Client** | undici (built-in) | — | Fast, modern, built into Node.js |
| **Mock API** | WireMock | 3.x | Realistic API mocking |
| **OTel Collector** | otel/opentelemetry-collector-contrib | latest | Feature-rich, production-ready |
| **Containerization** | Docker + Docker Compose | — | Local orchestration |
| **Package Manager** | pnpm | 9.x | Fast, monorepo-friendly |
| **Testing** | Vitest | 1.x | Fast, Vite-native |
| **API Testing** | supertest | 6.x | HTTP assertion library |

---

## REPOSITORY STRUCTURE

```
backend-devtools/
├── docker-compose.yml                 # Full stack orchestration
├── docker-compose.hackathon.yml       # Hackathon-specific overrides
├── pnpm-workspace.yaml                # Monorepo config
├── package.json                       # Root package.json
├── tsconfig.base.json                 # Shared TypeScript config
│
├── packages/
│   ├── frontend/                      # React SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── RequestExplorer/
│   │   │   │   │   ├── RequestList.tsx
│   │   │   │   │   ├── RequestFilters.tsx
│   │   │   │   │   └── RequestRow.tsx
│   │   │   │   ├── RequestDetail/
│   │   │   │   │   ├── RequestDetail.tsx
│   │   │   │   │   ├── Waterfall/
│   │   │   │   │   │   ├── WaterfallChart.tsx
│   │   │   │   │   │   ├── WaterfallRow.tsx
│   │   │   │   │   │   └── WaterfallTimeline.tsx
│   │   │   │   │   ├── ContextPanel/
│   │   │   │   │   │   ├── OverviewTab.tsx
│   │   │   │   │   │   ├── LogsTab.tsx
│   │   │   │   │   │   ├── DBQueriesTab.tsx
│   │   │   │   │   │   └── ExternalCallsTab.tsx
│   │   │   │   │   ├── TopologyTab.tsx
│   │   │   │   │   ├── ReplayTab.tsx
│   │   │   │   │   └── CompareTab.tsx
│   │   │   │   ├── CommandPalette/
│   │   │   │   │   └── CommandPalette.tsx
│   │   │   │   └── Layout/
│   │   │   │       ├── Sidebar.tsx
│   │   │   │       └── StatusBar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useRequests.ts
│   │   │   │   ├── useTrace.ts
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   └── useReplay.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── websocket.ts
│   │   │   │   └── utils.ts
│   │   │   ├── stores/
│   │   │   │   └── appStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── devtools-server/               # Backend API + OTel receiver
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── routes/
│   │   │   │   │   ├── requests.ts
│   │   │   │   │   ├── traces.ts
│   │   │   │   │   ├── replay.ts
│   │   │   │   │   ├── compare.ts
│   │   │   │   │   └── topology.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── errorHandler.ts
│   │   │   │   │   └── cors.ts
│   │   │   │   └── websocket.ts
│   │   │   ├── services/
│   │   │   │   ├── request.service.ts
│   │   │   │   ├── trace.service.ts
│   │   │   │   ├── replay.service.ts
│   │   │   │   ├── compare.service.ts
│   │   │   │   ├── topology.service.ts
│   │   │   │   ├── log.service.ts
│   │   │   │   └── redactor.ts
│   │   │   ├── repository/
│   │   │   │   ├── trace.repository.ts
│   │   │   │   ├── replay.repository.ts
│   │   │   │   └── service.repository.ts
│   │   │   ├── otel/
│   │   │   │   └── receiver.ts
│   │   │   ├── db/
│   │   │   │   ├── migrations/
│   │   │   │   │   └── 001_initial.sql
│   │   │   │   └── connection.ts
│   │   │   ├── config/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                        # Shared types and utilities
│       ├── src/
│       │   ├── types.ts
│       │   ├── constants.ts
│       │   └── utils.ts
│       ├── tsconfig.json
│       └── package.json
│
├── services/                          # Simulated backend services
│   ├── shared/
│   │   └── tracing.ts                 # OTel initialization
│   ├── api-gateway/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── routes.ts
│   │   └── Dockerfile
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── handlers.ts
│   │   └── Dockerfile
│   ├── order-service/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── handlers.ts
│   │   │   └── failures.ts          # Deliberate failure injection
│   │   └── Dockerfile
│   ├── payment-service/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── handlers.ts
│   │   │   └── failures.ts
│   │   └── Dockerfile
│   └── frontend/                      # Simulated e-commerce frontend
│       ├── src/
│       │   └── pages/
│       └── Dockerfile
│
├── mocks/
│   └── payment-api/
│       ├── __files/
│       │   ├── charge-success.json
│       │   ├── charge-declined.json
│       │   └── charge-timeout.json
│       └── mappings/
│           ├── charge-success.json
│           ├── charge-slow.json
│           └── charge-failure.json
│
├── db/
│   ├── devtools/
│   │   └── 001_initial.sql
│   ├── ecommerce/
│   │   └── seed.sql
│   └── init.sh
│
├── otel-collector-config.yaml
├── .env.example
├── Makefile                           # Common commands
└── README.md
```

---

## FIRST END-TO-END VERTICAL SLICE

The first thing to build and verify is the **minimum viable data flow**:

```
Browser → API Gateway → Auth Service → Order Service → PostgreSQL → DevTools API → Frontend
```

### Step-by-Step

1. **Create simulated backend** (API Gateway + Order Service + PostgreSQL)
2. **Instrument with OTel** (auto-instrumentation for Express + pg)
3. **Run OTel Collector** (OTLP receiver → OTLP exporter)
4. **Build DevTools server** (receive OTLP traces, store in PostgreSQL, serve via REST API)
5. **Build minimal frontend** (list of requests, click to see waterfall)
6. **Verify**: Make an HTTP request to API Gateway → See it in DevTools UI

### Success Criteria

- [ ] HTTP request to `localhost:3000/api/orders` creates a trace
- [ ] Trace appears in DevTools API (`GET /api/v1/requests`)
- [ ] Clicking a request shows a waterfall in the frontend
- [ ] Waterfall shows correct timing and service breakdown

**This is the MVP. Everything else builds on this foundation.**

---

## BIGGEST TECHNICAL UNKNOWN

**OTel data completeness for our specific use case.** We don't know until we test:
1. Will `db.statement` attribute capture the full SQL query?
2. Will the pg instrumentation capture parameterized queries correctly?
3. Will Redis commands appear as spans with the right attributes?
4. Will our manual spans integrate cleanly with auto-instrumented spans?

**Mitigation:** Build the vertical slice first. Test OTel capture before building the full UI. If auto-instrumentation is insufficient, add manual spans for critical operations.

---

## ARCHITECTURE DECISIONS TO FREEZE

| # | Decision | Choice | Freeze Reason |
|---|----------|--------|---------------|
| 1 | **Trace storage** | PostgreSQL | Simple, JSONB support, single DB for hackathon |
| 2 | **OTel data format** | OTLP gRPC | Industry standard, Collector native format |
| 3 | **Span matching for comparison** | `service_name + operation_name` | Deterministic, no timing dependency |
| 4 | **Replay approach** | Direct HTTP re-execution | Simplest feasible approach for hackathon |
| 5 | **WebSocket scope** | Key events only (new requests, replay) | Avoids complexity of full real-time streaming |
| 6 | **Frontend serving** | Built assets served by DevTools server | Single port, no CORS, simpler deployment |
| 7 | **Secret redaction** | Two-layer (Collector + Server) | Defense in depth, best practice |
| 8 | **Waterfall rendering** | Custom SVG in React | Full control, no D3 dependency for simple viz |
| 9 | **Service topology source** | Derived from span relationships | Real-time, no separate topology tracking |
| 10 | **Database cleanup** | None (hackathon) | Simplest, acceptable for demo |
