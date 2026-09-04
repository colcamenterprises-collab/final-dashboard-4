import { pool } from "../db";
import type { ResolvedReportingRange } from "./unifiedLedger";
import { SBB_REPORTING_CUTOVER_ISO } from "./reportingCutover";

const n = (value: unknown) => Number(value ?? 0) || 0;
const text = (value: unknown) => String(value ?? "").trim();

export type IngredientUsageRow = {
  key: string;
  name: string;
  unit: string;
  expectedQuantity: number;
  sourceLineCount: number;
  watched: boolean;
};

function watchedIngredient(name: string) {
  return /roll|bun|beef|meat|patty|french fries|fries|nugget|coke|fanta|sprite|schweppes|manao|soda|water|singha|juice|drink/i.test(name);
}

function normalizedIngredient(raw: any, soldQuantity: number, recipeYield: number) {
  const name = text(raw?.name);
  const unit = text(raw?.unitUsed || raw?.unit || "unit");
  const batchQuantity = n(raw?.quantityUsed ?? raw?.quantity);
  if (!name || batchQuantity <= 0 || soldQuantity <= 0) return null;
  const safeYield = recipeYield > 0 ? recipeYield : 1;
  return {
    key: `${name.toLocaleLowerCase()}|${unit.toLocaleLowerCase()}`,
    name,
    unit,
    expectedQuantity: soldQuantity * (batchQuantity / safeYield),
  };
}

/**
 * Theoretical ingredient usage for SBB POS-era orders.
 *
 * Priority is the immutable sale-time recipe snapshot, including its frozen recipe yield.
 * When an older order predates snapshots, the current linked recipe is used as an explicit
 * fallback so coverage can be repaired without silently treating an unmapped sale as zero.
 */
