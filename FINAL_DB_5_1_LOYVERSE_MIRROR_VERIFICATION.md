# FINAL DB 5.1 — Loyverse Mirror Verification

## Final Status

**LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET**

This patch adds a read-only diagnostic API and an internal verification page. It does **not** change schema, POS ingestion, Daily Sales V2, Daily Stock V2, Purchasing, Finance, or Reports.

The current repository cannot be declared a trusted Loyverse mirror until the diagnostic endpoint is run against the production database and returns `status: "ok"` with no blockers or mismatches.

## Current Sync Architecture

| Area | Current finding |
|---|---|
| Primary manual sync route | `POST /api/loyverse/sync?from=YYYY-MM-DD&to=YYYY-MM-DD` in `server/routes/loyverseV2.ts` |
| Primary receipt sync service | `importReceiptsV2(fromISO, toISO)` in `server/services/loyverseImportV2.ts` |
| Receipt API endpoint | `GET https://api.loyverse.com/v1.0/receipts?created_at_min=...&created_at_max=...&cursor=...` |
| Receipt sync token | `LOYVERSE_TOKEN` is used by `loyverseImportV2.ts`; other status/legacy paths also reference `LOYVERSE_API_TOKEN` and `BOBS_LOYVERSE_TOKEN` |
| Shift API endpoint | `loyverseGet('shifts', { opened_at_min, closed_at_max })` in `server/services/loyverseService.ts` and legacy `GET /api/loyverse/shifts` in `server/routes.ts` |
| Shift token | `LOYVERSE_TOKEN` or `LOYVERSE_ACCESS_TOKEN` in `server/services/loyverseService.ts`; legacy route checks `LOYVERSE_TOKEN` |
| Tables written by receipt sync | `import_log`, `lv_receipt`, `lv_line_item`, `lv_modifier` |
| Legacy/app POS tables inspected | `receipts`, `receipt_items`, `receipt_payments`, `loyverse_receipts`, `loyverse_shifts` |
| Cron schedule | `schedulerService` schedules incremental POS sync every 15 minutes; `server/index.ts` schedules shift snapshot work at 08:00 Bangkok and Loyverse queue processing every 30 seconds |
| Manual sync verification | Existing route remains registered. A no-range call returns HTTP 400 with `from/to required`, proving route registration without running ingestion. |

## Canonical POS Table Decision

For this verification patch, the canonical Loyverse receipt mirror is:

1. `lv_receipt`
2. `lv_line_item`
3. `lv_modifier`

Reason: `server/services/loyverseImportV2.ts` explicitly fetches Loyverse receipt data and writes those three tables directly. The file header says `lv_line_item` and `lv_modifier` are insert-only POS truth tables. The diagnostic therefore treats these tables as the Loyverse mirror side and compares the older/app receipt tables (`receipts`, `receipt_items`, `receipt_payments`) against them without silently falling back.

`loyverse_shifts` is treated as the shift-report source for latest-shift diagnostics. `loyverse_receipts` is inspected and counted, but it is not silently substituted for canonical receipt truth.

## Added Diagnostic Endpoint

`GET /api/loyverse/mirror-diagnostic`

Returns a read-only payload with:

- `status`
- `latestSyncAt`
- `latestReceiptDate`
- `latestShiftDate`
- `receiptCounts`
- `latestReceipts`
- `latestShiftReports`
- `last7Days`
- `latestShiftComparison`
- `integrity`
- `mismatches`
- `blockers`
- `sourceMap`

The endpoint returns HTTP 200 even when the mirror fails validation. Failures are represented in `status`, `blockers`, and `mismatches` instead of hidden behind a transport error.

## Last 7 Days Comparison

The endpoint computes the last seven Bangkok business dates using the fixed shift window:

`17:00 Asia/Bangkok` through `03:00 Asia/Bangkok` next calendar day.

For each day it compares:

| Metric | Loyverse mirror source | App source |
|---|---|---|
| Receipt count | `lv_receipt` | `receipts` |
| Gross sales | `lv_receipt.total_amount` plus raw discount where available | `receipts.subtotal` |
| Cash sales | `lv_receipt.payment_json` classified by payment name | `receipt_payments.method` |
| QR sales | `lv_receipt.payment_json` classified by payment name | `receipt_payments.method` |
| Grab sales | `lv_receipt.payment_json` classified by payment name | `receipt_payments.method` |
| Other payments | `lv_receipt.payment_json` classified by payment name | `receipt_payments.method` |
| Refunds | `lv_receipt.raw_json.refund_for` when present | insufficient source field in current app receipt schema |
| Discounts | `lv_receipt.raw_json` discount fields when present | `receipts.discount` |
| Net sales | `lv_receipt.total_amount` | `receipts.total` |
| Line items | `lv_line_item` | `receipt_items` |
| Modifiers | `lv_modifier` | `receipt_items.modifiers` JSON array length |

If any difference is non-zero, the day is marked `mismatch` and a `DAILY_TOTAL_MISMATCH` entry is added.

## Latest Shift Comparison

The endpoint selects the latest row in `loyverse_shifts`, normalizes common shift total/payment fields from its JSON payload, and compares the matching business-date window against:

- `lv_receipt`
- `lv_line_item`
- `lv_modifier`
- `receipts`
- `receipt_payments`
- `receipt_items`

If the row is missing, malformed, stale, or totals do not match, the endpoint emits `LATEST_SHIFT_MISMATCH` or a structured blocker.

## Duplicate, Missing, and Stale Data Detection

The diagnostic detects and reports:

