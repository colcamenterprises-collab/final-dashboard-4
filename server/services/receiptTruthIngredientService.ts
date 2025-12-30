/**
 * 🔒 RECEIPT TRUTH — INGREDIENT EXPANSION SERVICE
 * 
 * ZERO-GUESS POLICY:
 * - No defaults, no averages, no inferred ingredients
 * - If mapping is missing → flag it, do not compensate
 * - Every ingredient row must trace back to a receipt
 * - Rebuild produces identical results every run
 * 
 * DERIVATION CHAIN (ONLY ALLOWED):
 * Receipts → Line Items → Modifiers → Recipes → Ingredients
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface IngredientUsage {
  receiptDate: string;
  receiptId: string;
  posItemName: string;
  recipeId: number | null;
  ingredientId: number;
  ingredientName: string;
  quantityUsed: number;
  unit: string;
  confidence: number;
}

interface TruthFlag {
  receiptDate: string;
  receiptId: string;
  posItemName: string;
  issueType: 'UNMAPPED_POS_ITEM' | 'RECIPE_INCOMPLETE' | 'INGREDIENT_INACTIVE';
  details: string;
}

export interface IngredientRebuildResult {
  ok: boolean;
  date: string;
  totalLineItems: number;
  mappedItems: number;
  unmappedItems: number;
  ingredientsExpanded: number;
  flagsCreated: number;
}

export interface IngredientQueryResult {
  date: string;
  totalReceipts: number;
  totalLineItems: number;
  totalIngredientsUsed: number;
  flaggedItemsCount: number;
  ingredients: IngredientUsage[];
  flags: TruthFlag[];
}

// 🔒 STEP 1: Load all POS → Recipe mappings
async function loadPosRecipeMappings(): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT pos_item_id, recipe_id FROM pos_item_recipe_map
  `);
  const map = new Map<string, number>();
  for (const row of result.rows as any[]) {
    map.set(row.pos_item_id, row.recipe_id);
  }
  return map;
}

// 🔒 STEP 2: Load recipe ingredients with purchasing item details
interface RecipeIngredientRow {
  recipeId: number;
  purchasingItemId: number;
  ingredientName: string;
  quantity: number;
  unit: string;
  active: boolean;
  isIngredient: boolean;
}

async function loadRecipeIngredients(): Promise<Map<number, RecipeIngredientRow[]>> {
  const result = await db.execute(sql`
    SELECT 
      ri.recipe_id,
      ri.purchasing_item_id,
      ri.quantity,
      ri.unit,
      pi.item as ingredient_name,
      pi.active,
      pi.is_ingredient
    FROM recipe_ingredient ri
    JOIN purchasing_items pi ON pi.id = ri.purchasing_item_id
  `);
  
  const map = new Map<number, RecipeIngredientRow[]>();
  for (const row of result.rows as any[]) {
    const recipeId = row.recipe_id;
    if (!map.has(recipeId)) {
      map.set(recipeId, []);
    }
    map.get(recipeId)!.push({
      recipeId: row.recipe_id,
      purchasingItemId: row.purchasing_item_id,
      ingredientName: row.ingredient_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      active: row.active,
      isIngredient: row.is_ingredient,
    });
  }
  return map;
}

// 🔒 MAIN: Rebuild ingredient truth for a date
export async function rebuildIngredientTruth(businessDate: string): Promise<IngredientRebuildResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  // Verify receipt truth exists
  const summaryCheck = await db.execute(sql`
    SELECT all_receipts FROM receipt_truth_summary WHERE business_date = ${businessDate}::date
  `);
  if (!summaryCheck.rows || summaryCheck.rows.length === 0) {
    throw new Error(`[RECEIPT_TRUTH_FAIL] No receipt truth found for ${businessDate}. Run receipts-truth/rebuild first.`);
  }

  // Load receipt truth line items (SALE only, exclude refunds)
  const linesResult = await db.execute(sql`
    SELECT receipt_id, item_name, sku, quantity
    FROM receipt_truth_line
    WHERE receipt_date = ${businessDate}::date
      AND receipt_type = 'SALE'
  `);

  if (!linesResult.rows || linesResult.rows.length === 0) {
    throw new Error(`[RECEIPT_TRUTH_FAIL] No line items found for ${businessDate}. Run receipts-truth/rebuild first.`);
  }

  const lines = linesResult.rows as any[];
  console.log(`[RECEIPT_TRUTH] Processing ${lines.length} SALE line items for ${businessDate}`);

  // Load mappings
  const posRecipeMap = await loadPosRecipeMappings();
  const recipeIngredients = await loadRecipeIngredients();

  // Clear existing data for this date
  await db.execute(sql`DELETE FROM receipt_truth_ingredient WHERE receipt_date = ${businessDate}::date`);
  await db.execute(sql`DELETE FROM receipt_truth_flags WHERE receipt_date = ${businessDate}::date`);

  const ingredientRows: IngredientUsage[] = [];
  const flagRows: TruthFlag[] = [];
  let mappedItems = 0;
  let unmappedItems = 0;

  // Process each line item
  for (const line of lines) {
    const receiptId = line.receipt_id;
    const posItemName = line.item_name;
    const sku = line.sku || '';
    const quantity = Number(line.quantity);

    // Try to find recipe mapping by SKU first, then by item name
    let recipeId = posRecipeMap.get(sku) || posRecipeMap.get(posItemName);

    if (!recipeId) {
      // UNMAPPED_POS_ITEM - No recipe mapping exists
      unmappedItems++;
      flagRows.push({
        receiptDate: businessDate,
        receiptId,
        posItemName,
        issueType: 'UNMAPPED_POS_ITEM',
        details: `No recipe mapping found for SKU="${sku}" or name="${posItemName}"`,
      });
      console.log(`[RECEIPT_TRUTH_FLAG] UNMAPPED_POS_ITEM: ${posItemName} (SKU: ${sku})`);
      continue;
    }

    // Get recipe ingredients
    const ingredients = recipeIngredients.get(recipeId);
    if (!ingredients || ingredients.length === 0) {
      // RECIPE_INCOMPLETE - Recipe exists but has no ingredients
      unmappedItems++;
      flagRows.push({
        receiptDate: businessDate,
        receiptId,
        posItemName,
        issueType: 'RECIPE_INCOMPLETE',
        details: `Recipe ID ${recipeId} has no ingredients defined`,
      });
      console.log(`[RECEIPT_TRUTH_FLAG] RECIPE_INCOMPLETE: ${posItemName} (Recipe: ${recipeId})`);
      continue;
    }

    mappedItems++;

    // Expand each ingredient
    for (const ing of ingredients) {
      // Check if ingredient is active and marked as ingredient
      if (!ing.active) {
        flagRows.push({
          receiptDate: businessDate,
          receiptId,
          posItemName,
          issueType: 'INGREDIENT_INACTIVE',
          details: `Ingredient "${ing.ingredientName}" (ID: ${ing.purchasingItemId}) is inactive`,
        });
        
        // Still add ingredient row but with reduced confidence
        ingredientRows.push({
          receiptDate: businessDate,
          receiptId,
          posItemName,
          recipeId,
          ingredientId: ing.purchasingItemId,
          ingredientName: ing.ingredientName,
          quantityUsed: quantity * ing.quantity,
          unit: ing.unit,
          confidence: 70, // Reduced confidence for inactive ingredient
        });
        continue;
      }

      // Fully mapped ingredient
      ingredientRows.push({
        receiptDate: businessDate,
        receiptId,
        posItemName,
        recipeId,
        ingredientId: ing.purchasingItemId,
        ingredientName: ing.ingredientName,
        quantityUsed: quantity * ing.quantity,
        unit: ing.unit,
        confidence: 100,
      });
    }
  }

  // Insert ingredient rows
  if (ingredientRows.length > 0) {
    for (const row of ingredientRows) {
      await db.execute(sql`
        INSERT INTO receipt_truth_ingredient 
        (receipt_date, receipt_id, pos_item_name, recipe_id, ingredient_id, ingredient_name, quantity_used, unit, confidence)
        VALUES (
          ${row.receiptDate}::date,
          ${row.receiptId},
          ${row.posItemName},
          ${row.recipeId},
          ${row.ingredientId},
          ${row.ingredientName},
          ${row.quantityUsed},
          ${row.unit},
          ${row.confidence}
        )
      `);
    }
  }

  // Insert flag rows
  if (flagRows.length > 0) {
    for (const flag of flagRows) {
      await db.execute(sql`
        INSERT INTO receipt_truth_flags 
        (receipt_date, receipt_id, pos_item_name, issue_type, details)
        VALUES (
          ${flag.receiptDate}::date,
          ${flag.receiptId},
          ${flag.posItemName},
          ${flag.issueType},
          ${flag.details}
        )
      `);
    }
  }

  console.log(`[RECEIPT_TRUTH_REBUILD_OK] ${businessDate}: ${ingredientRows.length} ingredients, ${flagRows.length} flags`);

  return {
    ok: true,
    date: businessDate,
    totalLineItems: lines.length,
    mappedItems,
    unmappedItems,
    ingredientsExpanded: ingredientRows.length,
    flagsCreated: flagRows.length,
  };
}

// 🔒 GET: Query ingredient truth for a date
export async function getIngredientTruth(businessDate: string): Promise<IngredientQueryResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  // Get summary stats
  const summaryResult = await db.execute(sql`
    SELECT all_receipts FROM receipt_truth_summary WHERE business_date = ${businessDate}::date
  `);
  
  const lineCountResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM receipt_truth_line 
    WHERE receipt_date = ${businessDate}::date AND receipt_type = 'SALE'
  `);

  const ingredientCountResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM receipt_truth_ingredient WHERE receipt_date = ${businessDate}::date
  `);

  const flagCountResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM receipt_truth_flags WHERE receipt_date = ${businessDate}::date
  `);

  if (!summaryResult.rows || summaryResult.rows.length === 0) {
    return null;
  }

  // Get ingredient details
  const ingredientsResult = await db.execute(sql`
    SELECT receipt_date, receipt_id, pos_item_name, recipe_id, ingredient_id, ingredient_name, quantity_used, unit, confidence
    FROM receipt_truth_ingredient
    WHERE receipt_date = ${businessDate}::date
    ORDER BY ingredient_name, receipt_id
  `);

  // Get flags
  const flagsResult = await db.execute(sql`
    SELECT receipt_date, receipt_id, pos_item_name, issue_type, details
    FROM receipt_truth_flags
    WHERE receipt_date = ${businessDate}::date
    ORDER BY issue_type, pos_item_name
  `);

  return {
    date: businessDate,
    totalReceipts: Number((summaryResult.rows[0] as any).all_receipts),
    totalLineItems: Number((lineCountResult.rows[0] as any).count),
    totalIngredientsUsed: Number((ingredientCountResult.rows[0] as any).count),
    flaggedItemsCount: Number((flagCountResult.rows[0] as any).count),
    ingredients: (ingredientsResult.rows as any[]).map(row => ({
      receiptDate: row.receipt_date,
      receiptId: row.receipt_id,
      posItemName: row.pos_item_name,
      recipeId: row.recipe_id,
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name,
      quantityUsed: Number(row.quantity_used),
      unit: row.unit,
      confidence: row.confidence,
    })),
    flags: (flagsResult.rows as any[]).map(row => ({
      receiptDate: row.receipt_date,
      receiptId: row.receipt_id,
      posItemName: row.pos_item_name,
      issueType: row.issue_type,
      details: row.details,
    })),
  };
}
