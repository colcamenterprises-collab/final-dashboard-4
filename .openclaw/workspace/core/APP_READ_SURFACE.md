# APP_READ_SURFACE — Bob Read-Only Access Governance Map

**Generated:** 2026-04-13  
**Authority:** `/api/bob/read/*` (Bearer token required, GET-only enforced)  
**Base URL:** `http://host/api/bob/read/`  
**Token env:** `BOB_READONLY_TOKEN`

---

## GOVERNANCE RULES

1. **Curated modules are preferred** for all recurring verification jobs. They carry structured `blockers[]`, `warnings[]`, and `status` fields that Bob can act on deterministically.
2. **Universal proxy** (`/proxy?path=...`) is permitted for investigation and debugging only. It must not be used as the default source for any recurring job if a curated module exists.
3. **Broken/empty modules** must not be used in recurring jobs. Log a blocker if data is absent and escalate.
4. All modules are **read-only**. No write operations exist in this namespace. Any `POST`/`PATCH`/`DELETE` to this namespace returns HTTP 405.

---

## MODULE REGISTRY

### SECTION: Core Health & Governance

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `system-health` | `GET /api/bob/read/system-health` | `bob_read_logs`, `analysis_reports`, runtime | Full system health: DB, env, active modules, latest build | **canonical** | ✅ yes | no |
| `system-map` | `GET /api/bob/read/system-map` | curated in-code map | Index of all pages → endpoints → canonical sources | **canonical** | ✅ yes | no |
| `module-status` | `GET /api/bob/read/module-status` | `daily_sales_v2`, `analysis_reports`, runtime | Quick-status across all active modules for dashboard | **canonical** | ✅ yes | no |
| `build-status` | `GET /api/bob/read/build-status?date=` | `analysis_reports`, `receipt_truth_daily_usage` | Per-date analysis build state and failure log | **canonical** | ✅ yes | no |

---

### SECTION: Daily Forms

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `forms/daily-sales` | `GET /api/bob/read/forms/daily-sales?date=&limit=` | `daily_sales_v2` (161 rows) | Raw daily sales form submissions | **canonical** | ✅ yes | no |
| `forms/daily-stock` | `GET /api/bob/read/forms/daily-stock?date=&limit=` | `daily_stock_v2` + `daily_sales_v2` | Raw daily stock form linked to sales forms | **canonical** | ✅ yes | no |

> **Canonical for: Daily Sales & Stock** → `forms/daily-sales` + `forms/daily-stock`

---

### SECTION: Shift

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `shift-snapshot` | `GET /api/bob/read/shift-snapshot?date=` | `daily_sales_v2`, `daily_stock_v2`, `roll_order`, `lv_receipt`, `receipt_truth_daily_usage`, `analysis_reports`, `ai_issues` | Full multi-source shift confidence snapshot with blockers | **canonical** | ✅ yes | no |
| `shift-report/latest` | `GET /api/bob/read/shift-report/latest?date=` | `shift_report_v2` (**0 rows — EMPTY**) | Compiled POS+sales+stock+variances shift report | **broken/empty** | ❌ no | ✅ investigation only — table unpopulated; trigger `POST /api/shift-report/generate` first |
| `roll-order` | `GET /api/bob/read/roll-order?date=` | `roll_order` (**0 rows — EMPTY**) | Bread roll order status and send confirmation | **broken/empty** | ❌ no | ✅ investigation only — no orders exist yet |

> **Canonical for: Sales & Shift Analysis** → `shift-snapshot` (primary) + `analysis/shift-analysis` (secondary)

---

