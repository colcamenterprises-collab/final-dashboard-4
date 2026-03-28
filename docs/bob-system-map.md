# Bob System Map (Canonical Read Model)

## Canonical Namespace
- Base: `/api/bob/read`

## Page → Endpoint → Service → Table Map

| Page/Area | Purpose | Bob Endpoint(s) | Service/Layer | Canonical Source |
|---|---|---|---|---|
| Homepage modules | Whole-app readiness view | `/module-status` | bobRead router | `daily_sales_v2`, `daily_stock_v2`, `analysis_reports`, `receipt_truth_*` |
| Daily sales & stock forms | Shift form truth | `/forms/daily-sales`, `/forms/daily-stock` | Forms read model | `daily_sales_v2`, `daily_stock_v2` |
| Receipts analysis | POS raw + normalized truth | `/receipts/truth`, `/reports/item-sales`, `/reports/category-totals`, `/reports/modifier-sales` | Receipt truth read | `receipt_truth_line`, `lv_receipt`, `lv_modifier` |
| Usage / stock truth | Expected usage by date | `/usage/truth`, `/analysis/stock-usage` | Usage derivation read | `receipt_truth_daily_usage` |
| Sales & shift analysis | Date-scoped intelligence rollup | `/shift-snapshot`, `/build-status` | Bob snapshot layer | `analysis_reports` + source tables |
| Issue register | Issue state & counts | `/issues` | AI Ops issue read model | `ai_issues` |
| Catalog/menu/modifiers | Catalog state visibility | `/catalog` | Catalog read model | `item_catalog`, `online_catalog_items`, `modifier_group`, `modifier` |
| Online orders | Read-only orders + lines | `/orders` | Orders read model | `orders_online`, `order_lines_online` |
| Purchasing & shopping chain | Chain health in status map | `/module-status` | Module probes | `purchasing_items`, `purchasing_shift_items` |
| AI Ops/Bob integration | Operational health | `/system-health` | Bob integration read | `bob_documents`, `bob_read_logs` |

## Response Contract
All endpoints should return:
- `ok`
- `source`
- `scope` (and `date` when date-scoped)
- `status` (`ok`/`partial`/`missing`/`error`)
- `data`
- `warnings`
- `blockers`
- `last_updated`

