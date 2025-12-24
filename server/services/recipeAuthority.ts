/**
 * 🔒 FOUNDATION-02: RECIPE AUTHORITY SERVICE
 * 
 * This service provides the canonical recipe layer for:
 * - Recipe CRUD operations
 * - Recipe cost calculation (READ-ONLY, computed fresh)
 * - POS item mapping
 * 
 * RULES:
 * - Recipe cost is ALWAYS computed from purchasing_items.unit_cost
 * - No caching of costs
 * - Ingredients must have is_ingredient = true in purchasing_items
 */

import { db } from '../db';
import { recipe, recipeIngredient, posItemRecipeMap, purchasingItems } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RecipeV2, RecipeIngredientV2, PosItemRecipeMap, InsertRecipeV2, InsertRecipeIngredientV2, InsertPosItemRecipeMap } from '@shared/schema';

export interface RecipeWithCost extends RecipeV2 {
  ingredients: Array<RecipeIngredientV2 & {
    ingredientName: string;
    ingredientCost: number | null;
    lineCost: number | null;
  }>;
  totalCost: number;
}

/**
 * Calculate recipe cost from purchasing items (READ-ONLY, always fresh)
 * 
 * recipe_cost = SUM(recipe_ingredient.quantity × purchasing_items.unit_cost)
 */
export async function calculateRecipeCost(recipeId: number): Promise<number> {
  const ingredients = await db
    .select({
      quantity: recipeIngredient.quantity,
      unitCost: purchasingItems.unitCost,
    })
    .from(recipeIngredient)
    .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  let totalCost = 0;
  for (const ing of ingredients) {
    const qty = parseFloat(ing.quantity?.toString() || '0');
    const cost = parseFloat(ing.unitCost?.toString() || '0');
    totalCost += qty * cost;
  }
  
  return totalCost;
}

/**
 * Get all recipes with their ingredients and calculated costs
 */
export async function getAllRecipesWithCost(): Promise<RecipeWithCost[]> {
  const recipes = await db.select().from(recipe).where(eq(recipe.active, true));
  
  const result: RecipeWithCost[] = [];
  
  for (const r of recipes) {
    const ingredients = await db
      .select({
        id: recipeIngredient.id,
        recipeId: recipeIngredient.recipeId,
        purchasingItemId: recipeIngredient.purchasingItemId,
        quantity: recipeIngredient.quantity,
        unit: recipeIngredient.unit,
        ingredientName: purchasingItems.item,
        ingredientCost: purchasingItems.unitCost,
      })
      .from(recipeIngredient)
      .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
      .where(eq(recipeIngredient.recipeId, r.id));

    let totalCost = 0;
    const ingredientsWithCost = ingredients.map(ing => {
      const qty = parseFloat(ing.quantity?.toString() || '0');
      const cost = parseFloat(ing.ingredientCost?.toString() || '0');
      const lineCost = qty * cost;
      totalCost += lineCost;
      
      return {
        id: ing.id,
        recipeId: ing.recipeId,
        purchasingItemId: ing.purchasingItemId,
        quantity: ing.quantity,
        unit: ing.unit,
        ingredientName: ing.ingredientName,
        ingredientCost: cost || null,
        lineCost: lineCost || null,
      };
    });

    result.push({
      ...r,
      ingredients: ingredientsWithCost,
      totalCost,
    });
  }
  
  return result;
}

/**
 * Get single recipe with cost
 */
export async function getRecipeWithCost(recipeId: number): Promise<RecipeWithCost | null> {
  const [r] = await db.select().from(recipe).where(eq(recipe.id, recipeId));
  if (!r) return null;

  const ingredients = await db
    .select({
      id: recipeIngredient.id,
      recipeId: recipeIngredient.recipeId,
      purchasingItemId: recipeIngredient.purchasingItemId,
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
      ingredientName: purchasingItems.item,
      ingredientCost: purchasingItems.unitCost,
    })
    .from(recipeIngredient)
    .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, r.id));

  let totalCost = 0;
  const ingredientsWithCost = ingredients.map(ing => {
    const qty = parseFloat(ing.quantity?.toString() || '0');
    const cost = parseFloat(ing.ingredientCost?.toString() || '0');
    const lineCost = qty * cost;
    totalCost += lineCost;
    
    return {
      id: ing.id,
      recipeId: ing.recipeId,
      purchasingItemId: ing.purchasingItemId,
      quantity: ing.quantity,
      unit: ing.unit,
      ingredientName: ing.ingredientName,
      ingredientCost: cost || null,
      lineCost: lineCost || null,
    };
  });

  return {
    ...r,
    ingredients: ingredientsWithCost,
    totalCost,
  };
}

/**
 * Create a new recipe
 */
export async function createRecipe(data: InsertRecipeV2): Promise<RecipeV2> {
  const [newRecipe] = await db.insert(recipe).values({
    name: data.name,
    yieldUnits: data.yieldUnits,
    active: data.active ?? true,
  }).returning();
  
  return newRecipe;
}

