/**
 * 🔒 PATCH 13: RECEIPT → RECIPE → INGREDIENT TRUTH ENGINE
 * 
 * ZERO-GUESS POLICY:
 * - No defaults, no averages, no inferred ingredients
 * - If mapping is missing → FLAG IT, do not compensate
 * - Every ingredient row must trace back to a receipt
 * - Rebuild produces identical results every run
 * 
 * DERIVATION CHAIN (ONLY ALLOWED):
 * Receipts → Line Items → Modifiers → Recipes → Ingredients
 * 
 * MODIFIER-AWARE:
 * - NO CHEESE → subtract cheese
 * - EXTRA CHEESE → add cheese
 * - ADD BACON → add bacon ingredients
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface ModifierRule {
  modifierPattern: string;
  purchasingItemId: number;
  ingredientName: string;
  quantityDelta: number;
  unit: string;
}

interface IngredientAccumulator {
  ingredientId: number;
  ingredientName: string;
  quantityUsed: number;
  unit: string;
  sourceItemCount: number;
  confidence: number;
}

interface ModifierEffectRecord {
  receiptId: string;
  posItemName: string;
  modifierName: string;
  ingredientId: number;
  ingredientName: string;
  quantityDelta: number;
  unit: string;
}

interface TruthFlag {
  receiptId: string;
  posItemName: string;
  issueType: 'UNMAPPED_POS_ITEM' | 'RECIPE_INCOMPLETE' | 'INGREDIENT_INACTIVE' | 'MODIFIER_UNMATCHED';
  details: string;
}

export interface IngredientTruthRebuildResult {
  ok: boolean;
  date: string;
  runId: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  receiptCount: number;
  lineItemCount: number;
  ingredientsExpanded: number;
  modifierEffects: number;
  flagsCreated: number;
  confidenceScore: number;
}

export interface IngredientUsageQueryResult {
  date: string;
  runId: number;
  status: string;
  receiptCount: number;
  lineItemCount: number;
  confidenceScore: number;
  ingredientUsage: {
    ingredientId: number;
    ingredientName: string;
    quantityUsed: number;
    unit: string;
    sourceItemCount: number;
    confidence: number;
  }[];
  modifierEffects: {
    modifierName: string;
    ingredientName: string;
    totalDelta: number;
    unit: string;
    occurrences: number;
  }[];
  flags: TruthFlag[];
}

async function loadModifierRules(): Promise<ModifierRule[]> {
  const result = await db.execute(sql`
    SELECT 
      mir.modifier_pattern,
      mir.purchasing_item_id,
      mir.quantity_delta,
      mir.unit,
      pi.item as ingredient_name
    FROM modifier_ingredient_rules mir
    JOIN purchasing_items pi ON pi.id = mir.purchasing_item_id
    WHERE mir.active = true
  `);
  
  return (result.rows as any[]).map(row => ({
    modifierPattern: row.modifier_pattern,
    purchasingItemId: row.purchasing_item_id,
    ingredientName: row.ingredient_name,
    quantityDelta: Number(row.quantity_delta),
    unit: row.unit,
  }));
}

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

interface RecipeIngredientRow {
  recipeId: number;
  purchasingItemId: number;
  ingredientName: string;
  quantity: number;
  unit: string;
  active: boolean;
}

async function loadRecipeIngredients(): Promise<Map<number, RecipeIngredientRow[]>> {
  const result = await db.execute(sql`
    SELECT 
      ri.recipe_id,
      ri.purchasing_item_id,
      ri.quantity,
      ri.unit,
      pi.item as ingredient_name,
      pi.active
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
    });
  }
  return map;
}

function matchModifierRule(modifierOption: string, rules: ModifierRule[]): ModifierRule | null {
  const normalizedOption = modifierOption.toLowerCase();
  
  for (const rule of rules) {
    const pattern = rule.modifierPattern.toLowerCase();
    if (normalizedOption.includes(pattern)) {
      return rule;
    }
  }
  return null;
}

export async function rebuildIngredientTruth(businessDate: string): Promise<IngredientTruthRebuildResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[TRUTH_ENGINE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  console.log(`[TRUTH_ENGINE] Starting rebuild for ${businessDate}`);

  const existingRun = await db.execute(sql`
    DELETE FROM receipt_truth_run WHERE business_date = ${businessDate}::date RETURNING id
  `);
  if (existingRun.rows.length > 0) {
    console.log(`[TRUTH_ENGINE] Deleted prior run for ${businessDate}`);
  }

  const runResult = await db.execute(sql`
    INSERT INTO receipt_truth_run (business_date, status)
    VALUES (${businessDate}::date, 'RUNNING')
    RETURNING id
  `);
  const runId = (runResult.rows[0] as any).id;

  try {
    const summaryCheck = await db.execute(sql`
      SELECT all_receipts, sales_receipts FROM receipt_truth_summary 
      WHERE business_date = ${businessDate}::date
    `);
    
    if (!summaryCheck.rows || summaryCheck.rows.length === 0) {
      await db.execute(sql`
        UPDATE receipt_truth_run 
        SET status = 'FAILED', completed_at = NOW(), notes = 'No receipt truth summary found'
        WHERE id = ${runId}
      `);
      throw new Error(`[TRUTH_ENGINE_FAIL] No receipt truth found for ${businessDate}. Run receipts-truth/rebuild first.`);
    }

    const receiptCount = Number((summaryCheck.rows[0] as any).all_receipts);

    const linesResult = await db.execute(sql`
      SELECT receipt_id, item_name, sku, quantity
      FROM receipt_truth_line
      WHERE receipt_date = ${businessDate}::date
        AND receipt_type = 'SALE'
    `);

    if (!linesResult.rows || linesResult.rows.length === 0) {
      await db.execute(sql`
        UPDATE receipt_truth_run 
        SET status = 'FAILED', completed_at = NOW(), notes = 'No line items found'
        WHERE id = ${runId}
      `);
      throw new Error(`[TRUTH_ENGINE_FAIL] No line items found for ${businessDate}`);
    }

    const lines = linesResult.rows as any[];
    const lineItemCount = lines.length;
    console.log(`[TRUTH_ENGINE] Processing ${lineItemCount} SALE line items`);

    const modifiersResult = await db.execute(sql`
      SELECT receipt_id, line_sku, modifier_name, quantity
      FROM receipt_truth_modifier
      WHERE receipt_id IN (
        SELECT DISTINCT receipt_id FROM receipt_truth_line 
        WHERE receipt_date = ${businessDate}::date AND receipt_type = 'SALE'
      )
    `);
    
    const modifiersByReceipt = new Map<string, Map<string, any[]>>();
    for (const mod of modifiersResult.rows as any[]) {
      const key = mod.receipt_id;
      if (!modifiersByReceipt.has(key)) {
        modifiersByReceipt.set(key, new Map());
      }
      const receiptMods = modifiersByReceipt.get(key)!;
      if (!receiptMods.has(mod.line_sku)) {
        receiptMods.set(mod.line_sku, []);
      }
      receiptMods.get(mod.line_sku)!.push(mod);
    }

    const posRecipeMap = await loadPosRecipeMappings();
    const recipeIngredients = await loadRecipeIngredients();
    const modifierRules = await loadModifierRules();

    const ingredientAccum = new Map<number, IngredientAccumulator>();
    const modifierEffects: ModifierEffectRecord[] = [];
    const flags: TruthFlag[] = [];
    let mappedItems = 0;
    let unmappedItems = 0;

    for (const line of lines) {
      const receiptId = line.receipt_id;
      const posItemName = line.item_name;
      const sku = line.sku || '';
      const quantity = Number(line.quantity);

      let recipeId = posRecipeMap.get(sku) || posRecipeMap.get(posItemName);

      if (!recipeId) {
        unmappedItems++;
        flags.push({
          receiptId,
          posItemName,
          issueType: 'UNMAPPED_POS_ITEM',
          details: `No recipe mapping for SKU="${sku}" or name="${posItemName}"`,
        });
        continue;
      }

      const ingredients = recipeIngredients.get(recipeId);
      if (!ingredients || ingredients.length === 0) {
        unmappedItems++;
        flags.push({
          receiptId,
          posItemName,
          issueType: 'RECIPE_INCOMPLETE',
          details: `Recipe ID ${recipeId} has no ingredients`,
        });
        continue;
      }

      mappedItems++;

      for (const ing of ingredients) {
        const conf = ing.active ? 100 : 70;
        const totalQty = quantity * ing.quantity;

        if (!ingredientAccum.has(ing.purchasingItemId)) {
          ingredientAccum.set(ing.purchasingItemId, {
            ingredientId: ing.purchasingItemId,
            ingredientName: ing.ingredientName,
            quantityUsed: 0,
            unit: ing.unit,
            sourceItemCount: 0,
            confidence: 100,
          });
        }

        const accum = ingredientAccum.get(ing.purchasingItemId)!;
        accum.quantityUsed += totalQty;
        accum.sourceItemCount += quantity;
        if (conf < accum.confidence) {
          accum.confidence = conf;
        }

        if (!ing.active) {
          flags.push({
            receiptId,
            posItemName,
            issueType: 'INGREDIENT_INACTIVE',
            details: `Ingredient "${ing.ingredientName}" is inactive`,
          });
        }
      }

      const receiptMods = modifiersByReceipt.get(receiptId);
      if (receiptMods) {
        const skuMods = receiptMods.get(sku);
        if (skuMods) {
          for (const mod of skuMods) {
            const rule = matchModifierRule(mod.modifier_name, modifierRules);
            if (rule) {
              const delta = quantity * rule.quantityDelta;
              
              if (!ingredientAccum.has(rule.purchasingItemId)) {
                ingredientAccum.set(rule.purchasingItemId, {
                  ingredientId: rule.purchasingItemId,
                  ingredientName: rule.ingredientName,
                  quantityUsed: 0,
                  unit: rule.unit,
                  sourceItemCount: 0,
                  confidence: 100,
                });
              }
              
              const accum = ingredientAccum.get(rule.purchasingItemId)!;
              accum.quantityUsed += delta;
              
              modifierEffects.push({
                receiptId,
                posItemName,
                modifierName: mod.modifier_name,
                ingredientId: rule.purchasingItemId,
                ingredientName: rule.ingredientName,
                quantityDelta: delta,
                unit: rule.unit,
              });
            }
          }
        }
      }
    }

    for (const accum of ingredientAccum.values()) {
      await db.execute(sql`
        INSERT INTO receipt_truth_ingredient_usage 
        (run_id, ingredient_id, ingredient_name, quantity_used, unit, source_item_count, confidence)
        VALUES (
          ${runId},
          ${accum.ingredientId},
          ${accum.ingredientName},
          ${accum.quantityUsed},
          ${accum.unit},
          ${accum.sourceItemCount},
          ${accum.confidence}
        )
      `);
    }

    for (const effect of modifierEffects) {
      await db.execute(sql`
        INSERT INTO receipt_truth_modifier_effect 
        (run_id, receipt_id, pos_item_name, modifier_name, ingredient_id, ingredient_name, quantity_delta, unit)
        VALUES (
          ${runId},
          ${effect.receiptId},
          ${effect.posItemName},
          ${effect.modifierName},
          ${effect.ingredientId},
          ${effect.ingredientName},
          ${effect.quantityDelta},
          ${effect.unit}
        )
      `);
    }

    for (const flag of flags) {
      await db.execute(sql`
        INSERT INTO receipt_truth_flags 
        (receipt_date, receipt_id, pos_item_name, issue_type, details)
        VALUES (
          ${businessDate}::date,
          ${flag.receiptId},
          ${flag.posItemName},
          ${flag.issueType},
          ${flag.details}
        )
        ON CONFLICT DO NOTHING
      `);
    }

    const totalItems = mappedItems + unmappedItems;
    const coveragePercent = totalItems > 0 ? Math.round((mappedItems / totalItems) * 100) : 0;
    const status = coveragePercent >= 95 ? 'SUCCESS' : coveragePercent >= 50 ? 'PARTIAL' : 'FAILED';

    await db.execute(sql`
      UPDATE receipt_truth_run 
      SET 
        status = ${status},
        completed_at = NOW(),
        receipt_count = ${receiptCount},
        line_item_count = ${lineItemCount},
        confidence_score = ${coveragePercent},
        notes = ${`Mapped: ${mappedItems}/${totalItems}, Effects: ${modifierEffects.length}, Flags: ${flags.length}`}
      WHERE id = ${runId}
    `);

    console.log(`[TRUTH_ENGINE_OK] ${businessDate}: ${ingredientAccum.size} ingredients, ${modifierEffects.length} modifier effects, ${flags.length} flags, ${coveragePercent}% coverage`);

    return {
      ok: true,
      date: businessDate,
      runId,
      status,
      receiptCount,
      lineItemCount,
      ingredientsExpanded: ingredientAccum.size,
      modifierEffects: modifierEffects.length,
      flagsCreated: flags.length,
      confidenceScore: coveragePercent,
    };

  } catch (error: any) {
    await db.execute(sql`
      UPDATE receipt_truth_run 
      SET status = 'FAILED', completed_at = NOW(), notes = ${error.message || 'Unknown error'}
      WHERE id = ${runId}
    `);
    throw error;
  }
}

export async function getIngredientUsage(businessDate: string): Promise<IngredientUsageQueryResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[TRUTH_ENGINE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const runResult = await db.execute(sql`
    SELECT id, status, receipt_count, line_item_count, confidence_score
    FROM receipt_truth_run
    WHERE business_date = ${businessDate}::date
  `);

  if (!runResult.rows || runResult.rows.length === 0) {
    return null;
  }

  const run = runResult.rows[0] as any;
  const runId = run.id;

  const usageResult = await db.execute(sql`
    SELECT ingredient_id, ingredient_name, quantity_used, unit, source_item_count, confidence
    FROM receipt_truth_ingredient_usage
    WHERE run_id = ${runId}
    ORDER BY quantity_used DESC
  `);

  const modifierResult = await db.execute(sql`
    SELECT 
      modifier_name, 
      ingredient_name, 
      SUM(quantity_delta) as total_delta, 
      unit,
      COUNT(*) as occurrences
    FROM receipt_truth_modifier_effect
    WHERE run_id = ${runId}
    GROUP BY modifier_name, ingredient_name, unit
    ORDER BY occurrences DESC
  `);

  const flagsResult = await db.execute(sql`
    SELECT receipt_id, pos_item_name, issue_type, details
    FROM receipt_truth_flags
    WHERE receipt_date = ${businessDate}::date
    ORDER BY issue_type, pos_item_name
  `);

  return {
    date: businessDate,
    runId,
    status: run.status,
    receiptCount: run.receipt_count,
    lineItemCount: run.line_item_count,
    confidenceScore: run.confidence_score || 0,
    ingredientUsage: (usageResult.rows as any[]).map(row => ({
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name,
      quantityUsed: Number(row.quantity_used),
      unit: row.unit,
      sourceItemCount: row.source_item_count,
      confidence: row.confidence,
    })),
    modifierEffects: (modifierResult.rows as any[]).map(row => ({
      modifierName: row.modifier_name,
      ingredientName: row.ingredient_name,
      totalDelta: Number(row.total_delta),
      unit: row.unit,
      occurrences: Number(row.occurrences),
    })),
    flags: (flagsResult.rows as any[]).map(row => ({
      receiptId: row.receipt_id,
      posItemName: row.pos_item_name,
      issueType: row.issue_type,
      details: row.details,
    })),
  };
}
