/**
 * PATCH P1: PRODUCT COST SERVICE
 * 
 * Calculates product cost from canonical ingredients
 * Cost = SUM(unit_cost_per_base × quantity_used)
 */

import { db, pool } from "../db";
import { sql } from "drizzle-orm";

export interface ProductCostLine {
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  portionQty: number | null;
  unitCostPerBase: number | null;
  lineCost: number | null;
}

export interface ProductCostResult {
  productId: number;
  ingredients: ProductCostLine[];
  totalCost: number | null;
}

/**
 * Recalculate and persist derived costs for a product.
 * This is the ONLY place cost math is allowed.
 */
export async function recalcProductCosts(productId: number): Promise<{ totalCost: number }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      SELECT
        pi.id AS product_ingredient_id,
        pi.quantity_used,
        i.unit_cost_per_base
      FROM product_ingredient pi
      JOIN ingredients i ON i.id = pi.ingredient_id
      WHERE pi.product_id = $1
        AND i.active = TRUE
      `,
      [productId],
    );

    if (rows.length === 0) {
      await client.query("COMMIT");
      return { totalCost: 0 };
    }

    let totalCost = 0;

    for (const row of rows) {
      const quantityUsed = Number(row.quantity_used);
      if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
        throw new Error("Ingredient quantity is not defined");
      }

      const unitCost = Number(row.unit_cost_per_base);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error("Ingredient unit cost is not defined");
      }

      const lineCost = unitCost * quantityUsed;

      totalCost += lineCost;

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
    return { totalCost };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductCost(productId: number): Promise<number | null> {
  const ingredientResult = await db.execute(sql`
    SELECT 
      pi.quantity_used,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const ingredientRows = (ingredientResult.rows || ingredientResult) as any[];
  if (ingredientRows.length === 0) {
    return null;
  }

  let total = 0;
  for (const row of ingredientRows) {
    const qty = Number(row.quantity_used);
    const unitCost = Number(row.unit_cost_per_base);
    if (!Number.isFinite(qty) || qty <= 0) {
      return null;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return null;
    }
    total += qty * unitCost;
  }

  return Number(total.toFixed(2));
}

export async function getProductCostDetails(productId: number): Promise<ProductCostResult> {
  const ingredientResult = await db.execute(sql`
    SELECT 
      pi.ingredient_id,
      i.name as ingredient_name,
      i.base_unit,
      pi.quantity_used,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const ingredientRows = (ingredientResult.rows || ingredientResult) as any[];
  const ingredients: ProductCostLine[] = [];
  let total = 0;
  let totalCostValid = true;

  for (const row of ingredientRows) {
    const qty = Number(row.quantity_used);
    const unitCost = Number(row.unit_cost_per_base);
    const qtyValid = Number.isFinite(qty) && qty > 0;
    const unitCostValid = Number.isFinite(unitCost) && unitCost >= 0;
    const lineCost = qtyValid && unitCostValid ? qty * unitCost : null;
    if (lineCost === null) {
      totalCostValid = false;
    } else {
      total += lineCost;
    }

    ingredients.push({
      ingredientId: Number(row.ingredient_id),
      ingredientName: row.ingredient_name || 'Unknown',
      baseUnit: row.base_unit || 'UNMAPPED',
      portionQty: qtyValid ? qty : null,
      unitCostPerBase: unitCostValid ? unitCost : null,
      lineCost: lineCost === null ? null : Number(lineCost.toFixed(4)),
    });
  }

  return {
    productId,
    ingredients,
    totalCost: totalCostValid && ingredientRows.length > 0 ? Number(total.toFixed(2)) : null,
  };
}
