# Stock Truth Audit — Rolls / Meat / Drinks

## A) System Truth Contract
Canonical truth today is split: **staff close counts** come from `daily_sales_v2.payload` (`rollsEnd`, `meatEnd`, `drinkStock`), while **purchases** come from mixed sources (`expenses` string-matched buns/rolls, `purchase_tally.meat_grams`, `stock_received_log` drinks), and **sold/used** is derived from POS-normalized analytics (`analytics_shift_item` built from `lv_receipt`/`lv_line_item`/`lv_modifier` + `item_catalog`). For determinism: rolls should be canonical from staff close + canonical purchases + canonical burger sold count; meat should be canonical from staff close + canonical meat purchases + patties sold × fixed grams; drinks should be canonical from `purchasing_items(category='Drinks')` purchases + POS drink sales mapping + staff close count. In current code, only parts of that contract exist, and “canonical vs derived” is inconsistent across item types.

## B) Data Model Map

| Entity | Table/Model | Key Fields | Writes From | Reads By |
|---|---|---|---|---|
| Daily Sales & Stock V2 (merged form payload) | `daily_sales_v2` (`DailySalesV2`) | `shiftDate`, `shift_date`, `payload.rollsEnd`, `payload.meatEnd`, `payload.drinkStock` | `createDailySalesV2()` inserts payload (`server/forms/dailySalesV2.ts`); `/api/forms/daily-stock` merges stock fields into payload (`server/routes/forms.ts`) | Rolls/meat/drinks ledger services (`getActual*End`), daily analysis API, dashboard DTO/comparison routes |
| Daily Sales & Stock legacy | `daily_stock_sales` | `shift_date`, `burger_buns_stock`, `meat_weight`, `drink_stock_count`, `drink_stock` | Legacy form writes (model only in current audit scope) | Rolls fallback (`getActualRollsEnd()`), legacy comparison/services |
| Purchasing catalog | `purchasing_items` (`PurchasingItem`) | `id`, `item`, `category`, `active`, `unitCost` | Admin/catalog workflows (not stock-ledger writes directly) | `/api/stock/manual-purchase` lookup (rolls/drinks), ingredients/purchasing services |
| Shift purchase logs | `purchasing_shift_items` | `dailyStockId`, `purchasingItemId`, `quantity` | `/api/stock/manual-purchase` upserts | Purchasing/stock views; not used by current rolls/meat/drinks ledger math |
| Expenses / purchases | `expenses`, `expenses_v2`, `purchase_tally`, `purchase_tally_drink`, `stock_received_log` | `expenses.meta.quantity`, `purchase_tally.meat_grams`, `purchase_tally.rolls_pcs`, `stock_received_log.item_type/qty/weight_g` | `/api/stock/rolls|meat|drinks` writes `stock_received_log`; `createDailySalesV2()` writes basic `purchase_tally` rows for linked expenses; expenses routes write `expenses`/`expenses_v2` | Rolls ledger reads `expenses` (bun/roll LIKE + source); meat ledger reads `purchase_tally.meat_grams`; drinks ledger reads `stock_received_log` item_type=`drinks` |
| POS receipts / lines / modifiers / shift report | `lv_receipt`, `lv_line_item`, `lv_modifier`, `loyverse_receipts`, `loyverse_shifts`, `pos_receipt` | `datetime_bkk`, `sku`, `qty`, `line_no`, `raw_json`, `shift_date`, `batch_id` | Loyverse sync/import services (`/api/loyverse/*`, `loyverseSync`, `loyverseIngest`), `/api/pos/upload` CSV path | `computeShiftAll()` builds `analytics_shift_item`; reconciliation/reporting APIs; dashboard snapshot pipeline |
| Variance / ledger tables | `rolls_ledger`, `meat_ledger`, `drinks_ledger`, `daily_shift_summary`, `jussi_comparison` | starts/purchases/sold/expected/actual/variance/state fields | `computeAndUpsertRollsLedger`, `computeAndUpsertMeatLedger`, `computeAndUpsertDrinksLedger`, snapshot workers | `/api/analysis/*-ledger`, stock reconciliation views/pages, `/api/dashboard/latest` |

## C) Roll Calculation — Current Implementation
- `server/services/rollsLedger.ts` → `computeAndUpsertRollsLedger(shiftDate)` is the primary roll formula location.
- Formula used: `estimated = rolls_start + rolls_purchased - burgers_sold`.
- `rolls_start`: `getRollsStart()` uses previous `rolls_ledger.actual_rolls_end`, then previous `daily_sales_v2.payload.rollsEnd`, then previous `daily_stock_sales.burger_buns_stock`, else `0`.
- `rolls_purchased`: `getRollsPurchased(fromISO,toISO)` sums `expenses.meta->>'quantity'` where `source='STOCK_LODGMENT'` and `item` string contains `bun` or `roll`.
- `burgers_sold`: `getBurgersSoldFromAnalytics()` sums `analytics_shift_item.rolls`, fallback sum of `analytics_shift_item.qty` where `category='burger'`.
- `actual_rolls_end`: `getActualRollsEnd()` reads latest `daily_sales_v2.payload.rollsEnd`, fallback `daily_stock_sales.burger_buns_stock`.
- Confirmation: this is effectively `(start_roll_count + rolls_purchased - burgers_sold)`; burger sales source is **POS-derived analytics cache from `lv_*` tables**, not manual input.

