import { pool } from "../../db";
import { ensureCommercialSchema } from "./commercialService";

function db() {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

const activeOrderFilter = `o.status NOT IN ('cancelled','refunded')`;

export async function getMemberProfile(id: string) {
  await ensureCommercialSchema();
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
  await ensureCommercialSchema();
  const result = await db().query(`
    WITH customer_orders AS (
      SELECT o.id,o.created_at,o.total,o.customer_name,
        COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')) AS phone,
        o.member_id,o.partner_venue_id,COALESCE(o.pos_origin_channel,o.channel) AS origin_channel,
        o.status
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
      COALESCE(MAX(m.id),MAX(n.member_id)) AS member_id,
      MAX(m.member_number) AS member_number,
      CASE WHEN COALESCE(MAX(m.id),MAX(n.member_id)) IS NULL THEN FALSE ELSE TRUE END AS is_member,
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
  await ensureCommercialSchema();
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
  await ensureCommercialSchema();
  const summaryResult = await db().query(`
    SELECT v.id,v.name,v.code,v.address,v.contact_name,v.phone,v.created_at,
      COUNT(DISTINCT e.id)::int AS qr_scans,
      COUNT(DISTINCT o.id)::int AS orders,
      COALESCE(SUM(DISTINCT CASE WHEN o.id IS NOT NULL THEN o.total ELSE 0 END),0)::numeric AS sales,
      COALESCE(AVG(DISTINCT CASE WHEN o.id IS NOT NULL THEN o.total END),0)::numeric AS average_order_value,
      COUNT(DISTINCT o.member_id)::int AS members,
      COUNT(DISTINCT COALESCE(NULLIF(o.customer_phone,''),NULLIF(o.customer_mobile,'')))::int AS known_customers,
      MAX(o.created_at) AS last_order_at
    FROM ordering_partner_venues v
    LEFT JOIN ordering_qr_codes q ON q.partner_venue_id=v.id AND q.qr_type='partner_venue'
    LEFT JOIN ordering_qr_events e ON e.qr_code_id=q.id AND e.event_type='scan'
    LEFT JOIN ordering_orders o ON o.partner_venue_id=v.id AND ${activeOrderFilter}
    WHERE v.id=$1
    GROUP BY v.id
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
