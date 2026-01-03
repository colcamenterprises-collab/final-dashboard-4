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
  portion_qty: number;
  unit_cost: number;
  purchase_unit_qty: number;
  cost_per_unit: number;
  line_cost: number;
}

export interface RecipeCostFlag {
  recipe_id: number;
  recipe_name: string;
  ingredient_name: string;
  portion_qty: number;
  unit_cost: number;
  purchase_unit_qty: number | null;
  issue: string;
}

export async function getAllRecipeCosts(): Promise<RecipeCost[]> {
  const result = await db.execute(sql`
    SELECT * FROM v_recipe_cost
    ORDER BY food_cost DESC
  `);
  return result.rows as RecipeCost[];
}

export async function getRecipeCostBreakdown(recipeId: number): Promise<RecipeCostLine[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM v_recipe_cost_lines
    WHERE recipe_id = ${recipeId}
    ORDER BY line_cost DESC
  `);
  return result.rows as RecipeCostLine[];
}

export async function getRecipeCostFlags(): Promise<RecipeCostFlag[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM v_recipe_cost_flags
    ORDER BY recipe_name
  `);
  return result.rows as RecipeCostFlag[];
}

export async function getRecipeCostById(recipeId: number): Promise<RecipeCost | null> {
  const result = await db.execute(sql`
    SELECT * FROM v_recipe_cost
    WHERE recipe_id = ${recipeId}
  `);
  return (result.rows[0] as RecipeCost) || null;
}
