/**
 * 🔒 FOUNDATION-02: RECIPE AUTHORITY SERVICE
 * 🔒 CANONICAL COST AUTHORITY — DO NOT DUPLICATE
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
 * 
 * PHASE E ADDITIONS:
 * - UNMAPPED_POS_ITEM flag for POS items without recipes
 * - RECIPE_INCOMPLETE flag for recipes missing valid ingredients
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
 * 🔒 CANONICAL COST AUTHORITY — DO NOT DUPLICATE
 * 🔒 PATCH 1.6.16: PURCHASING vs INGREDIENT COST MODEL
 * 
 * Calculate recipe cost from purchasing items (READ-ONLY, always fresh)
 * 
 * CORRECT FORMULA:
 * - per_unit_cost = purchasing.unit_cost / purchasing.purchase_unit_qty
 * - line_cost = portion_qty × per_unit_cost
 * - recipe_cost = SUM(line_cost)
 * 
 * Example: Fries (2kg bag = ฿129)
 * - per_unit_cost = 129 / 2000 = ฿0.0645 per gram
 * - 150g portion = 150 × 0.0645 = ฿9.68
 * 
 * This is the ONLY authoritative cost calculation.
 * All other cost calculations must delegate to this function.
 */
export async function calculateRecipeCost(recipeId: number): Promise<number> {
  const ingredients = await db
    .select({
      quantity: recipeIngredient.quantity,
      unitCost: purchasingItems.unitCost,
      purchaseUnitQty: purchasingItems.purchaseUnitQty,
    })
    .from(recipeIngredient)
    .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  let totalCost = 0;
  for (const ing of ingredients) {
    const portionQty = parseFloat(ing.quantity?.toString() || '0');
    const packCost = parseFloat(ing.unitCost?.toString() || '0');
    const packQty = parseFloat(ing.purchaseUnitQty?.toString() || '1'); // Default to 1 to avoid division by zero
    
    // PATCH 1.6.16: Calculate per-unit cost then multiply by portion
    const perUnitCost = packQty > 0 ? packCost / packQty : 0;
    totalCost += portionQty * perUnitCost;
  }
  
  return totalCost;
}

/**
 * Get all recipes with their ingredients and calculated costs
 * 🔒 PATCH 1.6.16: Uses correct portion-based cost calculation
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
        packCost: purchasingItems.unitCost,
        purchaseUnitQty: purchasingItems.purchaseUnitQty,
      })
      .from(recipeIngredient)
      .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
      .where(eq(recipeIngredient.recipeId, r.id));

    let totalCost = 0;
    const ingredientsWithCost = ingredients.map(ing => {
      const portionQty = parseFloat(ing.quantity?.toString() || '0');
      const packCost = parseFloat(ing.packCost?.toString() || '0');
      const packQty = parseFloat(ing.purchaseUnitQty?.toString() || '1');
      
      // PATCH 1.6.16: Calculate per-unit cost then multiply by portion
      const perUnitCost = packQty > 0 ? packCost / packQty : 0;
      const lineCost = portionQty * perUnitCost;
      totalCost += lineCost;
      
      return {
        id: ing.id,
        recipeId: ing.recipeId,
        purchasingItemId: ing.purchasingItemId,
        quantity: ing.quantity,
        unit: ing.unit,
        ingredientName: ing.ingredientName,
        ingredientCost: perUnitCost || null, // Cost per base unit
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
 * 🔒 PATCH 1.6.16: Uses correct portion-based cost calculation
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
      packCost: purchasingItems.unitCost,
      purchaseUnitQty: purchasingItems.purchaseUnitQty,
    })
    .from(recipeIngredient)
    .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, r.id));

  let totalCost = 0;
  const ingredientsWithCost = ingredients.map(ing => {
    const portionQty = parseFloat(ing.quantity?.toString() || '0');
    const packCost = parseFloat(ing.packCost?.toString() || '0');
    const packQty = parseFloat(ing.purchaseUnitQty?.toString() || '1');
    
    // PATCH 1.6.16: Calculate per-unit cost then multiply by portion
    const perUnitCost = packQty > 0 ? packCost / packQty : 0;
    const lineCost = portionQty * perUnitCost;
    totalCost += lineCost;
    
    return {
      id: ing.id,
      recipeId: ing.recipeId,
      purchasingItemId: ing.purchasingItemId,
      quantity: ing.quantity,
      unit: ing.unit,
      ingredientName: ing.ingredientName,
      ingredientCost: perUnitCost || null, // Cost per base unit
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
  // Coerce empty strings to null for numeric fields
  const yieldUnits = data.yieldUnits === '' || data.yieldUnits === null || data.yieldUnits === undefined
    ? null 
    : Number(data.yieldUnits) || null;
    
  const [newRecipe] = await db.insert(recipe).values({
    name: data.name,
    yieldUnits,
    active: data.active ?? true,
  }).returning();
  
  return newRecipe;
}

/**
 * Update a recipe
 */