### SECTION: Analysis

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `receipts/truth` | `GET /api/bob/read/receipts/truth?date=` | `receipt_truth_line` (5,268 rows), `lv_receipt` (4,282 rows) | Per-item normalized receipt truth with sale/refund split | **canonical** | ✅ yes | no |
| `usage/truth` | `GET /api/bob/read/usage/truth?date=` | `receipt_truth_daily_usage` (503 rows) | Daily ingredient usage derived from POS receipts | **canonical** | ✅ yes | no |
| `analysis/stock-usage` | `GET /api/bob/read/analysis/stock-usage?date=` | redirect → `usage/truth` | Alias for usage/truth | **derived** | ✅ yes (redirects) | no |
| `analysis/daily-comparison` | `GET /api/bob/read/analysis/daily-comparison?date=` | `daily_sales_v2`, `lv_receipt`, `analysis_reports` | Sales form vs POS receipts comparison for any date | **canonical** | ✅ yes | no |
| `analysis/prime-cost` | `GET /api/bob/read/analysis/prime-cost?date=` | internal proxy → `/api/metrics/prime-cost` | Food cost % and labour cost % metrics | **derived** | ✅ yes | no |
| `analysis/finance` | `GET /api/bob/read/analysis/finance` | internal proxy → `/api/finance/summary/today` + `/api/finance/summary` | MTD + today financial summary | **derived** | ✅ yes | no |
| `analysis/shift-analysis` | `GET /api/bob/read/analysis/shift-analysis?date=` | `daily_sales_v2`, `daily_stock_v2`, `receipt_truth_line` | Per-category sales breakdown + top 20 items for a shift | **canonical** | ✅ yes | no |
| `reports/item-sales` | `GET /api/bob/read/reports/item-sales?date=` | `lv_receipt`, `receipt_truth_line` | Item-level sales count from POS receipts | **canonical** | ✅ yes | no |
| `reports/modifier-sales` | `GET /api/bob/read/reports/modifier-sales?date=` | `lv_modifier`, `lv_receipt` | Modifier group counts per shift | **canonical** | ✅ yes | no |
| `reports/category-totals` | `GET /api/bob/read/reports/category-totals?date=` | `receipt_truth_line` | Sales quantity by POS category per shift | **canonical** | ✅ yes | no |

> **Canonical for: Receipts Analysis** → `receipts/truth`  
> **Canonical for: Grab vs Loyverse** → ⛔ NO MODULE — client-side CSV-only reconciliation tool; no backend API exists. Bob cannot access this area. Escalate to engineering if server-side Grab data feed is required.

---

### SECTION: Purchasing

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `purchasing/items` | `GET /api/bob/read/purchasing/items?category=&active=&limit=` | `purchasing_items` (82 rows) | Full purchasing catalogue with supplier, cost per unit, category | **canonical** | ✅ yes | no |
| `purchasing/tally` | `GET /api/bob/read/purchasing/tally?date=&limit=` | `purchase_tally` (148 rows) + `purchase_tally_drink` | Roll/meat + drinks purchase tally log with totals | **canonical** | ✅ yes | no |
| `purchasing/shift-log` | `GET /api/bob/read/purchasing/shift-log` | internal proxy → `/api/purchasing-shift-log` | Full purchasing shift matrix with category breakdown | **derived** | ✅ yes | no |
| `purchasing/shopping-list` | `GET /api/bob/read/purchasing/shopping-list` | `shopping_list`, `shopping_list_items` (**0 item rows**), `shopping_purchases` | Active shopping lists and recent purchase records | **partial** | ⚠️ caution — `shopping_list_items` empty; `shopping_purchases` may have data | ✅ investigation |

> **Canonical for: Purchasing history** → `purchasing/tally` (primary) + `purchasing/items` (catalogue)

---

### SECTION: Operations

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `operations/expenses` | `GET /api/bob/read/operations/expenses?date=&limit=` | `expenses` (70 rows) | Expense records with totals by type | **canonical** | ✅ yes | no |
| `operations/balance` | `GET /api/bob/read/operations/balance` | internal proxy → `/api/balance/pos` + `/api/balance/forms` + `/api/balance/combined` | POS cash balance + forms balance reconciliation | **derived** | ✅ yes | no |
| `operations/stock-review` | `GET /api/bob/read/operations/stock-review?date=&limit=` | `stock_received_log` (32 rows) | Stock received log with per-item summary | **canonical** | ✅ yes | no |
| `issues` | `GET /api/bob/read/issues?date=&status=&severity=&type=&limit=` | `ai_issues` | Theft-control issue register with full filter support | **canonical** | ✅ yes | no |

