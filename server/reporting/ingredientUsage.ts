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

export type IngredientUsageSourceRow = {
  sold_quantity: unknown;
  recipe_id?: unknown;
  ingredients?: unknown;
  recipe_yield?: unknown;
  provenance?: unknown;
  is_set_component?: unknown;
  usage_multiplier?: unknown;
};

function watchedIngredient(name: string) {
  return /roll|bun|beef|meat|patty|french fries|fries|nugget|coke|fanta|sprite|schweppes|manao|soda|water|singha|juice|drink/i.test(name);
}

function normalizedIngredient(raw: any, soldQuantity: number, recipeYield: number) {
  const name = text(raw?.name);
  const unit = text(raw?.unitUsed || raw?.unit || "unit");
  const batchQuantity = n(raw?.quantityUsed ?? raw?.quantity);
  if (!name || batchQuantity <= 0 || soldQuantity === 0) return null;
  const safeYield = recipeYield > 0 ? recipeYield : 1;
  return {
    key: `${name.toLocaleLowerCase()}|${unit.toLocaleLowerCase()}`,
    name,
    unit,
    expectedQuantity: soldQuantity * (batchQuantity / safeYield),
  };
}

export function aggregateIngredientUsageRows(
  itemRows: IngredientUsageSourceRow[],
  modifierRows: IngredientUsageSourceRow[],
) {
  const aggregate = new Map<string, IngredientUsageRow>();
  let mappedItemQuantity = 0;
  let unmappedItemQuantity = 0;
  let snapshotItemQuantity = 0;
  let fallbackItemQuantity = 0;
  let setComponentQuantity = 0;

  const consume = (row: IngredientUsageSourceRow, countCoverage: boolean) => {
    const baseSoldQuantity = n(row.sold_quantity);
    const multiplier = countCoverage ? 1 : (row.usage_multiplier === undefined || row.usage_multiplier === null ? 1 : n(row.usage_multiplier));
    const soldQuantity = baseSoldQuantity * multiplier;
    const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
    const mapped = row.recipe_id != null && ingredients.length > 0;

    if (countCoverage) {
      if (mapped) mappedItemQuantity += baseSoldQuantity;
      else unmappedItemQuantity += baseSoldQuantity;
      if (mapped && row.provenance === "sale_snapshot") snapshotItemQuantity += baseSoldQuantity;
      if (mapped && row.provenance === "current_recipe_fallback") fallbackItemQuantity += baseSoldQuantity;
      if (row.is_set_component === true) setComponentQuantity += baseSoldQuantity;
    }

    if (!mapped || soldQuantity === 0) return;
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

  itemRows.forEach((row) => consume(row, true));
  modifierRows.forEach((row) => consume(row, false));

  const ingredients = Array.from(aggregate.values())
    .filter((row) => Math.abs(row.expectedQuantity) > 1e-9)
    .sort((a, b) => b.expectedQuantity - a.expectedQuantity || a.name.localeCompare(b.name));
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
      setComponentQuantity,
    },
  };
}

/**
 * Theoretical ingredient usage for SBB POS-era orders.
 *
 * Every recorded order line is a consumption line. This intentionally includes zero-revenue
 * set component children (fries, selected drinks and future sides) instead of suppressing them
 * when the parent burger/set has a recipe. The parent contributes its own recipe; child rows
 * contribute their own recipes. Modifier rows are applied independently and may use a signed
 * usage multiplier (+1 add, -1 remove) captured at sale time.
 *
 * Priority is the immutable sale-time recipe snapshot, including its frozen recipe yield.
 * When an older order predates snapshots, the current linked recipe is used as an explicit
 * fallback so coverage can be repaired without silently treating an unmapped sale as zero.
 */
export async function queryIngredientUsage(range: ResolvedReportingRange) {
  if (!pool) throw new Error("Database unavailable");
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).toISOString();

  const itemResult = await pool.query(
    `SELECT
       i.id,
       i.quantity::numeric AS sold_quantity,
       COALESCE(i.is_set_component,false) AS is_set_component,
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
       AND o.payment_status IN ('paid','refunded')`,
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
       COALESCE(s.usage_multiplier,cfg.usage_multiplier,1)::numeric AS usage_multiplier,
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

  const result = aggregateIngredientUsageRows(itemResult.rows, modifierResult.rows);
  return {
    ...result,
    provenance: {
      primary: "sale-time ingredient snapshot + frozen recipe yield",
      fallback: "current recipe links/config for pre-snapshot sales",
      scope: "SBB POS-era paid/refunded non-cancelled orders; parent items and recorded set-component children are consumed independently; signed modifier recipe effects are included",
    },
  };
}