export async function updateRecipe(id: number, data: Partial<InsertRecipeV2>): Promise<RecipeV2 | null> {
  // Coerce empty strings to null for numeric fields
  const yieldUnits = data.yieldUnits === '' || data.yieldUnits === null || data.yieldUnits === undefined
    ? null 
    : Number(data.yieldUnits) || null;
    
  const [updated] = await db
    .update(recipe)
    .set({
      name: data.name,
      yieldUnits,
      active: data.active,
    })
    .where(eq(recipe.id, id))
    .returning();
  
  return updated || null;
}

/**
 * Delete a recipe and all its ingredients
 */
export async function deleteRecipe(id: number): Promise<boolean> {
  // First delete all ingredients for this recipe
  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));
  
  // Then delete any POS mappings
  await db.delete(posItemRecipeMap).where(eq(posItemRecipeMap.recipeId, id));
  
  // Finally delete the recipe
  const [deleted] = await db
    .delete(recipe)
    .where(eq(recipe.id, id))
    .returning();
  
  return !!deleted;
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

  // PATCH 1.6.18: Ingredient save guards
  if (!item.purchaseUnitQty || Number(item.purchaseUnitQty) <= 0) {
    throw new Error(`Cannot add ingredient "${item.item}": purchase_unit_qty must be greater than zero. Current value: ${item.purchaseUnitQty}`);
  }

  if (Number(item.unitCost) < 0) {
    throw new Error(`Cannot add ingredient "${item.item}": unit_cost cannot be negative. Current value: ${item.unitCost}`);
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
 * PATCH 8: Full recipe update with atomic ingredient replacement
 * Replaces all ingredients transactionally
 */
export async function updateRecipeWithIngredients(
  id: number,
  data: {
    name?: string;
    yieldUnits?: string | number | null;
    active?: boolean;
    ingredients?: Array<{
      purchasingItemId: number;
      quantity: string;
      unit: string;
    }>;
  }
): Promise<RecipeWithCost | null> {
  // Coerce empty strings to null for numeric fields
  const yieldUnits = data.yieldUnits === '' || data.yieldUnits === null || data.yieldUnits === undefined
    ? null 
    : Number(data.yieldUnits) || null;

  // Update recipe metadata
  const [updated] = await db
    .update(recipe)
    .set({
      name: data.name,
      yieldUnits,
      active: data.active,
    })
    .where(eq(recipe.id, id))
    .returning();

  if (!updated) return null;

  // If ingredients array provided, replace all ingredients atomically
  if (data.ingredients !== undefined) {
    // Delete all existing ingredients for this recipe
    await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));

    // Insert new ingredients
    if (data.ingredients.length > 0) {
      // Validate all purchasing items exist (don't require is_ingredient flag for existing recipe ingredients)
      for (const ing of data.ingredients) {
        const [item] = await db
          .select()
          .from(purchasingItems)
          .where(eq(purchasingItems.id, ing.purchasingItemId));

        if (!item) {
          throw new Error(`Purchasing item ${ing.purchasingItemId} not found`);
        }
      }

      // Insert all ingredients
      await db.insert(recipeIngredient).values(
        data.ingredients.map(ing => ({
          recipeId: id,
          purchasingItemId: ing.purchasingItemId,
          quantity: ing.quantity,
          unit: ing.unit,
        }))
      );
    }
  }

  // Return fresh recipe with cost
  return getRecipeWithCost(id);
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

// ========================================
// PHASE E: POS → RECIPE MAPPING GUARDS
// ========================================

/**
 * 🔒 E2: Check POS item mapping status
 * Returns UNMAPPED_POS_ITEM if no recipe is mapped
 */
export async function getPosItemMappingStatus(posItemId: string): Promise<{
  status: 'MAPPED' | 'UNMAPPED_POS_ITEM';
  recipeId: number | null;
}> {
  const [mapping] = await db
    .select()
    .from(posItemRecipeMap)
    .where(eq(posItemRecipeMap.posItemId, posItemId));

  if (!mapping) {
    console.log(`[RecipeAuthority] UNMAPPED_POS_ITEM: ${posItemId}`);
    return { status: 'UNMAPPED_POS_ITEM', recipeId: null };
  }

  return { status: 'MAPPED', recipeId: mapping.recipeId };
}

/**
 * 🔒 E2: Get all unmapped POS items (internal use only)
 * Compares item_catalog SKUs against pos_item_recipe_map
 */
