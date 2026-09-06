# Backend DevTools — UI/UX Implementation Specification

> **Date:** September 3, 2026
> **Source of Truth:** [planning/01-product-research-validation.md](./01-product-research-validation.md) · [planning/02-implementation-blueprint.md](./02-implementation-blueprint.md) · [planning/03-development-backlog.md](./03-development-backlog.md)
> **Status:** Implementation-Ready
> **Primary Reference Feel:** Chrome DevTools · Linear · Raycast · modern observability tooling

---

## Table of Contents

1. [Information Architecture](#1-information-architecture)
2. [Navigation](#2-navigation)
3. [Screen Specifications](#3-screen-specifications)
4. [Component Architecture](#4-component-architecture)
5. [Design System](#5-design-system)
6. [Interaction System](#6-interaction-system)
7. [Animation System](#7-animation-system)
8. [Trace UI](#8-trace-ui)
9. [Service Topology UI](#9-service-topology-ui)
10. [Database Inspector UI](#10-database-inspector-ui)
11. [External API UI](#11-external-api-ui)
12. [Logs UI](#12-logs-ui)
13. [Replay UI](#13-replay-ui)
14. [Compare UI](#14-compare-ui)
15. [Command Palette](#15-command-palette)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Mock Data Requirements](#17-mock-data-requirements)
18. [Responsive Behavior](#18-responsive-behavior)
19. [Accessibility](#19-accessibility)
20. [Implementation Priorities](#20-implementation-priorities)
21. [Three Most Important Screens](#three-most-important-screens)
22. [Three Most Important Interactions](#three-most-important-interactions)
23. [Single Biggest Wow Moment](#single-biggest-wow-moment)
24. [What Makes This Feel Like a Real Developer Tool](#what-makes-this-feel-like-a-real-developer-tool)

---

## 1. Information Architecture

### 1.1 Application Map

```
Backend DevTools (Single-Page Application)
│
├── Request Explorer ────────────── (Primary entry point — always visible)
│   ├── Request List (virtual-scrolled table)
│   ├── Request Filters (method, status, service, search, duration)
│   └── Live Indicator (WebSocket status, request counter)
│
├── Request Detail ──────────────── (Panel below or beside the list)
│   ├── Trace Header (method badge, path, status, duration, services)
│   ├── Tab Bar
│   │   ├── Waterfall ───────────── (Default tab — the execution story)
│   │   │   ├── Time Ruler
│   │   │   ├── Span Rows (service-colored bars)
│   │   │   └── Span Detail (expanded attributes)
│   │   ├── Overview ────────────── (Request/response headers and body)
│   │   │   ├── Request Section
│   │   │   └── Response Section
│   │   ├── Logs ────────────────── (Trace-scoped log events)
│   │   │   ├── Log Table
│   │   │   └── Log Detail (expanded attributes)
│   │   ├── DB Queries ──────────── (Database spans with SQL)
│   │   │   └── Query List (syntax-highlighted SQL)
│   │   ├── External APIs ───────── (HTTP client spans)
│   │   │   └── Call List (method, URL, status, duration)
│   │   ├── Topology ────────────── (React Flow graph)
│   │   │   └── Service Graph (nodes + edges)
│   │   ├── Replay ──────────────── (Re-execute this request)
│   │   │   ├── Snapshot Review
│   │   │   ├── Override Form
│   │   │   ├── Progress Indicator
│   │   │   └── Result Panel
│   │   └── Compare ─────────────── (Diff two executions)
│   │       ├── Trace Selectors
│   │       ├── Summary Diff
│   │       └── Span Diff Table
│   └── Context Sidebar (optional — mini summary of key stats)
│
├── Command Palette ──────────────── (Cmd+K overlay — available anywhere)
│   ├── Search (fuzzy match across requests, services, navigation)
│   ├── Actions (navigate to tabs, toggle filters)
│   └── Recent (last 5 selected traces)
│
└── Status Bar ───────────────────── (Bottom bar — always visible)
    ├── Connection Status (WebSocket green/red dot)
    ├── Request Count (total captured)
    ├── Active Filters count
    └── Server Health indicator
```

### 1.2 Information Hierarchy

| Level | What | Priority |
|-------|------|----------|
| **L0** | Request Explorer list — the "network tab" | Highest — always visible, always updated |
| **L1** | Trace Header — method, path, status, duration | Immediate context when a request is selected |
| **L2** | Waterfall — timing and dependency story | Core value — the "execution story" |
| **L3** | Context tabs (Overview, Logs, DB, External) | Supporting evidence for debugging |
| **L4** | Topology, Replay, Compare | Advanced — secondary actions |
| **L5** | Command Palette, Status Bar | Navigation and system state |

### 1.3 Data-to-Screen Mapping

| API Response | Screen Region | Component |
|-------------|---------------|-----------|
| `GET /api/v1/requests` | Request List | `RequestList.tsx` |
| `GET /api/v1/requests/:traceId` | Request Detail (all tabs) | `RequestDetail.tsx` |
| `GET /api/v1/traces/:traceId/waterfall` | Waterfall tab | `WaterfallChart.tsx` |
| `GET /api/v1/traces/:traceId/logs` | Logs tab | `LogsTab.tsx` |
| `GET /api/v1/topology` | Topology tab | `TopologyTab.tsx` |
| `POST /api/v1/replay` | Replay tab | `ReplayTab.tsx` |
| `POST /api/v1/compare` | Compare tab | `CompareTab.tsx` |
| WebSocket `new_request` | Request List (prepend) | `useWebSocket.ts` |
| WebSocket `replay_progress` | Replay tab (progress) | `ReplayTab.tsx` |

---

## 2. Navigation

### 2.1 Primary Navigation Pattern

**No sidebar.** The application uses a **single-panel layout** inspired by Chrome DevTools and Linear:

```
┌──────────────────────────────────────────────────────────────┐
│  [Logo] Backend DevTools                    [Cmd+K]  [●]    │ ← Status Bar (top)
├──────────────────────────────────────────────────────────────┤
│  Filters: [Method ▾] [Status ▾] [Service ▾] [Search... ]   │ ← Filter Bar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Request List (upper 40% of viewport)                        │ ← Scrollable table
│  ┌────────────────────────────────────────────────────────┐  │
│  │ GET  /api/orders      201  1234ms  order-service  now  │  │
│  │ POST /api/orders      500  5012ms  payment-svc   2s ago│  │
│  │ GET  /api/orders/123  200   45ms   order-service  5s   │  │
│  │ ... (virtual scroll)                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Request Detail (lower 60% of viewport)                      │ ← Tabbed panel
│  [Waterfall] [Overview] [Logs] [DB] [API] [Topo] [Replay]   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  (Active tab content)                                  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ● Connected │ 127 requests │ 3 filters │ api-gateway: OK  │ ← Status Bar (bottom)
└──────────────────────────────────────────────────────────────┘
```

**Rationale:** Developers expect the list-above, detail-below pattern from Chrome DevTools Network Tab. No sidebar navigation needed — the request list IS the navigation.

### 2.2 Navigation Flows

| Flow | Trigger | Result |
|------|---------|--------|
| **Select request** | Click row in Request List | Detail panel opens/updates with that trace |
| **Keyboard select** | ↑/↓ arrows in Request List | Highlight moves; Enter opens detail |
| **Quick search** | Cmd+K | Command Palette overlay appears |
| **Go to waterfall** | Cmd+K → "waterfall" | Switches to Waterfall tab |
| **Go to logs** | Cmd+K → "logs" | Switches to Logs tab |
| **Toggle filter** | Cmd+K → "filter:POST" | Toggles POST method filter |
| **Navigate back** | Escape (when in detail) | Returns focus to Request List |
| **Copy trace ID** | Cmd+K → "copy trace id" | Copies selected trace ID to clipboard |

### 2.3 Keyboard Navigation Map

| Key | Context | Action |
|-----|---------|--------|
| `↑` / `↓` | Request List | Move selection |
| `Enter` | Request List | Open Request Detail for selected trace |
| `Escape` | Request Detail → Request List | Return focus to list |
| `Escape` | Command Palette | Close palette |
| `Tab` | Request Detail | Cycle through tabs (Waterfall → Overview → Logs → ...) |
| `Shift+Tab` | Request Detail | Cycle tabs backwards |
| `1`–`8` | Request Detail | Jump to tab by position (1=Waterfall, 2=Overview, ...) |
| `Cmd+K` | Anywhere | Open Command Palette |
| `/` | Request List (not focused on input) | Focus search filter |
| `r` | Request Detail (Waterfall tab) | Trigger Replay (if available) |
| `c` | Request Detail (any tab) | Open Compare tab |

---

## 3. Screen Specifications

### 3.1 Connection / Onboarding

**Purpose:** Show connection status before data flows.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│          Backend DevTools                             │
│                                                      │
│          ○ Connecting to server...                    │
│                                                      │
│          ┌─────────────────────────────────┐          │
│          │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │          │
│          │  (animated connection indicator)  │          │
│          └─────────────────────────────────┘          │
│                                                      │
│          Make a request to the simulated backend      │
│          to see it captured here.                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**States:**
| State | Visual | Description |
|-------|--------|-------------|
| Connecting | Pulsing dot + skeleton rows | WebSocket connecting to server |
| Connected (empty) | Green dot + empty state message | Connected but no requests captured yet |
| Connected (data) | Green dot + request list | Normal operation |
| Disconnected | Red dot + "Reconnecting..." banner | WebSocket disconnected, auto-reconnect |

**Primary action:** None (automatic connection)
**Secondary actions:** Retry connection, manual refresh

---

### 3.2 Request Explorer

**Purpose:** Browse all captured backend requests — the "Chrome DevTools Network Tab for backend."

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ [Method ▾] [Status ▾] [Service ▾] [Duration ▾] [🔍 search ]│
├──────────────────────────────────────────────────────────────┤
│ Method │ Path                  │ Status │ Duration │ Services│ Time  │
│────────│───────────────────────│────────│──────────│─────────│───────│
│ POST   │ /api/orders           │ 201    │ 1234ms   │ ●●●●    │ now   │
│ POST   │ /api/orders           │ 500    │ 5012ms   │ ●●●●    │ 2s    │
│ GET    │ /api/orders/789       │ 200    │ 45ms     │ ●●●     │ 5s    │
│ POST   │ /api/orders           │ 201    │ 892ms    │ ●●●●    │ 8s    │
│ GET    │ /api/orders           │ 200    │ 120ms    │ ●●      │ 12s   │
│ POST   │ /api/orders           │ 201    │ 1567ms   │ ●●●●    │ 15s   │
│ ...    │ ...                   │ ...    │ ...      │ ...     │ ...   │
├──────────────────────────────────────────────────────────────┤
│ ● Connected │ 127 requests │ 3 active filters              │
└──────────────────────────────────────────────────────────────┘
```

**Columns:**

| Column | Width | Content | Alignment |
|--------|-------|---------|-----------|
| Method | 72px | HTTP method badge (GET, POST, PUT, DELETE) | Left |
| Path | flex | URL path, truncated with ellipsis | Left |
| Status | 56px | HTTP status code, color-coded | Right |
| Duration | 80px | Duration in ms, color-coded | Right |
| Services | 120px | Small colored dots for each service touched | Left |
| Time | 80px | Relative time ("now", "2s", "5m") | Right |

**Method Badge Colors:**

| Method | Background | Text |
|--------|-----------|------|
| GET | `bg-blue-500/15 text-blue-400` | Blue |
| POST | `bg-emerald-500/15 text-emerald-400` | Green |
| PUT | `bg-amber-500/15 text-amber-400` | Amber |
| DELETE | `bg-red-500/15 text-red-400` | Red |
| PATCH | `bg-purple-500/15 text-purple-400` | Purple |

**Status Code Colors:**

| Range | Color | Meaning |
|-------|-------|---------|
| 2xx | `text-emerald-400` | Success |
| 3xx | `text-blue-400` | Redirect |
| 4xx | `text-amber-400` | Client error |
| 5xx | `text-red-400` | Server error |

**Duration Colors:**

| Range | Color | Meaning |
|-------|-------|---------|
| < 100ms | `text-emerald-400` | Fast |
| 100–500ms | `text-yellow-400` | Normal |
| 500ms–2s | `text-amber-400` | Slow |
| > 2s | `text-red-400` | Very slow |

**Service Dots:** Each dot represents a service touched by the request. Colors assigned per service (see Design System §5.8). Dots are 8px circles with 2px gap.

**Filter Bar Details:**
- Method filter: dropdown multi-select (GET, POST, PUT, DELETE, PATCH)
- Status filter: dropdown (ok, error, unset)
- Service filter: dropdown multi-select (populated from captured services)
- Duration filter: range slider (0ms – 10s)
- Search: text input with debounced full-text search on path

**States:**

| State | Visual |
|-------|--------|
| Loading | Skeleton rows (10 shimmer placeholders) |
| Empty | "No requests captured yet. Make a request to the simulated backend." |
| Error | "Failed to load requests. Retrying..." |
| Disconnected | Rows visible but dimmed; "Disconnected from server" banner |

**Interactions:**
- Click row → select and open Request Detail
- Double-click row → select and expand Waterfall tab directly
- Right-click row → context menu: "Copy Trace ID", "Copy cURL", "Replay", "Compare"
- Hover row → subtle background highlight (`bg-white/5`)

**Keyboard shortcuts:** ↑/↓ select, Enter opens, `/` focuses search

---

### 3.3 Trace Detail

**Purpose:** Show the complete execution story for one request.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ ◀ Back │ POST /api/orders │ 201 │ 1234ms │ ●●●●  │ Copy ID │
├──────────────────────────────────────────────────────────────┤
│ [Waterfall] [Overview] [Logs] [DB Queries] [External] [Topology] [Replay] [Compare] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  (Active tab content)                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Trace Header:**
- Back button (←) returns focus to Request List
- Method badge (colored)
- Path (full, selectable, monospace)
- Status code badge (colored)
- Duration badge
- Service dots
- "Copy Trace ID" button (copies hex string to clipboard, shows "Copied!" toast)

**Tab Bar:**
- Horizontal tab strip below the header
- Active tab: `border-b-2 border-white text-white` (bottom accent)
- Inactive tabs: `text-zinc-500 hover:text-zinc-300`
- Tab badges: Logs shows count badge if >0; DB shows count badge; External shows count badge
- Tabs are horizontally scrollable on narrow viewports

---

### 3.4 Request Waterfall

**Purpose:** Visualize the timing and dependency story of a request across services.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Trace: 5b8efff... │ Total: 1234ms │ 8 spans │ 4 services   │
├──────┬───────────────────────────────────────────────────────┤
│ 0ms  │ 200ms      │ 400ms      │ 600ms      │ 800ms │1234ms│ ← Time ruler
├──────┼───────────────────────────────────────────────────────┤
│ ▼    │ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ api-gateway    POST /api/orders 1234ms
│   ▼  │   ██░░░░░░░░░░░                                       │ auth-service   POST /auth/verify  112ms
│   ▼  │     █████████████████████████████████████████████████ │ order-service  POST /orders      800ms
│      │     ░██░░░░░                                         │   postgres     SELECT cart        12ms
│      │     ░░░█░░░░░░                                       │   redis        GET cart:session    2ms
│      │     ░░░░░███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   postgres     INSERT orders      45ms
│      │     ░░░░░░░░░░░░████████████████████████████████░░░░ │ payment-service POST /payments    350ms
│      │     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░ │   postgres     INSERT payments     10ms
│      │     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██ │ mock-payment   POST /charges      300ms
├──────┴───────────────────────────────────────────────────────┤
│ Span detail panel (expanded)                                 │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Service: payment-service                                │  │
│ │ Operation: POST /charges                                │  │
│ │ Duration: 300ms (24.3% of total)                        │  │
│ │ Status: ok                                              │  │
│ │ Attributes:                                             │  │
│ │   http.method: POST                                     │  │
│ │   http.url: http://mock-payment-api:4000/charges        │  │
│ │   http.status_code: 200                                 │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Waterfall Row Structure:**

Each row has two sections:
1. **Left info panel** (280px fixed): service name (indented by depth × 16px) + operation name + duration label
2. **Right chart panel** (flex): colored bar positioned by `start_offset_ms`, width proportional to `duration_ms`

**Span Bar Colors:** Assigned per service using the service color palette (§5.8). Bars use the service's primary color at 70% opacity, with full opacity on hover.

**Bar States:**

| State | Visual | Condition |
|-------|--------|-----------|
| Normal | Service color, 70% opacity | `status = "ok"` |
| Error | Red with diagonal stripe pattern | `status = "error"` |
| Slow | Amber pulsing border (subtle) | `duration_ms > 2000` |
| Selected | White border, 100% opacity | User clicked this span |
| Hovered | Lighter shade, tooltip appears | Mouse over |

**Span expansion:** Click a span row to expand below it showing a detail panel with all attributes as a key-value table. Expanded state persists until another span is clicked or collapsed.

**Interactions:**
- Click span → expand detail panel below the row
- Hover span → tooltip with service, operation, duration, status
- Click service name → filter request list to that service
- Click duration label → copy duration to clipboard

---

### 3.5 System Topology

**Purpose:** Visualize service dependencies as an interactive graph.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Service Topology │ [All Requests ▾] │ [Fit to Screen]       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         ┌──────────────┐                                     │
│         │ API Gateway  │                                     │
│         │ 1200ms avg   │                                     │
│         └──────┬───────┘                                     │
│           ┌────┴────┐                                        │
│     ┌─────▼──┐  ┌───▼──────────┐                            │
│     │  Auth  │  │    Order     │                            │
│     │ 112ms  │  │   800ms      │                            │
│     └────────┘  └──┬───┬───┬───┘                            │
│                    │   │   │                                 │
│               ┌────▼┐ ┌▼──┐┌▼─────────────┐                │
│               │ DB  │ │Red││   Payment    │                │
│               │ 15ms│ │2ms││   350ms      │                │
│               └─────┘ └───┘└──────┬───────┘                │
│                                   │                          │
│                             ┌─────▼──────┐                  │
│                             │Mock Payment│                  │
│                             │   300ms    │                  │
│                             └────────────┘                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Node Types:**

| Type | Shape | Color | Icon |
|------|-------|-------|------|
| Service | Rounded rectangle | `bg-blue-600` | Server icon |
| Database | Cylinder | `bg-emerald-600` | Database icon |
| Cache | Diamond | `bg-amber-600` | Lightning icon |
| External | Hexagon | `bg-purple-600` | Globe icon |

**Edge Labels:** Protocol + avg duration (e.g., "HTTP 112ms", "SQL 45ms", "Redis 2ms")

**Edge Colors:**

| Type | Color |
|------|-------|
| HTTP | `#60a5fa` (blue-400) |
| SQL | `#34d399` (emerald-400) |
| Redis | `#fbbf24` (amber-400) |
| External | `#a78bfa` (purple-400) |

**Interactions:**
- Click node → show service details in a popover (request count, error count, avg duration, list of operations)
- Drag node → reposition (layout snaps back after release)
- Scroll → zoom graph
- "Fit to Screen" button → reset zoom and center

**Filter Dropdown:** Switch between "All Requests" and per-request topology (filtered to services in the current trace).

---

### 3.6 Database Inspector

**Purpose:** Show database queries triggered by the selected request.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ DB Queries (3)                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ order-service ──────────────────────────────────────────┐ │
│ │ INSERT │ orders │ 45ms │ ok                              │ │
│ │ ┌───────────────────────────────────────────────────────┐│ │
│ │ │ INSERT INTO orders                                    ││ │
│ │ │   (user_id, items, status)                           ││ │
│ │ │ VALUES ($1, $2, $3)                                  ││ │
│ │ │ RETURNING *                                          ││ │
│ │ └───────────────────────────────────────────────────────┘│ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ order-service ──────────────────────────────────────────┐ │
│ │ SELECT │ cart │ 12ms │ ok                                │ │
│ │ ┌───────────────────────────────────────────────────────┐│ │
│ │ │ SELECT * FROM cart WHERE session_id = $1              ││ │
│ │ └───────────────────────────────────────────────────────┘│ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ payment-service ────────────────────────────────────────┐ │
│ │ INSERT │ payments │ 10ms │ ok                            │ │
│ │ ┌───────────────────────────────────────────────────────┐│ │
│ │ │ INSERT INTO payments (order_id, amount, status)       ││ │
│ │ │ VALUES ($1, $2, $3)                                  ││ │
│ │ └───────────────────────────────────────────────────────┘│ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Query Card Structure:**
- Header: service name · operation badge (INSERT/SELECT/UPDATE/DELETE) · table name · duration · status
- Body: SQL statement, syntax-highlighted
  - Keywords (`INSERT`, `INTO`, `VALUES`, `SELECT`, `FROM`, `WHERE`): `text-blue-400`
  - Table/column names: `text-emerald-400`
  - Parameters (`$1`, `$2`): `text-amber-400`
  - Regular text: `text-zinc-300`

**Operation Badge Colors:**

| Operation | Color |
|-----------|-------|
| SELECT | `bg-blue-500/15 text-blue-400` |
| INSERT | `bg-emerald-500/15 text-emerald-400` |
| UPDATE | `bg-amber-500/15 text-amber-400` |
| DELETE | `bg-red-500/15 text-red-400` |

**Interactions:**
- Click query card → expand to show full attributes (table, rows affected, execution plan if available)
- Click service name → filter to that service's queries

---

### 3.7 External API Inspector

**Purpose:** Show external HTTP API calls triggered by the selected request.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ External API Calls (1)                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ payment-service ────────────────────────────────────────┐ │
│ │ POST │ http://mock-payment-api:4000/charges │ 200 │ 300ms│ │
│ │                                                              │
│ │ Request:                                                    │ │
│ │ ┌───────────────────────────────────────────────────────┐  │ │
│ │ │ POST /charges HTTP/1.1                                │  │ │
│ │ │ Host: mock-payment-api:4000                           │  │ │
│ │ │ Content-Type: application/json                        │  │ │
│ │ │ Authorization: **REDACTED**                           │  │ │
│ │ │                                                       │  │ │
│ │ │ {"amount": 4999, "currency": "USD"}                   │  │ │
│ │ └───────────────────────────────────────────────────────┘  │ │
│ │                                                              │ │
│ │ Response:                                                   │ │
│ │ ┌───────────────────────────────────────────────────────┐  │ │
│ │ │ 200 OK                                               │  │ │
│ │ │ Content-Type: application/json                        │  │ │
│ │ │                                                       │  │ │
│ │ │ {"id": "ch_abc123", "status": "succeeded",           │  │ │
│ │ │  "amount": 4999, "currency": "USD"}                   │  │ │
│ │ └───────────────────────────────────────────────────────┘  │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Call Card Structure:**
- Header: service name · method badge · URL · status code · duration
- Request section: method + URL + headers (redacted) + body
- Response section: status + headers + body
- All code in monospace with JSON syntax highlighting

---

### 3.8 Contextual Logs

**Purpose:** Show logs correlated to the selected request by trace ID.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Logs (5)  │ [All ▾] [All Services ▾] [🔍 search logs ]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 12:00:00.050 │ INFO  │ api-gateway    │ Incoming request POST /api/orders │
│ 12:00:00.052 │ INFO  │ auth-service   │ Verifying token for user user-42  │
│ 12:00:00.160 │ INFO  │ order-service  │ Creating order for user user-42   │
│ 12:00:00.162 │ DEBUG │ order-service  │ Checking cart cache session-123   │
│ 12:00:00.950 │ INFO  │ order-service  │ Order created: order-789          │
│ 12:00:00.951 │ INFO  │ payment-service│ Processing payment for order-789  │
│ 12:00:01.250 │ INFO  │ payment-service│ Payment succeeded: ch_abc123      │
│ 12:00:01.251 │ INFO  │ api-gateway    │ Response: 201 Created             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Log Row Structure:**
- Timestamp (relative to trace start, e.g., `+50ms`)
- Level badge (colored)
- Service name (colored dot + name)
- Message (truncated, expandable)

**Level Badge Colors:**

| Level | Color | Icon |
|-------|-------|------|
| DEBUG | `text-zinc-500` | ⊘ |
| INFO | `text-blue-400` | ℹ |
| WARN | `text-amber-400` | ⚠ |
| ERROR | `text-red-400` | ✕ |

**Filter Bar:**
- Level filter: dropdown (All, DEBUG, INFO, WARN, ERROR)
- Service filter: dropdown (All + each service in trace)
- Search: text input, filters on message content

**Interactions:**
- Click log row → expand to show full attributes as key-value table
- Click service name → filter to that service's logs only
- Click level badge → filter to that level

---

### 3.9 Replay

**Purpose:** Re-execute the selected request against the simulated backend and capture a new trace.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Request Replay                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Original Request:                                            │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ POST /api/orders                                        │  │
│ │ Headers:                                                │  │
│ │   Content-Type: application/json                        │  │
│ │   Authorization: **REDACTED**                           │  │
│ │ Body:                                                   │  │
│ │   {"userId": "user-42", "items": [{"id": "item-1",...}]│  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ Optional Overrides:                                          │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Path:    [/api/orders                    ] (editable)   │  │
│ │ Headers: (add override key-value pairs)                 │  │
│ │ Body:    (editable JSON textarea)                       │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ [▶ Replay Request]                                           │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ▶ Replaying... ────────────────────────░░░░░░░░░░░░░░░ │  │
│ │ Step: Executing against API Gateway                     │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ Result:                                                      │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ✓ Completed │ 1180ms (original: 1234ms, -4.4%)        │  │
│ │                                                         │  │
│ │ Status: 201 Created                                     │  │
│ │                                                         │  │
│ │ [View Replay Trace]  [Compare with Original]            │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**States:**

| State | Visual | Action |
|-------|--------|--------|
| Ready | "Replay Request" button (enabled) | Click to start |
| Running | Progress bar + step label | Button disabled, progress animated |
| Completed | Green checkmark + duration comparison | "View Replay Trace" and "Compare" buttons |
| Failed | Red X + error message | "Retry" button |

---

### 3.10 Compare

**Purpose:** Diff two executions of the same request side by side.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Compare Executions                                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Trace A: [▼ select trace]          Trace B: [▼ select trace]│
│                                                              │
│ ┌──────────────────┬───────────────────────────────────────┐ │
│ │                  │                                       │ │
│ │ Duration         │ 1234ms          │ 1180ms             │ │
│ │ Delta            │                  │ -54ms (-4.4%)     │ │
│ │ Status           │ 201 ✓           │ 201 ✓              │ │
│ │ Services         │ ●●●● (4)        │ ●●●● (4)          │ │
│ │                  │                                       │ │
│ │ Span Diff        │                                       │ │
│ │ ──────────────── │ ─────────────── │ ─────────────────── │ │
│ │ POST /auth/verify│ 112ms           │ 108ms   -4ms  ✓    │ │
│ │ POST /orders     │ 800ms           │ 792ms   -8ms  ✓    │ │
│ │ INSERT orders    │ 45ms            │ 42ms    -3ms  ✓    │ │
│ │ POST /payments   │ 350ms           │ 320ms   -30ms ✓    │ │
│ │ POST /charges    │ 300ms           │ 270ms   -30ms ✓    │ │
│ │                  │                                       │ │
│ │ Added services   │ (none)                              │ │
│ │ Removed services │ (none)                              │ │
│ │                  │                                       │ │
│ └──────────────────┴───────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Diff Indicators:**

| Condition | Color | Icon |
|-----------|-------|------|
| Faster in B | `text-emerald-400` | ↓ |
| Slower in B | `text-red-400` | ↑ |
| Same | `text-zinc-500` | — |
| Status match | `text-emerald-400` | ✓ |
| Status mismatch | `text-red-400` | ✕ |
| Added service | `text-emerald-400 bg-emerald-500/10` | + |
| Removed service | `text-red-400 bg-red-500/10` | − |

---

### 3.11 Incident Timeline

> **Note:** Per the product spec, Incident Replay is explicitly excluded from the hackathon scope. The Incident Timeline is included here as a **nice-to-have stretch goal** only. If time permits, it would show a chronological timeline of related events (errors, slow requests) for a service or trace pattern.

**Layout (if implemented):**
```
┌──────────────────────────────────────────────────────────────┐
│ Incident Timeline │ Last 5 minutes                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 12:00:30 ● POST /api/orders 500 5012ms payment-service ✕    │
│ 12:00:28 ● POST /api/orders 201 1567ms order-service ✓      │
│ 12:00:25 ● POST /api/orders 201 1234ms order-service ✓      │
│ 12:00:22 ● POST /api/orders 500 5005ms payment-service ✕    │
│ 12:00:20 ● POST /api/orders 201 1200ms order-service ✓      │
│                                                              │
│ Pattern: payment-service returning 500 every ~10s            │
│ Root cause: Mock Payment API timeout (30% of requests)       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.12 Command Palette

**Purpose:** Quick navigation and action invocation — the "Raycast moment."

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ 🔍 Type a command or search...                   │
├──────────────────────────────────────────────────┤
│                                                  │
│ Recent                                           │
│   POST /api/orders (201, 1234ms)                 │
│   POST /api/orders (500, 5012ms)                 │
│                                                  │
│ Actions                                          │
│   → Go to Waterfall                              │
│   → Go to Logs                                   │
│   → Toggle POST filter                           │
│   → Toggle Error filter                          │
│   → Copy Trace ID                                │
│   → Replay Request                               │
│                                                  │
│ Services                                         │
│   → api-gateway (50 requests)                    │
│   → auth-service (50 requests)                   │
│   → order-service (48 requests)                  │
│   → payment-service (45 requests)                │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Search Behavior:**
- Fuzzy match across: request paths, service names, action names
- Results grouped by category (Recent, Actions, Services, Traces)
- ↑/↓ to navigate results, Enter to select, Esc to close
- Matches highlighted in bold within result text

**Keyboard:** `Cmd+K` opens, `Esc` closes, `Enter` selects

---

## 4. Component Architecture

### 4.1 Page Hierarchy

```
App
├── AppShell
│   ├── TopBar
│   │   ├── Logo ("Backend DevTools")
│   │   ├── CommandPaletteTrigger (Cmd+K)
│   │   └── ConnectionIndicator (WebSocket status)
│   │
│   ├── RequestExplorer
│   │   ├── FilterBar
│   │   │   ├── MethodFilter (MultiSelect)
│   │   │   ├── StatusFilter (Select)
│   │   │   ├── ServiceFilter (MultiSelect)
│   │   │   ├── DurationFilter (RangeSlider)
│   │   │   └── SearchInput (debounced text)
│   │   │
│   │   └── RequestList (virtual scroll)
│   │       └── RequestRow (× N)
│   │           ├── MethodBadge
│   │           ├── PathDisplay
│   │           ├── StatusCode
│   │           ├── DurationDisplay
│   │           ├── ServiceDots
│   │           └── RelativeTime
│   │
│   ├── RequestDetail (conditional — shown when trace selected)
│   │   ├── TraceHeader
│   │   │   ├── BackButton
│   │   │   ├── MethodBadge
│   │   │   ├── PathDisplay (monospace)
│   │   │   ├── StatusCode
│   │   │   ├── DurationBadge
│   │   │   ├── ServiceDots
│   │   │   └── CopyTraceIdButton
│   │   │
│   │   ├── TabBar
│   │   │   └── Tab (× N) with optional count badge
│   │   │
│   │   └── TabContent
│   │       ├── WaterfallTab
│   │       │   ├── WaterfallChart (SVG)
│   │       │   ├── TimeRuler
│   │       │   ├── SpanRow (× N)
│   │       │   │   ├── SpanInfo (service + operation + duration)
│   │       │   │   ├── SpanBar (colored, positioned)
│   │       │   │   └── SpanDetail (expandable attributes)
│   │       │   └── SpanTooltip (hover)
│   │       │
│   │       ├── OverviewTab
│   │       │   ├── RequestSection
│   │       │   │   ├── KeyValueTable (headers)
│   │       │   │   └── CodeBlock (body, JSON syntax highlighted)
│   │       │   └── ResponseSection
│   │       │       ├── KeyValueTable (headers)
│   │       │       └── CodeBlock (body)
│   │       │
│   │       ├── LogsTab
│   │       │   ├── LogFilterBar (level, service, search)
│   │       │   └── LogTable
│   │       │       └── LogRow (× N)
│   │       │           ├── Timestamp
│   │       │           ├── LevelBadge
│   │       │           ├── ServiceDot + Name
│   │       │           └── Message
│   │       │
│   │       ├── DBQueriesTab
│   │       │   └── QueryCard (× N)
│   │       │       ├── QueryHeader (service, operation, table, duration, status)
│   │       │       └── SQLBlock (syntax-highlighted)
│   │       │
│   │       ├── ExternalCallsTab
│   │       │   └── CallCard (× N)
│   │       │       ├── CallHeader (service, method, URL, status, duration)
│   │       │       ├── RequestBlock (headers + body)
│   │       │       └── ResponseBlock (status + headers + body)
│   │       │
│   │       ├── TopologyTab
│   │       │   ├── TopologyFilter (All Requests / Current Trace)
│   │       │   └── TopologyGraph (React Flow)
│   │       │       ├── ServiceNode
│   │       │       ├── DatabaseNode
│   │       │       ├── CacheNode
│   │       │       └── ExternalNode
│   │       │
│   │       ├── ReplayTab
│   │       │   ├── SnapshotDisplay (read-only original request)
│   │       │   ├── OverrideForm (path, headers, body)
│   │       │   ├── ReplayButton
│   │       │   ├── ProgressIndicator
│   │       │   └── ResultPanel (status, duration diff, links)
│   │       │
│   │       └── CompareTab
│   │           ├── TraceSelectorA
│   │           ├── TraceSelectorB
│   │           ├── SummaryDiff
│   │           └── SpanDiffTable
│   │               └── SpanDiffRow (× N)
│   │
│   └── StatusBar
│       ├── ConnectionDot
│       ├── RequestCount
│       ├── ActiveFilterCount
│       └── ServerHealth
│
├── CommandPalette (overlay)
│   ├── SearchInput
│   └── ResultList
│       └── ResultGroup (× N)
│           └── ResultItem (× N)
│
└── ErrorBoundary (wraps entire app)
```

### 4.2 Shared/Reusable Components

| Component | Used In | Props |
|-----------|---------|-------|
| `MethodBadge` | RequestRow, TraceHeader, ReplayTab | `method: string` |
| `StatusCode` | RequestRow, TraceHeader, CallCard | `code: number, size?: 'sm' | 'md'` |
| `DurationBadge` | RequestRow, TraceHeader, WaterfallRow | `ms: number, showColor?: boolean` |
| `ServiceDot` | RequestRow, TraceHeader, TopologyNode | `service: string, size?: 'sm' | 'md'` |
| `ServiceDots` | RequestRow, TraceHeader | `services: string[]` |
| `CodeBlock` | OverviewTab, ExternalCallsTab, DBQueriesTab | `code: string, language?: string` |
| `KeyValueTable` | OverviewTab, SpanDetail, LogDetail | `data: Record<string, any>` |
| `LevelBadge` | LogRow | `level: 'debug' | 'info' | 'warn' | 'error'` |
| `OperationBadge` | QueryCard | `operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'` |
| `SkeletonRow` | RequestList (loading) | — |
| `EmptyState` | All tabs | `title: string, description: string, icon?: ReactNode` |
| `ErrorState` | All tabs | `error: Error, retry?: () => void` |
| `Toast` | Global | `message: string, type: 'success' | 'error' | 'info'` |

---

## 5. Design System

### 5.1 Theme

**Dark-first.** The default (and only for hackathon) theme is dark. This is a developer tool — dark theme is expected and preferred.

| Property | Value |
|----------|-------|
| Background (base) | `bg-zinc-950` (#09090b) |
| Background (raised) | `bg-zinc-900` (#18181b) |
| Background (surface) | `bg-zinc-800` (#27272a) |
| Background (hover) | `bg-zinc-800/50` |
| Background (selected) | `bg-zinc-800` with `ring-1 ring-zinc-700` |
| Border (subtle) | `border-zinc-800` |
| Border (default) | `border-zinc-700` |
| Border (strong) | `border-zinc-600` |
| Text (primary) | `text-zinc-100` (#f4f4f5) |
| Text (secondary) | `text-zinc-400` (#a1a1aa) |
| Text (muted) | `text-zinc-500` (#71717a) |
| Text (disabled) | `text-zinc-600` |

### 5.2 Typography

| Role | Font | Size | Weight | Letter Spacing |
|------|------|------|--------|---------------|
| **App title** | Inter | 14px | 600 (semibold) | -0.01em |
| **Section heading** | Inter | 13px | 600 (semibold) | normal |
| **Body text** | Inter | 13px | 400 (normal) | normal |
| **Small text / labels** | Inter | 11px | 500 (medium) | +0.02em (uppercase for labels) |
| **Code / monospace** | JetBrains Mono | 12px | 400 | normal |
| **Badge text** | Inter | 10px | 600 (semibold) | +0.03em (uppercase) |
| **Duration numbers** | JetBrains Mono | 12px | 500 | normal |

**Font Loading:** Inter and JetBrains Mono loaded via Google Fonts or self-hosted woff2. Use `font-display: swap`.

### 5.3 Spacing Scale

Based on Tailwind's default 4px grid:

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps (icon to text, badge internals) |
| `space-2` | 8px | Default gap (between related items) |
| `space-3` | 12px | Section padding (small) |
| `space-4` | 16px | Section padding (default), card padding |
| `space-5` | 20px | Panel padding |
| `space-6` | 24px | Section spacing (between major sections) |
| `space-8` | 32px | Page-level padding |

### 5.4 Border Radius

| Element | Radius | Tailwind |
|---------|--------|----------|
| Cards, panels | 6px | `rounded-md` |
| Buttons | 6px | `rounded-md` |
| Badges | 4px | `rounded` |
| Input fields | 6px | `rounded-md` |
| Tooltips | 4px | `rounded` |
| Command palette | 12px | `rounded-xl` |
| Modals | 12px | `rounded-xl` |

### 5.5 Borders

| Context | Style |
|---------|-------|
| Panel dividers | `border-t border-zinc-800` (1px, subtle) |
| Card borders | `border border-zinc-700/50` |
| Input borders | `border border-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500` |
| Active tab | `border-b-2 border-white` |
| Waterfall row hover | `border-l-2 border-zinc-600` |

### 5.6 Shadows

Minimal shadows — this is a developer tool, not a marketing site.

| Element | Shadow |
|---------|--------|
| Command palette | `shadow-2xl shadow-black/50` |
| Tooltips | `shadow-lg shadow-black/30` |
| Popovers | `shadow-xl shadow-black/40` |
| Cards | No shadow (use borders instead) |
| Floating elements | `shadow-lg shadow-black/20` |

### 5.7 Icons

Use **Lucide React** icons (consistent with shadcn/ui). Key icons:

| Context | Icon | Lucide Name |
|---------|------|-------------|
| Method GET | — | (use text badge) |
| Service node | □ | `Server` |
| Database node | ◆ | `Database` |
| Cache node | ⚡ | `Zap` |
| External node | 🌐 | `Globe` |
| Replay | ▶ | `Play` |
| Compare | ⇄ | `GitCompare` |
| Copy | 📋 | `Copy` |
| Search | 🔍 | `Search` |
| Filter | ⊞ | `Filter` |
| Close | ✕ | `X` |
| Expand | ▾ | `ChevronDown` |
| Collapse | ▴ | `ChevronUp` |
| Back | ← | `ArrowLeft` |
| Error | ✕ | `XCircle` |
| Success | ✓ | `CheckCircle` |
| Warning | ⚠ | `AlertTriangle` |
| Loading | ⟳ | `Loader2` (animated) |
| Connected | ● | `Circle` (filled) |
| Disconnected | ● | `Circle` (red) |
| Topology | 🔗 | `Network` |

### 5.8 Service Color Palette

Each service gets a unique, persistent color. These colors are used consistently across waterfall bars, service dots, topology nodes, and log service indicators.

| Service | Primary Color | Tailwind | Usage |
|---------|--------------|----------|-------|
| api-gateway | `#3b82f6` | `blue-500` | Waterfall bars, dots, nodes |
| auth-service | `#8b5cf6` | `violet-500` | Waterfall bars, dots, nodes |
| order-service | `#f59e0b` | `amber-500` | Waterfall bars, dots, nodes |
| payment-service | `#ef4444` | `red-500` | Waterfall bars, dots, nodes |
| postgresql | `#10b981` | `emerald-500` | Waterfall bars, dots, nodes |
| redis | `#f97316` | `orange-500` | Waterfall bars, dots, nodes |
| mock-payment-api | `#a855f7` | `purple-500` | Waterfall bars, dots, nodes |

**Dynamic service colors:** For services not in the predefined map, assign colors from a rotating palette of 12 distinguishable colors.

### 5.9 Graph Colors (Topology)

| Element | Color |
|---------|-------|
| Service node fill | `#1e3a5f` (dark blue) |
| Service node border | `#3b82f6` (blue-500) |
| Database node fill | `#064e3b` (dark green) |
| Database node border | `#10b981` (emerald-500) |
| Cache node fill | `#78350f` (dark amber) |
| Cache node border | `#f59e0b` (amber-500) |
| External node fill | `#4c1d95` (dark purple) |
| External node border | `#a855f7` (purple-500) |
| Edge (HTTP) | `#60a5fa` (blue-400) |
| Edge (SQL) | `#34d399` (emerald-400) |
| Edge (Redis) | `#fbbf24` (amber-400) |
| Edge (External) | `#a78bfa` (purple-400) |
| Error node border | `#ef4444` (red-500), pulsing |
| Hovered node | `ring-2 ring-white/30` |

### 5.10 Animation Principles

| Principle | Rule |
|-----------|------|
| **Purpose-driven** | Every animation communicates state change or guides attention |
| **Fast** | 150ms default duration; 200ms max for most transitions |
| **Subtle** | Opacity and transform shifts, never flashy |
| **Composable** | Multiple small animations, not one big one |
| **Respectful** | `prefers-reduced-motion` disables all non-essential animations |

**Default timing:** `duration-150 ease-out` (150ms)
**Enter animations:** `opacity-0 → opacity-1` with slight `translate-y-1 → translate-y-0`
**Exit animations:** `opacity-1 → opacity-0` (no translate, just fade)
**Layout shifts:** `transition-all duration-150` for width/height changes

---

## 6. Interaction System

### 6.1 Core Interaction Patterns

| Pattern | Trigger | Response |
|---------|---------|----------|
| **Select** | Click row | Row highlighted, detail panel updates |
| **Expand** | Click span/log/query card | Detail panel slides open below (150ms) |
| **Hover** | Mouse over element | Subtle highlight + tooltip (after 300ms delay) |
| **Filter** | Click filter / type search | List updates instantly (optimistic) |
| **Command** | Cmd+K | Palette overlay appears (fade + scale from 98%) |
| **Action** | Click button | Immediate feedback (toast, state change) |
| **Navigate** | Keyboard shortcut | Instant tab switch or focus change |

### 6.2 Tooltip System

Tooltips appear after a **300ms hover delay** on interactive elements.

**Tooltip content by context:**

| Element | Tooltip Content |
|---------|----------------|
| Waterfall span bar | Service · Operation · Duration · Status · % of total |
| Service dot | Service name |
| Duration badge | Raw duration in ms |
| Status code | Status text (e.g., "201 Created") |
| Method badge | Full method name (e.g., "POST — Create") |
| Error indicator | Error message from span |
| Replay result | Duration comparison: "Xms (original Yms, ±Z%)" |

**Tooltip styling:**
```
bg-zinc-800 text-zinc-100 text-xs px-2 py-1 rounded shadow-lg shadow-black/30
max-w-xs truncate pointer-events-none z-50
```

### 6.3 Toast System

Toasts appear at bottom-right, auto-dismiss after 3 seconds.

| Type | Color | Use Case |
|------|-------|----------|
| Success | `border-emerald-500/30` | "Trace ID copied", "Replay completed" |
| Error | `border-red-500/30` | "Failed to load traces", "Replay failed" |
| Info | `border-blue-500/30` | "Connected to server", "New request captured" |

---

## 7. Animation System

### 7.1 Animation Catalog

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| **Row highlight** | 150ms | ease-out | Request selected |
| **Detail panel open** | 200ms | ease-out | Trace selected |
| **Tab switch** | 150ms | ease-out | Tab clicked |
| **Span expand** | 200ms | ease-out | Span clicked |
| **Tooltip appear** | 150ms | ease-out | 300ms hover |
| **Command palette open** | 200ms | ease-out | Cmd+K |
| **Command palette close** | 150ms | ease-in | Esc |
| **Toast enter** | 200ms | ease-out | Event |
| **Toast exit** | 150ms | ease-in | 3s timeout |
| **New request prepend** | 300ms | ease-out | WebSocket event |
| **Waterfall bar draw** | 400ms | ease-out | Tab becomes active |
| **Replay progress** | 1000ms | linear | Replay running |
| **Connection pulse** | 2000ms | ease-in-out | Connected state |
| **Error shake** | 300ms | ease-in-out | Error state |

### 7.2 New Request Animation

When a new request arrives via WebSocket:
1. New row prepends at top of list
2. Row starts at `opacity-0, bg-emerald-500/10`
3. Fades in over 300ms to `opacity-1`
4. Background color fades from `bg-emerald-500/10` to transparent over 1000ms
5. Request count in status bar increments with a brief scale pulse

### 7.3 Waterfall Bar Draw

When the Waterfall tab becomes active:
1. Bars animate from left to right (width: 0 → final width)
2. Each bar starts with a staggered delay based on `depth` (100ms per level)
3. Duration: 400ms total, ease-out
4. After animation, bars are static until hover

### 7.4 Slow/Error Span Highlight

When a span is slow (>2s) or has error status:
1. A subtle pulsing border appears (2px, opacity oscillates 0.3 → 0.6 → 0.3)
2. Pulse cycle: 2000ms, ease-in-out
3. On error spans: the bar has a diagonal stripe pattern (CSS `repeating-linear-gradient`)
4. Stripe pattern: 45° angle, 4px width, alternating `currentColor` and `transparent` at 10% opacity

---

## 8. Trace UI

### 8.1 Waterfall Chart Rendering

The waterfall is rendered as a **custom SVG** inside a React component. No D3 dependency.

**SVG Structure:**
```svg
<svg width="100%" height={totalRows * rowHeight}>
  <!-- Time ruler -->
  <g class="time-ruler">
    <line x1="{tickX}" y1="0" x2="{tickX}" y2="100%" stroke="zinc-800" />
    <text x="{tickX}" y="-4">{tickLabel}ms</text>
  </g>
  
  <!-- Span rows -->
  <g class="span-rows">
    {spans.map((span, i) => (
      <g class="span-row" transform="translate(0, {i * rowHeight})">
        <!-- Bar -->
        <rect
          x="{leftPadding + (span.start_offset_ms / totalDuration) * chartWidth}"
          y="4"
          width="{(span.duration_ms / totalDuration) * chartWidth}"
          height="{rowHeight - 8}"
          rx="3"
          fill="{serviceColor(span.service_name)}"
          opacity="{span.status === 'error' ? 1 : 0.7}"
          class="{span.status === 'error' ? 'error-pattern' : ''}"
        />
        <!-- Duration label (inside bar if wide enough, outside if not) -->
        <text>{span.duration_ms}ms</text>
      </g>
    ))}
  </g>
</svg>
```

**Bar positioning math:**
```
barX = leftPadding + (span.start_offset_ms / totalDuration) × chartWidth
barWidth = max((span.duration_ms / totalDuration) × chartWidth, minWidth=2px)
```

**Minimum bar width:** 2px (even for <1ms spans, the bar is visible)

**Left padding:** 280px (for the span info labels)

### 8.2 Span Information Display

Each span row in the waterfall shows:
- **Service name** (indented by depth × 16px, colored dot + text)
- **Operation name** (truncated with ellipsis)
- **Duration** (in ms, right-aligned)

The left info panel has a fixed width of 280px. The right chart panel fills remaining space.

---

## 9. Service Topology UI

### 9.1 Implementation

Uses **React Flow** (`@xyflow/react`) for the graph.

**Node types:**
- `serviceNode` — default rounded rectangle
- `databaseNode` — cylinder shape (custom SVG node)
- `cacheNode` — diamond shape (custom SVG node)
- `externalNode` — hexagon shape (custom SVG node)

**Edge types:**
- `httpEdge` — solid blue line
- `sqlEdge` — solid green line
- `redisEdge` — solid amber line
- `externalEdge` — dashed purple line

**Layout:** Use `dagre` or manual positioning (7 nodes is small enough for manual layout).

### 9.2 Node Popover

Click a node to see a popover with:
- Service name (heading)
- Request count
- Error count (with error rate percentage)
- Average duration
- List of operations (sorted by frequency)

---

## 10. Database Inspector UI

### 10.1 SQL Syntax Highlighting

Custom lightweight highlighter (no external library needed for this scope):

```typescript
function highlightSQL(sql: string): React.ReactNode {
  const keywords = ['INSERT', 'INTO', 'VALUES', 'SELECT', 'FROM', 'WHERE', 
                    'UPDATE', 'SET', 'DELETE', 'AND', 'OR', 'RETURNING', '*'];
  // Split by keywords and wrap in styled spans
  // Keywords: text-blue-400
  // Parameters ($1, $2): text-amber-400
  // Table/column names: text-emerald-400
  // Default: text-zinc-300
}
```

### 10.2 Query Card States

| State | Visual |
|-------|--------|
| Normal | White text, syntax-highlighted SQL |
| Error | Red left border, error message below SQL |
| Slow (>500ms) | Amber left border, duration highlighted |

---

## 11. External API UI

### 11.1 Request/Response Display

HTTP messages displayed in a monospace code block:
- Request line: `POST /charges HTTP/1.1` — `text-blue-400`
- Headers: `Key: Value` — key in `text-emerald-400`, value in `text-zinc-300`
- Redacted headers: `Authorization: **REDACTED**` — `text-amber-400`
- Body: JSON syntax-highlighted

### 11.2 Response Display

- Status line: `200 OK` — `text-emerald-400` (success) or `text-red-400` (error)
- Headers and body formatted same as request

---

## 12. Logs UI

### 12.1 Log Level Styling

| Level | Badge Color | Background | Text |
|-------|------------|-----------|------|
| DEBUG | `bg-zinc-700` | Dim | `text-zinc-400` |
| INFO | `bg-blue-500/15` | Subtle blue | `text-blue-400` |
| WARN | `bg-amber-500/15` | Subtle amber | `text-amber-400` |
| ERROR | `bg-red-500/15` | Subtle red | `text-red-400` |

### 12.2 Log Timestamp Display

Timestamps shown as relative to trace start:
- `+0ms` (first log)
- `+50ms`
- `+1200ms`
- `+1.2s` (converted to seconds when >1s)

### 12.3 Log Expansion

Click a log row to expand and show:
- Full timestamp (absolute)
- Service name
- All attributes as a key-value table
- Full message (if truncated)

---

## 13. Replay UI

### 13.1 Replay Workflow States

```
IDLE → RUNNING → COMPLETED
                  └→ FAILED (can retry → RUNNING)
```

**IDLE state:**
- Show original request snapshot (read-only code block)
- Show override form (collapsible)
- "▶ Replay Request" button (green, prominent)

**RUNNING state:**
- Progress bar (indeterminate, animated)
- Step label: "Executing against API Gateway..."
- Button disabled
- WebSocket listening for `replay_progress` events

**COMPLETED state:**
- Green checkmark icon
- Duration comparison: "1180ms (original: 1234ms, -4.4%)"
- Status: "201 Created"
- Two action buttons: "View Replay Trace" (primary), "Compare with Original" (secondary)

**FAILED state:**
- Red X icon
- Error message
- "Retry" button

### 13.2 Override Form

Collapsible section with:
- **Path:** text input, pre-filled with original path
- **Headers:** key-value editor (add/remove rows)
- **Body:** textarea with JSON syntax highlighting

Override values shown in amber to distinguish from original.

---

## 14. Compare UI

### 14.1 Trace Selection

Two dropdown selectors side by side:
- Pre-populated with traces for the same HTTP method + path as the current request
- Current trace pre-selected in "Trace A"
- "Trace B" defaults to the most recent replay of this request (if available)

### 14.2 Diff Visualization

**Summary row:** Side-by-side cards showing:
- Duration (with delta badge)
- Status code
- Services involved
- Span count

**Span diff table:** Table with columns:
| Operation | Service | Trace A Duration | Trace B Duration | Delta | Status Match |
|-----------|---------|-----------------|-----------------|-------|-------------|

Delta column colored:
- Green with ↓ if B is faster
- Red with ↑ if B is slower
- Grey with — if same

**Service diff:**
- Added services: green badge with +
- Removed services: red badge with −
- Unchanged: grey badge

---

## 15. Command Palette

### 15.1 Palette Design

**Overlay:** Full-screen semi-transparent backdrop (`bg-black/50 backdrop-blur-sm`)

**Palette container:**
- Centered horizontally, positioned at top 20% of viewport
- Width: 560px max
- Background: `bg-zinc-900`
- Border: `border border-zinc-700`
- Border radius: 12px
- Shadow: `shadow-2xl shadow-black/50`

**Search input:**
- Full width, no visible border
- Placeholder: "Type a command or search..."
- Font: Inter 15px
- Padding: 16px horizontal

**Results:**
- Max height: 320px, scrollable
- Grouped by category with section headers
- Each result: 36px height, hover highlight
- Selected result: `bg-zinc-800` with left accent border

### 15.2 Command Categories

| Category | Source | Example |
|----------|--------|---------|
| **Recent Traces** | Last 5 selected traces | `POST /api/orders (201, 1234ms)` |
| **Navigation** | Hardcoded | "Go to Waterfall", "Go to Logs", "Go to Overview" |
| **Actions** | Hardcoded + context-aware | "Copy Trace ID", "Replay Request", "Toggle POST filter" |
| **Services** | From captured data | "api-gateway (50 requests)" |
| **Traces** | From search results | "POST /api/orders (500, 5012ms)" |

---

## 16. Frontend Architecture

### 16.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + TypeScript 5 | Ecosystem, team familiarity |
| Build | Vite 5 | Fast HMR, modern |
| Styling | Tailwind CSS 3 + shadcn/ui | Rapid development, accessible components |
| State (server) | React Query (TanStack Query) | Caching, refetching, optimistic updates |
| State (client) | Zustand | Lightweight, simple global state |
| Routing | React Router v6 | Page-level routing (minimal) |
| Graph | React Flow (@xyflow/react) | Interactive node-edge graphs |
| Virtual Scroll | @tanstack/react-virtual | High-performance list rendering |
| WebSocket | Native WebSocket + custom hook | Real-time updates |
| Package Manager | pnpm | Monorepo-friendly |

### 16.2 State Management

**Zustand Store (`appStore.ts`):**

```typescript
interface AppState {
  // Selected trace
  selectedTraceId: string | null;
  setSelectedTraceId: (id: string | null) => void;
  
  // Active tab
  activeTab: 'waterfall' | 'overview' | 'logs' | 'db' | 'external' | 'topology' | 'replay' | 'compare';
  setActiveTab: (tab: AppState['activeTab']) => void;
  
  // Expanded span
  expandedSpanId: string | null;
  setExpandedSpanId: (id: string | null) => void;
  
  // Filters
  filters: {
    methods: string[];
    status: string | null;
    services: string[];
    search: string;
    minDuration: number | null;
    maxDuration: number | null;
  };
  setFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  
  // WebSocket
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
  
  // Command palette
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
}
```

**React Query Hooks:**

| Hook | Query Key | Fetcher | Refetch |
|------|-----------|---------|---------|
| `useRequests(filters)` | `['requests', filters]` | `GET /api/v1/requests` | On WS `new_request` |
| `useTrace(traceId)` | `['trace', traceId]` | `GET /api/v1/requests/:traceId` | On demand |
| `useWaterfall(traceId)` | `['waterfall', traceId]` | `GET /api/v1/traces/:traceId/waterfall` | On demand |
| `useLogs(traceId, filters)` | `['logs', traceId, filters]` | `GET /api/v1/traces/:traceId/logs` | On demand |
| `useTopology(traceId?)` | `['topology', traceId]` | `GET /api/v1/topology` | On demand |
| `useReplayStatus(replayId)` | `['replay', replayId]` | `GET /api/v1/replay/:replayId` | Polling (1s) |

### 16.3 WebSocket Hook

```typescript
function useWebSocket() {
  const { setWsConnected, addRequest } = useAppStore();
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4001/ws');
    
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      // Auto-reconnect with exponential backoff
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'new_request':
          addRequest(data.data);
          break;
        case 'replay_progress':
          // Handled by replay component
          break;
        case 'replay_complete':
          // Handled by replay component
          break;
      }
    };
    
    return () => ws.close();
  }, []);
}
```

### 16.4 Virtual Scrolling

The Request List uses `@tanstack/react-virtual` for virtual scrolling:
- Row height: 40px
- Overscan: 5 rows (render 5 extra rows above/below viewport)
- Scroll to top on filter change

### 16.5 Error Handling

| Level | Strategy |
|-------|----------|
| **Component** | React Error Boundary with fallback UI |
| **Data fetching** | React Query error states with retry |
| **WebSocket** | Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 10 attempts) |
| **Global** | Top-level ErrorBoundary shows "Something went wrong" with page reload button |

---

## 17. Mock Data Requirements

### 17.1 Seed Data Scenarios

The seed script should generate **50+ requests** with the following distribution:

| Scenario | Count | Characteristics | Demo Value |
|----------|-------|----------------|------------|
| **Successful order (small)** | 20 | 1-3 items, normal latency, 201 | Baseline "happy path" |
| **Successful order (large)** | 5 | 10+ items, slow DB query (3s), 201 | Waterfall shows DB bottleneck |
| **Successful order (slow payment)** | 10 | Normal except payment takes 5s, 201 | Waterfall shows external API slow |
| **Failed payment (503)** | 5 | Payment service returns 503, 500 | Error span with red indicator |
| **Auth timeout** | 5 | Invalid token → 5s timeout → 401 | Long auth span with error |
| **Cache miss** | 3 | Redis failure → fallback to DB, 201 | Shows cache miss pattern |
| **Fast GET** | 2 | Simple read, <50ms, 200 | Contrast with slow requests |

### 17.2 Service Color Assignments

Must be consistent across all seed data and UI components. Defined in §5.8.

### 17.3 Latency Distribution

| Span Type | Normal Latency | Slow Latency | Error Latency |
|-----------|---------------|-------------|---------------|
| HTTP server | 5-50ms | 500-5000ms | 5000ms (timeout) |
| PostgreSQL | 5-50ms | 3000ms (pg_sleep) | Connection error |
| Redis | 1-5ms | N/A | Connection refused |
| External HTTP | 100-300ms | 5000ms | 503 response |

---

## 18. Responsive Behavior

### 18.1 Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Large desktop** | ≥1920px | Full layout, all columns visible |
| **Standard desktop** | 1440px–1919px | Full layout, slightly compressed |
| **Laptop** | 1024px–1443px | Detail panel stacks below list (full-width) |
| **Tablet** | 768px–1023px | Single column, tabs become scrollable |
| **Mobile** | <768px | Not optimized — show "Use on desktop" message |

### 18.2 Desktop Layout (≥1440px)

```
┌────────────────────────────────────────────────────┐
│ Request List (40% height)                           │
├────────────────────────────────────────────────────┤
│ Request Detail (60% height)                         │
└────────────────────────────────────────────────────┘
```

### 18.3 Laptop Layout (1024px–1443px)

```
┌────────────────────────────────────────────────────┐
│ Request List (35% height)                           │
├────────────────────────────────────────────────────┤
│ Request Detail (65% height)                         │
│ (Tabs scroll horizontally, fewer visible at once)   │
└────────────────────────────────────────────────────┘
```

### 18.4 Narrow Layout (<1024px)

```
┌──────────────────────────────────┐
│ Request List (full width)        │
│ (compact mode: fewer columns)    │
├──────────────────────────────────┤
│ Request Detail (full width)      │
│ (tabs in dropdown, not strip)    │
└──────────────────────────────────┘
```

### 18.5 Desktop-First Priorities

1. **1920px** — Optimal experience, all information visible
2. **1440px** — Standard developer monitor, primary design target
3. **1280px** — Laptop, slightly compressed but fully functional
4. **1024px** — Small laptop, minimal compromise
5. **Below 1024px** — Functional but not optimized

**Do NOT:**
- Hide information to fit mobile
- Convert the waterfall to a non-interactive view
- Reduce font sizes below 11px
- Collapse the request list into cards

---

## 19. Accessibility

### 19.1 Keyboard Navigation

All interactive elements must be keyboard-accessible:
- Tab order follows visual layout
- Focus indicators visible (`ring-2 ring-zinc-500 ring-offset-2 ring-offset-zinc-950`)
- No keyboard traps (Escape always works)
- Arrow keys for list navigation

### 19.2 Screen Reader Support

- All ARIA roles properly set (`role="tablist"`, `role="tab"`, `role="tabpanel"`, etc.)
- `aria-label` on icon-only buttons
- `aria-live="polite"` on status updates (request count, connection status)
- `aria-selected` on active tab
- Table headers with `scope="col"`

### 19.3 Color Independence

- Status indicated by color AND icon/text (not color alone)
- Error rows: red background + ✕ icon + "ERROR" text
- Success: green + ✓ + "OK"
- Service dots: color + tooltip with service name

### 19.4 Reduced Motion

Respect `prefers-reduced-motion: reduce`:
- Disable waterfall bar draw animation
- Disable toast slide-in (instant appear)
- Disable connection pulse
- Disable all non-essential transitions

---

## 20. Implementation Priorities

### Phase 1: Foundation (Week 1)

| Task | Component | Priority |
|------|-----------|----------|
| Tailwind + shadcn/ui setup | Design system | P0 |
| AppShell + TopBar + StatusBar | Layout | P0 |
| FilterBar | Request Explorer | P0 |
| RequestList with virtual scroll | Request Explorer | P0 |
| RequestRow | Request Explorer | P0 |
| RequestDetail shell + TabBar | Detail | P0 |
| TraceHeader | Detail | P0 |

### Phase 2: Core Visualizations (Week 1-2)

| Task | Component | Priority |
|------|-----------|----------|
| WaterfallChart (SVG) | Waterfall | P0 |
| WaterfallRow | Waterfall | P0 |
| TimeRuler | Waterfall | P0 |
| SpanTooltip | Waterfall | P0 |
| SpanDetail (expanded) | Waterfall | P1 |
| OverviewTab | Overview | P0 |

### Phase 3: Context Panels (Week 2)

| Task | Component | Priority |
|------|-----------|----------|
| LogsTab + LogTable | Logs | P0 |
| LogRow + LevelBadge | Logs | P0 |
| DBQueriesTab + QueryCard | DB Inspector | P0 |
| SQL syntax highlighter | DB Inspector | P1 |
| ExternalCallsTab + CallCard | External API | P0 |

### Phase 4: Advanced Features (Week 2-3)

| Task | Component | Priority |
|------|-----------|----------|
| TopologyTab + React Flow | Topology | P1 |
| ServiceNode types | Topology | P1 |
| ReplayTab | Replay | P1 |
| Replay progress (WebSocket) | Replay | P1 |
| CompareTab | Compare | P1 |

### Phase 5: Polish (Week 3)

| Task | Component | Priority |
|------|-----------|----------|
| CommandPalette | Global | P1 |
| Error boundaries | Global | P1 |
| Loading skeletons | Global | P1 |
| Toast system | Global | P2 |
| Animations (waterfall draw, new request) | Global | P2 |
| Keyboard shortcuts | Global | P2 |
| Accessibility pass | Global | P2 |

---

## THREE MOST IMPORTANT SCREENS

### 1. Request Explorer (with live updates)

This is the home screen — the "Chrome DevTools Network Tab for backend." It must feel alive: requests flowing in, rows updating, filters responding instantly. This screen establishes the product's identity.

### 2. Trace Waterfall

The core value proposition. When a developer clicks a request and sees the waterfall, they should immediately understand the execution story. The colored bars, timing, and hierarchy must communicate at a glance which service is slow, which dependency failed, and where time was spent. This is the "aha" moment.

### 3. Command Palette

The Cmd+K palette is what elevates this from "nice demo" to "feels like a real developer tool." Fast fuzzy search, keyboard-driven navigation, instant action execution. This is the Linear/Raycast touch that signals quality.

---

## THREE MOST IMPORTANT INTERACTIONS

### 1. Live Request Entry

A new request appears at the top of the Request List via WebSocket. The row fades in with a green highlight that dissipates over 1 second. The request count in the status bar increments. This must feel **instantaneous** — the tool is alive and watching.

### 2. Waterfall Bar Draw

When the Waterfall tab opens, bars animate from left to right with a staggered delay by depth level. This animation communicates the flow of time and the hierarchy of dependencies. It turns static data into a **narrative**.

### 3. Replay → Compare Flow

Click "Replay" → progress bar fills → "View Replay Trace" link appears → click → new waterfall opens → click "Compare" → side-by-side diff appears. This is a multi-step workflow that must feel seamless and satisfying. Each step builds anticipation for the next.

---

## SINGLE BIGGEST WOW MOMENT

**The first waterfall reveal.** A developer clicks a request in the list — any request — and the waterfall appears showing the complete execution story across 4+ services, with database queries, Redis calls, and external API calls, all with precise timing. Color-coded bars. Hierarchy. Duration labels. A bottleneck jumping out visually. This is the moment that proves the product's thesis: "One request. One view. One tool." Every other feature supports this moment. If this single screen works beautifully, the hackathon is a success.

---

## WHAT MAKES THIS FEEL LIKE A REAL DEVELOPER TOOL

1. **Dark theme, always.** Not a toggle — a commitment. Developer tools are dark.
2. **Monospace for code.** Every path, SQL query, JSON body, and trace ID in JetBrains Mono. Always.
3. **Keyboard-first.** Cmd+K opens the command palette. Arrow keys navigate lists. Enter selects. Escape goes back. Tab cycles tabs. A developer should never need the mouse.
4. **Information density.** No wasted space. No hero banners. No onboarding carousels. Just data, presented precisely.
5. **Instant feedback.** Filters apply in <50ms. Tab switches are <150ms. WebSocket events appear in <1s. The tool never feels slow.
6. **Color as information, not decoration.** Every color communicates something: method, status, service, severity. Nothing is colored just to look nice.
7. **Redacted values shown as `**REDACTED**`**, not hidden. The tool shows you that information exists but is sensitive — like Chrome DevTools showing `Authorization: [redacted]`.
8. **Service names as identifiers**, not friendly labels. "api-gateway" not "API Gateway Service". Developers think in service names.
9. **Duration as the primary metric.** Every view leads with timing. Duration is how developers reason about performance.
10. **Consistent color for each service.** The same blue means "api-gateway" everywhere — waterfall, logs, topology, request list. Build recognition through consistency.

---

*This specification is implementation-ready. Every component, color, spacing value, and interaction has been defined. The frontend developer should be able to build from this document without ambiguity.*
