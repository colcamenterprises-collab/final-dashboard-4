/**
 * PATCH P1: PRODUCT COST SERVICE
 *
 * Product-first costing derived from product_ingredient lines.
 * unit_cost_derived = ingredient.purchase_cost / ingredient.yield_per_purchase
 * line_cost_derived = unit_cost_derived * quantity_used
 */

import { db, pool } from "../db";
import { sql } from "drizzle-orm";

export type ProductCostLine = {
  id: number;
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

const toNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Recalculate and persist derived costs for a product.
 * Returns null totalCost if any required value is missing.
 */
export async function recalcProductCosts(
  productId: number
): Promise<{ totalCost: number | null }> {
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
      `,
      [productId]
    );

    if (rows.length === 0) {
      await client.query("COMMIT");
      return { totalCost: null };
    }

    let totalCost = 0;
    let hasMissing = false;

    for (const row of rows) {
      const quantityUsed = toNumber(row.quantity_used);
      const purchaseCost = toNumber(row.purchase_cost);
      const yieldPerPurchase = toNumber(row.yield_per_purchase);

      if (
        quantityUsed === null ||
        quantityUsed <= 0 ||
        purchaseCost === null ||
        purchaseCost < 0 ||
        yieldPerPurchase === null ||
        yieldPerPurchase <= 0
      ) {
        hasMissing = true;
        await client.query(
          `
          UPDATE product_ingredient
          SET unit_cost_derived = NULL,
              line_cost_derived = NULL
          WHERE id = $1
          `,
          [row.product_ingredient_id]
        );
        continue;
      }

      const unitCost = purchaseCost / yieldPerPurchase;
      const lineCost = unitCost * quantityUsed;
      totalCost += lineCost;

      await client.query(
        `
        UPDATE product_ingredient
        SET unit_cost_derived = $1,
            line_cost_derived = $2
        WHERE id = $3
        `,
        [unitCost, lineCost, row.product_ingredient_id]
      );
    }

    await client.query("COMMIT");

    if (hasMissing) {
      return { totalCost: null };
    }

    return { totalCost };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductCost(productId: number): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT
      COUNT(pi.id) AS line_count,
      SUM(
        CASE
          WHEN i.purchase_cost IS NULL
            OR i.yield_per_purchase IS NULL
            OR pi.quantity_used IS NULL
            OR pi.line_cost_derived IS NULL
          THEN 1
          ELSE 0
        END
      ) AS missing_count,
      SUM(pi.line_cost_derived) AS total_cost
    FROM product_ingredient pi
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ${productId}
  `);

  const rows = (result.rows || result) as Array<Record<string, any>>;
  const row = rows[0];
  if (!row) return null;

  const lineCount = Number(row.line_count || 0);
  const missingCount = Number(row.missing_count || 0);
  if (lineCount === 0 || missingCount > 0) {
    return null;
  }

  return row.total_cost === null ? null : Number(row.total_cost);
}

export async function getProductCostDetails(productId: number): Promise<ProductCostResult> {
  const result = await db.execute(sql`
    SELECT
      pi.id,
      pi.ingredient_id,
      pi.quantity_used,
      pi.prep_note,
      CASE
        WHEN i.purchase_cost IS NULL OR i.yield_per_purchase IS NULL
        THEN NULL
        ELSE pi.unit_cost_derived
      END AS unit_cost_derived,
      CASE
        WHEN i.purchase_cost IS NULL OR i.yield_per_purchase IS NULL
        THEN NULL
        ELSE pi.line_cost_derived
      END AS line_cost_derived,
      i.name AS ingredient_name,
      i.yield_unit
    FROM product_ingredient pi
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ${productId}
    ORDER BY pi.id
  `);

  const rows = (result.rows || result) as Array<Record<string, any>>;
  const lines: ProductCostLine[] = rows.map((row) => ({
    id: Number(row.id),
    ingredientId: Number(row.ingredient_id),
    ingredientName: row.ingredient_name ?? null,
    quantityUsed: Number(row.quantity_used),
    unitCostDerived: row.unit_cost_derived === null ? null : Number(row.unit_cost_derived),
    lineCostDerived: row.line_cost_derived === null ? null : Number(row.line_cost_derived),
    yieldUnit: row.yield_unit ?? null,
    prepNote: row.prep_note ?? null,
  }));

  const totalCost = lines.length === 0
    ? null
    : lines.some((line) => line.lineCostDerived === null)
      ? null
      : lines.reduce((sum, line) => sum + Number(line.lineCostDerived || 0), 0);

  return {
    productId,
    lines,
    totalCost,
  };
}