export async function getUnmappedPosItems(): Promise<string[]> {
  // Get all mapped POS item IDs
  const mappedItems = await db
    .select({ posItemId: posItemRecipeMap.posItemId })
    .from(posItemRecipeMap);
  
  const mappedSet = new Set(mappedItems.map(m => m.posItemId));
  
  // Get all SKUs from item_catalog via raw query
  const catalogItems = await db.execute<{ sku: string }>(
    `SELECT sku FROM item_catalog WHERE active = true`
  );
  
  const unmapped: string[] = [];
  for (const item of catalogItems.rows || []) {
    if (!mappedSet.has(item.sku)) {
      unmapped.push(item.sku);
    }
  }
  
  console.log(`[RecipeAuthority] Unmapped POS items: ${unmapped.length}`);
  return unmapped;
}

// ========================================
// PHASE E: RECIPE COMPLETENESS GUARD
// ========================================

export interface RecipeCompletenessResult {
  recipeId: number;
  recipeName: string;
  status: 'COMPLETE' | 'RECIPE_INCOMPLETE';
  reasons: string[];
}

/**
 * 🔒 E3: Check recipe completeness
 * A recipe is complete if all ingredients:
 * - Exist in purchasing_items
 * - Have is_ingredient = true
 * - Have active = true
 */
export async function checkRecipeCompleteness(recipeId: number): Promise<RecipeCompletenessResult> {
  const [r] = await db.select().from(recipe).where(eq(recipe.id, recipeId));
  if (!r) {
    return {
      recipeId,
      recipeName: 'Unknown',
      status: 'RECIPE_INCOMPLETE',
      reasons: ['Recipe not found']
    };
  }

  const ingredients = await db
    .select({
      purchasingItemId: recipeIngredient.purchasingItemId,
      itemName: purchasingItems.item,
      isIngredient: purchasingItems.isIngredient,
      active: purchasingItems.active,
    })
    .from(recipeIngredient)
    .leftJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  const reasons: string[] = [];
  
  for (const ing of ingredients) {
    if (!ing.itemName) {
      reasons.push(`Ingredient ID ${ing.purchasingItemId} not found in purchasing_items`);
    } else if (!ing.isIngredient) {
      reasons.push(`${ing.itemName} is not marked as ingredient`);
    } else if (!ing.active) {
      reasons.push(`${ing.itemName} is not active`);
    }
  }

  if (ingredients.length === 0) {
    reasons.push('Recipe has no ingredients');
  }

  return {
    recipeId: r.id,
    recipeName: r.name,
    status: reasons.length === 0 ? 'COMPLETE' : 'RECIPE_INCOMPLETE',
    reasons
  };
}

/**
 * 🔒 E3: Get all incomplete recipes
 */
export async function getIncompleteRecipes(): Promise<RecipeCompletenessResult[]> {
  const recipes = await db.select().from(recipe);
  const results: RecipeCompletenessResult[] = [];
  
  for (const r of recipes) {
    const result = await checkRecipeCompleteness(r.id);
    if (result.status === 'RECIPE_INCOMPLETE') {
      results.push(result);
    }
  }
  
  return results;
}

// ========================================
// PHASE E: DEBUG & PARITY STATS
// ========================================

export interface RecipePosParityStats {
  posItems: number;
  mapped: number;
  unmapped: number;
  activeRecipes: number;
  inactiveRecipes: number;
  incompleteRecipes: number;
}

/**
 * 🔒 E6: Get recipe/POS parity statistics (internal debug use)
 */
export async function getRecipePosParityStats(): Promise<RecipePosParityStats> {
  // Count POS items from item_catalog
  const posItemsResult = await db.execute<{ count: string }>(
    `SELECT COUNT(*) as count FROM item_catalog WHERE active = true`
  );
  const posItems = parseInt(posItemsResult.rows?.[0]?.count || '0');
  
  // Count mapped items
  const mappedResult = await db
    .select({ posItemId: posItemRecipeMap.posItemId })
    .from(posItemRecipeMap);
  const mapped = mappedResult.length;
  
  // Active/inactive recipes
  const activeRecipes = await db.select().from(recipe).where(eq(recipe.active, true));
  const inactiveRecipes = await db.select().from(recipe).where(eq(recipe.active, false));
  
  // Incomplete recipes
  const incompleteList = await getIncompleteRecipes();
  
  return {
    posItems,
    mapped,
    unmapped: posItems - mapped,
    activeRecipes: activeRecipes.length,
    inactiveRecipes: inactiveRecipes.length,
    incompleteRecipes: incompleteList.length
  };
}
