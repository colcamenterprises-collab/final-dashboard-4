import { pool } from "../db";
import { shiftWindow } from "./time/shiftWindow";

const number = (value: unknown) => Number(value ?? 0) || 0;
const text = (value: unknown) => String(value ?? "").trim();

export type AnomalySeverity = "within_tolerance" | "warning" | "material_anomaly" | "missing_data";

export function ingredientKey(name: string, unit: string) {
  return `${name.trim().toLocaleLowerCase()}|${unit.trim().toLocaleLowerCase()}`;
}

export function calculateInventoryPosition(input: {
  opening: number | null;
  stockIn: number;
  transfersIn: number;
  transfersOut: number;
  waste: number;
  adjustments: number;
  expectedConsumption: number;
  physicalCount: number | null;
  tolerance: number;
  materialTolerance?: number | null;
}) {
  const expectedClosing = input.opening == null ? null : input.opening + input.stockIn + input.transfersIn
    - input.transfersOut - input.waste + input.adjustments - input.expectedConsumption;
  const variance = expectedClosing == null || input.physicalCount == null ? null : input.physicalCount - expectedClosing;
  const material = input.materialTolerance == null
    ? Math.max(input.tolerance * 2, input.tolerance)
    : input.materialTolerance;
  const severity: AnomalySeverity = variance == null
    ? "missing_data"
    : Math.abs(variance) <= input.tolerance
      ? "within_tolerance"
      : Math.abs(variance) >= material
        ? "material_anomaly"
        : "warning";
  return { expectedClosing, variance, severity };
}

function requireDb() {
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must use YYYY-MM-DD");
}

export async function getSbbProductSales(date: string) {
  assertDate(date);
  const db = requireDb();
  const window = shiftWindow(date);
  const result = await db.query(
    `WITH valid_lines AS (
       SELECT i.*, parent.item_name_en AS parent_name,
              COALESCE(s.recipe_id,link.recipe_id,cfg.recipe_id) AS recipe_id,
              COALESCE(r.name,i.item_name_en) AS product_name
       FROM ordering_order_items i
       JOIN ordering_orders o ON o.id=i.order_id
       LEFT JOIN ordering_order_items parent ON parent.id=i.parent_order_item_id
       LEFT JOIN ordering_order_item_cost_snapshots s ON s.order_item_id=i.id
       LEFT JOIN ordering_menu_item_recipe_links link ON link.menu_item_id=i.menu_item_id
       LEFT JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.menu_item_id AND cfg.costing_mode='recipe'
       LEFT JOIN recipes r ON r.id=COALESCE(s.recipe_id,link.recipe_id,cfg.recipe_id)
       WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled' AND o.payment_status='paid'
     ), product_sources AS (
       SELECT COALESCE(recipe_id::text,NULLIF(source_sku,''),item_name_en) product_key,
              product_name,
              CASE WHEN COALESCE(is_set_component,false) OR parent_name IS NOT NULL
                   THEN COALESCE(parent_name,'Meal Deal') ELSE 'Direct' END source,
              CASE WHEN COALESCE(is_set_component,false) OR parent_name IS NOT NULL THEN 'meal_deal' ELSE 'direct' END source_type,
              SUM(quantity)::numeric quantity
       FROM valid_lines
       GROUP BY COALESCE(recipe_id::text,NULLIF(source_sku,''),item_name_en),product_name,
                CASE WHEN COALESCE(is_set_component,false) OR parent_name IS NOT NULL THEN COALESCE(parent_name,'Meal Deal') ELSE 'Direct' END,
                CASE WHEN COALESCE(is_set_component,false) OR parent_name IS NOT NULL THEN 'meal_deal' ELSE 'direct' END
     )
     SELECT product_key,product_name,
            SUM(quantity)::numeric total,
            SUM(quantity) FILTER (WHERE source_type='direct')::numeric direct,
            SUM(quantity) FILTER (WHERE source_type='meal_deal')::numeric meal_deal,
            jsonb_agg(jsonb_build_object('source',source,'sourceType',source_type,'quantity',quantity) ORDER BY source) sources
     FROM product_sources GROUP BY product_key,product_name ORDER BY SUM(quantity) DESC,product_name`,
    [window.fromISO, window.toISO],
  );

  const deals = await db.query(
    `SELECT i.item_name_en name,SUM(i.quantity)::numeric quantity
     FROM ordering_order_items i JOIN ordering_orders o ON o.id=i.order_id
     WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz
       AND o.status <> 'cancelled' AND o.payment_status='paid'
       AND COALESCE(i.is_set_component,false)=false
       AND EXISTS (SELECT 1 FROM ordering_order_items c WHERE c.parent_order_item_id=i.id AND COALESCE(c.is_set_component,false)=true)
     GROUP BY i.item_name_en ORDER BY SUM(i.quantity) DESC,i.item_name_en`,
    [window.fromISO, window.toISO],
  );
  return {
    products: result.rows.map((row: any) => ({ ...row, total: number(row.total), direct: number(row.direct), mealDeal: number(row.meal_deal) })),
    mealDeals: deals.rows.map((row: any) => ({ name: row.name, quantity: number(row.quantity) })),
  };
}

