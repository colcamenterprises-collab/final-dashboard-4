/**
 * 🔒 INGREDIENT CASCADE ENGINE
 * ---------------------------
 * SoldItem → Recipe → Ingredient → Prep Explosion
 * 
 * This service handles the expansion of sold POS items into their
 * constituent ingredients for COGS calculation and inventory tracking.
 * 
 * RULES:
 * - These tables are DERIVED — read-only from UI
 * - Only this engine may write to sold_item_recipe and sold_item_ingredient
 */

import { db } from '../db';
import { 
  recipe, 
  recipeIngredient, 
  purchasingItems,
  soldItemRecipe, 
  soldItemIngredient 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { resolveRecipeName } from './recipeResolver';

type SoldItem = {
  id: string;
  name: string;
  shiftId: string;
  quantity?: number;
};

/**
 * Explodes a sold item into its recipe and ingredients.
 * If the item has a mapped recipe, it creates entries in:
 * - sold_item_recipe (links sold item to recipe)
 * - sold_item_ingredient (atomic ingredient usage)
 */
export async function explodeSoldItem(soldItem: SoldItem): Promise<void> {
  const recipeName = resolveRecipeName(soldItem.name);
  if (!recipeName) {
    console.log(`[IngredientCascade] No recipe mapping for: ${soldItem.name}`);
    return;
  }

  const [foundRecipe] = await db
    .select()
    .from(recipe)
    .where(eq(recipe.name, recipeName));

  if (!foundRecipe) {
    console.log(`[IngredientCascade] Recipe not found: ${recipeName}`);
    return;
  }

  const qty = soldItem.quantity || 1;

  await db.insert(soldItemRecipe).values({
    soldItemId: soldItem.id,
    recipeId: foundRecipe.id,
    quantity: qty,
  });

  const ingredients = await db
    .select({
      id: recipeIngredient.id,
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
      purchasingItemId: recipeIngredient.purchasingItemId,
      itemName: purchasingItems.item,
    })
    .from(recipeIngredient)
    .leftJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, foundRecipe.id));

  for (const ing of ingredients) {
    const ingredientName = ing.itemName || `Item #${ing.purchasingItemId}`;
    const ingredientQty = parseFloat(ing.quantity) * qty;

    await explodeIngredient(
      soldItem.id,
      soldItem.shiftId,
      ingredientName,
      ingredientQty,
      ing.unit,
      ing.purchasingItemId
    );
  }
}

/**
 * Explodes an ingredient, checking if it's a PREP recipe that needs further expansion.
 * If the ingredient is a base ingredient, it's written directly to sold_item_ingredient.
 * If the ingredient is a PREP recipe, its sub-ingredients are recursively exploded.
 */
async function explodeIngredient(
  soldItemId: string,
  shiftId: string,
  ingredientName: string,
  qty: number,
  unit: string,
  purchasingItemId: number
): Promise<void> {
  const [prepRecipe] = await db
    .select()
    .from(recipe)
    .where(eq(recipe.name, ingredientName));

  if (!prepRecipe) {
    await db.insert(soldItemIngredient).values({
      soldItemId,
      shiftId,
      ingredient: ingredientName,
      quantity: qty.toString(),
      unit,
    });
    return;
  }

  const subIngredients = await db
    .select({
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
      purchasingItemId: recipeIngredient.purchasingItemId,
      itemName: purchasingItems.item,
    })
    .from(recipeIngredient)
    .leftJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id))
    .where(eq(recipeIngredient.recipeId, prepRecipe.id));

  if (subIngredients.length === 0) {
    await db.insert(soldItemIngredient).values({
      soldItemId,
      shiftId,
      ingredient: ingredientName,
      quantity: qty.toString(),
      unit,
    });
    return;
  }

  for (const sub of subIngredients) {
    const subName = sub.itemName || `Item #${sub.purchasingItemId}`;
    const subQty = parseFloat(sub.quantity) * qty;

    await db.insert(soldItemIngredient).values({
      soldItemId,
      shiftId,
      ingredient: subName,
      quantity: subQty.toString(),
      unit: sub.unit,
    });
  }
}

/**
 * Batch process multiple sold items.
 */
export async function processSoldItems(soldItems: SoldItem[]): Promise<void> {
  for (const item of soldItems) {
    await explodeSoldItem(item);
  }
}
