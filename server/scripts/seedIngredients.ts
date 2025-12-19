// PATCH C — Seed ingredients from foodCostings.ts
// One-time idempotent seed script

import { pool } from "../db";
import { foodCostings } from "../data/foodCostings";

function parseCost(costStr: string): number {
  if (!costStr) return 0;
  const cleaned = costStr.replace(/[฿,]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

export async function seedIngredients(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  console.log(`[SEED] Starting ingredient seed from foodCostings (${foodCostings.length} items)`);

  for (const item of foodCostings) {
    const name = (item as any).item?.trim();
    if (!name) {
      console.log(`[SEED] Skipping item with no name`);
      skipped++;
      continue;
    }

    const existsResult = await pool.query(
      `SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)`,
      [name]
    );

    if (existsResult.rows.length > 0) {
      console.log(`[SEED] Skipping existing: ${name}`);
      skipped++;
      continue;
    }

    const cost = parseCost((item as any).cost || "");

    await pool.query(
      `INSERT INTO ingredients (
        name, category, supplier, brand, 
        packaging_qty, package_cost, portion_unit, 
        last_review_date, verified, locked, unit_price, price, unit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        name,
        (item as any).category || null,
        (item as any).supplier || null,
        (item as any).brand || null,
        (item as any).packagingQty || null,
        cost,
        (item as any).averageMenuPortion || null,
        (item as any).lastReviewDate || null,
        false,
        false,
        cost,
        cost,
        (item as any).averageMenuPortion || "each",
      ]
    );

    console.log(`[SEED] Inserted: ${name}`);
    inserted++;
  }

  console.log(`[SEED] Complete: ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

// Run directly
seedIngredients()
  .then((result) => {
    console.log(`\n✅ Seed complete: ${result.inserted} ingredients added`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