async function expectedUsage(date: string) {
  const db = requireDb();
  const window = shiftWindow(date);
  const result = await db.query(
    `WITH item_usage AS (
       SELECT i.item_name_en product_name,
              CASE WHEN COALESCE(i.is_set_component,false) OR i.parent_order_item_id IS NOT NULL
                   THEN COALESCE(parent.item_name_en,'Meal Deal') ELSE 'Direct' END sale_source,
              i.quantity::numeric sold_quantity,
              COALESCE(NULLIF(s.ingredient_snapshot,'[]'::jsonb),r.ingredients,'[]'::jsonb) ingredients,
              CASE WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb))>0
                   THEN COALESCE(s.recipe_yield,1)::numeric ELSE COALESCE(r.yield_quantity,1)::numeric END recipe_yield,
              CASE WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb))>0
                   THEN 'sale_snapshot' WHEN COALESCE(link.recipe_id,cfg.recipe_id) IS NOT NULL THEN 'current_recipe_fallback' ELSE 'unmapped' END provenance
       FROM ordering_order_items i JOIN ordering_orders o ON o.id=i.order_id
       LEFT JOIN ordering_order_items parent ON parent.id=i.parent_order_item_id
       LEFT JOIN ordering_order_item_cost_snapshots s ON s.order_item_id=i.id
       LEFT JOIN ordering_menu_item_recipe_links link ON link.menu_item_id=i.menu_item_id
       LEFT JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.menu_item_id AND cfg.costing_mode='recipe'
       LEFT JOIN recipes r ON r.id=COALESCE(s.recipe_id,link.recipe_id,cfg.recipe_id)
       WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled' AND o.payment_status='paid'
     ), modifier_usage AS (
       SELECT i.item_name_en product_name,COALESCE(NULLIF(m.modifier_name_en,''),'Modifier') sale_source,
              (m.quantity*COALESCE(NULLIF(s.usage_multiplier,0),NULLIF(cfg.usage_multiplier,0),1))::numeric sold_quantity,
              COALESCE(NULLIF(s.ingredient_snapshot,'[]'::jsonb),r.ingredients,'[]'::jsonb) ingredients,
              CASE WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb))>0
                   THEN COALESCE(s.recipe_yield,1)::numeric ELSE COALESCE(r.yield_quantity,1)::numeric END recipe_yield,
              CASE WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb))>0
                   THEN 'sale_snapshot' WHEN cfg.recipe_id IS NOT NULL THEN 'current_recipe_fallback' ELSE 'unmapped' END provenance
       FROM ordering_order_item_modifiers m
       JOIN ordering_order_items i ON i.id=m.order_item_id JOIN ordering_orders o ON o.id=i.order_id
       LEFT JOIN ordering_modifier_cost_snapshots s ON s.order_item_modifier_id=m.id
       LEFT JOIN pos_modifier_costing_config cfg ON cfg.item_modifier_id=m.item_modifier_id AND cfg.costing_mode='recipe'
       LEFT JOIN recipes r ON r.id=COALESCE(s.recipe_id,cfg.recipe_id)
       WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled' AND o.payment_status='paid'
     ), usage_rows AS (SELECT * FROM item_usage UNION ALL SELECT * FROM modifier_usage), expanded AS (
       SELECT product_name,sale_source,provenance,
              COALESCE(x->>'name','') ingredient_name,
              COALESCE(NULLIF(x->>'unitUsed',''),NULLIF(x->>'unit',''),'unit') unit,
              sold_quantity*(COALESCE(NULLIF(x->>'quantityUsed',''),x->>'quantity','0')::numeric/NULLIF(recipe_yield,0)) quantity
       FROM usage_rows CROSS JOIN LATERAL jsonb_array_elements(ingredients) x
       WHERE jsonb_typeof(ingredients)='array'
     )
     SELECT lower(trim(ingredient_name))||'|'||lower(trim(unit)) ingredient_key,
            ingredient_name,unit,SUM(quantity)::numeric expected_consumption,
            jsonb_agg(jsonb_build_object('product',product_name,'source',sale_source,'usage',quantity,'provenance',provenance) ORDER BY product_name,sale_source) sources
     FROM expanded WHERE ingredient_name<>''
     GROUP BY lower(trim(ingredient_name))||'|'||lower(trim(unit)),ingredient_name,unit
     HAVING ABS(SUM(quantity))>0.0000001 ORDER BY ingredient_name`,
    [window.fromISO, window.toISO],
  );
  return result.rows;
}

