import { DateTime } from "luxon";
import { pool } from "../db";
import { SBB_REPORTING_CUTOVER_ISO } from "./reportingCutover";

export type ExactReportingRange = {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  timezone: string;
};

export type ResolvedReportingRange = ExactReportingRange & {
  fromInstant: string;
  toInstant: string;
};

const n = (value: unknown) => Number(value ?? 0) || 0;

export function resolveExactReportingRange(input: ExactReportingRange): ResolvedReportingRange {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.toDate)) {
    throw new Error("Reporting dates must use YYYY-MM-DD");
  }
  if (!/^\d{2}:\d{2}$/.test(input.fromTime) || !/^\d{2}:\d{2}$/.test(input.toTime)) {
    throw new Error("Reporting times must use HH:mm");
  }
  const from = DateTime.fromFormat(`${input.fromDate} ${input.fromTime}`, "yyyy-MM-dd HH:mm", { zone: input.timezone });
  const to = DateTime.fromFormat(`${input.toDate} ${input.toTime}`, "yyyy-MM-dd HH:mm", { zone: input.timezone });
  if (!from.isValid || !to.isValid) throw new Error("Invalid reporting date/time or timezone");
  if (to <= from) throw new Error("Reporting end date/time must be after start date/time");
  return {
    ...input,
    fromInstant: from.toUTC().toISO()!,
    toInstant: to.toUTC().toISO()!,
  };
}

function requirePool() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

export async function queryUnifiedOverview(range: ResolvedReportingRange) {
  const db = requirePool();
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const result = await db.query(
    `WITH canonical AS (
      SELECT
        h.id::text canonical_id,
        h.occurred_at,
        'loyverse'::text source_system,
        h.source_receipt_number receipt_number,
        h.channel,
        h.order_mode,
        h.subtotal gross_sales,
        h.discount_total discounts,
        h.refund_total refunds,
        h.net_sales,
        h.total,
        COALESCE(p.payment_method, 'Unknown') payment_method
      FROM reporting_historical_transactions h
      JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
      LEFT JOIN LATERAL (
        SELECT payment_method
        FROM reporting_historical_payments hp
        WHERE hp.transaction_id=h.id
        ORDER BY hp.paid_at NULLS LAST, hp.id
        LIMIT 1
      ) p ON TRUE
      WHERE h.venue_key='sbb-rawai'
        AND h.occurred_at >= $1::timestamptz
        AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)

      UNION ALL

      SELECT
        o.id::text canonical_id,
        o.created_at occurred_at,
        'sbb_pos'::text source_system,
        COALESCE(o.ticket_number,o.order_number::text) receipt_number,
        o.channel,
        o.order_mode,
        COALESCE(o.subtotal,o.total) gross_sales,
        COALESCE(o.discount_amount,0) discounts,
        CASE WHEN o.payment_status='refunded' THEN COALESCE(o.total,0) ELSE 0 END refunds,
        CASE WHEN o.payment_status='refunded' THEN 0 ELSE COALESCE(o.total,0) END net_sales,
        COALESCE(o.total,0) total,
        COALESCE(o.payment_method,'Unknown') payment_method
      FROM ordering_orders o
      WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
        AND o.created_at < $2::timestamptz
        AND o.status <> 'cancelled'
        AND o.payment_status IN ('paid','refunded')
    )
    SELECT
      COUNT(*)::int receipt_count,
      COALESCE(SUM(gross_sales),0)::numeric gross_sales,
      COALESCE(SUM(discounts),0)::numeric discounts,
      COALESCE(SUM(refunds),0)::numeric refunds,
      COALESCE(SUM(net_sales),0)::numeric net_sales,
      CASE WHEN COUNT(*)=0 THEN 0 ELSE COALESCE(SUM(net_sales),0)/COUNT(*) END average_order,
      COUNT(*) FILTER (WHERE source_system='loyverse')::int historical_receipts,
      COUNT(*) FILTER (WHERE source_system='sbb_pos')::int live_receipts,
      COALESCE(jsonb_object_agg(payment_method,payment_sales) FILTER (WHERE payment_method IS NOT NULL),'{}'::jsonb) payment_sales
    FROM (
      SELECT c.*,
             SUM(net_sales) OVER (PARTITION BY payment_method) payment_sales
      FROM canonical c
    ) x`,
    [range.fromInstant, range.toInstant, cutover],
  );
  const row = result.rows[0] || {};
  return {
    receiptCount: n(row.receipt_count),
    grossSales: n(row.gross_sales),
    discounts: n(row.discounts),
    refunds: n(row.refunds),
    netSales: n(row.net_sales),
    averageOrder: n(row.average_order),
    historicalReceipts: n(row.historical_receipts),
    liveReceipts: n(row.live_receipts),
    paymentSales: row.payment_sales || {},
  };
}

