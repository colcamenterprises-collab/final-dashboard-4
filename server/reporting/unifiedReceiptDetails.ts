import { pool } from "../db";

function requirePool() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

export async function queryUnifiedReceiptDetails(source: string, id: string) {
  const db = requirePool();
  if (source === "loyverse") {
    const result = await db.query(
      `SELECT
         h.id::text id,
         h.occurred_at,
         h.source_receipt_number receipt_number,
         h.channel,
         h.order_mode,
         h.payment_status,
         h.subtotal,
         h.discount_total,
         h.refund_total,
         h.tax_total,
         h.net_sales,
         h.total,
         h.staff_name,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', i.id,
             'name', i.item_name,
             'sku', i.sku,
             'category', i.category,
             'quantity', i.quantity,
             'unitPrice', i.unit_price,
             'grossSales', i.gross_sales,
             'discounts', i.discount_total,
             'refunds', i.refund_total,
             'netSales', i.net_sales,
             'costOfGoods', i.cost_of_goods,
             'grossProfit', i.gross_profit,
             'isSetComponent', i.is_set_component,
             'isSetProduct', (lower(COALESCE(i.item_name,'')) LIKE '% set%'),
             'modifiers', COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'group', m.modifier_group,
                 'name', m.modifier_name,
                 'quantity', m.quantity,
                 'priceDelta', m.price_delta,
                 'revenue', m.revenue
               ) ORDER BY m.id)
               FROM reporting_historical_transaction_modifiers m
               WHERE m.transaction_item_id=i.id
             ), '[]'::jsonb)
           ) ORDER BY i.id)
           FROM reporting_historical_transaction_items i
           WHERE i.transaction_id=h.id
         ), '[]'::jsonb) items,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'method', p.payment_method,
             'amount', p.amount,
             'paidAt', p.paid_at
           ) ORDER BY p.paid_at NULLS LAST, p.id)
           FROM reporting_historical_payments p
           WHERE p.transaction_id=h.id
         ), '[]'::jsonb) payments
       FROM reporting_historical_transactions h
       JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
       WHERE h.id=$1::uuid
       LIMIT 1`,
      [id],
    );
    if (!result.rowCount) return null;
    return { sourceSystem: "loyverse", ...result.rows[0] };
  }

  if (source === "sbb_pos") {
    const result = await db.query(
      `SELECT
         o.id::text id,
         o.created_at occurred_at,
         COALESCE(o.ticket_number,o.order_number::text) receipt_number,
         o.channel,
         o.order_mode,
         o.payment_status,
         COALESCE(o.subtotal,o.total) subtotal,
         COALESCE((to_jsonb(o)->>'discount_total')::numeric,0) discount_total,
         CASE WHEN o.payment_status='refunded' THEN COALESCE(o.total,0) ELSE 0 END refund_total,
         0::numeric tax_total,
         CASE WHEN o.payment_status='refunded' THEN 0 ELSE COALESCE(o.total,0) END net_sales,
         COALESCE(o.total,0) total,
         NULL::text staff_name,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', i.id,
             'name', i.item_name_en,
             'sku', i.source_sku,
             'category', COALESCE(c.name_en,'Other'),
             'quantity', i.quantity,
             'unitPrice', i.unit_price,
             'grossSales', i.line_total,
             'discounts', 0,
             'refunds', 0,
             'netSales', i.line_total,
             'costOfGoods', NULL,
             'grossProfit', NULL,
             'isSetComponent', COALESCE(i.is_set_component,false),
             'isSetProduct', (
               lower(COALESCE(i.item_name_en,'')) LIKE '% set%'
               OR EXISTS(
                 SELECT 1 FROM ordering_order_item_modifiers sm
                 WHERE sm.order_item_id=i.id AND upper(COALESCE(sm.modifier_group_name_en,''))='SET UPGRADE'
               )
             ),
             'notes', i.notes,
             'modifiers', COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'group', m.modifier_group_name_en,
                 'name', m.modifier_name_en,
                 'quantity', m.quantity,
                 'priceDelta', m.price_delta,
                 'revenue', m.price_delta*m.quantity
               ) ORDER BY m.id)
               FROM ordering_order_item_modifiers m
               WHERE m.order_item_id=i.id
             ), '[]'::jsonb)
           ) ORDER BY i.sort_order,i.id)
           FROM ordering_order_items i
           LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
           LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
           WHERE i.order_id=o.id
         ), '[]'::jsonb) items,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'method', p.method,
             'amount', p.amount,
             'paidAt', COALESCE(to_jsonb(p)->>'confirmed_at',to_jsonb(p)->>'created_at')
           ) ORDER BY p.id)
           FROM ordering_payments p
           WHERE p.order_id=o.id
         ), '[]'::jsonb) payments
       FROM ordering_orders o
       WHERE o.id=$1::uuid
       LIMIT 1`,
      [id],
    );
    if (!result.rowCount) return null;
    return { sourceSystem: "sbb_pos", ...result.rows[0] };
  }

  throw new Error(`Unsupported reporting receipt source: ${source}`);
}