> **Canonical for: Balance / reconciliation** → `operations/balance`

---

### SECTION: Catalogue & Orders

| Module | Endpoint | Table / Source | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|---|
| `catalog` | `GET /api/bob/read/catalog?includeHidden=` | `item_catalog`, `online_catalog_items`, `modifier_group`, `modifier` | Full menu catalogue with modifiers and online items | **canonical** | ✅ yes | no |
| `orders` | `GET /api/bob/read/orders?status=&limit=&since=` | `orders_online`, `order_lines_online` | Online order read model | **canonical** | ✅ yes | no |

---

### SECTION: Universal Proxy

| Module | Endpoint | Purpose | Status | Recurring Safe | Investigation Only |
|---|---|---|---|---|---|
| `proxy` | `GET /api/bob/read/proxy?path=/api/ENDPOINT&params=...` | Passes any GET request to any unblocked `/api/*` endpoint in the app | **utility** | ⚠️ **not default for recurring jobs** — use curated modules unless no module exists | ✅ **primary use: investigation, debugging, one-off reads** |

**Proxy blocklist** (always returns 403):
- `/api/auth` — session/login mutations
- `/api/payment` — payment processing
- `/api/admin` — admin operations
- `/api/bob/read/proxy` — self-loop prevention

**Example valid proxy calls:**
```
GET /api/bob/read/proxy?path=/api/finance/summary/today
GET /api/bob/read/proxy?path=/api/metrics/prime-cost&date=2026-04-12
GET /api/bob/read/proxy?path=/api/purchasing-shift-log
GET /api/bob/read/proxy?path=/api/reports/list
GET /api/bob/read/proxy?path=/api/security/variance-history
GET /api/bob/read/proxy?path=/api/loyalty/members
```

---

## CANONICAL MODULE SUMMARY BY SECTION

| App Section | Canonical Module(s) | Fallback |
|---|---|---|
| **Sales & Shift Analysis** | `shift-snapshot` | `analysis/shift-analysis`, `analysis/daily-comparison` |
| **Receipts Analysis** | `receipts/truth` | `reports/item-sales`, `reports/category-totals` |
| **Daily Sales & Stock** | `forms/daily-sales` + `forms/daily-stock` | `shift-snapshot` |
| **Purchasing History** | `purchasing/tally` | `purchasing/shift-log` (proxy) |
| **Purchasing Catalogue** | `purchasing/items` | `proxy?path=/api/purchasing-items` |
| **Balance / Reconciliation** | `operations/balance` | `proxy?path=/api/balance/combined` |
| **Grab vs Loyverse** | ⛔ NO MODULE | Client-side CSV tool only — no server API |

---

## EMPTY / BROKEN TABLES (do not rely on for recurring jobs)

| Table | Row Count | Module Affected | Action Required |
|---|---|---|---|
| `shift_report_v2` | 0 | `shift-report/latest` | Run `POST /api/shift-report/generate` with `shiftDate` to populate |
| `roll_order` | 0 | `roll-order` | Roll order system not yet in active use |
| `shopping_list_items` | 0 | `purchasing/shopping-list` | Shopping list items empty — lists may exist but have no line items |

---

## AUTH & TRANSPORT

```
Authorization: Bearer <BOB_READONLY_TOKEN>
Method:        GET only (405 on all others)
Content-Type:  application/json
Envelope:      { ok, source, scope, date?, status, data, warnings[], blockers[], last_updated }
```

**Status field values:**
- `ok` — data present, no blockers
- `partial` — some data present, at least one blocker
- `missing` — no data found for requested scope
- `error` — request failed or upstream error
