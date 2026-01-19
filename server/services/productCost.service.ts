/**
 * Product cost service (product-first).
 *
 * Cost is derived line-by-line from product_ingredient + ingredients.
 * unit_cost_derived = ingredient.purchase_cost / ingredient.yield_per_purchase
 * line_cost_derived = unit_cost_derived * quantity_used
 */

import { db, pool } from "../db";
import { sql } from "drizzle-orm";

export type ProductCostLine = {
  productIngredientId: number;
  ingredientId: number;
  ingredientName: string | null;
  quantityUsed: number;
  unitCostDerived: number | null;
  lineCostDerived: number | null;
  yieldUnit: string | null;
  prepNote: string | null;
};

export type ProductCostResult = {
  productId: number;
  lines: ProductCostLine[];
  totalCost: number | null;
};

const toNumberOrNull = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Recalculate and persist derived costs for a product.
 * Returns null if any required input is missing.
 */
export async function recalcProductCosts(productId: number): Promise<{ totalCost: number | null }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      SELECT
        pi.id AS product_ingredient_id,
        pi.quantity_used,
        i.purchase_cost,
        i.yield_per_purchase
      FROM product_ingredient pi
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      WHERE pi.product_id = $1
      ORDER BY pi.id
      `,
      [productId],
    );

    if (rows.length === 0) {
      await client.query("COMMIT");
      return { totalCost: null };
    }

    let totalCost = 0;
    let hasMissing = false;

    for (const row of rows) {
      const quantityUsed = toNumberOrNull(row.quantity_used);
      const purchaseCost = toNumberOrNull(row.purchase_cost);
      const yieldPerPurchase = toNumberOrNull(row.yield_per_purchase);

      let unitCost: number | null = null;
      let lineCost: number | null = null;

      if (
        quantityUsed === null ||
        quantityUsed <= 0 ||
        purchaseCost === null ||
        purchaseCost < 0 ||
        yieldPerPurchase === null ||
        yieldPerPurchase <= 0
      ) {
        hasMissing = true;
      } else {
        unitCost = purchaseCost / yieldPerPurchase;
        lineCost = unitCost * quantityUsed;
        totalCost += lineCost;
      }

      await client.query(
        `
        UPDATE product_ingredient
        SET unit_cost_derived = $1,
            line_cost_derived = $2
        WHERE id = $3
        `,
        [unitCost, lineCost, row.product_ingredient_id],
      );
    }

    await client.query("COMMIT");
    return { totalCost: hasMissing ? null : Number(totalCost.toFixed(4)) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductCostTotal(productId: number): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS line_count,
      COUNT(line_cost_derived)::int AS line_cost_count,
      SUM(line_cost_derived)::numeric AS total_cost
    FROM product_ingredient
    WHERE product_id = ${productId}
  `);

  const row = (result.rows || result)[0] as {
    line_count: number;
    line_cost_count: number;
    total_cost: string | null;
  };

  if (!row || row.line_count === 0) return null;
  if (row.line_cost_count < row.line_count) return null;
  return row.total_cost !== null ? Number(row.total_cost) : null;
}

export async function getProductCostDetails(productId: number): Promise<ProductCostResult> {
  const result = await db.execute(sql`
    SELECT
      pi.id as "productIngredientId",
      pi.ingredient_id as "ingredientId",
      i.name as "ingredientName",
      pi.quantity_used as "quantityUsed",
      pi.unit_cost_derived as "unitCostDerived",
      pi.line_cost_derived as "lineCostDerived",
      i.yield_unit as "yieldUnit",
      pi.prep_note as "prepNote"
    FROM product_ingredient pi
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ${productId}
    ORDER BY pi.id
  `);

  const rows = (result.rows || result) as ProductCostLine[];
  const totalCost = await getProductCostTotal(productId);

  return {
    productId,
    lines: rows,
    totalCost,
  };
}
