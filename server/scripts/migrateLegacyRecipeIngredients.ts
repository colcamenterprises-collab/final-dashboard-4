/**
 * 🔒 PATCH R1.2: MIGRATE LEGACY RECIPES TO CANONICAL INGREDIENTS
 * 
 * Migrates legacy recipe ingredients that reference purchasingItemId
 * to canonical ingredientId.
 * 
 * SAFE TO RE-RUN (idempotent).
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("[Migration R1.2] Starting legacy recipe ingredient migration...");

  // Find legacy recipe ingredients that have purchasingItemId but no ingredientId
  const legacyResult = await db.execute(sql`
    SELECT id, recipe_id, purchasing_item_id, quantity, unit
    FROM recipe_ingredient
    WHERE ingredient_id IS NULL
      AND purchasing_item_id IS NOT NULL
  `);

  const legacyRows = legacyResult.rows || legacyResult;
  console.log(`[Migration R1.2] Found ${legacyRows.length} legacy recipe ingredients`);

  let migrated = 0;
  let skipped = 0;

  for (const row of legacyRows as any[]) {
    // Find canonical ingredient by source_purchasing_item_id
    const ingResult = await db.execute(sql`
      SELECT id, name, base_unit, unit_cost_per_base
      FROM ingredients
      WHERE source_purchasing_item_id = ${row.purchasing_item_id}
      LIMIT 1
    `);

    const ingredients = ingResult.rows || ingResult;

    if (!ingredients || ingredients.length === 0) {
      console.warn(
        `[Migration R1.2] No canonical ingredient for purchasingItemId ${row.purchasing_item_id}`
      );
      skipped++;
      continue;
    }

    const canonicalIng = ingredients[0] as any;

    // Update recipe_ingredient to use canonical ingredientId
    // Also copy quantity to portion_qty for canonical format
    await db.execute(sql`
      UPDATE recipe_ingredient
      SET 
        ingredient_id = ${canonicalIng.id},
        portion_qty = ${row.quantity}
      WHERE id = ${row.id}
    `);

    console.log(
      `[Migration R1.2] Migrated recipe_ingredient ${row.id}: ` +
      `purchasingItemId ${row.purchasing_item_id} -> ingredientId ${canonicalIng.id} (${canonicalIng.name})`
    );
    migrated++;
  }

  console.log(`[Migration R1.2] Migration complete:`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped (no canonical ingredient): ${skipped}`);
  console.log(`  - Total legacy: ${legacyRows.length}`);

  // Verify migration
  const remainingResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM recipe_ingredient
    WHERE ingredient_id IS NULL
  `);
  const remaining = (remainingResult.rows || remainingResult)[0] as any;
  console.log(`[Migration R1.2] Remaining with NULL ingredient_id: ${remaining.count}`);
}

migrate()
  .then(() => {
    console.log("[Migration R1.2] Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Migration R1.2] Error:", err);
    process.exit(1);
  });