export async function queryUnifiedReceipts(range: ResolvedReportingRange) {
  const db = requirePool();
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const result = await db.query(
    `SELECT * FROM (
      SELECT
        h.id::text id,
        h.occurred_at,
        'loyverse'::text source_system,
        h.source_receipt_number receipt_number,
        h.channel,
        h.order_mode,
        h.payment_status,
        h.subtotal,
        h.discount_total,
        h.refund_total,
        h.net_sales,
        h.total,
        h.staff_name
      FROM reporting_historical_transactions h
      JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
      WHERE h.venue_key='sbb-rawai'
        AND h.occurred_at >= $1::timestamptz
        AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)

      UNION ALL

      SELECT
        o.id::text id,
        o.created_at occurred_at,
        'sbb_pos'::text source_system,
        COALESCE(o.ticket_number,o.order_number::text) receipt_number,
        o.channel,
        o.order_mode,
        o.payment_status,
        COALESCE(o.subtotal,o.total) subtotal,
        COALESCE(o.discount_amount,0) discount_total,
        CASE WHEN o.payment_status='refunded' THEN COALESCE(o.total,0) ELSE 0 END refund_total,
        CASE WHEN o.payment_status='refunded' THEN 0 ELSE COALESCE(o.total,0) END net_sales,
        COALESCE(o.total,0) total,
        NULL::text staff_name
      FROM ordering_orders o
      WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
        AND o.created_at < $2::timestamptz
        AND o.status <> 'cancelled'
        AND o.payment_status IN ('paid','refunded')
    ) canonical
    ORDER BY occurred_at DESC, receipt_number DESC`,
    [range.fromInstant, range.toInstant, cutover],
  );
  return result.rows;
}

export async function queryUnifiedItemSales(range: ResolvedReportingRange) {
  const db = requirePool();
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const result = await db.query(
    `WITH lines AS (
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
        COALESCE(c.name_en,'Other') category,
        i.quantity::numeric quantity,
        i.line_total gross_sales,
        0::numeric discount_total,
        0::numeric refund_total,
        i.line_total net_sales,
        CASE
          WHEN cfg.costing_mode='direct' THEN cfg.direct_unit_cost * i.quantity
          WHEN cfg.costing_mode='recipe' THEN NULLIF(to_jsonb(r)->>'cost_per_serving','')::numeric * i.quantity
          ELSE NULL
        END cost_of_goods,
        CASE
          WHEN cfg.costing_mode='direct' THEN i.line_total-(cfg.direct_unit_cost*i.quantity)
          WHEN cfg.costing_mode='recipe' THEN i.line_total-(NULLIF(to_jsonb(r)->>'cost_per_serving','')::numeric*i.quantity)
          ELSE NULL
        END gross_profit,
        'sbb_pos'::text source_system
      FROM ordering_order_items i
      JOIN ordering_orders o ON o.id=i.order_id
      LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
      LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
      LEFT JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.menu_item_id
      LEFT JOIN recipes r ON r.id=cfg.recipe_id
      WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
        AND o.created_at < $2::timestamptz
        AND o.status <> 'cancelled'
        AND o.payment_status='paid'
        AND COALESCE(i.is_set_component,false)=false
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
  return result.rows.map(row => ({
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
