# Final Dashboard 5.1 — Alignment Repair Patch 1

## Scope and safety

This patch repairs confirmed alignment issues without adding product features, changing source-of-truth records, or changing schemas. The changes are read-path alignment, stored-value consistency, and explicit missing-source responses.

## Canonical source-of-truth decisions

| Area | Canonical source | Notes |
|---|---|---|
| POS receipts | `receipts` with `receipt_items` and `receipt_payments` | `/api/system/pos-status` and `/api/loyverse/sync` now expose this source explicitly. Legacy aggregate `loyverse_receipts` remains untouched but is not selected as canonical for this patch. |
| POS shift reports | `loyverse_shifts` | Exposed as the canonical shift report source in POS status endpoints. |
| Latest POS sync | `MAX(receipts."createdAt")` | Exposed separately from latest receipt business timestamp. |
| Shift window/timezone | `17:00-03:00 Asia/Bangkok` | Documented in POS status responses. Existing ingestion remains unchanged. |
| Daily Sales V2 | `daily_sales_v2` stored columns plus `payload` | New submissions now write stored totals at the same time as payload so library/reports do not read stale zero defaults. |
| Daily Stock V2 | `daily_stock_v2` | Read responses identify this source and return explicit blockers when unavailable. |
| Purchasing item catalogue | `purchasing_items` | Existing canonical catalogue preserved. Missing catalogue returns explicit blockers instead of 500. |
| Requested purchasing quantities | `purchasing_shift_items.quantity` | Shopping List root now reads this source and no longer adds fake/default drink items. |
| Purchased quantities | `purchase_tally` | Documented in Shopping List response metadata; no tally writes were changed. |
| Ingredients | `purchasing_items WHERE is_ingredient = true` | Missing DB source returns empty rows plus blockers. |
| Recipes | `recipes` | Missing DB source returns empty rows plus blockers. |
| Menu items | `menu_items_v3` | Menu V3 item API returns explicit missing-source blockers. |
| Online catalog | `product` filtered by `visible_online`, `price_online`, and `active` | Existing separate online catalog remains documented; no payment processing added. |
| Online orders | `orders_online` and `order_lines_online` | Added read alias `/api/online-orders` for admin/API alignment. |
| Finance P&L | `daily_sales_v2` stored sales/expense columns + `expenses` | Added `/api/finance/profit-loss` read endpoint aligned to Daily Sales V2 stored values. |
| Staff operations | Staff ops tables (`staff_members`, `shift_rosters`, `cleaning_task_templates`, etc.) | Dashboard now returns explicit blockers instead of 500 when unavailable. |

## Endpoints changed

| Endpoint | Change |
|---|---|
| `GET /api/system/pos-status` | Reports canonical POS sources, counts, timezone/shift window, and structured blockers for missing tables. |
| `GET /api/loyverse/sync` | Added read-only status view; `POST /api/loyverse/sync` remains the sync route. |
| `GET /api/forms/daily-sales/v2` | Empty/missing DB returns rows/records with blockers instead of 500. Library row mapper preserves stored zero values and exposes sales/expense/balance fields. |
| `POST /api/forms/daily-sales/v2` | New records write Daily Sales V2 stored totals/counts in addition to payload. |
| `GET /api/daily-stock` | Reads/identifies Daily Stock V2 source and returns blockers for missing source. |
| `GET /api/purchasing-items` | Missing DB source returns `items: []` plus blockers. |
| `GET /api/shopping-list` | Root read now uses `purchasing_shift_items` + `purchasing_items` only; removed fake/default drink fallback. |
| `GET /api/menu-v3/items` | Missing DB source returns `items: []` plus blockers. |
| `GET /api/recipes` | Missing DB source returns `rows: []` plus blockers. |
| `GET /api/ingredients` | Missing DB source returns `ingredients: []`/`rows: []` plus blockers. |
| `GET /api/food-costings` | Missing source returns `rows: []` plus blockers. |
| `GET /api/online-orders` | Added read alias backed by `orders_online`/`order_lines_online`. |
| `GET /api/finance/profit-loss` | Added read-only P&L aligned with Daily Sales V2 stored totals. |
| `GET /api/expensesV2/imports` | Missing import table returns `rows: []` plus blockers. |
| `GET /api/bank-statements` | Missing bank statement source returns `rows: []` plus blockers. |
| `GET /api/shift-report/history` | Missing shift report source returns `reports: []` plus blockers. |
| `GET /api/staff/dashboard` | Missing staff source returns zero counts plus blockers. |

## Calculation changes

- Daily Sales V2 new submissions now persist these stored columns from the same calculation already used for payload/email:
  - cash sales
  - QR sales
  - Grab sales
  - other/Aroi sales
  - total sales
  - shopping total
  - wages total
  - other total
  - total expenses
  - cash banked
  - QR transfer
  - receipt counts
- Daily Sales V2 library mapping now uses nullish coalescing so legitimate `0` values are not replaced by fallback display values.
- Shopping List root totals are now calculated only from `purchasing_shift_items.quantity * purchasing_items.unitCost`.
- Finance profit/loss now reads sales from Daily Sales V2 stored totals instead of calculating a separate sales model.

## Modules aligned

- POS status and Loyverse sync status now agree on receipt/shift/latest-sync sources.
- Daily Sales V2 payload and stored columns are aligned for new records.
- Daily Stock V2 read metadata identifies the canonical stock table.
- Shopping List no longer silently falls back to stale `shopping_list.items`, ingredient DB groupings, or default drinks.
- Purchasing catalogue and Shopping List agree on `purchasing_items` as item catalogue.
- Menu/recipes/ingredients APIs now report their canonical source and missing-source blockers.
- Online ordering admin reads are backed by stored online orders.
- Finance P&L has a Daily Sales V2 aligned endpoint.
- Staff dashboard no longer returns unexplained 500s for missing DB source.

## Remaining issues / skipped items

| Item | Status | Reason |
|---|---|---|
| Raw POS ingestion internals | Not changed | Source-safety rule: no ingestion flow changes. |
| Legacy aggregate tables (`loyverse_receipts`, old `shopping_list`) | Not deleted | No destructive changes; left in place but no longer used by repaired root Shopping List read. |
| Existing historical Daily Sales V2 rows with zero stored columns | Not backfilled | Backfill would mutate existing business data; this patch only aligns new writes and read behavior. |
| Real payment processing | Not added | Explicitly out of scope. |
| Schema changes | None | Not required for the verified alignment repairs. |
| Stock item-to-recipe/ingredient mapping gaps | Exposed, not guessed | Missing mappings must remain explicit; no inferred usage rules were added. |
| Server background jobs with missing local `DATABASE_URL` | Warning remains | Local validation environment has no DB URL; request-path endpoints now return explicit blockers where repaired. |

## Validation results

Validation was run in the local container without `DATABASE_URL`. The server starts and serves pages, while DB-backed API checks return explicit blockers for missing sources where repaired.

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm start` | Warning: server starts on port 8080; background DB jobs log missing `DATABASE_URL` errors in local no-database mode. |
| Page load sweep | Pass: all requested UI routes returned HTTP 200. |
| API sweep | Pass/warning: repaired endpoints returned HTTP 200 with data or structured blockers in local no-database mode. |

