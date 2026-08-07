# Loyverse live integration retirement

Effective 2026-08-07, Smash Brothers Burgers uses the internal SBB POS as the live source of truth.

## Live sources
- Receipts and sales: `ordering_orders`
- Sold items/components: `ordering_order_items`
- Options/modifiers/upsells: `ordering_order_item_modifiers`
- Shift boundaries: `pos_shifts`
- Staff reconciliation: `daily_sales_v2`

## Historical archive retained
Existing Loyverse mirror/archive tables are intentionally preserved, including `lv_receipt`, `lv_line_item`, `lv_modifier`, and `loyverse_shifts`. They are historical data only and must not be refreshed by automatic API calls.

## Disabled live paths
- startup catch-up and scheduled receipt/shift sync
- outbound Loyverse order queue/push
- inbound Loyverse webhook mutation
- live shift snapshot calls
- manual live API sync endpoints
- enhanced/live receipt API clients

Historical data may later be loaded through a controlled file-import workflow without re-enabling the Loyverse API.
