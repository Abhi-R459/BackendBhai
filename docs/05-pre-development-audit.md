# Backend DevTools — Pre-Development Audit

> **Date:** September 3, 2026
> **Auditors:** Reality Checker · Software Architect · Backend Architect · Security Engineer · Performance Benchmarker · API Tester
> **Documents Reviewed:** 01-product-research-validation.md · 02-implementation-blueprint.md · 03-development-backlog.md · 04-ui-ux-implementation-spec.md
> **Purpose:** Find everything that could cause failure before development begins.

---

## Table of Contents

1. [Product Audit](#1-product-audit)
2. [Architecture Audit](#2-architecture-audit)
3. [Instrumentation Audit](#3-instrumentation-audit)
4. [Replay Audit](#4-replay-audit)
5. [Security Audit](#5-security-audit)
6. [Performance Audit](#6-performance-audit)
7. [Frontend Audit](#7-frontend-audit)
8. [Demo Audit](#8-demo-audit)
9. [Scope Audit](#9-scope-audit)
10. [Architecture Freeze](#architecture-freeze)
11. [MVP Freeze](#mvp-freeze)
12. [UI Freeze](#ui-freeze)
13. [Demo Freeze](#demo-freeze)
14. [Technical Unknown](#technical-unknown)
15. [Product Risk](#product-risk)
16. [Final Verdict](#final-verdict)

---

## 1. Product Audit

### Is the problem meaningful?

**Yes.** The context-switching pain is real and universal. Backend developers genuinely do switch between 6+ tools to understand a single request. The product research is sound on this point.

**However:** The problem is meaningful for *production* debugging. For a hackathon demo with a *simulated* backend, the "I can't find which DB query caused this error" pain point is artificial. Judges will understand this is a demo, not solve a real production incident. The product must be framed as "this is what the tool *would* enable" rather than "look at this production incident we just debugged."

### Is the product differentiated?

**Partially.** The combination is novel, but each individual piece is well-understood. The differentiation depends entirely on **execution quality** — a beautiful, polished Request Explorer + Waterfall is more impressive than a mediocre version with Replay + Compare + Topology. The risk is spreading thin across too many features instead of nailing the core.

### Is it actually different from Datadog?

**Positioning is different. Functionally, not really.** Datadog APM already has:
- Request-centric trace inspection
- Waterfall visualization
- Log-trace correlation
- Service dependency graphs
- Trace comparison (limited)

Our differentiation is:
1. **Local-first** (no SaaS)
2. **Developer-tool UX** (not APM dashboard)
3. **Request replay** (genuinely novel combination)

**Risk:** If judges are familiar with Datadog, they may ask "isn't this just a simpler Datadog?" The answer must be: "Datadog is an APM platform for operations teams monitoring at scale. This is a developer tool for debugging individual requests — like Chrome DevTools vs. Google Analytics."

### Is it actually different from Grafana?

**Yes.** Grafana is dashboard-focused and metric-centric. Our product is request-centric. Different paradigm.

### Is it actually different from Jaeger?

**Yes in UX, no in data.** Jaeger shows the same OTel trace data. Our differentiation is the *unification* — traces + logs + DB queries + external calls in one view — and the *UX quality*. Jaeger's UI is functional but spartan. Ours must be premium.

### Is it actually different from Sentry?

**Yes.** Sentry is error-centric. We are request-centric. Different primary axis.

### Is it actually different from Postman?

**Yes.** Postman constructs requests. We inspect actual executions. Completely different use case.

### Is the request-centric model strong enough?

**Yes, for a demo.** The "Chrome DevTools for backend" analogy is compelling and immediately understood. The risk is that judges may not *feel* the pain if they haven't debugged microservices. The demo must create an "aha" moment quickly.

### Is Replay genuinely useful?

**In theory, yes. In this implementation, marginally.** The replay described is "re-execute the same HTTP request against the same backend." This is equivalent to pressing "Send" in Postman. The value proposition of replay is "reproduce the exact same execution with the exact same state" — but the blueprint explicitly says database state cannot be reproduced exactly, timing will differ, and random values will differ. What remains is: "send the same HTTP request again." This is useful but not transformative.

**The "wow" of replay depends on database seeding.** If we can reset the DB to a known state before each replay and show that the replay produces a *comparable* trace (similar span structure, similar timing), that's impressive. If the replay just generates a random-looking new trace, it's anticlimactic.

---

## 2. Architecture Audit

### Critical Architecture Issue #1: OTLP Receiver Complexity

**The DevTools server must implement an OTLP gRPC receiver.** This is stated in backlog task D-03 (estimated 5 hours) and is on the critical path.

**The problem:** Building an OTLP gRPC receiver is non-trivial. It requires:
- gRPC server setup with protobuf deserialization
- OTLP trace/service/span proto message handling
- Batch processing (OTel Collector sends in batches)
- Span transformation (OTLP proto → PostgreSQL schema)
- Concurrent writes to multiple tables (traces, spans, span_events, log_events)
- Secret redaction during ingestion

**Alternative not considered:** The OTel Collector can export directly to an HTTP endpoint. The DevTools server could expose a simple HTTP POST endpoint that receives already-parsed JSON, avoiding gRPC entirely. The Collector's `otlphttp` exporter would handle serialization.

**Recommendation:** Use `otlphttp` exporter instead of `otlpgrpc`. The Collector handles the gRPC→HTTP translation. The DevTools server receives plain JSON.

### Critical Architecture Issue #2: Collector vs. Same-Process Contradiction

**Section 15.3 of the blueprint states:**
> "OTel Collector runs inside DevTools server process (not a separate Docker container) — simplifies deployment"

**But Docker Compose (Section 15.4) shows:**
```yaml
otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports: ["4317:4317"]
```

**And the backlog (I-04) creates a separate Collector config.**

These are contradictory. The team must decide: separate container or embedded? The backlog and Docker Compose assume separate. The architecture doc says embedded. **This must be resolved before coding.**

**Recommendation:** Use a separate container. It's the simpler, more debuggable path and aligns with the backlog tasks.

### Architecture Issue #3: Missing Request Body Capture

The blueprint's trace model stores `request_body` and `response_body` in the traces table. But OTel auto-instrumentation for HTTP does NOT capture request/response bodies by default. The `http.request.body` and `http.response.body` are not standard OTel attributes.

**The blueprint's instrumentation code (Section 4.3) shows manual span creation but does not show how bodies are captured and stored.**

**For the simulated backend:** Bodies could be added as custom span attributes (`custom.http.request.body`). But this requires manual instrumentation in every service — which undermines the "auto-instrumentation" approach.

**For the DevTools API:** The `GET /api/v1/requests/:traceId` response includes `request_body` and `response_body`. If these are not captured by OTel, the API must return null, and the Overview tab will show empty bodies. This significantly weakens the "complete execution story" promise.

**Recommendation:** Capture bodies via a simple Express middleware that adds them as span attributes. This must be implemented in the shared tracing module, not per-service.

### Architecture Issue #4: Log Correlation Gap

The blueprint shows logs correlated to traces via `trace_id` and `span_id`. But OTel auto-instrumentation does NOT automatically attach trace context to `console.log` output. The shared logger (Section 4.5) must be used instead.

**The blueprint provides a `createLogger` function that injects trace context.** But this requires every service to use the custom logger, not `console.log`. If any service uses raw `console.log`, those logs will have no `trace_id` and will not appear in the Logs tab.

**Recommendation:** Add a `console.log` monkey-patch in the shared tracing module that auto-injects trace context. This is a common OTel pattern and ensures zero-change log correlation.

### Architecture Issue #5: Topology Is Post-Hoc Derived

The topology is derived from span relationships after traces are stored. This means:
1. Topology only shows services that have been called at least once
2. Topology may show spurious edges from unrelated parent-child relationships
3. Per-request topology depends on the trace having complete span data

**For a hackathon demo with pre-seeded data, this is fine.** The topology will be correct because we control the data. But the team should understand that the topology is a *view of stored traces*, not a live dependency map.

### Architecture Issue #6: Replay Trace Discovery Race Condition

The replay service (Section 9.6) finds the new trace by searching for traces matching the replay request within a time window. This has a race condition:

1. Replay sends HTTP request to API Gateway
2. API Gateway processes and returns response
3. Replay service receives response
4. Replay service waits 500ms for OTel export
5. Replay service searches for matching trace

The 500ms wait is arbitrary. If the OTel Collector batches with a longer interval, or if the DevTools server is slow to process, the trace may not be stored yet. Conversely, if another request happened to match the same method/path in that window, the wrong trace could be matched.

**Recommendation:** Pass the `traceparent` header through the replay request and use the returned trace ID from the response header (if available). This eliminates the time-window search entirely.

---

## 3. Instrumentation Audit

### Trace Propagation

**Status: Solid.** W3C `traceparent` propagation is the industry standard. OTel auto-instrumentation handles this automatically for Express HTTP calls. This will work.

**One concern:** The Auth Service is called from the API Gateway via HTTP. If the Auth Service also calls downstream services, the trace chain continues. But if the Auth Service is a simple "verify token" endpoint with no downstream calls, its span will be a leaf node. This is fine for the demo.

### Span Correlation

**Status: Solid.** OTel auto-instrumentation creates parent-child relationships via context propagation. Spans from different services will have the same `trace_id` and correct `parent_span_id`.

### Log Correlation

**Status: Requires manual work.** As noted above, `console.log` output will not have trace context unless the custom logger or monkey-patch is used. This is a common gotcha.

### Database Correlation

**Status: Depends on OTel pg instrumentation.** The `@opentelemetry/instrumentation-pg` package instruments the `pg` library and creates spans with `db.statement`, `db.operation`, `db.sql.table`, etc. This should work for the simulated backend's PostgreSQL queries.

**Concern:** The Redis instrumentation (`@opentelemetry/instrumentation-redis`) may not capture the exact Redis command as the span name. It typically uses `redis.command` as the span name. The DB Queries tab must handle Redis spans differently from PostgreSQL spans — they should probably appear in a separate "Cache" section or be visually distinguished.

### External Request Correlation

**Status: Solid.** HTTP client spans (outbound calls from Payment Service to Mock Payment API) are auto-instrumented. The `server.address` attribute identifies the target. The DevTools server can distinguish internal vs. external calls by checking if `server.address` matches a known service name.

### Error Capture

**Status: Solid.** OTel captures errors via `span.setStatus({ code: ERROR })` and `span.recordException()`. The blueprint's manual instrumentation code (Section 4.3) shows this pattern. Auto-instrumentation also captures HTTP error status codes.

### Secret Handling

**Status: Two-layer approach is sound, but coverage is incomplete.**

The OTel Collector redacts `authorization`, `cookie`, `x-api-key` headers. The DevTools server redacts `password`, `token`, `secret`, `credit_card`, `ssn` in body fields.

**Missing:**
- `x-auth-token` header (mentioned in server redactor but not Collector)
- SQL parameter values in `db.statement` (the Collector config shows `REDACTED_PARAMETERS` but the value update action replaces the entire attribute, not just parameters)
- Custom span attributes containing PII (e.g., `order.user_id` is stored as-is)

**For a hackathon demo with fake data, this is acceptable.** But the team should know that the redaction is incomplete.

---

## 4. Replay Audit

### Can replay actually work?

**Technically yes, but the value proposition is weaker than presented.**

The replay flow is:
1. Extract request snapshot from stored trace (method, path, headers, body)
2. Send HTTP request to API Gateway
3. Wait for OTel to export the new trace
4. Store replay session linking original → replay
5. Show new trace in UI

This is essentially "re-send an HTTP request." The stored trace data (DB queries, logs, etc.) will be similar but not identical because:
- Database state has changed (previous orders exist)
- Timing will differ
- Random values (UUIDs, nonces) will differ
- External API responses may differ (if mock uses probabilistic behavior)

### What state is required?

**Database state is the critical variable.** The blueprint says "Seed database to known state" in the replay flow diagram, but **no database seeding mechanism is specified in the implementation.** The backlog's `make reset-db` drops and recreates databases, but this is a destructive operation that cannot be run between every replay.

**Without database seeding, replayed POST requests will create additional records.** The second replay of the same order will succeed but create a new order with a different ID. The DB Queries tab will show similar but not identical queries. This is acceptable for a demo but not impressive.

### What cannot be reproduced?

Per the blueprint (Section 9.4):
- Exact timing
- Database state (exact)
- Network latency
- Connection pooling state
- File system state
- In-memory state

**What remains is: same HTTP method, path, headers, and body.** This is what Postman does. The replay is not "reproduce the exact execution" — it's "re-send the same request."

### Are side effects controlled?

**Partially.** The Mock Payment API has probabilistic behavior (30% slow, 5% 503). A replayed request may hit a different failure mode than the original. This means:
- The replay trace may show different service behavior
- The comparison may show unexpected diffs
- The "reproduce the bug" scenario may not reproduce

**Recommendation:** Add a "replay mode" flag to the Mock Payment API that forces deterministic responses. Or accept that replay may produce different results and frame the comparison as "how did the behavior differ?" rather than "verify it's identical."

### Is the replay environment realistic?

**For a demo, yes.** The simulated backend is controlled. The replay goes through the same services. The OTel instrumentation captures the new trace. The waterfall will look similar.

**For a real product, no.** Real replay would require database state snapshots, external API mocking, and deterministic execution. This is explicitly out of scope.

### Replay Audit Verdict

**Replay is feasible but oversold.** The implementation is "re-send an HTTP request and show the new trace." The UI/UX spec presents it as a sophisticated debugging workflow. The team must understand the actual scope: a "Replay" button that sends the same HTTP request again, with a new trace appearing in the list. The comparison feature adds genuine value if the replay produces different results (which it will, due to probabilistic mocks).

---

## 5. Security Audit

### API Keys and Passwords

**Status: No authentication.** The blueprint explicitly states no auth for hackathon. The DevTools server binds to localhost. This is acceptable for a local demo.

**Risk:** If the demo is presented on a shared network, anyone can access the API. **Mitigation:** Use `localhost` binding. For presentation, use a local machine.

### Database Credentials

**Status: Hardcoded in Docker Compose.** `POSTGRES_USER: app`, `POSTGRES_PASSWORD: secret`. These are in the YAML file and `.env.example`.

**Risk:** Minimal for hackathon. These are local development credentials.

### Sensitive Request Bodies

**Status: Partially redacted.** The redactor handles `password`, `token`, `secret`, `credit_card`, `ssn`. But the simulated backend uses fake data (user-42, item-1), so there are no real secrets.

**Risk:** None for hackathon. The redactor is a good practice demonstration.

### Replay Safety

**Status: Safe.** Replay only executes against the simulated backend (localhost:3000). No external services. No real payments. The mock payment API returns deterministic responses.

### Access Control

**Status: None.** All endpoints are open. Acceptable for hackathon.

### Telemetry Protection

**Status: Local-only.** No telemetry leaves the local environment. The OTel Collector exports to localhost only.

### Security Audit Verdict

**No blocking security issues for hackathon.** The two-layer redaction is a good demonstration of security practices. The local-only deployment is safe. For production, authentication, TLS, and network policies would be needed.

---

## 6. Performance Audit

### Instrumentation Overhead

**Status: Acceptable.** The blueprint estimates 5-10ms per request. With 4 services and auto-instrumentation, the overhead is:
- Express HTTP: ~1-2ms per request × 4 services = 4-8ms
- pg instrumentation: ~0.5ms per query × 2 queries = 1ms
- Redis instrumentation: ~0.3ms per command × 1 command = 0.3ms
- HTTP client: ~1ms per call × 2 calls = 2ms
- Log serialization: ~0.1ms × 5 logs = 0.5ms
- **Total: ~8-12ms per end-to-end request**

This adds ~10% to a 100ms request, ~1% to a 1000ms request. Acceptable.

### Telemetry Volume

**Status: Manageable.** The blueprint estimates ~12KB per request. At 100 req/s for 30 minutes: ~2.2GB total. PostgreSQL can handle this.

**Concern:** The OTel Collector's batch processor defaults to 200 spans or 5 seconds, whichever comes first. For 100 req/s with ~8 spans each, that's 800 spans/s. The Collector will batch frequently. This is fine.

### Database Growth

**Status: Acceptable for hackathon.** The `traces` table stores full request/response bodies. At 12KB per request × 50 seeded requests = 600KB. No issue.

**Concern for production:** The `traces.request_body` and `traces.response_body` columns are TEXT. At scale, this would be enormous. For hackathon, no issue.

### WebSocket Traffic

**Status: Minimal.** `new_request` events are ~200 bytes each. At 100 req/s, that's 20KB/s. Negligible.

### Frontend Rendering

**Status: Virtual scrolling handles the list.** The Request List uses `@tanstack/react-virtual` with 40px row height. At 100+ requests, this is fine.

**Concern:** The Waterfall chart renders SVG. For a trace with 20+ spans, the SVG has 20+ rect elements with hover handlers. This should be fine for modern browsers.

**Concern:** React Flow for topology with 7 nodes and 7 edges is trivial. No performance issue.

### Performance Audit Verdict

**No blocking performance issues for hackathon.** The system is designed for 10,000 requests max, well within PostgreSQL and React capabilities.

---

## 7. Frontend Audit

### Trace Rendering

**Status: Custom SVG waterfall is the right approach.** No D3 dependency. Simple rect positioning based on `start_offset_ms` and `duration_ms`. The math is straightforward:

```
barX = leftPadding + (start_offset_ms / totalDuration) × chartWidth
barWidth = max((duration_ms / totalDuration) × chartWidth, 2px)
```

**Concern:** The waterfall must handle traces with 1-20+ spans. The SVG height grows with span count. For 20 spans at 40px row height, that's 800px — fits in the detail panel without scrolling. For 50+ spans (unlikely in demo), scrolling would be needed.

### Graph Complexity

**Status: 7 nodes, 7 edges.** React Flow handles this trivially. Manual layout is fine (no need for auto-layout algorithms).

### State Management

**Status: Zustand + React Query is appropriate.** Server state (traces, spans, logs) goes through React Query with caching. Client state (selected trace, active tab, filters) goes through Zustand. This is a clean separation.

**Concern:** The Zustand store has a `selectedTraceId` field. When the user selects a trace, React Query fetches the detail. If the user selects a different trace before the first fetch completes, the first fetch result should be discarded. React Query handles this naturally with query keys.

### WebSocket Updates

**Status: The `useWebSocket` hook connects on mount and disconnects on unmount.** New requests are added to the React Query cache via `addRequest`. This should trigger a re-render of the Request List.

**Concern:** The WebSocket `new_request` event must match the shape of the `GET /api/v1/requests` response items. If the WebSocket payload has a different shape, the UI will break. **The API spec must be consistent between REST and WebSocket.**

### Error Handling

**Status: Error boundaries + React Query error states.** This is standard practice. The UI spec defines loading skeletons, empty states, and error states for each component.

### UI Consistency

**Status: The UI spec is comprehensive (1836 lines).** Colors, typography, spacing, and component structure are well-defined. The risk is implementation drift — developers may deviate from the spec under time pressure.

**Recommendation:** Create a Tailwind config file that encodes all design tokens (colors, fonts, spacing) before any UI work begins. This ensures consistency.

### Frontend Audit Verdict

**No blocking frontend issues.** The architecture is sound. The main risk is implementation quality under time pressure, not architectural flaws.

---

## 8. Demo Audit

### What can fail?

1. **Docker Compose fails to start.** 8+ services (API Gateway, Auth, Order, Payment, Mock Payment API, PostgreSQL, Redis, OTel Collector, DevTools Server, Frontend) must all start and be healthy. Any single failure breaks the demo.

2. **OTel Collector doesn't receive traces.** If the Collector config is wrong, or the simulated services can't reach it, no data flows.

3. **WebSocket disconnects.** If the WebSocket drops during the demo, the "live" feel is lost.

4. **Replay fails.** The race condition in trace discovery could cause the replay to show "no trace found."

5. **Seed data is insufficient.** If the demo starts with no requests, the presenter must manually create traffic while presenting.

### Which dependency is dangerous?

**The OTel Collector is the single most dangerous dependency.** It sits between the simulated backend and the DevTools server. If it fails:
- No traces are captured
- No data appears in the UI
- The entire demo is dead

**Mitigation:** Pre-seed the database with 50+ diverse requests before the demo. The UI should work with pre-seeded data even if the Collector is down.

### What requires real infrastructure?

- PostgreSQL (Docker)
- Redis (Docker)
- WireMock (Docker)
- OTel Collector (Docker)
- 4 Node.js services (Docker or local)
- DevTools server (local)
- React frontend (local)

**Total: 8+ processes.** This is a lot of moving parts for a hackathon demo.

**Recommendation:** Use Docker Compose for all infrastructure. Use `docker compose up --build` for a clean start. Have a `make demo` script that seeds data and starts everything.

### What can be deterministic?

- Seed data (pre-generated, known traces)
- Waterfall rendering (deterministic from stored data)
- Filter/search behavior (deterministic)
- Command palette (deterministic)

### What should be mocked?

- The mock payment API is already mocked (WireMock). Good.
- The auth service is already simplified (any token with user_id works). Good.
- The e-commerce frontend is already minimal. Good.

### Can the demo be reset?

**Yes, via `make reset-db && make seed`.** This drops both databases, re-runs migrations, and re-seeds data. Takes ~10 seconds.

### Can it be run repeatedly?

**Yes, if the seed data is deterministic.** The demo should start from a known state every time.

### Demo Audit Verdict

**The demo is viable but fragile.** The main risk is Docker Compose startup failures. **Recommendation:** Run `docker compose up` 10+ times before the demo to build confidence. Have a backup plan (screenshots/video) if Docker fails.

---

## 9. Scope Audit

### Feature Classification

| Feature | Classification | Rationale |
|---------|---------------|-----------|
| Request Explorer (list + filters) | **CRITICAL** | Core entry point. Without this, nothing works. |
| Trace Waterfall | **CRITICAL** | Core value proposition. The "aha" moment. |
| Overview Tab | **CRITICAL** | Request/response inspection is fundamental. |
| WebSocket live updates | **HIGH** | Makes the tool feel alive. Without it, the list is static. |
| Logs Tab | **HIGH** | Key differentiator — request-scoped logs. |
| DB Queries Tab | **HIGH** | Key differentiator — request-scoped DB visibility. |
| External API Tab | **MEDIUM** | Nice to have, but waterfall already shows external calls. |
| Service Topology | **MEDIUM** | Impressive visual, but not essential for core demo. |
| Request Replay | **MEDIUM** | "Wow" factor but complex and fragile. |
| Request Comparison | **LOW** | Depends on replay. Cut first if behind. |
| Command Palette | **LOW** | Polish, not essential. |
| Incident Timeline | **LOW** | Stretch goal only. |

### REMOVE IMMEDIATELY

1. **Incident Timeline** — Not in the MUST HAVE or SHOULD HAVE lists. Adds complexity with no demo value.
2. **Dark mode toggle** — The UI spec says "dark theme is the only theme." Remove the toggle entirely. Dark-only.
3. **Latency budget breakdown** — Nice-to-have stretch goal. The waterfall already shows timing. This is redundant.
4. **Export/share trace** — Not needed for demo.
5. **Service Health Overview** — APM territory. Explicitly excluded in product research but still appears in the backlog.

### MUST FIX BEFORE CODING

1. **Resolve OTLP receiver approach.** Decide: gRPC receiver (complex) or HTTP receiver via Collector `otlphttp` exporter (simpler)? **Recommendation: HTTP.**
2. **Resolve Collector architecture.** Separate container or embedded? **Recommendation: Separate container (matches backlog).**
3. **Add request body capture middleware.** Without this, the Overview tab shows empty bodies. Create a shared Express middleware that captures `req.body` and `res.json` output and adds them as span attributes.
4. **Add console.log monkey-patch.** Without this, logs have no trace context. Patch `console.log`/`console.error` in the shared tracing module to inject `trace_id` and `span_id`.
5. **Define WebSocket event payloads precisely.** The WebSocket `new_request` event must match the REST API response shape exactly. Define this in the shared types package.

### MUST FIX BEFORE DEMO

1. **Pre-seed database with 50+ diverse requests.** The demo must start with data. Do not rely on generating traffic during the presentation.
2. **Add deterministic mock responses.** The WireMock probabilistic behavior (30% slow, 5% 503) means replay and comparison are non-deterministic. Add a "replay mode" flag or accept non-determinism.
3. **Test Docker Compose startup 10+ times.** If it fails once, it will fail during the demo.
4. **Create `make demo` script.** One command to start everything, seed data, and open the browser.
5. **Prepare backup screenshots/video.** If Docker fails during the presentation, show pre-recorded demo.

### CAN IGNORE

1. **Secret redaction completeness** — Fake data has no real secrets.
2. **Production architecture** — Out of scope for hackathon.
3. **Performance optimization** — Current scale is trivial.
4. **Accessibility audit** — Nice to have but not blocking.

### ONLY IF TIME REMAINS

1. Service Topology
2. Request Replay
3. Request Comparison
4. Command Palette
5. External API Tab
6. WebSocket live updates (use polling as fallback)

---

## Architecture Freeze

### Exact architecture to build:

```
┌─────────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                         │
│  Request Explorer → Waterfall → Context Tabs                │
│  Served as static files by DevTools server                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────┴───────────────────────────────────────┐
│              DevTools Server (Fastify, Node.js)              │
│  REST API + WebSocket + OTLP HTTP receiver + PostgreSQL     │
│  Port: 4001                                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                  PostgreSQL (single instance)                │
│  Database: devtools (traces, spans, logs, services)         │
│  Database: ecommerce (users, products, orders)              │
│  Port: 5432                                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│               OTel Collector (Docker container)              │
│  OTLP gRPC receiver (:4317) → OTLP HTTP exporter → Server  │
│  Attribute redaction for sensitive headers                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ OTLP export
┌─────────────────────┴───────────────────────────────────────┐
│                   Simulated Backend                          │
│  API Gateway (:3000) → Auth (:3001) → Order (:3002) →     │
│  Payment (:3003) → Mock Payment API (:4000)                │
│  PostgreSQL (:5432) · Redis (:6379)                        │
└─────────────────────────────────────────────────────────────┘
```

### Key architecture decisions:

1. **OTel Collector as separate Docker container** — Not embedded in DevTools server.
2. **OTLP HTTP export** (not gRPC) — Collector exports via `otlphttp` to DevTools server's HTTP endpoint. Simpler than implementing gRPC receiver.
3. **Single PostgreSQL instance** — Both `devtools` and `ecommerce` databases on same server.
4. **DevTools server serves frontend** — Built React assets served as static files on port 4001.
5. **WebSocket for live updates only** — Not full real-time streaming. `new_request` and `replay_complete` events only.

---

## MVP Freeze

### Exact features to build:

**Tier 1 (Must have — demo cannot work without these):**
1. Request Explorer with virtual-scrolled list
2. Request filters (method, status, service, search)
3. Trace Waterfall (custom SVG, service-colored bars, duration labels)
4. Overview Tab (request/response headers and body, JSON syntax highlighting)
5. OTLP trace ingestion pipeline (Collector → DevTools server → PostgreSQL)
6. Seed data (50+ diverse requests with failure scenarios)

**Tier 2 (Should have — demo is significantly better with these):**
7. WebSocket live updates (`new_request` events)
8. Logs Tab (trace-scoped, filterable by level)
9. DB Queries Tab (SQL syntax highlighting)
10. External API Tab (request/response display)
11. Command Palette (Cmd+K)

**Tier 3 (Nice to have — only if time permits):**
12. Service Topology (React Flow graph)
13. Request Replay (re-execute request, show new trace)
14. Request Comparison (side-by-side diff)

**Tier 4 (Do not build):**
15. Incident Timeline
16. Dark mode toggle
17. Latency budget
18. Export/share
19. Service health overview
20. Production architecture

### Total task count for MVP: ~30 tasks (down from 55 in the backlog)

---

## UI Freeze

### Exact UI scope:

1. **App Shell:** TopBar (logo + Cmd+K trigger + connection indicator) + main content area + StatusBar
2. **Request Explorer:** Filter bar (method, status, service, search) + virtual-scrolled request list
3. **Request Detail:** Tabbed panel (Waterfall, Overview, Logs, DB, External, Topology, Replay, Compare)
4. **Waterfall:** Custom SVG with time ruler, service-colored bars, span info labels, hover tooltips, click-to-expand
5. **Overview:** Request/response sections with JSON syntax highlighting
6. **Logs:** Filterable log table with level badges
7. **DB Queries:** Query cards with SQL syntax highlighting
8. **External APIs:** Call cards with request/response display
9. **Command Palette:** Cmd+K overlay with fuzzy search
10. **Shared components:** MethodBadge, StatusCode, DurationBadge, ServiceDot, CodeBlock, KeyValueTable

### UI components NOT in scope:
- TopologyTab (Tier 3)
- ReplayTab (Tier 3)
- CompareTab (Tier 3)
- IncidentTimeline (removed)
- Dark mode toggle (removed)
- Responsive mobile layout (desktop-only)

---

## Demo Freeze

### Exact demonstration scenario:

**Setup:**
1. `docker compose up --build` starts entire stack
2. `make seed` populates 50+ diverse requests
3. Open `http://localhost:4001` in browser

**Demo flow (5 minutes):**

1. **"This is Backend DevTools — Chrome DevTools for your backend."** (10 seconds)
   - Show the Request Explorer with 50+ seeded requests
   - Point out the method badges, status codes, duration, service dots

2. **"Watch a new request come in live."** (30 seconds)
   - Click "Place Order" on the e-commerce frontend (or use curl)
   - Show the new request appearing at the top of the list with the green fade-in animation
   - Point out the WebSocket live update

3. **"Click any request to see its complete execution story."** (2 minutes)
   - Click a request with a slow payment (5s external API call)
   - Show the waterfall: "Here you can see exactly where the 5 seconds were spent — the Mock Payment API took 5 seconds to respond"
   - Show the Overview tab: "Here's the full request and response with headers and body"
   - Show the Logs tab: "Here are all the logs correlated to this specific request"
   - Show the DB Queries tab: "Here are the database queries triggered by this request"

4. **"Let's find a failing request."** (1 minute)
   - Click a request with a 500 error (payment 503)
   - Show the waterfall with the red error span: "The Payment Service returned a 503 — this is the root cause"
   - Show the logs with the error message

5. **"Let's search for slow requests."** (30 seconds)
   - Use the duration filter to show only requests >2s
   - Show how the waterfall immediately reveals the bottleneck

6. **"One request. One view. One tool."** (30 seconds)
   - Recap the value proposition
   - Show the service dots in the request list: "Every request shows which services it touched"
   - End with the tagline

**If Replay is implemented (bonus 2 minutes):**
7. **"Now let's replay this request."** (1 minute)
   - Click "Replay" on a failing request
   - Show the progress indicator
   - Show the new trace appearing
   - Click "Compare" to show the side-by-side diff

8. **"The comparison shows exactly what changed."** (1 minute)
   - Point out the duration diff
   - Point out the status match/mismatch

### What MUST NOT be demonstrated live:
- Docker Compose startup (do this before the presentation)
- Database seeding (do this before the presentation)
- Any operation that could fail unpredictably

---

## Technical Unknown

### Largest unresolved technical issue:

**Will the OTel auto-instrumentation capture database query bodies (`db.statement`) for the simulated backend's PostgreSQL queries?**

The `@opentelemetry/instrumentation-pg` package instruments the `pg` library. According to the OTel documentation, it should capture `db.statement` with the full SQL query. However:

1. The exact format of `db.statement` may include parameter values or use placeholders (`$1`, `$2`)
2. The attribute name may differ between OTel SDK versions
3. The `pg` library version may affect instrumentation compatibility

**If `db.statement` is not captured, the DB Queries tab will be empty.** This is a key differentiator feature. The waterfall will still show database spans (with timing), but the SQL content will be missing.

**Mitigation:** Test this on Day 1. Build a minimal Express + pg service, instrument it with OTel, send a query, and verify that `db.statement` appears in the stored span. If it doesn't, add manual instrumentation.

**This is the single highest-risk technical item.** It affects the DB Queries tab, which is a key differentiator.

---

## Product Risk

### Largest unresolved product issue:

**The "replay" feature is oversold relative to its actual value.**

The product research (Section 7) frames replay as: "Replay a request to reproduce the issue." The implementation (Section 9) is: "Re-send the same HTTP request." The gap between these is significant.

A real developer debugging a production issue needs:
1. The exact database state at the time of the original request
2. The exact external API responses
3. The exact timing and concurrency

Our replay provides none of these. What it provides is: "Send the same HTTP request again and see what happens." This is useful but not the debugging superpower the product research promises.

**If judges ask "how is this different from just using Postman to re-send the request?", the answer must be:** "The replay captures the new execution trace automatically, so you can compare the original and replayed executions side-by-side — seeing exactly which services were called, how long each took, and what queries ran. Postman shows you the response; Backend DevTools shows you the *story*."

**This is a weaker answer than the product research implies.** The team must understand that replay is a "nice to have" feature, not the core value proposition. The core value is the Request Explorer + Waterfall + Context Panel.

---

## Final Verdict

### READY TO BUILD

The project is ready for development with the following mandatory pre-coding fixes:

1. **Decide OTLP ingestion approach:** Use `otlphttp` export from Collector to DevTools server HTTP endpoint (not gRPC).
2. **Resolve architecture contradiction:** Separate OTel Collector container (matches backlog, not embedded).
3. **Add request body capture middleware** in the shared tracing module.
4. **Add console.log monkey-patch** for automatic log-trace correlation.
5. **Define WebSocket payloads** to match REST API response shapes exactly.

These are all solvable in 2-4 hours. The architecture is sound. The scope is manageable. The product has genuine differentiation. The demo is compelling.

**The project will succeed if and only if:**
- The team builds the vertical slice (Request Explorer → Waterfall) first and makes it beautiful
- The team pre-seeds the database before every demo
- The team tests Docker Compose startup 10+ times before presenting
- The team does NOT over-invest in Replay/Compare/Topology at the expense of the core waterfall experience

**The biggest risk is not technical — it's scope discipline.** The backlog has 55 tasks. The MVP needs ~30. The team must resist the temptation to build everything and instead build the core beautifully.
