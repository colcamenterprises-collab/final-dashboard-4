import { pool } from "../db";
import { SBB_REPORTING_CUTOVER_ISO } from "./reportingCutover";
import type { ResolvedReportingRange } from "./unifiedLedger";

const n = (value: unknown) => Number(value ?? 0) || 0;
const modifierTypeSql = `CASE
  WHEN lower(COALESCE(group_name,'')) LIKE '%level up%'
    OR lower(COALESCE(group_name,'')) LIKE '%upgrade%'
    OR lower(COALESCE(group_name,'')) LIKE '%make it better%'
    OR lower(COALESCE(group_name,'')) LIKE '%extra%'
    OR lower(COALESCE(group_name,'')) LIKE '%add on%'
    OR lower(COALESCE(group_name,'')) LIKE '%add-on%'
    OR lower(COALESCE(group_name,'')) LIKE '%upsell%'
  THEN 'Upsell'
  ELSE 'Modifier'
END`;

function db() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

export async function queryUnifiedComponents(range: ResolvedReportingRange) {
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();
  const modifiers = await db().query(
    `WITH component_rows AS (
      SELECT
        COALESCE(NULLIF(m.modifier_group,''),'Modifier') group_name,
        m.modifier_name name,
        m.quantity,
        m.revenue,
        'loyverse'::text source_system
      FROM reporting_historical_transaction_modifiers m
      JOIN reporting_historical_transaction_items i ON i.id=m.transaction_item_id
      JOIN reporting_historical_transactions h ON h.id=i.transaction_id
      JOIN reporting_import_batches b ON b.id=h.source_import_batch_id AND b.validation_status='validated'
      WHERE h.venue_key='sbb-rawai'
        AND h.occurred_at >= $1::timestamptz
        AND h.occurred_at < LEAST($2::timestamptz,$3::timestamptz)

      UNION ALL

      SELECT
        COALESCE(NULLIF(m.modifier_group_name_en,''),'Modifier') group_name,
        m.modifier_name_en name,
        m.quantity::numeric quantity,
        (COALESCE(m.price_delta,0) * COALESCE(m.quantity,1))::numeric revenue,
        'sbb_pos'::text source_system
      FROM ordering_order_item_modifiers m
      JOIN ordering_order_items i ON i.id=m.order_item_id
      JOIN ordering_orders o ON o.id=i.order_id
      WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
        AND o.created_at < $2::timestamptz
        AND o.status <> 'cancelled'
        AND o.payment_status='paid'
    )
    SELECT
      group_name,
      name,
      ${modifierTypeSql} component_type,
      SUM(quantity)::numeric quantity,
      SUM(revenue)::numeric revenue,
      jsonb_agg(DISTINCT source_system) sources
    FROM component_rows
    GROUP BY group_name,name
    ORDER BY SUM(quantity) DESC,name`,
    [range.fromInstant, range.toInstant, cutover],
  );

  const setComponents = await db().query(
    `SELECT
       COALESCE(NULLIF(i.source_sku,''),i.item_name_en) component_key,
       i.item_name_en name,
       COALESCE(c.name_en,'Other') category,
       SUM(i.quantity)::numeric quantity,
       'sbb_pos'::text source_system
     FROM ordering_order_items i
     JOIN ordering_orders o ON o.id=i.order_id
     LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
     LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
     WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
       AND o.created_at < $2::timestamptz
       AND o.status <> 'cancelled'
       AND o.payment_status='paid'
       AND COALESCE(i.is_set_component,false)=true
     GROUP BY COALESCE(NULLIF(i.source_sku,''),i.item_name_en),i.item_name_en,c.name_en
     ORDER BY SUM(i.quantity) DESC,i.item_name_en`,
    [range.fromInstant, range.toInstant, cutover],
  );

  const rows = modifiers.rows.map(row => ({
    group: row.group_name,
    name: row.name,
    type: row.component_type,
    quantity: n(row.quantity),
    revenue: n(row.revenue),
    sources: row.sources || [],
  }));

  return {
    modifiers: rows.filter(row => row.type === "Modifier"),
    upsells: rows.filter(row => row.type === "Upsell"),
    setComponents: setComponents.rows.map(row => ({
      key: row.component_key,
      name: row.name,
      category: row.category,
      quantity: n(row.quantity),
      sources: [row.source_system],
    })),
    limitations: {
      historicalSetComponents: "Loyverse Receipts by Item does not provide an explicit set-component relationship, so historical set components are not manufactured from inference.",
    },
  };
}
