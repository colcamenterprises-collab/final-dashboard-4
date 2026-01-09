/**
 * PATCH P1: PRODUCT COST SERVICE
 * 
 * Calculates product cost from canonical ingredients
 * Cost = SUM(unit_cost_per_base × portion_qty)
 */

import { db } from "../db";
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
  totalCost: number;
}

export async function getProductCost(productId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT 
      pi.portion_qty,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const rows = result.rows || result;
  let total = 0;

  for (const row of rows as any[]) {
    const qty = Number(row.portion_qty || 0);
    const unitCost = Number(row.unit_cost_per_base || 0);
    total += qty * unitCost;
  }

  return Number(total.toFixed(2));
}

export async function getProductCostDetails(productId: number): Promise<ProductCostResult> {
  const result = await db.execute(sql`
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

  const rows = result.rows || result;
  const ingredients: ProductCostLine[] = [];
  let total = 0;

  for (const row of rows as any[]) {
    const qty = Number(row.portion_qty || 0);
    const unitCost = Number(row.unit_cost_per_base || 0);
    const lineCost = qty * unitCost;
    total += lineCost;

    ingredients.push({
      ingredientId: Number(row.ingredient_id),
      ingredientName: row.ingredient_name || 'Unknown',
      baseUnit: row.base_unit || 'each',
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
