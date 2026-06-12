# FINAL DB 5.1 — Loyverse Mirror Repair

## Final Trust Decision

**LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET**

Reason: this environment does not expose the production `DATABASE_URL`, so the repair can be built and route-checked, but cannot prove production receipt/shift equality locally. The endpoint now returns explicit blockers/mismatches when connected data is missing, stale, unmapped, or mismatched.

## Sync Architecture

| Component | Current canonical path |
|---|---|
| Manual receipt sync route | `POST /api/loyverse/sync?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Diagnostic route | `GET /api/loyverse/mirror-diagnostic` |
| Receipt sync service | `server/services/loyverseImportV2.ts#importReceiptsV2` |
| Loyverse receipt endpoint | `GET https://api.loyverse.com/v1.0/receipts` with `created_at_min`, `created_at_max`, and pagination cursor/page token |
| Token env vars accepted by receipt sync | `LOYVERSE_TOKEN`, `LOYVERSE_API_TOKEN`, `LOYVERSE_ACCESS_TOKEN` |
| Shift mirror source | `loyverse_shifts` populated by existing shift mirror routes/services |
| Shift endpoint in existing code | `GET https://api.loyverse.com/v1.0/shifts` via `loyverseGet('shifts', ...)` |
| Scheduled sync jobs | Existing scheduler still runs incremental POS sync every 15 minutes and existing background shift/queue jobs. No Bob/Jussi/AI routes were added or restored. |

## Canonical Table Decision

The canonical POS mirror is:

| Canonical role | Table/source |
|---|---|
| Raw receipt source | `lv_receipt.raw_json` |
| Receipts | `lv_receipt` |
| Receipt line items | `lv_line_item` |
| Receipt modifiers | `lv_modifier` |
| Receipt payments | `lv_receipt.payment_json` as normalized payment entries; the current schema has no separate canonical `lv_payment` table |
| Shift reports | `loyverse_shifts` |
| Sync timestamps | `import_log` plus `lv_receipt.created_at` |

`receipts`, `receipt_items`, and `receipt_payments` are treated as legacy/app comparison tables, not canonical truth. `loyverse_receipts` is treated as stale/legacy date-bucket JSON unless production evidence proves otherwise.

## Tables Kept / Considered Stale or Duplicate

| Table | Decision |
|---|---|
| `lv_receipt` | Keep; canonical receipt mirror |
| `lv_line_item` | Keep; canonical line-item mirror, insert-only |
| `lv_modifier` | Keep; canonical modifier mirror, insert-only |
| `loyverse_shifts` | Keep; shift report mirror |
| `import_log` | Keep; sync timestamp/status source |
| `receipts` | Keep; legacy/app comparison table only for this diagnostic |
| `receipt_items` | Keep; legacy/app comparison table only for this diagnostic |
| `receipt_payments` | Keep; legacy/app comparison table only for this diagnostic |
| `loyverse_receipts` | Consider stale/duplicate unless diagnostics show it is actively used |
| `menu_items_v3` | Counted in POS audit if present; not POS receipt truth |

## Endpoints Changed

| Endpoint | Change |
|---|---|
| `GET /api/loyverse/mirror-diagnostic` | Repaired response shape to include `canonicalTables`, `receiptCounts`, `integrity`, `paymentMapping`, `latestShiftComparison`, `sevenDayComparison`, `blockers`, and `mismatches` |
| `POST /api/loyverse/sync` | Kept route registered; date range now uses the shared Bangkok business window (`17:00-03:00`) and returns detailed idempotency counters |

## Payment Mapping Rules

Payment mapping is explicit and visible:

| Output category | Matching names |
|---|---|
| Cash | contains `cash` |
| QR | contains `qr`, `scan`, `promptpay`, `prompt pay`, or `transfer` |
| Grab | contains `grab` |
| Other | explicit `other` names |
| Unmapped | anything else; normalized to `Other` with `mappingStatus: "unmapped"` and surfaced in diagnostics |