export async function queryIngredientUsage(range: ResolvedReportingRange) {
  if (!pool) throw new Error("Database unavailable");
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();

  const itemResult = await pool.query(
    `WITH sold AS (
       SELECT
         i.id,
         i.parent_order_item_id,
         i.quantity::numeric AS sold_quantity,
         COALESCE(s.recipe_id, link.recipe_id, cfg.recipe_id) AS recipe_id,
         COALESCE(NULLIF(s.ingredient_snapshot,'[]'::jsonb), r.ingredients, '[]'::jsonb) AS ingredients,
         CASE
           WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb)) > 0
             THEN COALESCE(s.recipe_yield,1)::numeric
           ELSE COALESCE(r.yield_quantity,1)::numeric
         END AS recipe_yield,
         CASE
           WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb)) > 0 THEN 'sale_snapshot'
           WHEN COALESCE(link.recipe_id,cfg.recipe_id) IS NOT NULL THEN 'current_recipe_fallback'
           ELSE 'unmapped'
         END AS provenance
       FROM ordering_order_items i
       JOIN ordering_orders o ON o.id=i.order_id
       LEFT JOIN ordering_order_item_cost_snapshots s ON s.order_item_id=i.id
       LEFT JOIN ordering_menu_item_recipe_links link ON link.menu_item_id=i.menu_item_id
       LEFT JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.menu_item_id AND cfg.costing_mode='recipe'
       LEFT JOIN recipes r ON r.id=COALESCE(s.recipe_id,link.recipe_id,cfg.recipe_id)
       WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
         AND o.created_at < $2::timestamptz
         AND o.status <> 'cancelled'
         AND o.payment_status IN ('paid','refunded')
     ), resolved AS (
       SELECT s.*,
              EXISTS(
                SELECT 1 FROM sold parent
                WHERE parent.id=s.parent_order_item_id
                  AND parent.recipe_id IS NOT NULL
                  AND jsonb_typeof(parent.ingredients)='array'
                  AND jsonb_array_length(parent.ingredients)>0
              ) AS parent_has_recipe
       FROM sold s
     )
     SELECT id,sold_quantity,recipe_id,ingredients,recipe_yield,provenance
     FROM resolved
     WHERE NOT (parent_order_item_id IS NOT NULL AND parent_has_recipe)`,
    [range.fromInstant, range.toInstant, cutover],
  );

  const modifierResult = await pool.query(
    `SELECT
       m.id,
       m.quantity::numeric AS sold_quantity,
       COALESCE(s.recipe_id,cfg.recipe_id) AS recipe_id,
       COALESCE(NULLIF(s.ingredient_snapshot,'[]'::jsonb),r.ingredients,'[]'::jsonb) AS ingredients,
       CASE
         WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb)) > 0
           THEN COALESCE(s.recipe_yield,1)::numeric
         ELSE COALESCE(r.yield_quantity,1)::numeric
       END AS recipe_yield,
       CASE
         WHEN s.recipe_id IS NOT NULL AND jsonb_array_length(COALESCE(s.ingredient_snapshot,'[]'::jsonb)) > 0 THEN 'sale_snapshot'
         WHEN cfg.recipe_id IS NOT NULL THEN 'current_recipe_fallback'
         ELSE 'unmapped'
       END AS provenance
     FROM ordering_order_item_modifiers m
     JOIN ordering_order_items i ON i.id=m.order_item_id
     JOIN ordering_orders o ON o.id=i.order_id
     LEFT JOIN ordering_modifier_cost_snapshots s ON s.order_item_modifier_id=m.id
     LEFT JOIN pos_modifier_costing_config cfg ON cfg.item_modifier_id=m.item_modifier_id AND cfg.costing_mode='recipe'
     LEFT JOIN recipes r ON r.id=COALESCE(s.recipe_id,cfg.recipe_id)
     WHERE o.created_at >= GREATEST($1::timestamptz,$3::timestamptz)
       AND o.created_at < $2::timestamptz
       AND o.status <> 'cancelled'
       AND o.payment_status IN ('paid','refunded')`,
    [range.fromInstant, range.toInstant, cutover],
  );

  const aggregate = new Map<string, IngredientUsageRow>();
  let mappedItemQuantity = 0;
  let unmappedItemQuantity = 0;
  let snapshotItemQuantity = 0;
  let fallbackItemQuantity = 0;

  const consume = (row: any, countCoverage: boolean) => {
    const soldQuantity = n(row.sold_quantity);
    const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
    const mapped = row.recipe_id != null && ingredients.length > 0;
    if (countCoverage) {
      if (mapped) mappedItemQuantity += soldQuantity;
      else unmappedItemQuantity += soldQuantity;
      if (mapped && row.provenance === "sale_snapshot") snapshotItemQuantity += soldQuantity;
      if (mapped && row.provenance === "current_recipe_fallback") fallbackItemQuantity += soldQuantity;
    }
    if (!mapped) return;
    for (const raw of ingredients) {
      const ingredient = normalizedIngredient(raw, soldQuantity, n(row.recipe_yield));
      if (!ingredient) continue;
      const current = aggregate.get(ingredient.key);
      if (current) {
        current.expectedQuantity += ingredient.expectedQuantity;
        current.sourceLineCount += 1;
      } else {
        aggregate.set(ingredient.key, {
          ...ingredient,
          sourceLineCount: 1,
          watched: watchedIngredient(ingredient.name),
        });
      }
    }
  };

  itemResult.rows.forEach((row) => consume(row, true));
  modifierResult.rows.forEach((row) => consume(row, false));

  const ingredients = Array.from(aggregate.values()).sort((a,b) => b.expectedQuantity-a.expectedQuantity || a.name.localeCompare(b.name));
  const totalItemQuantity = mappedItemQuantity + unmappedItemQuantity;

  return {
    ingredients,
    watched: ingredients.filter((row) => row.watched),
    coverage: {
      soldItemQuantity: totalItemQuantity,
      mappedItemQuantity,
      unmappedItemQuantity,
      coveragePct: totalItemQuantity > 0 ? mappedItemQuantity / totalItemQuantity * 100 : null,
      snapshotItemQuantity,
      fallbackItemQuantity,
    },
    provenance: {
      primary: "sale-time ingredient snapshot + frozen recipe yield",
      fallback: "current recipe links/config for pre-snapshot sales",
      scope: "SBB POS-era paid/refunded non-cancelled orders; set components suppressed when parent recipe is mapped",
    },
  };
}
