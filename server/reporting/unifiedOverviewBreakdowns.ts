import { pool } from "../db";
import { SBB_REPORTING_CUTOVER_ISO } from "./reportingCutover";
import type { ResolvedReportingRange } from "./unifiedLedger";

const n = (value: unknown) => Number(value ?? 0) || 0;

function db() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

export async function queryUnifiedOverviewBreakdowns(range: ResolvedReportingRange) {
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const result = await db().query(
    `WITH canonical_transactions AS (
       SELECT h.occurred_at, h.net_sales
       FROM reporting_historical_transactions h
       JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
       WHERE h.venue_key='sbb-rawai'
         AND h.occurred_at >= $1::timestamptz
         AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)
       UNION ALL
       SELECT o.created_at occurred_at,
              CASE WHEN o.payment_status='refunded' THEN 0 ELSE COALESCE(o.total,0) END net_sales
       FROM ordering_orders o
       WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
         AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled'
         AND o.payment_status IN ('paid','refunded')
     ), canonical_lines AS (
       SELECT i.item_name, COALESCE(NULLIF(i.category,''),'Other') category, i.quantity, i.net_sales
       FROM reporting_historical_transaction_items i
       JOIN reporting_historical_transactions h ON h.id=i.transaction_id
       JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
       WHERE h.venue_key='sbb-rawai'
         AND h.occurred_at >= $1::timestamptz
         AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)
       UNION ALL
       SELECT i.item_name_en item_name, COALESCE(c.name_en,'Other') category, i.quantity::numeric quantity, i.line_total net_sales
       FROM ordering_order_items i
       JOIN ordering_orders o ON o.id=i.order_id
       LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
       LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
       WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
         AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled'
         AND o.payment_status='paid'
         AND COALESCE(i.is_set_component,false)=false
     )
     SELECT jsonb_build_object(
       'daily', COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.report_day) FROM (
         SELECT to_char(timezone($4,occurred_at),'YYYY-MM-DD') AS report_day,
                COUNT(*)::int AS orders,
                SUM(net_sales)::numeric AS net_sales
         FROM canonical_transactions GROUP BY 1
       ) x),'[]'::jsonb),
       'hourly', COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.bucket_start) FROM (
         SELECT date_trunc('hour', occurred_at) AS bucket_start,
                COUNT(*)::int AS orders,
                SUM(net_sales)::numeric AS net_sales
         FROM canonical_transactions GROUP BY 1
       ) x),'[]'::jsonb),
       'categories', COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.net_sales DESC) FROM (
         SELECT category, SUM(quantity)::numeric AS quantity, SUM(net_sales)::numeric AS net_sales
         FROM canonical_lines GROUP BY category
       ) x),'[]'::jsonb),
       'topProducts', COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.net_sales DESC) FROM (
         SELECT item_name, SUM(quantity)::numeric AS quantity, SUM(net_sales)::numeric AS net_sales
         FROM canonical_lines GROUP BY item_name ORDER BY SUM(net_sales) DESC LIMIT 10
       ) x),'[]'::jsonb)
     ) payload`,
    [range.fromInstant, range.toInstant, cutover, range.timezone],
  );
  const payload = result.rows[0]?.payload || {};
  return {
    daily: (payload.daily || []).map((row: any) => ({ day: row.report_day, orders: n(row.orders), netSales: n(row.net_sales) })),
    hourly: (payload.hourly || []).map((row: any) => ({ bucketStart: row.bucket_start, orders: n(row.orders), netSales: n(row.net_sales) })),
    categories: (payload.categories || []).map((row: any) => ({ category: row.category, quantity: n(row.quantity), netSales: n(row.net_sales) })),
    topProducts: (payload.topProducts || []).map((row: any) => ({ itemName: row.item_name, quantity: n(row.quantity), netSales: n(row.net_sales) })),
  };
}