export async function getSbbStockReconciliation(date: string, shiftKey = "") {
  assertDate(date);
  const db = requireDb();
  const usageRows = await expectedUsage(date);
  const [counts, configs, movements] = await Promise.all([
    db.query(`SELECT * FROM sbb_inventory_physical_count WHERE business_date=$1::date AND shift_key=$2`, [date, shiftKey]),
    db.query(`SELECT * FROM sbb_inventory_item_config WHERE active=true`),
    db.query(`SELECT ingredient_key,movement_type,SUM(quantity)::numeric quantity FROM sbb_inventory_movement WHERE business_date=$1::date AND shift_key=$2 GROUP BY ingredient_key,movement_type`, [date, shiftKey]),
  ]);
  const countByKey = new Map(counts.rows.map((row: any) => [row.ingredient_key, row]));
  const configByKey = new Map(configs.rows.map((row: any) => [row.ingredient_key, row]));
  const movementByKey = new Map<string, Record<string, number>>();
  for (const row of movements.rows as any[]) {
    const current = movementByKey.get(row.ingredient_key) || {};
    current[row.movement_type] = number(row.quantity);
    movementByKey.set(row.ingredient_key, current);
  }
  const openingResult = await db.query(
    `SELECT DISTINCT ON (ingredient_key) ingredient_key,quantity,unit,business_date
     FROM sbb_inventory_physical_count WHERE business_date<$1::date
     ORDER BY ingredient_key,business_date DESC,updated_at DESC`, [date],
  );
  const openingByKey = new Map(openingResult.rows.map((row: any) => [row.ingredient_key, row]));

  const rows = usageRows.map((usage: any) => {
    const key = text(usage.ingredient_key);
    const count: any = countByKey.get(key);
    const config: any = configByKey.get(key);
    const opening: any = openingByKey.get(key);
    const movement = movementByKey.get(key) || {};
    const expectedConsumption = number(usage.expected_consumption);
    const tolerance = number(config?.tolerance_quantity);
    const calculated = calculateInventoryPosition({
      opening: opening ? number(opening.quantity) : null,
      stockIn: number(movement.STOCK_IN), transfersIn: number(movement.TRANSFER_IN),
      transfersOut: number(movement.TRANSFER_OUT), waste: number(movement.WASTE),
      adjustments: number(movement.ADJUSTMENT), expectedConsumption,
      physicalCount: count ? number(count.quantity) : null, tolerance,
      materialTolerance: config?.material_tolerance_quantity == null ? null : number(config.material_tolerance_quantity),
    });
    return {
      ingredientKey: key, ingredient: usage.ingredient_name, unit: usage.unit,
      group: config?.group_name || "Other", opening: opening ? number(opening.quantity) : null,
      openingDate: opening?.business_date || null, stockIn: number(movement.STOCK_IN),
      transfersIn: number(movement.TRANSFER_IN), transfersOut: number(movement.TRANSFER_OUT),
      waste: number(movement.WASTE), adjustments: number(movement.ADJUSTMENT), expectedConsumption,
      expectedClosing: calculated.expectedClosing, staffReported: null,
      physicalCount: count ? number(count.quantity) : null, variance: calculated.variance,
      tolerance, materialTolerance: config?.material_tolerance_quantity == null ? null : number(config.material_tolerance_quantity),
      severity: calculated.severity, savedAt: count?.updated_at || null, sources: usage.sources || [],
      blockers: [!opening ? "OPENING_PHYSICAL_COUNT_MISSING" : null, usage.sources?.some((s: any) => s.provenance === "current_recipe_fallback") ? "HISTORICAL_RECIPE_SNAPSHOT_MISSING" : null].filter(Boolean),
    };
  });
  return { date, shiftKey, signConvention: "variance = physicalCount - expectedClosing", rows };
}