Each synced payment entry stored in `lv_receipt.payment_json` includes:

- `originalName`
- `normalizedCategory`
- `amount`
- `mappingStatus`
- `paymentTypeId`
- `raw`

Unknown payment names are not silently guessed.

## Shift Window Rules

All repaired mirror code uses one shared function:

`getBangkokBusinessWindow(date)` in `server/services/loyverseMirrorCommon.ts`

Rules:

- Timezone: `Asia/Bangkok`
- Start: `17:00`
- End: `03:00` next calendar day
- Comparisons use UTC instants derived from this Bangkok business window
- Business date is the shift date, not the raw UTC calendar date

## Idempotency Rules

Manual sync is safe to re-run against the same date range:

| Data | Idempotency behavior |
|---|---|
| `lv_receipt` | `INSERT ... ON CONFLICT (receipt_id) DO UPDATE` for receipt metadata, payment JSON, and raw JSON |
| `lv_line_item` | `INSERT ... ON CONFLICT (receipt_id, line_no) DO NOTHING`; no updates to insert-only truth table |
| `lv_modifier` | `INSERT ... ON CONFLICT (receipt_id, line_no, mod_no) DO NOTHING`; no updates to insert-only truth table |
| Payments | Rebuilt deterministically inside `lv_receipt.payment_json` from current Loyverse receipt payload |
| Sync response | Reports imported receipts, updated receipts, skipped duplicates, failed receipts, imported line items, imported modifiers, imported payments, date range, and errors |

## Seven-Day Test Result

The diagnostic now returns `sevenDayComparison` for the last seven Bangkok business dates. Each day includes:

- `date`
- `appTotals` from canonical receipt-derived `lv_*` data
- `loyverseShiftTotals` from `loyverse_shifts`
- `legacyAppTotals` from `receipts`/`receipt_items`/`receipt_payments` for visibility only
- `difference`
- `status: match | mismatch | missing`

PASS requires every difference to be exactly zero and every day to be `match`.

Local result: **missing database**, so production equality cannot be proven in this environment.

## Latest Shift Result

The diagnostic now returns `latestShiftComparison` with exact:

- gross sales
- net sales
- discounts
- refunds
- cash
- QR
- Grab
- other
- receipt count
- line item count
- modifier count

It compares `loyverse_shifts` totals against receipt-derived canonical totals. If the shift report is missing/incomplete, status is `missing` and a blocker is returned.

Local result: **missing database**, so latest shift equality cannot be proven in this environment.

## Blockers Fixed by This Patch

| Blocker | Fix |
|---|---|
| Manual sync response did not show detailed idempotency counters | Sync now returns imported, updated, skipped duplicate, failed receipt, line item, modifier, payment, date-range, and error counters |
| Payment mapping was not explicit | Payments are normalized into visible categories with unmapped names surfaced |
| Shift windows were duplicated in diagnostic logic | Shared Bangkok business window helper added |
| Diagnostic mixed old and canonical tables without a clear decision | Diagnostic now names `lv_*` as canonical and treats legacy tables as comparison-only |
| Mirror page did not show exact required trust sentence | Page now shows exactly one final trust sentence |

## Blockers Remaining

Priority order:

1. Run `GET /api/loyverse/mirror-diagnostic` in production with `DATABASE_URL` configured.
2. Verify `lv_receipt`, `lv_line_item`, `lv_modifier`, and `loyverse_shifts` are non-empty and current.
3. Verify no `UNMAPPED_PAYMENT_NAMES` mismatch remains.
4. Verify every row in `sevenDayComparison` is `match` with zero differences.
5. Verify `latestShiftComparison.status` is `match` with zero differences.
6. Resolve any duplicate/missing integrity findings returned by the diagnostic.
7. Run a small-range manual sync twice and confirm the second run increments skipped/updated counters without duplicating line items or modifiers.

## Final Trust Decision

**LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET**

The code now has the repair mechanisms and evidence endpoint required to prove trust, but production data must pass the diagnostic before the app can be declared trusted.
