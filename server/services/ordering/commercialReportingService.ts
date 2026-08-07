import { pool } from "../../db";
import { ensureCommercialSchema } from "./commercialService";

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

const activeOrderFilter = `o.status NOT IN ('cancelled','refunded')`;
let reportingSchemaReady: Promise<void> | null = null;

async function ensureReportingSchema() {
  await ensureCommercialSchema();
  if (!reportingSchemaReady) {
    reportingSchemaReady = (async () => {
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS pos_origin_channel TEXT`);
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS customer_mobile TEXT`);
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS ticket_number TEXT`);
      await db().query(`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS dining_type TEXT`);
    })();
  }
  await reportingSchemaReady;
}

export async function getMemberProfile(id: string) {
  await ensureReportingSchema();
  const memberResult = await db().query(`
    SELECT m.*,q.id AS qr_code_id,q.token AS qr_token,
      COUNT(DISTINCT o.id)::int AS order_count,
      COALESCE(SUM(o.total),0)::numeric AS lifetime_spend,
      COALESCE(AVG(o.total),0)::numeric AS average_order_value,
      MAX(o.created_at) AS last_order_at,
      COUNT(DISTINCT CASE WHEN o.partner_venue_id IS NOT NULL THEN o.id END)::int AS partner_orders,
      COUNT(DISTINCT CASE WHEN COALESCE(o.pos_origin_channel,o.channel)='online' THEN o.id END)::int AS online_orders
    FROM ordering_members m
    LEFT JOIN ordering_qr_codes q ON q.member_id=m.id AND q.qr_type='member' AND q.is_active=TRUE
    LEFT JOIN ordering_orders o ON o.member_id=m.id AND ${activeOrderFilter}
    WHERE m.id=$1
    GROUP BY m.id,q.id,q.token
    LIMIT 1
  `,[id]);
  const member = memberResult.rows[0];
  if (!member) throw new Error("Member not found");

  const ordersResult = await db().query(`
    SELECT o.id,o.order_number,LEFT(COALESCE(o.ticket_number,''),3) AS ticket_number,
      o.created_at,o.total,o.status,o.payment_status,o.payment_method,o.dining_type,
      COALESCE(o.pos_origin_channel,o.channel) AS origin_channel,o.channel_source,
      o.delivery_address_snapshot,v.name AS partner_venue_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name',i.item_name_en,'quantity',i.quantity,'line_total',i.line_total
      ) ORDER BY i.sort_order) FROM ordering_order_items i WHERE i.order_id=o.id),'[]'::jsonb) AS items
    FROM ordering_orders o
    LEFT JOIN ordering_partner_venues v ON v.id=o.partner_venue_id
    WHERE o.member_id=$1 AND ${activeOrderFilter}
    ORDER BY o.created_at DESC
    LIMIT 100
  `,[id]);

  return { ...member, orders: ordersResult.rows };
}

export async function listCustomerDirectory(tenant = "sbb") {
  await ensureReportingSchema();
  const result = await db().query(`
    WITH customer_orders AS (
      SELECT o.id,o.created_at,o.total,o.customer_name,
        COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')) AS phone,
        o.member_id,o.partner_venue_id,COALESCE(o.pos_origin_channel,o.channel) AS origin_channel
      FROM ordering_orders o
      WHERE ${activeOrderFilter}
        AND COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')) IS NOT NULL
    ), normalized AS (
      SELECT *,regexp_replace(phone,'[^0-9+]','','g') AS phone_normalized
      FROM customer_orders
    )
    SELECT n.phone_normalized,
      (ARRAY_AGG(n.phone ORDER BY n.created_at DESC))[1] AS phone_display,
      (ARRAY_AGG(NULLIF(n.customer_name,'') ORDER BY n.created_at DESC) FILTER (WHERE NULLIF(n.customer_name,'') IS NOT NULL))[1] AS name,
      COALESCE(
        (ARRAY_AGG(m.id) FILTER (WHERE m.id IS NOT NULL))[1],
        (ARRAY_AGG(n.member_id) FILTER (WHERE n.member_id IS NOT NULL))[1]
      ) AS member_id,
      (ARRAY_AGG(m.member_number) FILTER (WHERE m.member_number IS NOT NULL))[1] AS member_number,
      CASE WHEN COUNT(m.id) > 0 OR COUNT(n.member_id) > 0 THEN TRUE ELSE FALSE END AS is_member,
      COUNT(DISTINCT n.id)::int AS order_count,
      COALESCE(SUM(n.total),0)::numeric AS lifetime_spend,
      COALESCE(AVG(n.total),0)::numeric AS average_order_value,
      MIN(n.created_at) AS first_order_at,
      MAX(n.created_at) AS last_order_at,
      COUNT(DISTINCT n.partner_venue_id)::int AS partner_venues_used,
      COUNT(DISTINCT CASE WHEN n.origin_channel='online' THEN n.id END)::int AS online_orders
    FROM normalized n
    LEFT JOIN ordering_members m ON m.tenant_key=$1 AND m.phone_normalized=n.phone_normalized
    WHERE n.phone_normalized<>''
    GROUP BY n.phone_normalized
    ORDER BY MAX(n.created_at) DESC
    LIMIT 2000
  `,[String(tenant || "sbb").trim().toLowerCase() || "sbb"]);
  return result.rows;
}

export async function commercialOverview(tenant = "sbb") {
  await ensureReportingSchema();
  const tenantKey = String(tenant || "sbb").trim().toLowerCase() || "sbb";
  const [memberResult, venueResult, orderResult] = await Promise.all([
    db().query(`SELECT COUNT(*)::int AS members FROM ordering_members WHERE tenant_key=$1 AND status='active'`,[tenantKey]),
    db().query(`SELECT COUNT(*)::int AS venues FROM ordering_partner_venues WHERE tenant_key=$1 AND is_active=TRUE`,[tenantKey]),
    db().query(`SELECT
      COUNT(*)::int AS attributed_orders,
      COALESCE(SUM(total),0)::numeric AS attributed_sales,
      COUNT(DISTINCT member_id)::int AS attributed_members
      FROM ordering_orders o WHERE partner_venue_id IS NOT NULL AND ${activeOrderFilter}`),
  ]);
  return {
    members: Number(memberResult.rows[0]?.members || 0),
    active_venues: Number(venueResult.rows[0]?.venues || 0),
    attributed_orders: Number(orderResult.rows[0]?.attributed_orders || 0),
    attributed_sales: Number(orderResult.rows[0]?.attributed_sales || 0),
    attributed_members: Number(orderResult.rows[0]?.attributed_members || 0),
  };
}

export async function detailedPartnerVenueReport(id: string) {
  await ensureReportingSchema();
  const summaryResult = await db().query(`
    WITH scans AS (
      SELECT q.partner_venue_id,COUNT(e.id)::int AS qr_scans
      FROM ordering_qr_codes q
      LEFT JOIN ordering_qr_events e ON e.qr_code_id=q.id AND e.event_type='scan'
      WHERE q.partner_venue_id=$1 AND q.qr_type='partner_venue'
      GROUP BY q.partner_venue_id
    ), orders AS (
      SELECT o.partner_venue_id,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.total),0)::numeric AS sales,
        COALESCE(AVG(o.total),0)::numeric AS average_order_value,
        COUNT(DISTINCT o.member_id)::int AS members,
        COUNT(DISTINCT COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')))::int AS known_customers,
        MAX(o.created_at) AS last_order_at
      FROM ordering_orders o
      WHERE o.partner_venue_id=$1 AND ${activeOrderFilter}
      GROUP BY o.partner_venue_id
    )
    SELECT v.id,v.name,v.code,v.address,v.contact_name,v.phone,v.created_at,
      COALESCE(s.qr_scans,0)::int AS qr_scans,
      COALESCE(r.orders,0)::int AS orders,
      COALESCE(r.sales,0)::numeric AS sales,
      COALESCE(r.average_order_value,0)::numeric AS average_order_value,
      COALESCE(r.members,0)::int AS members,
      COALESCE(r.known_customers,0)::int AS known_customers,
      r.last_order_at
    FROM ordering_partner_venues v
    LEFT JOIN scans s ON s.partner_venue_id=v.id
    LEFT JOIN orders r ON r.partner_venue_id=v.id
    WHERE v.id=$1
  `,[id]);
  const summary = summaryResult.rows[0];
  if (!summary) throw new Error("Partner venue not found");

  const recentResult = await db().query(`
    SELECT o.id,o.order_number,LEFT(COALESCE(o.ticket_number,''),3) ticket_number,o.created_at,o.total,
      o.customer_name,COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')) customer_phone,
      o.member_id,m.member_number,m.name member_name,o.status,o.payment_method
    FROM ordering_orders o
    LEFT JOIN ordering_members m ON m.id=o.member_id
    WHERE o.partner_venue_id=$1 AND ${activeOrderFilter}
    ORDER BY o.created_at DESC LIMIT 50
  `,[id]);

  const scans = Number(summary.qr_scans || 0);
  const orders = Number(summary.orders || 0);
  return {
    ...summary,
    conversion_rate: scans > 0 ? Number(((orders / scans) * 100).toFixed(1)) : 0,
    recent_orders: recentResult.rows,
  };
}
