# Bakery Roll Order via LINE Messaging API

## Purpose
This setup is only for Form 2 bakery roll ordering.
It sends one roll-order message to one configured bakery LINE target.

## Required LINE setup
1. Create or use a LINE Official Account.
2. Enable Messaging API for that account.
3. Generate a **Channel Access Token**.
4. Capture the bakery recipient target ID (user/group/room `U...`, `C...`, or `R...`).

## Required environment variables
- `LINE_CHANNEL_ACCESS_TOKEN` — Messaging API channel token.
- `LINE_BAKERY_TARGET_ID` — recipient ID to receive bakery order.
- `ROLL_ORDER_TARGET_NEXT_SHIFT` — target rolls for next shift (default `140`).
- `ROLL_ORDER_BAKERY_INCREMENT` — round-up increment for bakery batching (default `1`).

## Formula (v1)
`recommended_order = target_next_shift_rolls - closing_rolls`

Behavior:
- If result is negative, use `0`.
- If `ROLL_ORDER_BAKERY_INCREMENT > 1`, round up to nearest increment.
- Staff may override `approved_qty` before send.

## API integration points
- `GET /api/forms/daily-sales/v2/:id/roll-order`
  - returns current roll order and defaults for Form 2
- `POST /api/forms/daily-sales/v2/:id/roll-order/send`
  - persists roll order, sends LINE push, stores SENT/FAILED outcome
- `GET /api/bob/read/roll-order?date=YYYY-MM-DD`
  - read-only Bob visibility for daily checks

## Failure behavior
If LINE send fails:
- `status = FAILED`
- `line_error` is stored
- failure is exposed in Form 2, daily email, and Bob read layer
