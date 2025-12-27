/**
 * 🔒 DERIVED DATA — INGREDIENT USAGE
 * DO NOT WRITE MANUALLY
 * DO NOT ADD UI
 * SOURCE: POS → RECIPES → PURCHASING
 * 
 * This service derives ingredient usage from POS receipts by:
 * 1. Reading POS line items for a shift date
 * 2. Looking up recipe mappings for each POS item
 * 3. Expanding recipe ingredients
 * 4. Calculating quantity used based on receipt quantity × recipe ingredient quantity
 */

import { db } from '../db';
import { 
  ingredientUsage, 
  posItemRecipeMap, 
  recipeIngredient, 
  purchasingItems 
} from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface IngredientUsageSummary {
  shiftDate: string;
  totalReceipts: number;
  totalRecipesUsed: number;
  totalIngredientsUsed: number;
  topIngredients: Array<{ item: string; qty: number }>;
}

/**
 * Derive ingredient usage for a specific shift date.
 * Idempotent: deletes existing data for that date and rebuilds.
 */
export async function deriveIngredientUsageForDate(shiftDate: string): Promise<{ success: boolean; count: number; errors: string[] }> {
  const errors: string[] = [];
  let insertCount = 0;

  try {
    // Step 1: Delete existing records for this shift_date (idempotent)
    await db.delete(ingredientUsage).where(eq(ingredientUsage.shiftDate, shiftDate));

    // Step 2: Get all receipts and line items for this date from lv_receipt + lv_line_item
    const lineItemsResult = await db.execute(sql`
      SELECT 
        r.receipt_id as receipt_id,
        li.sku as pos_item_id,
        li.qty as line_quantity
      FROM lv_receipt r
      JOIN lv_line_item li ON r.receipt_id = li.receipt_id
      WHERE DATE(r.datetime_bkk) = ${shiftDate}::date
    `);

    const lineItems = lineItemsResult.rows as Array<{
      receipt_id: string;
      pos_item_id: string;
      line_quantity: number;
    }>;

    if (lineItems.length === 0) {
      console.log(`[ingredientUsageDeriver] No line items found for ${shiftDate}`);
      return { success: true, count: 0, errors: [] };
    }

    // Step 3: Get all recipe mappings
    const mappings = await db
      .select({
        posItemId: posItemRecipeMap.posItemId,
        recipeId: posItemRecipeMap.recipeId,
      })
      .from(posItemRecipeMap);

    const mappingLookup = new Map(mappings.map(m => [m.posItemId, m.recipeId]));

    // Step 4: Get all recipe ingredients with purchasing item info
    const ingredients = await db
      .select({
        recipeId: recipeIngredient.recipeId,
        purchasingItemId: recipeIngredient.purchasingItemId,
        quantity: recipeIngredient.quantity,
        unit: recipeIngredient.unit,
        isIngredient: purchasingItems.isIngredient,
        active: purchasingItems.active,
      })
      .from(recipeIngredient)
      .innerJoin(purchasingItems, eq(recipeIngredient.purchasingItemId, purchasingItems.id));

    // Group ingredients by recipe
    const ingredientsByRecipe = new Map<number, typeof ingredients>();
    for (const ing of ingredients) {
      if (!ingredientsByRecipe.has(ing.recipeId)) {
        ingredientsByRecipe.set(ing.recipeId, []);
      }
      ingredientsByRecipe.get(ing.recipeId)!.push(ing);
    }

    // Step 5: Derive usage for each line item
    const usageRecords: Array<{
      shiftDate: string;
      receiptId: string;
      posItemId: string;
      recipeId: number;
      purchasingItemId: number;
      quantityUsed: string;
      unit: string;
    }> = [];

    for (const lineItem of lineItems) {
      const recipeId = mappingLookup.get(lineItem.pos_item_id);
      
      if (!recipeId) {
        // Skip unmapped POS items (don't throw)
        continue;
      }

      const recipeIngredients = ingredientsByRecipe.get(recipeId);
      
      if (!recipeIngredients || recipeIngredients.length === 0) {
        // Skip incomplete recipes (don't throw)
        errors.push(`Recipe ${recipeId} has no valid ingredients`);
        continue;
      }

      for (const ing of recipeIngredients) {
        // Skip non-ingredients and inactive items
        if (!ing.isIngredient || !ing.active) {
          continue;
        }

        const quantityUsed = Number(lineItem.line_quantity) * Number(ing.quantity);
        
        usageRecords.push({
          shiftDate,
          receiptId: String(lineItem.receipt_id),
          posItemId: lineItem.pos_item_id,
          recipeId,
          purchasingItemId: ing.purchasingItemId,
          quantityUsed: quantityUsed.toFixed(4),
          unit: ing.unit,
        });
      }
    }

    // Step 6: Insert all usage records
    if (usageRecords.length > 0) {
      await db.insert(ingredientUsage).values(usageRecords);
      insertCount = usageRecords.length;
    }

    console.log(`[ingredientUsageDeriver] Derived ${insertCount} usage records for ${shiftDate}`);
    return { success: true, count: insertCount, errors };

  } catch (err: any) {
    console.error(`[ingredientUsageDeriver] Error deriving usage for ${shiftDate}:`, err);
    errors.push(err.message || 'Unknown error');
    return { success: false, count: insertCount, errors };
  }
}

/**
 * Get summary statistics for ingredient usage on a date.
 * Never throws - returns empty stats if no data.
 */
export async function getIngredientUsageSummary(shiftDate: string): Promise<IngredientUsageSummary> {
  try {
    // Get total unique receipts
    const receiptsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT receipt_id) as count 
      FROM ingredient_usage 
      WHERE shift_date = ${shiftDate}::date
    `);
    const totalReceipts = parseInt((receiptsResult.rows[0] as any)?.count || '0');

    // Get total unique recipes used
    const recipesResult = await db.execute(sql`
      SELECT COUNT(DISTINCT recipe_id) as count 
      FROM ingredient_usage 
      WHERE shift_date = ${shiftDate}::date
    `);
    const totalRecipesUsed = parseInt((recipesResult.rows[0] as any)?.count || '0');

    // Get total ingredient usage records
    const usageResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ingredient_usage 
      WHERE shift_date = ${shiftDate}::date
    `);
    const totalIngredientsUsed = parseInt((usageResult.rows[0] as any)?.count || '0');

    // Get top ingredients by quantity
    const topResult = await db.execute(sql`
      SELECT p.item, SUM(CAST(iu.quantity_used AS NUMERIC)) as qty
      FROM ingredient_usage iu
      JOIN purchasing_items p ON iu.purchasing_item_id = p.id
      WHERE iu.shift_date = ${shiftDate}::date
      GROUP BY p.item
      ORDER BY qty DESC
      LIMIT 10
    `);
    const topIngredients = (topResult.rows as any[]).map(r => ({
      item: r.item,
      qty: parseFloat(r.qty) || 0,
    }));

    return {
      shiftDate,
      totalReceipts,
      totalRecipesUsed,
      totalIngredientsUsed,
      topIngredients,
    };

  } catch (err: any) {
    // Defensive: if table doesn't exist or any error, return empty stats
    console.warn(`[ingredientUsageDeriver] Error getting summary for ${shiftDate}:`, err?.message);
    return {
      shiftDate,
      totalReceipts: 0,
      totalRecipesUsed: 0,
      totalIngredientsUsed: 0,
      topIngredients: [],
    };
  }
}
