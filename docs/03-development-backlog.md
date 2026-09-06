# Backend DevTools — Development Backlog

> **Date:** September 3, 2026
> **Source of Truth:** [planning/01-product-research-validation.md](./01-product-research-validation.md) · [planning/02-implementation-blueprint.md](./02-implementation-blueprint.md)
> **Team Size:** 3–6 developers
> **Horizon:** Hackathon (20–30 engineering hours)

---

## Table of Contents

1. [Epics](#1-epics)
2. [Feature Breakdown](#2-feature-breakdown)
3. [Engineering Tasks](#3-engineering-tasks)
4. [Dependencies](#4-dependencies)
5. [Team Assignment](#5-team-assignment)
6. [Critical Path](#6-critical-path)
7. [First Vertical Slice](#7-first-vertical-slice)
8. [Development Phases](#8-development-phases)
9. [Feature Freeze](#9-feature-freeze)
10. [Scope-Cut Strategy](#10-scope-cut-strategy)
11. [Definition of Done](#11-definition-of-done)
12. [Demo Readiness Checklist](#12-demo-readiness-checklist)
13. [First 10 Things to Build](#13-first-10-things-to-build)
14. [Parallel Workstreams](#14-parallel-workstreams)
15. [Most Critical Dependency](#15-most-critical-dependency)
16. [Most Dangerous Scope Item](#16-most-dangerous-scope-item)
17. [Emergency Cut List](#17-emergency-cut-list)

---

## 1. Epics

| # | Epic | Description | Value |
|---|------|-------------|-------|
| E1 | **Simulated Backend** | 4 Node.js microservices + PostgreSQL + Redis + Mock Payment API, all instrumented with OpenTelemetry | Produces the telemetry data the tool consumes |
| E2 | **DevTools Server** | Fastify API server that receives OTLP traces, stores them in PostgreSQL, and serves them via REST + WebSocket | The data backbone of the entire product |
| E3 | **Request Explorer** | Searchable, filterable list of captured requests in the React UI | Entry point — the "Chrome DevTools Network Tab" |
| E4 | **Trace Waterfall** | Interactive SVG waterfall showing every span in a request with timing and status | Core value — the "execution story" |
| E5 | **Context Panel** | Tabbed detail view showing Overview, Logs, DB Queries, External API Calls | Completes the "one request, one view" promise |
| E6 | **Request Replay** | Re-execute a captured request against the demo backend and capture the new trace | "Wow factor" differentiator |
| E7 | **Request Comparison** | Side-by-side diff of two executions of the same request | Unique feature — genuinely novel |
| E8 | **Service Topology** | React Flow graph of services and dependencies, optionally scoped to one request | Architecture visualization |
| E9 | **Infrastructure** | Docker Compose, OTel Collector config, database migrations, seed data | Makes everything runnable |
| E10 | **Testing & Polish** | Unit tests, integration tests, failure injection, UI polish, demo scripts | Reliability and presentation |

---

## 2. Feature Breakdown

### 2.1 MUST HAVE (MVP — required for a working demo)

| Feature | Epic | Rationale |
|---------|------|-----------|
| Monorepo + build tooling | E9 | Foundation for parallel development |
| Docker Compose with all services | E9 | Single `docker compose up` to run everything |
| OTel instrumentation on all services | E1 | Data source for the entire product |
| OTel Collector receiving and forwarding traces | E2 | Bridge between simulated backend and DevTools server |
| PostgreSQL schema + migrations | E2 | Trace, span, log, service, and replay storage |
| OTLP trace receiver in DevTools server | E2 | Ingests telemetry data |
| REST API: `GET /api/v1/requests` | E2+E3 | Request Explorer data source |
| REST API: `GET /api/v1/requests/:traceId` | E2+E4 | Full trace detail |
| REST API: `GET /api/v1/traces/:traceId/waterfall` | E2+E4 | Waterfall data |
| React App Shell + routing | E3 | UI skeleton |
| Request Explorer list with virtual scroll | E3 | Core entry point |
| Request Explorer filters (method, status, service) | E3 | Usable request list |
| Trace Waterfall chart (custom SVG) | E4 | Core visualization |
| Request Detail panel with tabs | E4+E5 | Unified detail view |
| Overview tab (headers, body, timing) | E5 | Basic request inspection |
| Logs tab (trace-scoped, filterable) | E5 | Contextual log viewing |
| DB Queries tab (extracted from spans) | E5 | Request-scoped DB visibility |
| External Calls tab (extracted from spans) | E5 | Request-scoped API visibility |
| WebSocket: `new_request` event for live list | E2+E3 | Real-time update |
| Seed data + failure injection scripts | E9+E1 | Compelling demo content |

### 2.2 SHOULD HAVE (add if MVP is stable)

| Feature | Epic | Rationale |
|---------|------|-----------|
| Request Replay (POST + GET endpoints + service) | E6 | Major differentiator |
| Replay UI (button, progress, result) | E6 | Enables the replay workflow |
| Request Comparison (API + service) | E7 | Unique feature |
| Comparison UI (side-by-side diff) | E7 | Enables compare workflow |
| Service Topology (API + React Flow) | E8 | Visual architecture overview |
| Command Palette (Cmd+K) | E3 | Developer UX polish |
| Error boundary + loading states | E3 | Robustness |

### 2.3 NICE TO HAVE (stretch goals)

| Feature | Epic | Rationale |
|---------|------|-----------|
| Per-request topology (filtered view) | E8 | Richer context for individual requests |
| Latency budget breakdown | E4 | Performance debugging aid |
| Export/share trace | E2 | Collaboration |
| Dark mode toggle | E3 | UX preference |
| Keyboard shortcuts throughout | E3 | Power-user DX |

### 2.4 DO NOT BUILD

| Feature | Reason |
|---------|--------|
| Backend breakpoints / request pause | Requires deep runtime instrumentation |
| Production incident replay | Requires distributed state management |
| Real-time monitoring dashboards | APM territory |
| AI-powered root cause analysis | Out of scope (constraint: No AI) |
| Custom dashboard builder | APM territory |
| User authentication / multi-tenancy | Not needed for hackathon |
| Real database inspection (beyond query viewing) | Requires direct DB access |
| Service mesh integration | Too specific, too complex |
| API documentation generation | Postman territory |

---

## 3. Engineering Tasks

### Legend

- **Complexity:** XS (< 1 h) · S (1–2 h) · M (2–4 h) · L (4–6 h) · XL (6–10 h)
- **Parallelizable?** Whether the task can start before its listed dependency is fully complete (partial overlap is possible)

---

#### EPIC E9 — Infrastructure

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| I-01 | **Monorepo scaffold** | Create pnpm workspace with `packages/frontend`, `packages/devtools-server`, `packages/shared`, `services/`, `mocks/`, `db/`. Configure `tsconfig.base.json`, root `package.json`, `.gitignore`. | Foundation for all parallel work. | None | Empty workspace that builds cleanly. | `pnpm install` succeeds; `pnpm -r build` succeeds with no errors; all package dirs exist. | S | NO | F — Infrastructure | Infra Lead |
| I-02 | **Docker Compose base** | Create `docker-compose.yml` with postgres, redis, otel-collector, and placeholder services. | All services need a running DB and collector. | I-01 | Compose file that starts postgres + redis + otel-collector. | `docker compose up postgres redis otel-collector` starts all three, health checks pass. | M | YES | F — Infrastructure | Infra Lead |
| I-03 | **PostgreSQL init scripts** | Create `db/devtools/001_initial.sql` (traces, spans, span_events, log_events, services, service_dependencies, replay_sessions) and `db/ecommerce/seed.sql` (users, products, orders schema + seed data). | Both the DevTools server and simulated backend need DB schemas. | I-02 | SQL files runnable against postgres. | Both SQL files execute without errors; `devtools` and `ecommerce` databases have all tables; seed data is queryable. | M | YES | F — Infrastructure | Infra Lead |
| I-04 | **OTel Collector config** | Create `otel-collector-config.yaml` with OTLP gRPC receiver, batch processor, attribute redactor (authorization, cookie, x-api-key), and OTLP exporter to devtools-server. | Configures the telemetry pipeline. | I-02 | YAML config file. | Collector starts with this config; spans received on :4317 are exported to the configured endpoint. | S | YES | F — Infrastructure | Infra Lead |
| I-05 | **Shared types package** | Create `packages/shared` with TypeScript interfaces: `Trace`, `Span`, `SpanEvent`, `LogEvent`, `Service`, `ServiceDependency`, `ReplaySession`, `RequestSummary`, `WaterfallSpan`, `ComparisonResult`, `TopologyResult`, `API responses`. | Shared type contract prevents frontend/backend drift. | I-01 | `packages/shared/src/types.ts` with all interfaces. | `pnpm --filter shared build` succeeds; types importable from other packages. | M | YES | F — Infrastructure | Infra Lead |
| I-06 | **Dev server scripts** | Create `Makefile` or root scripts: `make up`, `make down`, `make seed`, `make reset-db`, `make logs`, `make test`. | Developer convenience for common operations. | I-02 | Working Makefile/scripts. | `make up` starts full stack; `make seed` populates demo data; `make reset-db` drops and recreates databases. | S | YES | F — Infrastructure | Infra Lead |

---

#### EPIC E1 — Simulated Backend

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| S-01 | **Shared OTel tracing init** | Create `services/shared/tracing.ts` using `@opentelemetry/sdk-node` with auto-instrumentations for Express, HTTP, pg, Redis. Accepts `SERVICE_NAME` env var. | Every service needs identical OTel setup; single source of truth. | I-01, I-02 | Reusable `initTracing(serviceName)` function. | Importable from all services; OTel SDK starts and exports to collector without errors. | M | YES | A — Simulated Backend | Backend Dev |
| S-02 | **API Gateway service** | Create Express server on :3000. Routes: `POST /api/orders` → auth-service → order-service; `GET /api/orders/:id` → order-service. Forwards `traceparent` header. Includes OTel init. | Entry point for all demo requests. | S-01 | Running API Gateway container. | `curl localhost:3000/api/orders` returns response; trace appears in OTel Collector. | M | YES | A — Simulated Backend | Backend Dev |
| S-03 | **Auth Service** | Create Express server on :3001. Endpoint `POST /auth/verify` validates JWT (simplified: any token with user_id works). Simulates 100ms latency. Includes OTel init. | Required by order flow. | S-01 | Running Auth Service container. | `curl -X POST localhost:3001/auth/verify` returns 200 with user info. | S | YES | A — Simulated Backend | Backend Dev |
| S-04 | **Order Service** | Create Express server on :3002. Endpoints: `POST /orders` (creates order in PostgreSQL, checks Redis cart cache), `GET /orders/:id`. Includes OTel init, pg instrumentation, Redis instrumentation. | Core business logic; generates DB + cache spans. | S-01, I-03 | Running Order Service container. | `POST /orders` inserts into PostgreSQL and returns 201; trace includes DB span with `db.statement`. | L | YES | A — Simulated Backend | Backend Dev |
| S-05 | **Payment Service** | Create Express server on :3003. Endpoint `POST /payments` calls Mock Payment API, records payment. Includes OTel init. | Generates external HTTP call spans. | S-01 | Running Payment Service container. | `POST /payments` returns 200; trace includes client HTTP span to mock-payment-api. | M | YES | A — Simulated Backend | Backend Dev |
| S-06 | **Mock Payment API (WireMock)** | Create WireMock stubs: `POST /charges` → 200 success (normal), 5s delay (30% of requests), 503 (every 20th request). Map files in `mocks/payment-api/mappings/`. Response bodies in `__files/`. | Deliberate failures make the demo compelling. | I-02 | Running WireMock container with stubs. | `POST localhost:4000/charges` returns success; ~30% of calls have 5s delay; ~5% return 503. | S | YES | A — Simulated Backend | Backend Dev |
| S-07 | **Failure injection: Order Service** | Add config-driven failures: slow DB query (>10 items → 3s delay via `pg_sleep`), Redis failure (every 30th request → cache miss fallback). | Waterfall shows timing anomalies for debugging demo. | S-04 | Failure scenarios triggerable by request params. | Order with >10 items shows 3s DB span; every 30th request shows Redis error span. | S | NO | A — Simulated Backend | Backend Dev |
| S-08 | **Failure injection: Auth Service** | Add timeout simulation: requests with invalid tokens trigger 5s timeout before rejection. | Shows timeout in waterfall. | S-03 | Failure triggerable by malformed token. | Request with `Authorization: Bearer invalid` shows 5s auth span with timeout error. | XS | NO | A — Simulated Backend | Backend Dev |
| S-09 | **Simulated e-commerce frontend** | Create minimal Next.js or plain HTML frontend that calls the API Gateway (place orders, view orders). Provides a UI for generating traffic. | Demo needs a "user" making requests. | S-02 | Browser page at :4002 that can place orders. | Opening `localhost:4002` and clicking "Place Order" triggers the full request flow. | M | NO | A — Simulated Backend | Frontend Dev |

---

#### EPIC E2 — DevTools Server

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| D-01 | **Fastify server scaffold** | Create `packages/devtools-server` with Fastify server, TypeScript config, health endpoint `GET /health`. | Foundation for all DevTools server work. | I-01, I-05 | Running Fastify server. | `pnpm --filter devtools-server dev` starts server; `curl localhost:4001/health` returns 200. | S | YES | B — DevTools Server | Backend Dev |
| D-02 | **Database connection + migrations** | Create `db/connection.ts` (pg Pool), migration runner, run `001_initial.sql` on startup. | All services need DB access. | D-01, I-03 | Server connects to PostgreSQL and creates tables. | Server starts; `devtools` database has all tables; connection pool handles concurrent queries. | M | YES | B — DevTools Server | Backend Dev |
| D-03 | **OTLP trace receiver** | Implement OTLP gRPC/HTTP receiver that accepts traces from the OTel Collector, transforms spans into our schema, applies redaction, and stores in PostgreSQL. | This is the ingestion pipeline — the most critical server component. | D-01, D-02, I-04 | Receiver accepting OTLP traces and writing to DB. | Send a test trace via OTLP → trace + spans + logs appear in PostgreSQL. | L | YES | B — DevTools Server | Backend Dev |
| D-04 | **Request list API** | `GET /api/v1/requests` with pagination, filtering (method, status, service, path), sorting, search. Uses `request_summary` view. | Powers the Request Explorer UI. | D-02 | API endpoint returning paginated request list. | `curl /api/v1/requests?page=1&limit=10` returns correct JSON; filters work; response < 200ms. | M | YES | B — DevTools Server | Backend Dev |
| D-05 | **Request detail API** | `GET /api/v1/requests/:traceId` returns full trace, spans, logs, DB queries (spans with `db.statement`), external calls (HTTP client spans with external `server.address`). | Powers the Request Detail view. | D-02 | API endpoint returning full trace detail. | `curl /api/v1/requests/:id` returns trace with all spans, logs, DB queries, external calls correctly categorized. | M | YES | B — DevTools Server | Backend Dev |
| D-06 | **Waterfall API** | `GET /api/v1/traces/:traceId/waterfall` computes `start_offset_ms`, `percentage_of_total`, `depth`, and `order` for each span. | Powers the waterfall visualization. | D-02 | API endpoint returning waterfall-ready span data. | Response spans have correct offsets, depths, and ordering; `start_offset_ms` + `duration_ms` never exceed `total_duration_ms`. | S | YES | B — DevTools Server | Backend Dev |
| D-07 | **Logs API** | `GET /api/v1/traces/:traceId/logs` with level and service filtering. | Powers the Logs tab. | D-02 | API endpoint returning trace-scoped logs. | `curl /api/v1/traces/:id/logs?level=error` returns only error logs for that trace. | S | YES | B — DevTools Server | Backend Dev |
| D-08 | **Topology API** | `GET /api/v1/topology` (global) and `GET /api/v1/topology?traceId=:id` (per-request). Derives nodes and edges from span relationships. | Powers the Service Topology view. | D-02 | API endpoint returning graph nodes and edges. | Response contains correct nodes (unique services) and edges (cross-service parent-child). | M | NO | B — DevTools Server | Backend Dev |
| D-09 | **WebSocket handler** | Implement `ws://localhost:4001/ws` with events: `new_request`, `trace_update`, `replay_progress`, `replay_complete`. Broadcasts new traces to connected clients. | Live updates in the UI without polling. | D-03 | WebSocket server that pushes `new_request` events. | Connect via `wscat`; receive `new_request` event within 1s of a new trace arriving. | M | NO | B — DevTools Server | Backend Dev |
| D-10 | **Replay service + API** | `POST /api/v1/replay` extracts request snapshot from original trace, re-executes HTTP request against simulated backend, waits for new trace, returns replay result. `GET /api/v1/replay/:replayId` polls status. | Enables request replay. | D-05, S-02 | Replay API that executes and returns a new trace. | `POST /api/v1/replay` with a valid trace_id → returns new trace_id within 5s; replay trace has correct spans. | L | NO | E — Replay & Compare | Backend Dev |
| D-11 | **Compare service + API** | `POST /api/v1/compare` accepts two trace IDs, returns duration diff, status match, service diff, span diff (matched by `service_name + operation_name`). | Enables request comparison. | D-05 | Compare API returning structured diff. | `POST /api/v1/compare` with two valid trace_ids → returns correct diffs for duration, services, and spans. | M | NO | E — Replay & Compare | Backend Dev |
| D-12 | **Secret redactor** | Two-layer redaction: OTel Collector attribute processor (headers) + server-side redactor (body fields: password, token, credit_card, ssn). | Security — prevents PII in stored traces. | D-03 | Redactor service. | Traces stored in DB have `**REDACTED**` for sensitive headers and `***` for sensitive body fields. | S | NO | B — DevTools Server | Backend Dev |
| D-13 | **Frontend static serving** | Build React app, serve from Fastify as static files on same port. | Single-port deployment, no CORS. | D-01, F-01 | Built React app served at root. | `curl localhost:4001/` returns HTML; React app loads and renders. | S | NO | F — Infrastructure | Infra Lead |

---

#### EPIC E3 — Request Explorer (Frontend)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| F-01 | **React app scaffold** | Create Vite + React + TypeScript app in `packages/frontend`. Configure Tailwind, shadcn/ui, React Router, React Query, Zustand. Create App Shell with sidebar, main content area, status bar. | Foundation for all frontend work. | I-01, I-05 | Running React dev server with routing. | `pnpm --filter frontend dev` starts; App Shell renders with sidebar and placeholder content. | M | YES | C — Frontend / UI | Frontend Dev |
| F-02 | **API client + types** | Create `lib/api.ts` with typed fetch functions for all DevTools server endpoints. Create `hooks/useRequests.ts` (React Query), `hooks/useTrace.ts`, `hooks/useWebSocket.ts`. | Frontend needs typed API access. | F-01 | API client module. | All API functions compile; React Query hooks return typed data; `useWebSocket` connects and receives events. | M | YES | C — Frontend / UI | Frontend Dev |
| F-03 | **Request Explorer list** | `RequestList.tsx` with virtual scrolling (react-window or similar), displaying method badge, path, status code, duration, service icons, timestamp. Color-coded by status. | Core entry point for the tool. | F-01, F-02, D-04 | Scrollable request list. | List renders 100+ requests smoothly; method badges color-coded; status codes color-coded; clicking a row navigates to detail. | L | YES | C — Frontend / UI | Frontend Dev |
| F-04 | **Request Explorer filters** | `RequestFilters.tsx` — dropdowns for method, status, service; text search input; duration range slider. | Filters make the list usable. | F-03 | Filter bar above request list. | Selecting a method filter shows only that method; search filters by path; filters compose (AND logic). | M | YES | C — Frontend / UI | Frontend Dev |
| F-05 | **Request Explorer layout** | Main content area with Request List occupying full height. Status bar shows connection status, total requests, filter counts. | Layout that feels like Chrome DevTools. | F-03, F-04 | Polished request explorer page. | Layout matches Chrome DevTools Network Tab aesthetic; status bar updates live. | S | NO | C — Frontend / UI | Frontend Dev |
| F-06 | **WebSocket live updates** | Connect to `ws://localhost:4001/ws`, subscribe to `new_request` events, prepend new requests to list. Show connection status indicator. | Real-time request capture is core UX. | F-02, D-09 | Live updating request list. | New requests appear at top of list within 1s of being captured; reconnection on disconnect; status indicator shows connected/disconnected. | M | NO | C — Frontend / UI | Frontend Dev |

---

#### EPIC E4 — Trace Waterfall (Frontend)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| W-01 | **Request Detail shell** | `RequestDetail.tsx` — tabbed layout (Overview, Waterfall, Logs, DB Queries, External APIs, Topology, Replay, Compare). Loads trace data on selection. | Container for all detail views. | F-01, F-02, D-05 | Clickable request → detail panel with tabs. | Clicking a request row opens detail panel; tabs render; selected trace data loads. | M | YES | C — Frontend / UI | Frontend Dev |
| W-02 | **Waterfall chart** | `WaterfallChart.tsx` — custom SVG waterfall with: time ruler (top), colored bars per span (service-colored), depth indentation, duration labels, hover tooltips with full span detail, click to expand attributes. | Core visualization — the "execution story". | W-01, D-06 | Interactive waterfall for any trace. | Waterfall renders all spans with correct timing offsets; bars are proportional; service colors consistent; hover shows details; clicking expands attributes. | XL | YES | C — Frontend / UI | Frontend Dev |
| W-03 | **Waterfall row component** | `WaterfallRow.tsx` — individual span row with: service name, operation name, duration bar, duration label, status indicator, expand/collapse for child spans. | Reusable span rendering. | W-02 | Individual row in the waterfall. | Row shows service name, operation, color-coded bar, duration in ms; error spans have red indicator. | M | YES | C — Frontend / UI | Frontend Dev |
| W-04 | **Overview tab** | `OverviewTab.tsx` — shows method, path, status code, duration, request headers (with redacted values shown as `**REDACTED**`), request body, response headers, response body. Syntax-highlighted JSON. | Basic request inspection. | W-01 | Tab with formatted request/response data. | Overview shows all request/response fields; JSON is syntax-highlighted; redacted values display correctly. | M | YES | C — Frontend / UI | Frontend Dev |

---

#### EPIC E5 — Context Panel (Frontend)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| C-01 | **Logs tab** | `LogsTab.tsx` — table of trace-scoped logs with level badge (color-coded), service name, message, timestamp, expandable attributes. Filterable by level and service. | Logs are essential for debugging. | W-01, D-07 | Logs tab with filterable log table. | Logs appear for selected trace; level badges colored (green=info, yellow=warn, red=error); filters work. | M | YES | C — Frontend / UI | Frontend Dev |
| C-02 | **DB Queries tab** | `DBQueriesTab.tsx` — list of database spans showing: service, operation (INSERT/SELECT/UPDATE), table name, SQL statement (syntax-highlighted), duration, status. | Request-scoped DB visibility is a key differentiator. | W-01, D-05 | DB Queries tab. | DB queries extracted from spans with `db.statement` attribute; SQL syntax-highlighted; duration shown. | M | YES | C — Frontend / UI | Frontend Dev |
| C-03 | **External Calls tab** | `ExternalCallsTab.tsx` — list of external HTTP client spans showing: method, URL, status code, duration, request/response details. | Request-scoped external API visibility. | W-01, D-05 | External Calls tab. | External API calls identified by non-internal `server.address`; shows method, URL, status, duration. | M | YES | C — Frontend / UI | Frontend Dev |

---

#### EPIC E6 — Request Replay (Frontend + Server)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| R-01 | **Replay tab UI** | `ReplayTab.tsx` — shows original request snapshot (read-only), optional override fields (path, headers, body), "Replay" button, progress indicator, result panel showing new trace link. | Enables the replay workflow from the UI. | W-01, D-10 | Replay tab with form and result. | User can click "Replay", see progress, click through to new trace. | M | YES | E — Replay & Compare | Frontend Dev |
| R-02 | **Replay WebSocket progress** | Wire `replay_progress` and `replay_complete` WebSocket events to the Replay tab. Show step-by-step progress. | Live progress feedback. | R-01, D-09 | Live replay progress in UI. | During replay, progress indicator updates; on completion, new trace link appears. | S | NO | E — Replay & Compare | Frontend Dev |

---

#### EPIC E7 — Request Comparison (Frontend + Server)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| CP-01 | **Compare tab UI** | `CompareTab.tsx` — two trace selectors (dropdown of traces for same path), side-by-side summary (duration, status, services), span-by-span diff table with colored duration deltas. | Enables the comparison workflow. | W-01, D-11 | Compare tab with side-by-side view. | User selects two traces; diff shows duration delta, service diff, span-by-span comparison with red/green indicators. | M | YES | E — Replay & Compare | Frontend Dev |

---

#### EPIC E8 — Service Topology (Frontend)

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| T-01 | **Topology tab** | `TopologyTab.tsx` — React Flow graph with service nodes (colored by type: service=blue, database=green, cache=orange, external=red) and labeled edges (protocol + avg latency). Click node to see service details. | Architecture visualization for debugging. | W-01, D-08 | Topology graph view. | Graph renders with correct nodes and edges; node colors match type; edge labels show protocol + latency; clicking node shows details. | L | YES | C — Frontend / UI | Frontend Dev |

---

#### EPIC E9 — Additional Infrastructure

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| I-07 | **Seed data script** | Create script to generate 50+ diverse requests: successful orders, slow payments, failed payments, auth timeouts, cache misses, multi-item orders. | Demo needs realistic, varied data. | S-07, S-08, D-03 | Script that generates and stores demo traces. | Running `make seed` produces 50+ requests with varied characteristics; traces visible in UI. | M | NO | F — Infrastructure | Infra Lead |

---

#### EPIC E10 — Testing & Polish

| ID | Task | Description | Why | Dependencies | Expected Output | Definition of Done | Complexity | Parallel? | Workstream | Owner |
|----|------|-------------|-----|--------------|-----------------|---------------------|------------|-----------|------------|-------|
| P-01 | **Command Palette** | `CommandPalette.tsx` — Cmd+K modal with fuzzy search across requests, services, navigation actions. | Developer UX polish — feels like a real dev tool. | F-01, D-04 | Cmd+K opens palette. | Cmd+K opens modal; type to filter; Enter selects; Esc closes; navigates to selected request or tab. | M | YES | G — Testing & Integration | Frontend Dev |
| P-02 | **Error boundaries + loading states** | Wrap all data-fetching components in error boundaries. Add skeleton loaders, empty states, error retry. | Robustness — prevents blank screens. | F-01 | Graceful error handling throughout. | Network errors show retry button; empty states show helpful messages; loading shows skeletons. | M | YES | G — Testing & Integration | Frontend Dev |
| P-03 | **Unit tests: DevTools server** | Vitest tests for CompareService (span matching, duration diff), TraceService (waterfall computation), ReplayService (snapshot extraction). | Validates core business logic. | D-06, D-10, D-11 | Test suite passing. | `pnpm --filter devtools-server test` passes; >80% coverage on services. | M | YES | G — Testing & Integration | Backend Dev |
| P-04 | **Integration tests: API** | Vitest + supertest tests for all REST endpoints: request list, request detail, waterfall, logs, replay, compare. | Validates API contracts. | D-04, D-05, D-06, D-07 | API test suite passing. | All endpoints tested with real DB; pagination, filtering, error responses verified. | M | YES | G — Testing & Integration | Backend Dev |
| P-05 | **E2E smoke test** | Playwright or manual script: start stack → make order → see in Request Explorer → view waterfall → replay → compare. | Validates full vertical slice works. | All tasks | End-to-end script. | Script completes without errors; all views render correctly. | M | NO | G — Testing & Integration | QA / Anyone |
| P-06 | **UI polish pass** | Consistent spacing, typography, color scheme. Keyboard navigation. Responsive layout. Loading shimmer. Tooltip consistency. | First impressions matter for judges. | All UI tasks | Polished, consistent UI. | No visual inconsistencies; keyboard navigation works; looks professional in screenshots. | M | NO | G — Testing & Integration | Frontend Dev |
| P-07 | **Demo script + talking points** | Write a 5-minute demo script: scenario walkthrough, key moments, failure demonstrations, replay showcase, comparison showcase. | Demo must be rehearsed and compelling. | All tasks | Written demo script. | Script covers all key features; timing fits within time limit; has backup plan for failures. | S | NO | G — Testing & Integration | Anyone |

---

## 4. Dependencies

### 4.1 Dependency Graph

```
Phase 0: Bootstrap
  I-01 (Monorepo) ──┬──→ I-02 (Docker) ──┬──→ I-03 (DB Schema)
                     │                    │──→ I-04 (OTel Config)
                     │                    │──→ S-01 (Shared OTel)
                     │                    └──→ D-02 (DB Connection)
                     └──→ I-05 (Shared Types) ──→ F-01 (React App)
                                                  D-01 (Fastify)

Phase 1: First Vertical Slice
  S-01 + I-03 ──→ S-02 (API Gateway)
  S-01 ──→ S-03 (Auth Service)
  S-01 ──→ S-04 (Order Service) + I-03
  S-01 ──→ S-05 (Payment Service)
  I-02 + I-04 ──→ D-03 (OTLP Receiver)
  D-01 + D-02 + D-03 ──→ D-04 (Request List API)
  D-04 ──→ F-03 (Request Explorer List)
  D-03 + D-04 ──→ D-06 (Waterfall API)
  D-05 ──→ W-01 (Request Detail Shell)
  D-06 ──→ W-02 (Waterfall Chart)

Phase 2-5: Feature Development (largely parallel)
  W-01 ──→ C-01 (Logs Tab), C-02 (DB Tab), C-03 (External Tab)
  W-01 + D-05 ──→ W-04 (Overview Tab)
  W-01 ──→ T-01 (Topology Tab) + D-08

Phase 6-7: Replay & Compare
  D-05 + S-02 ──→ D-10 (Replay Service)
  D-05 ──→ D-11 (Compare Service)
  D-10 ──→ R-01 (Replay UI)
  D-11 ──→ CP-01 (Compare UI)

Phase 8: Topology
  D-02 ──→ D-08 (Topology API)
  W-01 ──→ T-01 (Topology Tab)

Phase 9-11: Polish & Test
  All UI ──→ P-06 (Polish), P-07 (Demo Script)
  All Server ──→ P-03 (Unit Tests), P-04 (Integration Tests)
```

### 4.2 Hard Blockers

| Blocked Task | Blocked By | Nature |
|-------------|-----------|--------|
| Everything | I-01 (Monorepo) | Cannot start until monorepo exists |
| D-03 (OTLP Receiver) | D-01, D-02, I-04 | Need server scaffold + DB + collector config |
| D-04 (Request List API) | D-02 | Need DB connection |
| F-03 (Request List UI) | D-04 | Need API to consume |
| W-02 (Waterfall Chart) | D-06 | Need waterfall data shape |
| D-10 (Replay Service) | S-02, D-05 | Need running backend to replay against + trace data |
| D-11 (Compare Service) | D-05 | Need trace data to compare |

---

## 5. Team Assignment

### 5.1 Team Split (6 developers)

| Role | Alias | Focus | Primary Epics |
|------|-------|-------|---------------|
| **Infra Lead** | DEV-1 | Monorepo, Docker, DB, OTel Collector, Makefile, seed scripts | E9 |
| **Backend Dev 1** | DEV-2 | Simulated Backend services, OTel instrumentation, failure injection | E1 |
| **Backend Dev 2** | DEV-3 | DevTools Server: OTLP receiver, APIs, WebSocket, replay, compare | E2, E6, E7 |
| **Frontend Dev 1** | DEV-4 | Request Explorer, App Shell, API client, WebSocket live updates | E3 |
| **Frontend Dev 2** | DEV-5 | Waterfall, Context Panel tabs, Topology, Replay/Compare UI | E4, E5, E8 |
| **Full-Stack / QA** | DEV-6 | Command Palette, testing, polish, demo script, assist where needed | E10, support |

### 5.2 Task Ownership Matrix

| Task | Owner | Can Assist |
|------|-------|-----------|
| I-01 to I-07 | DEV-1 | DEV-3 |
| S-01 to S-09 | DEV-2 | DEV-1 |
| D-01 to D-13 | DEV-3 | DEV-2 |
| F-01 to F-06 | DEV-4 | DEV-5 |
| W-01 to W-04 | DEV-5 | DEV-4 |
| C-01 to C-03 | DEV-5 | DEV-4 |
| T-01 | DEV-5 | DEV-4 |
| R-01, R-02 | DEV-5 | DEV-3 |
| CP-01 | DEV-5 | DEV-3 |
| P-01, P-02, P-06 | DEV-6 | DEV-4 |
| P-03, P-04 | DEV-3, DEV-2 | DEV-6 |
| P-05 | DEV-6 | All |
| P-07 | DEV-6 | All |

### 5.3 Daily Sync Points

| Time | Activity | Who |
|------|----------|-----|
| Start of day | Unblock check: what's blocked, what's ready | All |
| Mid-day | Vertical slice smoke test | DEV-1, DEV-2, DEV-3 |
| End of day | Demo run-through + next-day plan | All |

---

## 6. Critical Path

The critical path determines the minimum time to a working demo. Every day of delay on these tasks delays the entire project.

```
I-01 (Monorepo)
  → I-02 (Docker)
    → I-04 (OTel Config)
    → I-03 (DB Schema)
      → D-02 (DB Connection)
        → D-04 (Request List API)
          → F-03 (Request List UI)  ← VISIBLE MILESTONE 1
            → W-01 (Detail Shell)
              → D-06 (Waterfall API)
                → W-02 (Waterfall Chart)  ← VISIBLE MILESTONE 2
                  → P-06 (Polish)
                    → P-07 (Demo Script)  ← FINAL DELIVERABLE

Also on critical path (parallel track):
  S-01 (Shared OTel)
    → S-02 (API Gateway)
      → S-04 (Order Service)
        → D-03 (OTLP Receiver)  ← must land before D-04 can return real data
```

**Critical path total:** ~16–20 hours

**Parallel track (simulated backend) total:** ~10–14 hours — must not lag behind server track.

### Milestones

| Milestone | Target | What's Working |
|-----------|--------|----------------|
| **M1: First Trace** | End of Phase 0 | HTTP request → trace in DB → visible via API |
| **M2: Request Explorer** | End of Phase 1 | Click through requests in UI, see list update live |
| **M3: Execution Story** | End of Phase 2-3 | Click request → see waterfall with timing and colors |
| **M4: Full Context** | End of Phase 4-5 | Logs, DB queries, external calls all visible per-request |
| **M5: Replay + Compare** | End of Phase 6-7 | Can replay a request and compare two executions |
| **M6: Demo Ready** | End of Phase 9-11 | Polished UI, demo script, seed data, failure scenarios |

---

## 7. First Vertical Slice

The first complete path that proves the architecture works end-to-end:

### Path

```
Simulated E-Commerce Frontend (:4002)
    ↓ user clicks "Place Order"
API Gateway (:3000)
    ↓ HTTP + traceparent
Auth Service (:3001)
    ↓ HTTP + traceparent
Order Service (:3002)
    ↓ pg query + Redis cache
PostgreSQL (:5432)
    ↓ OTel auto-instrumentation captures spans
OTel Collector (:4317)
    ↓ OTLP export
DevTools Server (:4001)
    ↓ stores in PostgreSQL (devtools DB)
REST API (GET /api/v1/requests)
    ↓ fetch
React UI (:4001/ or :4002 dev server)
    ↓ renders
Visible Trace in Request Explorer + Waterfall
```

### Implementation Order

| Step | Task | Owner | Est. Hours |
|------|------|-------|------------|
| 1 | I-01: Monorepo scaffold | DEV-1 | 1.5 |
| 2 | I-02: Docker Compose (postgres, redis, otel-collector) | DEV-1 | 2 |
| 3 | I-03: DB schema (both databases) | DEV-1 | 2 |
| 4 | I-04: OTel Collector config | DEV-1 | 1 |
| 5 | I-05: Shared types | DEV-1 | 1.5 |
| 6 | S-01: Shared OTel tracing init | DEV-2 | 2 |
| 7 | S-02: API Gateway | DEV-2 | 2 |
| 8 | S-03: Auth Service | DEV-2 | 1 |
| 9 | S-04: Order Service | DEV-2 | 4 |
| 10 | D-01: Fastify scaffold | DEV-3 | 1 |
| 11 | D-02: DB connection + migrations | DEV-3 | 2 |
| 12 | D-03: OTLP trace receiver | DEV-3 | 5 |
| 13 | D-04: Request List API | DEV-3 | 3 |
| 14 | F-01: React app scaffold | DEV-4 | 2 |
| 15 | F-02: API client + hooks | DEV-4 | 2 |
| 16 | F-03: Request Explorer list | DEV-4 | 4 |
| 17 | D-06: Waterfall API | DEV-3 | 1.5 |
| 18 | W-01: Request Detail shell | DEV-5 | 2 |
| 19 | W-02: Waterfall chart | DEV-5 | 6 |

**Total for vertical slice: ~46 person-hours ≈ 8 hours with 6 devs working in parallel**

### Verification Criteria

- [ ] `docker compose up` starts all services
- [ ] `curl -X POST localhost:3000/api/orders -H 'Content-Type: application/json' -d '{"userId":"user-1","items":[{"id":"item-1","qty":1}]}'` returns 201
- [ ] `curl localhost:4001/api/v1/requests` returns the request
- [ ] Opening the React UI shows the request in the list
- [ ] Clicking the request opens the waterfall with correct spans
- [ ] Waterfall shows timing, service breakdown, and correct ordering

---

## 8. Development Phases

### PHASE 0 — PROJECT BOOTSTRAP (3–5 hours)

**Goal:** Empty project → running infrastructure.

| Task | Owner | Parallel? |
|------|-------|-----------|
| I-01: Monorepo scaffold | DEV-1 | NO (first) |
| I-05: Shared types | DEV-1 | After I-01 |
| I-02: Docker Compose | DEV-1 | After I-01 |
| I-03: DB schema | DEV-1 | After I-02 |
| I-04: OTel Collector config | DEV-1 | After I-02 |
| I-06: Dev server scripts | DEV-1 | After I-02 |
| S-01: Shared OTel tracing | DEV-2 | After I-01 |
| D-01: Fastify scaffold | DEV-3 | After I-01, I-05 |
| F-01: React app scaffold | DEV-4 | After I-01, I-05 |

**Exit criteria:** All services start via `docker compose up`; Fastify health check passes; React dev server renders.

---

### PHASE 1 — FIRST VERTICAL SLICE (6–8 hours)

**Goal:** HTTP request → trace in DB → visible in UI.

| Task | Owner | Parallel? |
|------|-------|-----------|
| S-02: API Gateway | DEV-2 | YES |
| S-03: Auth Service | DEV-2 | YES |
| S-04: Order Service | DEV-2 | After S-03 (or parallel if routes are stubbed) |
| S-05: Payment Service | DEV-2 | YES |
| S-06: Mock Payment API | DEV-2 | YES |
| D-02: DB connection + migrations | DEV-3 | YES |
| D-03: OTLP trace receiver | DEV-3 | After D-02 |
| D-04: Request List API | DEV-3 | After D-03 |
| D-05: Request detail API | DEV-3 | After D-03 |
| D-06: Waterfall API | DEV-3 | After D-03 |
| D-07: Logs API | DEV-3 | After D-03 |
| F-02: API client + hooks | DEV-4 | YES |
| F-03: Request Explorer list | DEV-4 | After D-04, F-02 |
| F-06: WebSocket live updates | DEV-4 | After F-02 |
| W-01: Request Detail shell | DEV-5 | After D-05, F-01 |
| W-02: Waterfall chart | DEV-5 | After D-06, W-01 |
| W-04: Overview tab | DEV-5 | After W-01 |

**Exit criteria:** Place an order via curl or e-commerce frontend → trace appears in Request Explorer → clicking it shows waterfall and overview.

**This is the most important milestone. Once this works, everything else is additive.**

---

### PHASE 2 — REQUEST EXPLORER (3–4 hours)

**Goal:** Polished, filterable, searchable request list.

| Task | Owner | Parallel? |
|------|-------|-----------|
| F-04: Request Explorer filters | DEV-4 | YES |
| F-05: Request Explorer layout | DEV-4 | After F-04 |
| W-03: Waterfall row component | DEV-5 | YES |
| I-07: Seed data script | DEV-1 | After D-03 |

**Exit criteria:** 50+ seeded requests visible; filters work; layout feels like Chrome DevTools.

---

### PHASE 3 — TRACE / WATERFALL (2–3 hours)

**Goal:** Complete, interactive waterfall with span details.

| Task | Owner | Parallel? |
|------|-------|-----------|
| W-02: Waterfall chart polish | DEV-5 | — |
| W-03: Waterfall row polish | DEV-5 | — |
| Span attribute expansion in waterfall | DEV-5 | — |

**Exit criteria:** Waterfall is interactive; spans expand to show attributes; hover tooltips work; timing ruler is accurate.

---

### PHASE 4 — DATABASE + EXTERNAL API INSPECTION (3–4 hours)

**Goal:** DB Queries tab and External Calls tab fully functional.

| Task | Owner | Parallel? |
|------|-------|-----------|
| C-02: DB Queries tab | DEV-5 | YES |
| C-03: External Calls tab | DEV-5 | YES |
| C-01: Logs tab | DEV-5 | YES |

**Exit criteria:** For any trace, DB queries tab shows SQL with syntax highlighting; External calls tab shows HTTP details; Logs tab shows correlated logs.

---

### PHASE 5 — CONTEXTUAL LOGS (included in Phase 4)

**Goal:** Logs tab fully functional with filtering.

| Task | Owner | Parallel? |
|------|-------|-----------|
| C-01: Logs tab | DEV-5 | Already in Phase 4 |
| D-07: Logs API filtering | DEV-3 | Before C-01 |

**Exit criteria:** Logs filterable by level and service; error logs highlighted.

---

### PHASE 6 — REPLAY (4–5 hours)

**Goal:** Click "Replay" → see new execution trace.

| Task | Owner | Parallel? |
|------|-------|-----------|
| D-10: Replay service + API | DEV-3 | YES |
| D-09: WebSocket handler | DEV-3 | Before R-02 |
| D-12: Secret redactor | DEV-3 | YES |
| R-01: Replay tab UI | DEV-5 | After D-10 |
| R-02: Replay WebSocket progress | DEV-5 | After D-09, R-01 |

**Exit criteria:** Click "Replay" on any request → progress shown → new trace created → can navigate to replayed trace → can see differences from original.

---

### PHASE 7 — COMPARE (3–4 hours)

**Goal:** Select two traces → see side-by-side diff.

| Task | Owner | Parallel? |
|------|-------|-----------|
| D-11: Compare service + API | DEV-3 | YES |
| CP-01: Compare tab UI | DEV-5 | After D-11 |

**Exit criteria:** Select two traces for the same endpoint → see duration diff, service diff, span-by-span comparison with color indicators.

---

### PHASE 8 — SERVICE TOPOLOGY (3–4 hours)

**Goal:** Visual graph of service dependencies.

| Task | Owner | Parallel? |
|------|-------|-----------|
| D-08: Topology API | DEV-3 | YES |
| T-01: Topology tab (React Flow) | DEV-5 | After D-08, W-01 |

**Exit criteria:** Topology graph renders with correct nodes and edges; per-request topology filters to relevant services; node click shows details.

---

### PHASE 9 — UI POLISH (3–4 hours)

**Goal:** Professional, consistent UI.

| Task | Owner | Parallel? |
|------|-------|-----------|
| P-01: Command Palette | DEV-6 | YES |
| P-02: Error boundaries + loading states | DEV-6 | YES |
| P-06: UI polish pass | DEV-4, DEV-5 | After all UI tasks |
| D-13: Frontend static serving | DEV-1 | After build |

**Exit criteria:** No visual inconsistencies; keyboard navigation works; Cmd+K works; error states handled; looks great in screenshots.

---

### PHASE 10 — TESTING (4–5 hours)

**Goal:** Confidence that everything works.

| Task | Owner | Parallel? |
|------|-------|-----------|
| P-03: Unit tests (server) | DEV-3, DEV-2 | YES |
| P-04: Integration tests (API) | DEV-3 | After D-04–D-11 |
| P-05: E2E smoke test | DEV-6 | After all features |

**Exit criteria:** All tests pass; E2E script completes successfully.

---

### PHASE 11 — DEMO HARDENING (2–3 hours)

**Goal:** Demo-proof the application.

| Task | Owner | Parallel? |
|------|-------|-----------|
| I-07: Seed data (if not done) | DEV-1 | YES |
| S-07: Failure injection (if not done) | DEV-2 | YES |
| S-08: Failure injection (if not done) | DEV-2 | YES |
| S-09: E-commerce frontend | DEV-4 | YES |
| P-07: Demo script + talking points | DEV-6 | After all features |
| Full demo rehearsal | All | Last |

**Exit criteria:** Complete demo runs end-to-end without errors; timing fits within presentation slot; backup plan for common failures.

---

## 9. Feature Freeze

### Freeze Timeline

| Time | Freeze |
|------|--------|
| **T-4 hours** | Feature freeze: no new features. Only bug fixes, polish, and testing. |
| **T-2 hours** | Code freeze: no code changes except critical bug fixes. |
| **T-1 hour** | Final demo rehearsal. No changes. |
| **T-0** | Demo. |

### What's Frozen at Each Gate

| Gate | Allowed | Not Allowed |
|------|---------|-------------|
| Feature freeze | Bug fixes, CSS tweaks, test additions | New endpoints, new components, new features |
| Code freeze | `git commit --amend` for critical bugs only | Any code changes |
| Final | Demo script execution only | Any changes |

---

## 10. Scope-Cut Strategy

### FULL MVP (Target)

Everything in **MUST HAVE** section (Section 2.1):
- Monorepo + Docker + OTel pipeline
- Simulated backend (4 services + mocks + failures)
- DevTools server (OTLP receiver + REST API + WebSocket)
- React UI: Request Explorer, Waterfall, Context Panel (Overview, Logs, DB, External)
- Seed data with varied failure scenarios

**Total estimated effort: 46–60 person-hours (8–10 hours with 6 devs)**

### IF WE ARE 25% BEHIND

Cut from **SHOULD HAVE** (Section 2.2):
- ❌ Service Topology (T-01, D-08) — impressive but not essential
- ❌ Command Palette (P-01) — nice but not essential
- Reduce Context Panel to: Overview + Logs only (cut DB Queries tab C-02 and External Calls tab C-03)

**Recovery: saves ~8–10 person-hours**

### IF WE ARE 50% BEHIND

Cut from **MUST HAVE** + remaining **SHOULD HAVE**:
- ❌ Request Replay (D-10, R-01, R-02) — the "wow" feature but complex
- ❌ Request Comparison (D-11, CP-01) — requires replay first
- ❌ WebSocket live updates (F-06, D-09) — use polling instead
- ❌ E-commerce frontend (S-09) — use curl/Postman for demo traffic
- Simplify Waterfall to non-interactive (static SVG, no hover/click)

**Recovery: saves ~15–18 person-hours**

**What remains (MVP of the MVP):** Request Explorer (list + filters) → Waterfall (static) → Overview tab. This is the absolute minimum that demonstrates the concept.

### IF WE HAVE EXTRA TIME

Add from **NICE TO HAVE** (Section 2.3):
- ✅ Per-request topology (filtered React Flow view)
- ✅ Latency budget breakdown in waterfall
- ✅ Export/share trace (copy link)
- ✅ Dark mode toggle
- ✅ Keyboard shortcuts throughout
- ✅ More failure scenarios (connection pool exhaustion, cascading failures)
- ✅ Performance testing with k6

---

## 11. Definition of Done

### Per-Task Done Criteria

A task is **done** when:
1. Code is written, compiles, and is committed
2. Task-specific acceptance criteria (in Section 3) are met
3. No regressions in existing functionality
4. Code is reviewed by at least one other developer

### Per-Feature Done Criteria

#### Request Explorer

- [ ] Lists all captured requests with method, path, status, duration, services, timestamp
- [ ] Virtual scrolling handles 100+ requests without jank
- [ ] Filters: method (GET/POST/PUT/DELETE), status (ok/error), service, text search
- [ ] Filters compose (AND logic)
- [ ] New requests appear via WebSocket within 1s
- [ ] Clicking a row navigates to Request Detail
- [ ] Color coding: green (2xx), yellow (3xx), red (4xx/5xx), grey (other)

#### Trace Waterfall

- [ ] Renders all spans with proportional timing bars
- [ ] Depth indentation matches parent-child hierarchy
- [ ] Service-colored bars (consistent across the app)
- [ ] Time ruler at top showing absolute or relative time
- [ ] Duration label on each bar
- [ ] Hover tooltip shows: service, operation, duration, status
- [ ] Click to expand span attributes
- [ ] Error spans have red indicator

#### Context Panel

- [ ] **Overview tab:** Shows method, path, status, duration, headers (redacted), body, response
- [ ] **Logs tab:** Shows trace-scoped logs, filterable by level and service, color-coded levels
- [ ] **DB Queries tab:** Shows DB spans with operation, table, SQL (syntax-highlighted), duration
- [ ] **External Calls tab:** Shows HTTP client spans with method, URL, status, duration

#### Request Replay

- [ ] "Replay" button on any request triggers replay
- [ ] Progress indicator shows replay in progress
- [ ] New trace created and linked
- [ ] User can navigate to replayed trace
- [ ] Replay completes within 5 seconds

#### Request Comparison

- [ ] User can select two traces for the same endpoint
- [ ] Side-by-side summary: duration, status, services
- [ ] Span-by-span diff with duration deltas
- [ ] Color indicators: green (faster), red (slower), grey (same)

#### Service Topology

- [ ] Graph renders with all services as nodes
- [ ] Edges show dependency type (HTTP, DB, Cache, External)
- [ ] Node colors by type
- [ ] Edge labels show protocol + avg latency
- [ ] Click node shows service details

---

## 12. Demo Readiness Checklist

The demo is **ready** when ALL of the following are true:

### Infrastructure

- [ ] `docker compose up` starts the entire stack without errors
- [ ] All services are healthy (health checks pass)
- [ ] OTel Collector receives and forwards traces
- [ ] PostgreSQL has both databases with correct schemas
- [ ] Seed data is loaded (50+ diverse requests)

### Data Pipeline

- [ ] Placing an order generates a full trace across all services
- [ ] Traces include: HTTP spans, DB spans, Redis spans, external API spans
- [ ] Spans have correct parent-child relationships
- [ ] Logs are correlated to traces by trace_id
- [ ] Sensitive data is redacted in stored traces

### DevTools Server

- [ ] `GET /api/v1/requests` returns paginated, filterable results
- [ ] `GET /api/v1/requests/:traceId` returns full trace detail
- [ ] `GET /api/v1/traces/:traceId/waterfall` returns waterfall data
- [ ] WebSocket pushes `new_request` events in real-time
- [ ] Replay API works (if implemented)
- [ ] Compare API works (if implemented)
- [ ] Topology API works (if implemented)

### React UI

- [ ] Request Explorer loads and shows seeded requests
- [ ] Filters work (method, status, service, search)
- [ ] Clicking a request shows waterfall with correct timing
- [ ] Overview tab shows request/response detail
- [ ] Logs tab shows trace-scoped logs
- [ ] DB Queries tab shows SQL queries
- [ ] External Calls tab shows API calls
- [ ] WebSocket live updates work (new requests appear in list)
- [ ] No console errors
- [ ] No blank screens or broken layouts
- [ ] Cmd+K command palette works (if implemented)
- [ ] Topology graph renders (if implemented)
- [ ] Replay workflow works end-to-end (if implemented)
- [ ] Compare workflow works end-to-end (if implemented)

### Demo Script

- [ ] 5-minute demo script written
- [ ] Key failure scenarios identified (slow payment, auth timeout, cache miss)
- [ ] Demo rehearsed at least twice
- [ ] Backup plan for common failures (e.g., Docker doesn't start)
- [ ] Screenshots / backup slides ready

### Quality

- [ ] No crash on any user interaction
- [ ] All API endpoints return valid JSON (no 500 errors)
- [ ] Waterfall renders for traces with 1–20+ spans
- [ ] Performance acceptable (< 200ms API response, < 1s waterfall render)

---

## 13. FIRST 10 THINGS TO BUILD

These are the exact ten tasks to start, in order. Everything else depends on these.

| # | Task | Why First | Owner | Est. |
|---|------|-----------|-------|------|
| **1** | **I-01: Monorepo scaffold** | Nothing can be built until the workspace exists. This is the foundation for all parallel work. | DEV-1 | 1.5h |
| **2** | **I-02: Docker Compose (postgres, redis, otel-collector)** | Services need running infrastructure. Developers can't test without it. | DEV-1 | 2h |
| **3** | **I-03: PostgreSQL schema (devtools + ecommerce)** | Both the DevTools server and simulated backend need database schemas before any code can write data. | DEV-1 | 2h |
| **4** | **I-05: Shared TypeScript types** | Frontend and backend must agree on data shapes. Prevents integration pain later. | DEV-1 | 1.5h |
| **5** | **S-01: Shared OTel tracing initialization** | Every simulated service needs identical OTel setup. Single source of truth. | DEV-2 | 2h |
| **6** | **S-02: API Gateway service** | Entry point for all demo requests. First service to build and verify OTel integration. | DEV-2 | 2h |
| **7** | **S-04: Order Service** | Core business logic. Generates DB spans, Redis spans, and downstream HTTP spans. Most complex simulated service. | DEV-2 | 4h |
| **8** | **D-03: OTLP trace receiver** | The ingestion pipeline. Without this, no trace data reaches the DevTools server. Highest-risk server component. | DEV-3 | 5h |
| **9** | **D-04: Request List API** | First API endpoint the UI will consume. Enables the Request Explorer. | DEV-3 | 3h |
| **10** | **F-03: Request Explorer list (React)** | First visible UI milestone. Makes the trace data tangible and demo-able. | DEV-4 | 4h |

**After these 10 tasks:** You have a working vertical slice. A request goes through the simulated backend → OTel → DevTools server → API → React UI. This is the foundation everything else builds on.

---

## 14. PARALLEL WORKSTREAMS

### Stream A: Simulated Backend (DEV-2)

```
S-01 → S-02, S-03, S-04, S-05 (parallel) → S-06 → S-07, S-08 → S-09
```

**Can start:** After I-01 (monorepo exists)
**Blocks:** D-03 (OTLP receiver needs real traces to test), D-10 (replay needs running backend)
**Parallelizes with:** Streams B, C, D, E

### Stream B: DevTools Server (DEV-3)

```
D-01 → D-02 → D-03 → D-04, D-05, D-06, D-07 (parallel) → D-09 → D-10, D-11 → D-08 → D-12, D-13
```

**Can start:** After I-01, I-05 (monorepo + shared types)
**Blocks:** All frontend data-consuming components
**Parallelizes with:** Streams A, C

### Stream C: Frontend Core (DEV-4)

```
F-01 → F-02 → F-03 → F-04 → F-05
                  → F-06
```

**Can start:** After I-01, I-05 (monorepo + shared types)
**Blocks:** Nothing critical (UI is a consumer)
**Parallelizes with:** Streams A, B, D, E

### Stream D: Frontend Detail + Context (DEV-5)

```
W-01 → W-02, W-04 (parallel) → W-03
     → C-01, C-02, C-03 (parallel)
     → T-01
     → R-01 → R-02
     → CP-01
```

**Can start:** After F-01 (React app exists) + D-05 (detail API ready)
**Blocks:** Nothing critical
**Parallelizes with:** Streams A, B, C

### Stream E: Replay & Compare (DEV-3 + DEV-5)

```
D-10 (DEV-3) → R-01 (DEV-5) → R-02 (DEV-5)
D-11 (DEV-3) → CP-01 (DEV-5)
```

**Can start:** After D-05 (detail API) + S-02 (backend to replay against)
**Blocks:** Demo replay/compare features
**Parallelizes with:** Everything else (late-phase work)

### Stream F: Testing & Polish (DEV-6 + all)

```
P-01, P-02 (parallel) → P-06
P-03, P-04 (parallel) → P-05 → P-07
```

**Can start:** After core features are complete
**Blocks:** Demo readiness
**Parallelizes with:** Nothing (final phase)

---

## 15. MOST CRITICAL DEPENDENCY

### **D-03: OTLP Trace Receiver**

**Why this is the single most critical dependency:**

1. **Everything downstream depends on it.** Without trace data in PostgreSQL, no API returns data, no UI shows anything.
2. **It has the highest integration risk.** It must correctly: receive OTLP gRPC, transform spans into the PostgreSQL schema, handle batch processing, apply redaction, and write to multiple tables atomically.
3. **It bridges two teams.** The simulated backend team (DEV-2) produces telemetry; the server team (DEV-3) consumes it. This component is where they meet.
4. **OTel data completeness is unknown.** We don't know until we test whether auto-instrumentation captures `db.statement`, Redis commands, and cross-service context propagation correctly.
5. **It's on the critical path.** Every UI component depends on data flowing through this receiver.

**Mitigation:**
- DEV-3 starts D-01 (server scaffold) and D-02 (DB connection) immediately while DEV-2 builds the simulated backend
- Build a minimal OTLP receiver first (accept any spans, store raw), then iterate on transformation
- DEV-2 and DEV-3 pair-program the first end-to-end trace flow together
- Have manual instrumentation templates ready if auto-instrumentation misses data

---

## 16. MOST DANGEROUS SCOPE ITEM

### **Request Replay (D-10, R-01, R-02)**

**Why this is the most dangerous scope item:**

1. **Integration complexity is underestimated.** Replay requires: extracting request snapshot from stored trace → making HTTP request to simulated backend → waiting for OTel to export the new trace → finding the new trace in the database → linking it to the replay session. Each step can fail.
2. **Race conditions.** The replay HTTP request generates a new trace, but OTel export is asynchronous. There's a timing window where the replay response arrives but the trace hasn't been stored yet. The `findReplayTrace` function must handle this with polling/retry.
3. **It depends on both tracks.** Replay needs the simulated backend (Stream A) running AND the DevTools server (Stream B) fully functional AND the frontend (Stream D) ready. It's the last major feature to integrate.
4. **It's the feature judges will remember most.** If replay works, it's a "wow" moment. If it fails during the demo, it's a black mark. The risk-reward is asymmetric.
5. **It requires WebSocket coordination.** Real-time replay progress needs the WebSocket handler (D-09) working correctly, adding another integration point.

**Mitigation:**
- Build replay as a **late-phase feature** (Phase 6), not a core requirement
- Implement a **manual fallback**: if automated replay fails, have a pre-recorded replay in the demo script
- Test replay **end-to-end at least 5 times** before the demo
- Keep the replay UI simple: one button, one progress indicator, one result link
- **Cut replay first** if behind schedule (see Emergency Cut List)

---

## 17. EMERGENCY CUT LIST

Items to cut in strict order, from first to last. Cut from the bottom up if you have time; cut from the top if desperate.

| Priority | Feature | Saves | Impact of Cutting |
|----------|---------|-------|-------------------|
| **1 (cut first)** | Request Comparison (D-11, CP-01) | 6–8h | Loses "compare" demo; replay still works standalone |
| **2** | Request Replay (D-10, R-01, R-02) | 10–12h | Loses "replay" demo; core exploration still works |
| **3** | Service Topology (D-08, T-01) | 5–7h | Loses architecture graph; traces still tell the story |
| **4** | Command Palette (P-01) | 2–3h | Loses Cmd+K UX; navigation via sidebar still works |
| **5** | WebSocket live updates (F-06, D-09) | 4–5h | Revert to polling; less "live" but functional |
| **6** | E-commerce frontend (S-09) | 3–4h | Use curl/Postman for demo traffic; less visual |
| **7** | External Calls tab (C-03) | 2–3h | External call info still visible in waterfall spans |
| **8** | DB Queries tab (C-02) | 2–3h | DB query info still visible in waterfall spans |
| **9** | Seed data script (I-07) | 2–3h | Generate data manually; less variety in demo |
| **10 (cut last)** | Failure injection (S-07, S-08) | 2–3h | Demo less dramatic; all requests succeed |

### What Survives Every Emergency Cut

Even in the worst case, these MUST work:

1. ✅ Docker Compose starts everything
2. ✅ Place an order → trace captured
3. ✅ Trace visible in Request Explorer list
4. ✅ Click trace → see waterfall with timing
5. ✅ Overview tab shows request/response detail

**This is the irreducible minimum.** If these five things work, the project demonstrates its core thesis: "Chrome DevTools for your backend."

---

## APPENDIX: Task Count Summary

| Workstream | Tasks | Total Est. Hours |
|-----------|-------|-----------------|
| A — Simulated Backend | 9 | 14–18h |
| B — DevTools Server | 13 | 22–28h |
| C — Frontend / UI | 13 | 25–32h |
| D — Replay / Compare | 4 | 8–12h |
| E — Topology | 2 | 5–7h |
| F — Infrastructure | 7 | 10–14h |
| G — Testing / Polish | 7 | 11–15h |
| **TOTAL** | **55** | **95–126h** |

With 6 developers working in parallel: **~16–21 hours** (fits within a hackathon).

---

*This backlog is the execution plan. Every task maps to the approved architecture in `02-implementation-blueprint.md`. No feature is invented here — only decomposed, sequenced, and assigned.*
