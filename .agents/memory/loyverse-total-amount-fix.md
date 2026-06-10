---
name: Loyverse total_amount unit fix
description: Root cause and fix for lv_receipt.total_amount being stored at 1/100 correct value for receipts from ~Jun 2026 onwards.
---

## Rule
Never use `lv_receipt.total_amount` for financial calculations. Always use `SUM(payment_json[].money_amount)` — this is the authoritative Baht source (POS Truth Layer).

## Why
Loyverse API's `total_money` field has returned values in different units across API versions (satang vs Baht). `loyverseImportV2.ts` historically divided by 100, which was correct when the API returned satang (e.g. 31900 → 319). From around Jun 3 2026, the API started returning Baht directly (319 → 3.19 after ÷100). `payment_json[].money_amount` has always been correct Baht regardless of API version.

## How to apply
- `loyverseImportV2.ts`: derive `totalAmount` from `rc.payments.reduce((s,p) => s + Number(p.money_amount), 0)` — NOT from `total_money / 100`
- `receiptTruthSummary.ts`: same approach using `receipt.payments` reduce
- `shiftAnalysis.ts`: query uses `SUM((p->>'money_amount')::numeric)` via LATERAL join
- `analysisV3.ts`: integrity-check uses payment_json sum, NOT `total_amount * 100` workaround
- After any import code change, re-sync affected date range so `ON CONFLICT DO UPDATE` corrects existing rows
- Mirror verification: `GET /api/loyverse/mirror-diagnostic` runs the full 7-day comparison without manual DB queries
