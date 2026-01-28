/**
 * 🔒 PATCH R1.1: CANONICAL RECIPE COST SERVICE
 * 
 * RULES:
 * - Recipes use canonical ingredients ONLY
 * - Cost = unit_cost_per_base × portion_qty
 * - NO purchasing table queries
 * - NO runtime unit conversions
 * - DETERMINISTIC and AUDITABLE
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface RecipeCost {
  recipe_id: number;
  recipe_name: string;
  food_cost: number;
}

export interface RecipeCostLine {
  recipe_id: number;
  recipe_name: string;
  ingredient_id: number;
  ingredient_name: string;
  base_unit: string;
  portion_qty: number;
  unit_cost_per_base: number;
  line_cost: number;
}

export interface IngredientLineCost {
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  portionQty: number;
  unitCostPerBase: number;
  lineCost: number;
}

export interface RecipeCostResult {
  recipeId: number;
  recipeName: string;
  ingredients: IngredientLineCost[];
  totalCost: number;
}

/**
 * Calculate recipe cost using CANONICAL INGREDIENTS ONLY
 * Formula: SUM(unit_cost_per_base × portion_qty)
 * 
 * This is the ONLY authoritative cost calculation for recipes.
 * 
 * 🔒 NO ZERO DEFAULTS - Throws on missing cost data
 */
export async function calculateRecipeCostCanonical(recipeId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT 
      ri.portion_qty,
      i.unit_cost_per_base,
      i.name as ingredient_name,
      i.base_unit
    FROM recipe_ingredient ri
    INNER JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ${recipeId}
      AND ri.ingredient_id IS NOT NULL
  `);

  const rows = result.rows || result;
  let total = 0;

  for (const row of rows as any[]) {
    const ingredientName = row.ingredient_name || 'Unknown';
    const baseUnit = row.base_unit;
    const qty = Number(row.portion_qty);
    const unitCost = Number(row.unit_cost_per_base);

    // 🔒 NO ZERO DEFAULTS - Fail loudly on missing data
    if (!baseUnit) {
      throw new Error(`Ingredient "${ingredientName}" has no base_unit defined`);
    }
    if (unitCost === null || unitCost === undefined || isNaN(unitCost) || unitCost <= 0) {
      throw new Error(`Ingredient "${ingredientName}" has no valid cost_per_base_unit (got: ${row.unit_cost_per_base})`);
    }
    if (qty === null || qty === undefined || isNaN(qty) || qty <= 0) {
      throw new Error(`Ingredient "${ingredientName}" has no valid portion_qty (got: ${row.portion_qty})`);
    }

    const lineCost = qty * unitCost;

    if (!Number.isFinite(lineCost) || lineCost < 0) {
      throw new Error(`Invalid cost calculation for ingredient "${ingredientName}" in recipe ${recipeId}`);
    }

    total += lineCost;
  }

  return Number(total.toFixed(2));
}

/**
 * Get recipe with full ingredient breakdown using canonical data
 */
export async function getRecipeCostBreakdown(recipeId: number): Promise<RecipeCostResult | null> {
  const recipeResult = await db.execute(sql`
    SELECT id, name FROM recipe WHERE id = ${recipeId}
  `);
  const recipes = recipeResult.rows || recipeResult;
  if (!recipes || recipes.length === 0) return null;

  const recipeRow = recipes[0] as any;

  const ingredientResult = await db.execute(sql`
    SELECT 
      ri.ingredient_id,
      ri.portion_qty,
      i.name as ingredient_name,
      i.base_unit,
      i.unit_cost_per_base
    FROM recipe_ingredient ri
    INNER JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ${recipeId}
      AND ri.ingredient_id IS NOT NULL
  `);

  const ingredientRows = ingredientResult.rows || ingredientResult;
  const ingredients: IngredientLineCost[] = [];
  let totalCost = 0;

  for (const row of ingredientRows as any[]) {
    const qty = Number(row.portion_qty || 0);
    const unitCost = Number(row.unit_cost_per_base || 0);
    const lineCost = qty * unitCost;
    totalCost += lineCost;

    ingredients.push({
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name,
      baseUnit: row.base_unit,
      portionQty: qty,
      unitCostPerBase: unitCost,
      lineCost: Number(lineCost.toFixed(2)),
    });
  }

  return {
    recipeId: recipeRow.id,
    recipeName: recipeRow.name,
    ingredients,
    totalCost: Number(totalCost.toFixed(2)),
  };
}

/**
 * Get all recipes with canonical cost calculation
 */
export async function getAllRecipesCostCanonical(): Promise<RecipeCostResult[]> {
  const recipeResult = await db.execute(sql`
    SELECT id, name FROM recipe WHERE active = true ORDER BY name
  `);
  const recipes = recipeResult.rows || recipeResult;
  
  const results: RecipeCostResult[] = [];
  
  for (const r of recipes as any[]) {
    const breakdown = await getRecipeCostBreakdown(r.id);
    if (breakdown) {
      results.push(breakdown);
    }
  }
  
  return results;
}

/**
 * Legacy function - returns cost summary in old format
 */
export async function getAllRecipeCosts(): Promise<RecipeCost[]> {
  const recipes = await getAllRecipesCostCanonical();
  return recipes.map(r => ({
    recipe_id: r.recipeId,
    recipe_name: r.recipeName,
    food_cost: r.totalCost,
  }));
}

/**
 * Legacy function - get cost for single recipe
 */
export async function getRecipeCostById(recipeId: number): Promise<RecipeCost | null> {
  const breakdown = await getRecipeCostBreakdown(recipeId);
  if (!breakdown) return null;
  return {
    recipe_id: breakdown.recipeId,
    recipe_name: breakdown.recipeName,
    food_cost: breakdown.totalCost,
  };
}
