---
name: Owner dashboard endpoint
description: Architecture notes for GET /api/operations-read/owner-dashboard and the shift-window-aware sync-staleness rule
---

# Owner Dashboard Endpoint

## Endpoint
`GET /api/operations-read/owner-dashboard` — added to `server/routes/operationsRead.ts`

## Dual payment_json format
`lv_receipt.payment_json` has two shapes that must both be handled:
- **New** (post-normalisation, ~Jun 14+): `[{ amount, normalizedCategory }]`
- **Old** (pre-normalisation, ~Jun 7-8): `[{ money_amount, name }]`

SQL must use `COALESCE(elem->>'amount', elem->>'money_amount')` and
`COALESCE(elem->>'normalizedCategory', elem->>'name')` to handle both.

**Why:** The payment_json normalisation migration didn't backfill old receipts,
so both formats coexist in the DB.

## Shift-window-aware sync staleness
The "POS sync overdue" action alert only fires when:
1. `bkkHour >= 18 OR bkkHour < 3` (restaurant is actively open)
2. AND no receipts received in the last 60 minutes

**Why:** During 03:00–18:00 BKK the restaurant is closed. Flagging "sync overdue"
during daytime is a false alarm — no receipts are expected. The old threshold
(8 hrs, no window check) fires every morning unnecessarily.

**Implementation:** Use `Intl.DateTimeFormat` with `timeZone: "Asia/Bangkok"` to
get the current BKK hour before building the syncIsStale boolean.

## Response shape
```
{
  latestShift: { date, grossSales, receiptCount, cash, qr, grab, other },
  staffComparison: { cashVariance, receiptDifference, staffReceiptCount,
                     staffGrossSales, salesDifference, staffSalesEntered },
  stockStatus: { dailyStockSubmitted, rollsStatus, meatStatus },
  lastSevenShifts: [{ date, grossSales, receipts, cash, qr, grab }],
  salesMix: { cash, qr, grab, other },
  actionRequired: [{ severity, title, message }],  // severity: "high"|"medium"
  syncHealth: { status, latestReceiptAt, latestShiftDate, lastSyncAt },
  blockers: []
}
```
`ok: false` is normal — it means data loaded but some checks failed (e.g. cash variance).