| Check | Query/source |
|---|---|
| Duplicate app receipts | `receipts` grouped by `externalId` / `receiptNumber` |
| Receipts missing payment rows | `receipts` left joined to `receipt_payments` |
| Receipts missing line items | `receipts` left joined to `receipt_items` |
| Payments with no receipt | `receipt_payments` left joined to `receipts` |
| Line items with no receipt | `receipt_items` left joined to `receipts` |
| POS rows written to one table but not another | `lv_receipt` left joined to `receipts` |
| Stale latest sync | `import_log` / `lv_receipt.created_at` older than 24 hours |
| Shift reports not generated | Missing or empty `loyverse_shifts` |
| Timezone mismatch risk | All comparisons use the declared Bangkok 17:00-03:00 window |
| Receipt date mismatch risk | Differences between `lv_receipt.datetime_bkk` windows and `receipts.createdAtUTC` windows surface as count/total mismatches |

## Runtime Finding in This Validation Environment

The local validation server starts, but it is running in no-database mode because `DATABASE_URL` is not configured. Therefore the local diagnostic response is correctly:

```json
{
  "status": "fail",
  "blockers": [
    {
      "code": "MIRROR_DIAGNOSTIC_ERROR",
      "where": "GET /api/loyverse/mirror-diagnostic",
      "canonical_source": "lv_receipt/lv_line_item/lv_modifier",
      "auto_build_attempted": false
    }
  ]
}
```

This is not a mirror pass. It proves the endpoint does not hide missing infrastructure as success.

## Mismatches Found

A production database was not available in this environment, so exact production data mismatches cannot be truthfully listed here. The new endpoint is the required evidence path. Any non-empty `mismatches` array returned by production is a failing condition.

## Missing Data Found

In this local validation environment:

1. `DATABASE_URL` is missing.
2. The diagnostic cannot inspect `lv_receipt`, `lv_line_item`, `lv_modifier`, `receipts`, `receipt_items`, `receipt_payments`, `loyverse_receipts`, or `loyverse_shifts` without the database.
3. Because the database is unavailable, last-seven-day and latest-shift totals are insufficient data, not success.

## Duplicate Data Found

No duplicate-data claim can be made without production database access. The endpoint now detects duplicate receipts and orphan rows deterministically when connected to the database.

## Timezone Findings

- Receipt comparisons use Bangkok business windows of `17:00-03:00`.
- The receipt importer stores `receipt_date` as `timestamptz` in `lv_receipt.datetime_bkk` and comments that shift-window queries should filter using Asia/Bangkok time.
- The legacy/app `receipts` table stores `createdAtUTC`; the diagnostic compares it using the same UTC instants derived from the Bangkok shift window.

## Payment Mapping Findings

Payment mapping remains name-based and explicit:

| Bucket | Matching rule |
|---|---|
| Cash | payment name contains `cash` |
| QR | payment name contains `qr`, `scan`, `promptpay`, or `prompt pay` |
| Grab | payment name contains `grab` |
| Other | any unmapped payment name |

Unmapped names are not guessed into a business-specific category. They remain `otherPayments`, and payment-total differences are reported as mismatches.

## Whether the App Can Currently Be Trusted as a Loyverse Mirror

**No.** The app cannot be trusted as a Loyverse mirror until production returns:

- `GET /api/loyverse/mirror-diagnostic` HTTP 200
- `status: "ok"`
- no blockers
- no mismatches
- non-empty canonical POS mirror tables
- latest sync and latest receipt timestamps are current
- latest shift comparison is `match`
- all seven daily comparisons are `match`

## Required Fixes Before Analysis Can Be Trusted

Priority order:

1. Run the diagnostic in the deployed production environment with `DATABASE_URL` configured.
2. Verify `lv_receipt`, `lv_line_item`, and `lv_modifier` are populated and current.
3. Verify `receipts`, `receipt_items`, and `receipt_payments` match the canonical `lv_*` mirror tables for all seven days.
4. Verify `loyverse_shifts` exists, is current, and latest shift totals match receipt-derived totals.
5. Resolve any duplicate receipts or orphan payment/item rows returned in `integrity`.
6. Resolve any payment names returned as `otherPayments` if they are expected to map to Cash, QR, or Grab.
7. Re-run the diagnostic until `status` is `ok`.

## Files Added or Changed

| File | Purpose |
|---|---|
| `server/services/loyverseMirrorDiagnostic.ts` | Read-only diagnostic service for mirror counts, seven-day comparison, latest shift comparison, integrity checks, blockers, and source map |
| `server/routes/loyverseV2.ts` | Registers `GET /api/loyverse/mirror-diagnostic`; keeps `POST /api/loyverse/sync` unchanged |
| `client/src/pages/operations/LoyverseMirror.tsx` | Internal read-only verification page |
| `client/src/App.tsx` | Adds route `/operations/loyverse-mirror` |
| `FINAL_DB_5_1_LOYVERSE_MIRROR_VERIFICATION.md` | This evidence report |

## Validation Performed

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Server starts clean enough to listen on a local port | Warning: starts and listens, but logs missing `DATABASE_URL` background-service errors |
| `GET /api/loyverse/mirror-diagnostic` | HTTP 200, `status: "fail"` with explicit database blocker |
| `/operations/loyverse-mirror` | HTTP 200 |
| `GET /api/system/pos-status` | HTTP 200 |
| `POST /api/loyverse/sync` remains registered | HTTP 400 without date range, expected safe validation response |
| Daily Sales V2 changes | None |
| Daily Stock V2 changes | None |
| Schema changes | None |