export async function savePhysicalCounts(input: { date: string; shiftKey?: string; user: { id: number; name: string }; counts: Array<{ ingredientKey: string; ingredient: string; quantity: number; unit: string }> }) {
  assertDate(input.date);
  const db = requireDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const entry of input.counts) {
      if (!entry.ingredientKey || !entry.ingredient || !entry.unit || !Number.isFinite(entry.quantity) || entry.quantity < 0) throw new Error("Every physical count requires a non-negative quantity, ingredient and unit");
      const prior = await client.query(`SELECT id,quantity FROM sbb_inventory_physical_count WHERE business_date=$1::date AND shift_key=$2 AND ingredient_key=$3 FOR UPDATE`, [input.date, input.shiftKey || "", entry.ingredientKey]);
      const saved = await client.query(
        `INSERT INTO sbb_inventory_physical_count (business_date,shift_key,ingredient_key,ingredient_name,quantity,unit,counted_by,counted_by_name)
         VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (business_date,shift_key,ingredient_key) DO UPDATE SET quantity=EXCLUDED.quantity,unit=EXCLUDED.unit,ingredient_name=EXCLUDED.ingredient_name,counted_by=EXCLUDED.counted_by,counted_by_name=EXCLUDED.counted_by_name,updated_at=now()
         RETURNING id`, [input.date, input.shiftKey || "", entry.ingredientKey, entry.ingredient, entry.quantity, entry.unit, input.user.id, input.user.name],
      );
      await client.query(
        `INSERT INTO sbb_inventory_physical_count_audit (physical_count_id,business_date,shift_key,ingredient_key,ingredient_name,unit,previous_quantity,new_quantity,changed_by,changed_by_name)
         VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [saved.rows[0].id, input.date, input.shiftKey || "", entry.ingredientKey, entry.ingredient, entry.unit, prior.rows[0]?.quantity ?? null, entry.quantity, input.user.id, input.user.name],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPhysicalCountAudit(date: string, shiftKey = "") {
  assertDate(date);
  return (await requireDb().query(
    `SELECT ingredient_key,ingredient_name,unit,previous_quantity,new_quantity,changed_by,changed_by_name,changed_at
     FROM sbb_inventory_physical_count_audit WHERE business_date=$1::date AND shift_key=$2 ORDER BY changed_at DESC,id DESC`, [date, shiftKey],
  )).rows;
}