/**
 * Update a recipe
 */
export async function updateRecipe(id: number, data: Partial<InsertRecipeV2>): Promise<RecipeV2 | null> {
  const [updated] = await db
    .update(recipe)
    .set({
      name: data.name,
      yieldUnits: data.yieldUnits,
      active: data.active,
    })
    .where(eq(recipe.id, id))
    .returning();
  
  return updated || null;
}

/**
 * Add ingredient to recipe (must be a purchasing item with is_ingredient = true)
 */
export async function addIngredientToRecipe(
  recipeId: number, 
  purchasingItemId: number, 
  quantity: string, 
  unit: string
): Promise<RecipeIngredientV2> {
  const [item] = await db
    .select()
    .from(purchasingItems)
    .where(and(
      eq(purchasingItems.id, purchasingItemId),
      eq(purchasingItems.isIngredient, true)
    ));

  if (!item) {
    throw new Error('Purchasing item not found or is not marked as ingredient');
  }

  const [newIngredient] = await db
    .insert(recipeIngredient)
    .values({
      recipeId,
      purchasingItemId,
      quantity,
      unit,
    })
    .returning();
  
  return newIngredient;
}

/**
 * Update recipe ingredient quantity
 */
export async function updateRecipeIngredient(
  ingredientId: number,
  quantity: string,
  unit: string
): Promise<RecipeIngredientV2 | null> {
  const [updated] = await db
    .update(recipeIngredient)
    .set({ quantity, unit })
    .where(eq(recipeIngredient.id, ingredientId))
    .returning();
  
  return updated || null;
}

/**
 * Remove ingredient from recipe
 */
export async function removeIngredientFromRecipe(ingredientId: number): Promise<void> {
  await db.delete(recipeIngredient).where(eq(recipeIngredient.id, ingredientId));
}

/**
 * Map POS item to recipe
 */
export async function mapPosItemToRecipe(posItemId: string, recipeId: number): Promise<PosItemRecipeMap> {
  const [existing] = await db
    .select()
    .from(posItemRecipeMap)
    .where(eq(posItemRecipeMap.posItemId, posItemId));

  if (existing) {
    const [updated] = await db
      .update(posItemRecipeMap)
      .set({ recipeId })
      .where(eq(posItemRecipeMap.posItemId, posItemId))
      .returning();
    return updated;
  }

  const [newMapping] = await db
    .insert(posItemRecipeMap)
    .values({ posItemId, recipeId })
    .returning();
  
  return newMapping;
}

/**
 * Get recipe for POS item
 */
export async function getRecipeForPosItem(posItemId: string): Promise<RecipeWithCost | null> {
  const [mapping] = await db
    .select()
    .from(posItemRecipeMap)
    .where(eq(posItemRecipeMap.posItemId, posItemId));

  if (!mapping) return null;
  
  return getRecipeWithCost(mapping.recipeId);
}

/**
 * Get all POS item mappings
 */
export async function getAllPosItemMappings(): Promise<Array<PosItemRecipeMap & { recipeName: string }>> {
  const mappings = await db
    .select({
      id: posItemRecipeMap.id,
      posItemId: posItemRecipeMap.posItemId,
      recipeId: posItemRecipeMap.recipeId,
      recipeName: recipe.name,
    })
    .from(posItemRecipeMap)
    .innerJoin(recipe, eq(posItemRecipeMap.recipeId, recipe.id));
  
  return mappings;
}

/**
 * Check if a purchasing item is used in any recipe
 * Used for deletion guard
 */
export async function isPurchasingItemUsedInRecipe(purchasingItemId: number): Promise<boolean> {
  const [usage] = await db
    .select({ id: recipeIngredient.id })
    .from(recipeIngredient)
    .where(eq(recipeIngredient.purchasingItemId, purchasingItemId))
    .limit(1);
  
  return !!usage;
}

/**
 * Get recipes using a specific purchasing item
 */
export async function getRecipesUsingPurchasingItem(purchasingItemId: number): Promise<string[]> {
  const results = await db
    .select({ recipeName: recipe.name })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipeIngredient.recipeId, recipe.id))
    .where(eq(recipeIngredient.purchasingItemId, purchasingItemId));
  
  return results.map(r => r.recipeName);
}

/**
 * Get all purchasing items that can be used as ingredients
 * Only items with is_ingredient = true are valid for recipe creation
 */
export async function getAvailableIngredients() {
  const items = await db
    .select({
      id: purchasingItems.id,
      item: purchasingItems.item,
      category: purchasingItems.category,
      unitCost: purchasingItems.unitCost,
      orderUnit: purchasingItems.orderUnit,
      portionUnit: purchasingItems.portionUnit,
      portionSize: purchasingItems.portionSize,
    })
    .from(purchasingItems)
    .where(
      and(
        eq(purchasingItems.isIngredient, true),
        eq(purchasingItems.active, true)
      )
    )
    .orderBy(purchasingItems.category, purchasingItems.item);
  
  return items;
}
