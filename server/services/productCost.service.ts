/**
 * PATCH P1: PRODUCT COST SERVICE
 * 
 * Calculates product cost from canonical ingredients
 * Cost = SUM(unit_cost_per_base × portion_qty)
 */

import { db, pool } from "../db";
import { sql } from "drizzle-orm";

export interface ProductCostLine {
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  portionQty: number;
  unitCostPerBase: number;
  lineCost: number;
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
        i.purchase_cost,
        i.yield_per_purchase
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
      const yieldPerPurchase = Number(row.yield_per_purchase);
      if (!Number.isFinite(yieldPerPurchase) || yieldPerPurchase <= 0) {
        throw new Error("Ingredient yield is not defined");
      }

      const purchaseCost = Number(row.purchase_cost);
      if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
        throw new Error("Ingredient purchase cost is not defined");
      }

      const unitCost = purchaseCost / yieldPerPurchase;
      const lineCost = unitCost * Number(row.quantity_used);

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
  const productResult = await db.execute(sql`
    SELECT 
      p.recipe_id as "recipeId"
    FROM product p
    WHERE p.id = ${productId}
  `);

  const productRows = (productResult.rows || productResult) as Array<{ recipeId: number | null }>;
  const recipeId = productRows[0]?.recipeId;

  if (recipeId) {
    const recipeResult = await db.execute(sql`
      SELECT 
        r.yield_units,
        ri.portion_qty,
        i.unit_cost_per_base
      FROM recipe r
      INNER JOIN recipe_ingredient ri ON r.id = ri.recipe_id
      INNER JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE r.id = ${recipeId}
    `);

    const recipeRows = (recipeResult.rows || recipeResult) as any[];
    let perPortionTotal = 0;
    for (const row of recipeRows) {
      const qty = Number(row.portion_qty || 0);
      const unitCost = Number(row.unit_cost_per_base || 0);
      perPortionTotal += qty * unitCost;
    }
    const serves = Number(recipeRows[0]?.yield_units || 0);
    if (!Number.isFinite(serves) || serves <= 0) {
      return null;
    }
    return Number((perPortionTotal * serves).toFixed(2));
  }

  const ingredientResult = await db.execute(sql`
    SELECT 
      pi.portion_qty,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const ingredientRows = (ingredientResult.rows || ingredientResult) as any[];
  let total = 0;
  for (const row of ingredientRows) {
    const qty = Number(row.portion_qty || 0);
    const unitCost = Number(row.unit_cost_per_base || 0);
    total += qty * unitCost;
  }

  return Number(total.toFixed(2));
}

export async function getProductCostDetails(productId: number): Promise<ProductCostResult> {
  const productResult = await db.execute(sql`
    SELECT 
      p.recipe_id as "recipeId"
    FROM product p
    WHERE p.id = ${productId}
  `);

  const productRows = (productResult.rows || productResult) as Array<{ recipeId: number | null }>;
  const recipeId = productRows[0]?.recipeId;

  if (recipeId) {
    const recipeResult = await db.execute(sql`
      SELECT 
        r.yield_units,
        ri.ingredient_id,
        i.name as ingredient_name,
        i.base_unit,
        ri.portion_qty,
        i.unit_cost_per_base
      FROM recipe r
      INNER JOIN recipe_ingredient ri ON r.id = ri.recipe_id
      INNER JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE r.id = ${recipeId}
    `);

    const recipeRows = (recipeResult.rows || recipeResult) as any[];
    const ingredients: ProductCostLine[] = [];
    let perPortionTotal = 0;

    for (const row of recipeRows) {
      const qty = Number(row.portion_qty || 0);
      const unitCost = Number(row.unit_cost_per_base || 0);
      const lineCost = qty * unitCost;
      perPortionTotal += lineCost;

      ingredients.push({
        ingredientId: Number(row.ingredient_id),
        ingredientName: row.ingredient_name || 'Unknown',
        baseUnit: row.base_unit || 'UNMAPPED',
        portionQty: qty,
        unitCostPerBase: unitCost,
        lineCost: Number(lineCost.toFixed(4)),
      });
    }
    const serves = Number(recipeRows[0]?.yield_units || 0);
    const totalCost = Number.isFinite(serves) && serves > 0 ? Number((perPortionTotal * serves).toFixed(2)) : null;

    return {
      productId,
      ingredients,
      totalCost,
    };
  }

  const ingredientResult = await db.execute(sql`
    SELECT 
      pi.ingredient_id,
      i.name as ingredient_name,
      i.base_unit,
      pi.portion_qty,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const ingredientRows = (ingredientResult.rows || ingredientResult) as any[];
  const ingredients: ProductCostLine[] = [];
  let total = 0;

  for (const row of ingredientRows) {
    const qty = Number(row.portion_qty || 0);
    const unitCost = Number(row.unit_cost_per_base || 0);
    const lineCost = qty * unitCost;
    total += lineCost;

    ingredients.push({
      ingredientId: Number(row.ingredient_id),
      ingredientName: row.ingredient_name || 'Unknown',
      baseUnit: row.base_unit || 'UNMAPPED',
      portionQty: qty,
      unitCostPerBase: unitCost,
      lineCost: Number(lineCost.toFixed(4)),
    });
  }

  return {
    productId,
    ingredients,
    totalCost: Number(total.toFixed(2)),
  };
}
