/**
 * 🔒 PATCH R1: INGREDIENT SYNC SERVICE
 * One-way sync from purchasing_items → ingredients
 * 
 * RULES:
 * - Purchasing feeds ingredients ONE-WAY
 * - Ingredients have canonical baseUnit (grams | ml | each)
 * - unitCostPerBase = cost per single baseUnit
 * - NO reverse updates
 */

import { db } from "../db";
import { ingredients, purchasingItems } from "@shared/schema";
import { eq } from "drizzle-orm";

type BaseUnit = 'grams' | 'ml' | 'each';

/**
 * Derive the canonical base unit from purchasing unit
 */
function deriveBaseUnit(purchaseUnit: string | null): BaseUnit {
  if (!purchaseUnit) return 'each';
  const unit = purchaseUnit.toLowerCase().trim();
  
  if (unit === 'kg' || unit === 'grams' || unit === 'g') return 'grams';
  if (unit === 'l' || unit === 'ml' || unit === 'litre' || unit === 'liter') return 'ml';
  return 'each';
}

/**
 * Calculate cost per base unit from purchasing data
 * Formula: unitCost / normalizedQuantity
 * 
 * Examples:
 * - Bacon 1kg @ ฿350 → ฿350 / 1000g = ฿0.35/gram
 * - Cheese Sauce 500g @ ฿79 → ฿79 / 500g = ฿0.158/gram
 */
function calculateUnitCostPerBase(
  unitCost: number,
  purchaseQty: number,
  purchaseUnit: string | null
): number {
  if (!purchaseQty || purchaseQty <= 0) return 0;
  
  const unit = (purchaseUnit || '').toLowerCase().trim();
  
  // Normalize to base units
  let normalizedQty = purchaseQty;
  if (unit === 'kg') {
    normalizedQty = purchaseQty * 1000; // kg → grams
  } else if (unit === 'l' || unit === 'litre' || unit === 'liter') {
    normalizedQty = purchaseQty * 1000; // l → ml
  }
  
  return unitCost / normalizedQty;
}

/**
 * Sync a single purchasing item to the ingredients table
 * Creates new or updates existing ingredient
 */
export async function syncIngredientFromPurchasing(purchasingItemId: number): Promise<{ success: boolean; ingredientId?: number; error?: string }> {
  try {
    // Fetch the purchasing item
    const [item] = await db
      .select()
      .from(purchasingItems)
      .where(eq(purchasingItems.id, purchasingItemId));
    
    if (!item) {
      return { success: false, error: 'Purchasing item not found' };
    }
    
    // Check if ingredient already exists for this purchasing item
    const [existing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.sourcePurchasingItemId, purchasingItemId));
    
    const baseUnit = deriveBaseUnit(item.orderUnit);
    const unitCostPerBase = calculateUnitCostPerBase(
      Number(item.unitCost || 0),
      Number(item.purchaseUnitQty || 1),
      item.orderUnit
    );
    
    if (existing) {
      // Update existing ingredient
      await db
        .update(ingredients)
        .set({
          name: item.item,
          category: item.category,
          supplier: item.supplierName,
          brand: item.brand,
          baseUnit,
          unitCostPerBase: unitCostPerBase.toFixed(6),
          purchaseQty: item.purchaseUnitQty?.toString(),
          purchaseUnit: item.orderUnit,
          purchaseCost: item.unitCost?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(ingredients.id, existing.id));
      
      console.log(`[IngredientSync] Updated ingredient ${existing.id} from purchasing item ${purchasingItemId}`);
      return { success: true, ingredientId: existing.id };
    } else {
      // Create new ingredient
      const [newIngredient] = await db
        .insert(ingredients)
        .values({
          name: item.item,
          category: item.category,
          supplier: item.supplierName,
          brand: item.brand,
          baseUnit,
          unitCostPerBase: unitCostPerBase.toFixed(6),
          sourcePurchasingItemId: purchasingItemId,
          purchaseQty: item.purchaseUnitQty?.toString(),
          purchaseUnit: item.orderUnit,
          purchaseCost: item.unitCost?.toString(),
          source: 'purchasing_sync',
        })
        .returning({ id: ingredients.id });
      
      console.log(`[IngredientSync] Created ingredient ${newIngredient.id} from purchasing item ${purchasingItemId}`);
      return { success: true, ingredientId: newIngredient.id };
    }
  } catch (error) {
    console.error('[IngredientSync] Error syncing ingredient:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sync all purchasing items marked as ingredients
 */
export async function syncAllIngredientsFromPurchasing(): Promise<{ synced: number; errors: number }> {
  const items = await db
    .select({ id: purchasingItems.id })
    .from(purchasingItems)
    .where(eq(purchasingItems.isIngredient, true));
  
  let synced = 0;
  let errors = 0;
  
  for (const item of items) {
    const result = await syncIngredientFromPurchasing(item.id);
    if (result.success) {
      synced++;
    } else {
      errors++;
      console.error(`[IngredientSync] Failed to sync item ${item.id}: ${result.error}`);
    }
  }
  
  console.log(`[IngredientSync] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Get ingredient by ID with canonical cost info
 */
export async function getIngredientById(ingredientId: number) {
  const [ing] = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      baseUnit: ingredients.baseUnit,
      unitCostPerBase: ingredients.unitCostPerBase,
      category: ingredients.category,
    })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId));
  
  return ing || null;
}

/**
 * Calculate ingredient line cost
 * Formula: unitCostPerBase × portionQty
 * NO conversions needed - portionQty is already in baseUnit
 */
export function calculateIngredientLineCost(
  unitCostPerBase: number,
  portionQty: number
): number {
  const cost = unitCostPerBase * portionQty;
  
  if (cost < 0 || !Number.isFinite(cost)) {
    throw new Error('Invalid ingredient cost calculation');
  }
  
  return cost;
}
