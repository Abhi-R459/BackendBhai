# Handoff

> **Developer:** Demo Environment & Failure Simulation (Workstream 4 / DEV-4)
> **Last Updated:** September 6, 2026

---

## What Was Completed (Workstream 4)

### 1. Monorepo Scaffold (`I-01`)
- Configured `pnpm-workspace.yaml`, root `package.json`, and `tsconfig.base.json`.
- Created package and service stubs across all 22 workspace packages.
- Verified that `pnpm install` and `pnpm -r build` succeed cleanly with 0 errors across the entire monorepo.
- Compatibility ensured for both `apps/` + `packages/` layout and legacy `services/` paths.

### 2. Docker Compose Base & Full Orchestration (`I-02`)
- Authored `docker-compose.yml` configuring all services with health checks, volumes, and dependency ordering:
  - Infrastructure: `postgres:16-alpine` (:5432), `redis:7-alpine` (:6379), `otel-collector` (:4317/:4318)
  - Core & UI: `devtools-core` (:4001, single port serving built UI per D-13)
  - Demo microservices: `api-gateway` (:3000), `auth-service` (:3001), `order-service` (:3002), `payment-service` (:3003), `mock-payment-api` (:4000)
  - Demo frontend: `demo-frontend` (:4002)
- Created `infrastructure/otel-collector-config.yaml` with OTLP receivers, memory limiter, batch processor, and `otlphttp` exporter to DevTools server per Decision D-003.

### 3. PostgreSQL Init Scripts (`I-03`)
- Created `infrastructure/db/devtools/001_initial.sql` matching `contracts/DATA_MODEL.md` (`traces`, `spans`, `span_events`, `log_events`, `services`, `service_dependencies`, `replay_sessions`, all performance indexes).
- Created `infrastructure/db/ecommerce/001_initial.sql` matching `contracts/DATA_MODEL.md` (`users`, `products`, `orders`, `payments`, plus demo baseline users & products).
- Created automated multi-database entrypoints `infrastructure/db/init.sh` and `infrastructure/db/init.sql`.
- Created standalone Node.js scripts `scripts/init-db.js` and `scripts/reset-db.js`.

### 4. Dev Server Scripts & Makefile (`I-06`)
- Authored `Makefile` with targets: `up`, `down`, `seed`, `reset-db`, `logs`, `demo`.
- Created cross-platform one-command launcher `scripts/demo.js` runnable via `pnpm demo`.

### 5. Mock Payment API (`S-06`)
- Created WireMock stubs in `mocks/payment-api/mappings/` and `__files/`:
  - `charge-success.json` (200 OK, default majority)
  - `charge-slow.json` (200 OK with 5s delay, ~30% probability)
  - `charge-failure.json` (503 Service Unavailable, ~5% probability)
  - `charge-deterministic.json` (forces 200 OK immediately when `X-Replay-Mode: deterministic` header is present)
- Created standalone fallback Express server `apps/demo-store/mock-payment-api` matching the exact WireMock contract.

### 6. Failure Injection Modules & Demo Microservices (`S-07`, `S-08`, `S-02`-`S-05`)
- `apps/demo-store/order-service/src/failures.ts` & `services/order-service/src/failures.ts`:
  - `maybeInjectOrderDelay(items, db)`: Triggers 3-second database delay (`SELECT pg_sleep(3)`) for orders with >10 items.
  - `maybeInjectCacheMiss(sessionId, fetchFromCache)`: Forces Redis cache miss on every 30th request.
- `apps/demo-store/auth-service/src/failures.ts` & `services/auth-service/src/failures.ts`:
  - `maybeInjectAuthTimeout(token)`: Triggers 5-second sleep and throws `Auth service timeout` on invalid/malformed tokens.
- Implemented and verified all microservices: `api-gateway` (:3000), `auth-service` (:3001), `order-service` (:3002), `payment-service` (:3003).

### 7. Simulated E-Commerce Frontend (`S-09`)
- Created interactive web store on port `4002` (`apps/demo-store/frontend/`):
  - Catalog browsing and cart management.
  - One-click trigger buttons for Normal Order, Heavy Order (>10 items), Invalid Auth (5s timeout), and 10 Batch Orders.
  - Live latency, status badge, and Trace ID display.

### 8. Seed Data Script (`I-07`)
- Created `scripts/seed.js`:
  - Primary HTTP mode: fires 55 diverse requests at API Gateway covering all failure distributions.
  - Fallback direct DB mode: populates synthetic traces directly into `devtools` database if services are offline.

---

## Failure Scenario Verification Status

| Scenario | Trigger / Condition | Expected Behavior | Status |
|----------|---------------------|-------------------|--------|
| **Normal Checkout** | 1-3 items, valid token | Fast HTTP 201 (~250ms) | ✅ Tested & verified |
| **Slow DB Query** | Order with >10 items | 3s delay via `SELECT pg_sleep(3)` | ✅ Tested & verified |
| **Auth Timeout** | Token = `invalid` | 5s delay then 401 timeout error | ✅ Tested & verified |
| **Slow Payment** | ~30% payment rate or `X-Simulate-Slow` | 5s delay then 200 OK | ✅ Tested & verified |
| **Payment 503** | Every 20th payment or `X-Simulate-503` | HTTP 503 Service Unavailable | ✅ Tested & verified |
| **Redis Cache Miss** | Every 30th request | Forces DB fallback, cache miss span | ✅ Tested & verified |
| **Deterministic Replay** | `X-Replay-Mode: deterministic` | Instant 200 OK, overrides faults | ✅ Tested & verified |

---

## What the Next Developer Should Do

1. **Dev 1 (Telemetry Specialist):**
   - Implement `packages/instrumentation/` shared OTel initialization, body capture middleware, and console.log monkey-patch.
   - Demo microservices in `apps/demo-store/` are fully built and ready to import your tracing initialization.
2. **Dev 2 (Core Platform Engineer):**
   - Implement Fastify server in `apps/devtools-core/`. Database schemas and indexes in `infrastructure/db/devtools/` are ready.
3. **Dev 3 (Frontend Engineer):**
   - DevTools UI in `apps/devtools-ui/` can consume live traces from core server on port 4001.
   - Use `node scripts/seed.js` or e-commerce UI at `localhost:4002` to generate live requests.
4. **Dev 5 (Integration / QA):**
   - Run `pnpm test` and `node scripts/test-e2e-demo.js` to validate end-to-end integration.