## D) Meat Calculation — Current Implementation
- `server/services/meatLedger.ts` → `computeAndUpsertMeatLedger(shiftDate)` is the primary meat formula location.
- Constant: `GRAMS_PER_PATTY = 140` in this file.
- Formula used: `meat_used_g = patties_sold * 140`; `estimated_g = meat_start_g + meat_purchased_g - meat_used_g`.
- `patties_sold`: `getPattiesSoldFromAnalytics()` sums `analytics_shift_item.patties`, fallback burger `qty`.
- `meat_purchased_g`: `getMeatPurchased()` sums `purchase_tally.meat_grams` by `date`.
- `actual_meat_end_g`: `getActualMeatEnd()` reads latest `daily_sales_v2.payload.meatEnd`.

## E) Drinks Calculation — Current Implementation
- `server/services/drinksLedger.ts` → `computeAndUpsertDrinksLedger(shiftDate)` is the primary drinks formula location.
- Formula used: `estimatedDrinksEnd = drinksStart + drinksPurchased - drinksSold`.
- `drinksPurchased`: sums `stock_received_log.qty` where `item_type='drinks'` on shift date.
- `drinksSold`: sums `analytics_shift_item.qty` where `category ILIKE '%drink%' OR '%beverage%'`.
- `actualDrinksEnd`: reads `daily_sales_v2.payload.drinksEnd` (single integer), while form payload commonly stores per-SKU object as `drinkStock`.
- `purchasing_items(category='Drinks')` is used in `/api/stock/manual-purchase` lookup flow, but **not** the canonical source for drinks sold/variance calculations.

## F) POS Data Coverage
Current operations reporting uses (1) Loyverse sync routes (`/api/loyverse/sync`, `/api/loyverse/ensure-shift`, enhanced `/api/loyverse/*` mounts), (2) normalized receipt tables (`lv_receipt`, `lv_line_item`, `lv_modifier`) consumed by `computeShiftAll()`, and (3) optional CSV POS upload (`/api/pos/upload`) into `pos_receipt`. Last-month backfill/upload is supported via `/api/power-tools/historical-import` (calls `importHistoricalData(startDate,endDate)` in `server/services/loyverseHistoricalImport.ts`) and daily sync via `/api/pos/sync-daily`; therefore an ingestion path exists for historical periods.

## G) Why Nightly “Used vs Missing” Cannot Be Proved Today
1. Purchase sources are inconsistent by item type: rolls ledger reads `expenses` with string matching, meat ledger reads `purchase_tally`, drinks ledger reads `stock_received_log`; no single canonical purchase ledger is enforced across all three.
2. Rolls purchase logic depends on free-text `item LIKE '%bun%' OR '%roll%'` and `meta.quantity`, so deterministic counting fails when naming/meta shape differs.
3. Meat usage determinism is split: `shiftItems` computes beef grams with `BEEF_G=95`, but meat ledger uses `GRAMS_PER_PATTY=140`; two competing constants produce incompatible “used meat” truths.
4. Drinks sold logic depends on `analytics_shift_item.category` text containing `drink/beverage`; combo/set decomposition and SKU-level mapping to purchased drink SKUs is not enforced in drinks ledger.
5. Drinks actual-end source mismatch: ledger expects scalar `payload.drinksEnd`, while form pipeline stores drink stock as object `payload.drinkStock`; this causes null/partial actuals.
6. Ledger update cadence is asymmetric: cron auto-updates rolls only; meat/drinks require explicit rebuild API or manual trigger, so nightly completeness is not guaranteed.

## H) Minimal Lockdown Patch Plan (patch titles only)
1. **Declare canonical stock-truth contract in code comments + docs** — One authoritative source list per item (start, purchased, sold, actual end), enforced by service-level guardrails.
2. **Unify purchase source adapter (read-only)** — Add one read service that returns rolls/meat/drinks purchases from canonical tables with explicit NULL on missing source.
3. **Freeze meat usage constant source** — Replace dual constants with one canonical grams-per-patty reference (Requires approval if business constant changes).
4. **Normalize drinks actual-end extraction** — Read scalar total deterministically from `drinkStock` object when `drinksEnd` absent, with explicit provenance flag.
5. **Introduce deterministic drinks sold mapper** — Build read-only mapping from POS SKU/category to drink units sold; mark unmapped combo components as `UNMAPPED`.
6. **Standardize shift window resolver** — Reuse one BKK 17:00→03:00 window utility across ledgers/reconciliation to remove date-boundary drift.
7. **Nightly ledger orchestration parity** — Add scheduled rebuild for meat/drinks alongside rolls, idempotent and date-keyed.
8. **Add stock-truth audit endpoint (read-only)** — Return per-shift provenance (`source_table`, `source_field`, `derived_formula`, `missing_reason`) for manager verification.
9. **Add deterministic validation checks** — CI/runtime checks for missing canonical inputs (no silent fallbacks), failing closed with explicit `INSUFFICIENT_DATA`.
