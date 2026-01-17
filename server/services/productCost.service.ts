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
  const productResult = await db.execute(sql`
    SELECT 
      pi.portion_qty,
      i.unit_cost_per_base
    FROM product_ingredient pi
    INNER JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.product_id = ${productId}
  `);

  const productRows = (productResult.rows || productResult) as any[];
  if (productRows.length > 0) {
    let total = 0;
    for (const row of productRows) {
      const qty = Number(row.portion_qty || 0);
      const unitCost = Number(row.unit_cost_per_base || 0);
      total += qty * unitCost;
    }
    return Number(total.toFixed(2));
  }

  const recipeResult = await db.execute(sql`
    SELECT 
      ri.portion_qty,
      i.unit_cost_per_base
    FROM product_recipe pr
    INNER JOIN recipe_ingredient ri ON pr.recipe_id = ri.recipe_id
    INNER JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE pr.product_id = ${productId}
  `);

  const recipeRows = (recipeResult.rows || recipeResult) as any[];
  let total = 0;
  for (const row of recipeRows) {
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

  const rows = (result.rows || result) as any[];
  if (rows.length > 0) {
    const ingredients: ProductCostLine[] = [];
    let total = 0;

    for (const row of rows) {
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

  const recipeResult = await db.execute(sql`
    SELECT 
      ri.ingredient_id,
      i.name as ingredient_name,
      i.base_unit,
      ri.portion_qty,
      i.unit_cost_per_base
    FROM product_recipe pr
    INNER JOIN recipe_ingredient ri ON pr.recipe_id = ri.recipe_id
    INNER JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE pr.product_id = ${productId}
  `);

  const recipeRows = (recipeResult.rows || recipeResult) as any[];
  const ingredients: ProductCostLine[] = [];
  let total = 0;

  for (const row of recipeRows) {
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
