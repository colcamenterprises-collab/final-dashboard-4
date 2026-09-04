import { pool } from "../db";
import type { ResolvedReportingRange } from "./unifiedLedger";
import { SBB_REPORTING_CUTOVER_ISO } from "./reportingCutover";

const n = (value: unknown) => Number(value ?? 0) || 0;

/**
 * Overview/item profitability using immutable sale-time POS cost snapshots.
 * Missing snapshots remain uncosted rather than falling back to mutable current recipe costs.
 */
export async function querySnapshotItemSales(range: ResolvedReportingRange) {
  if (!pool) throw new Error("Database unavailable");
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const result = await pool.query(
    `WITH pos_lines AS (
      SELECT
        i.*,
        o.payment_status,
        COALESCE(c.name_en,'Other') category,
        CASE
          WHEN COALESCE(o.subtotal,o.total,0) > 0
            THEN COALESCE(o.discount_amount,0) * i.line_total / COALESCE(o.subtotal,o.total,0)
          ELSE 0::numeric
        END allocated_discount,
        CASE
          WHEN snap.costing_status IN ('complete','direct') THEN snap.unit_cost
          ELSE NULL
        END unit_cost
      FROM ordering_order_items i
      JOIN ordering_orders o ON o.id=i.order_id
      LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
      LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
      LEFT JOIN ordering_order_item_cost_snapshots snap ON snap.order_item_id=i.id
      WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
        AND o.created_at < $2::timestamptz
        AND o.status <> 'cancelled'
        AND o.payment_status IN ('paid','refunded')
        AND COALESCE(i.is_set_component,false)=false
    ), lines AS (
      SELECT
        COALESCE(NULLIF(i.sku,''),i.item_name) item_key,
        i.item_name,
        i.sku,
        i.category,
        i.quantity,
        i.gross_sales,
        i.discount_total,
        i.refund_total,
        i.net_sales,
        i.cost_of_goods,
        i.gross_profit,
        'loyverse'::text source_system
      FROM reporting_historical_transaction_items i
      JOIN reporting_historical_transactions h ON h.id=i.transaction_id
      JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
      WHERE h.venue_key='sbb-rawai'
        AND h.occurred_at >= $1::timestamptz
        AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)

      UNION ALL

      SELECT
        COALESCE(NULLIF(i.source_sku,''),i.item_name_en) item_key,
        i.item_name_en item_name,
        i.source_sku sku,
        i.category,
        i.quantity::numeric quantity,
        i.line_total gross_sales,
        i.allocated_discount discount_total,
        CASE WHEN i.payment_status='refunded' THEN i.line_total-i.allocated_discount ELSE 0::numeric END refund_total,
        CASE WHEN i.payment_status='refunded' THEN 0::numeric ELSE i.line_total-i.allocated_discount END net_sales,
        CASE WHEN i.unit_cost IS NULL THEN NULL ELSE i.unit_cost*i.quantity END cost_of_goods,
        CASE
          WHEN i.unit_cost IS NULL THEN NULL
          WHEN i.payment_status='refunded' THEN 0::numeric-(i.unit_cost*i.quantity)
          ELSE (i.line_total-i.allocated_discount)-(i.unit_cost*i.quantity)
        END gross_profit,
        'sbb_pos'::text source_system
      FROM pos_lines i
    )
    SELECT
      item_key,
      MAX(item_name) item_name,
      MAX(sku) sku,
      MAX(category) category,
      SUM(quantity)::numeric quantity,
      SUM(gross_sales)::numeric gross_sales,
      SUM(discount_total)::numeric discounts,
      SUM(refund_total)::numeric refunds,
      SUM(net_sales)::numeric net_sales,
      CASE WHEN COUNT(cost_of_goods)=COUNT(*) THEN SUM(cost_of_goods) ELSE NULL END cost_of_goods,
      CASE WHEN COUNT(gross_profit)=COUNT(*) THEN SUM(gross_profit) ELSE NULL END gross_profit,
      CASE WHEN COUNT(cost_of_goods)=COUNT(*) AND SUM(net_sales)<>0
           THEN ((SUM(net_sales)-SUM(cost_of_goods))/SUM(net_sales))*100
           ELSE NULL END margin_pct,
      jsonb_agg(DISTINCT source_system) sources
    FROM lines
    GROUP BY item_key
    ORDER BY SUM(net_sales) DESC, MAX(item_name)`,
    [range.fromInstant, range.toInstant, cutover],
  );
  return result.rows.map((row: any) => ({
    ...row,
    quantity: n(row.quantity),
    gross_sales: n(row.gross_sales),
    discounts: n(row.discounts),
    refunds: n(row.refunds),
    net_sales: n(row.net_sales),
    cost_of_goods: row.cost_of_goods == null ? null : n(row.cost_of_goods),
    gross_profit: row.gross_profit == null ? null : n(row.gross_profit),
    margin_pct: row.margin_pct == null ? null : n(row.margin_pct),
  }));
}
