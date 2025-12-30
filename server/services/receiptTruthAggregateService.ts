/**
 * 🔒 RECEIPT TRUTH — AGGREGATION SERVICE (PATCH 4)
 * 
 * READ-ONLY SOURCES:
 * - receipt_truth_line
 * - receipt_truth_modifier
 * - receipt_truth_category_map
 * 
 * NO DERIVATION FROM:
 * - lv_receipt, lv_line_item, or any analytics table
 * 
 * RULES:
 * - Category comes from POS category, not item name
 * - If unmapped → OTHER
 * - Modifiers are never collapsed into items
 * - Refund receipts already excluded by PATCH 1
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface CategoryMapping {
  id: string;
  posCategoryName: string;
  canonicalCategory: 'BURGERS' | 'SIDES' | 'DRINKS' | 'MEAL_DEALS' | 'OTHER';
}

export interface ItemAggregate {
  businessDate: string;
  canonicalCategory: string;
  itemName: string;
  totalQuantity: number;
  grossAmount: number;
}

export interface ModifierAggregate {
  businessDate: string;
  modifierName: string;
  totalQuantity: number;
}

export interface AggregateRebuildResult {
  ok: boolean;
  date: string;
  itemsAggregated: number;
  modifiersAggregated: number;
  unmappedCategories: string[];
}

export interface AggregateQueryResult {
  date: string;
  itemsByCategory: Record<string, ItemAggregate[]>;
  modifiers: ModifierAggregate[];
  categoryTotals: Record<string, { count: number; gross: number }>;
  unmappedCategories: string[];
}

// Get all category mappings
export async function getCategoryMappings(): Promise<CategoryMapping[]> {
  const result = await db.execute(sql`
    SELECT id, pos_category_name, canonical_category
    FROM receipt_truth_category_map
    ORDER BY canonical_category, pos_category_name
  `);
  return (result.rows as any[]).map(row => ({
    id: row.id,
    posCategoryName: row.pos_category_name,
    canonicalCategory: row.canonical_category,
  }));
}

// Add or update a category mapping
export async function upsertCategoryMapping(
  posCategoryName: string,
  canonicalCategory: 'BURGERS' | 'SIDES' | 'DRINKS' | 'MEAL_DEALS' | 'OTHER'
): Promise<void> {
  await db.execute(sql`
    INSERT INTO receipt_truth_category_map (pos_category_name, canonical_category)
    VALUES (${posCategoryName}, ${canonicalCategory})
    ON CONFLICT (pos_category_name) 
    DO UPDATE SET canonical_category = ${canonicalCategory}
  `);
}

// Get unmapped POS categories for a date
async function getUnmappedCategories(businessDate: string): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT l.category
    FROM receipt_truth_line l
    WHERE l.receipt_date = ${businessDate}::date
      AND l.receipt_type = 'SALE'
      AND l.category IS NOT NULL
      AND l.category NOT IN (
        SELECT pos_category_name FROM receipt_truth_category_map
      )
  `);
  return (result.rows as any[]).map(row => row.category).filter(Boolean);
}

// 🔒 REBUILD: Aggregate items and modifiers for a date
export async function rebuildAggregates(businessDate: string): Promise<AggregateRebuildResult> {
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

  // Clear existing aggregates for this date
  await db.execute(sql`DELETE FROM receipt_truth_item_aggregate WHERE business_date = ${businessDate}::date`);
  await db.execute(sql`DELETE FROM receipt_truth_modifier_aggregate WHERE business_date = ${businessDate}::date`);

  // Load category mappings
  const mappingsResult = await db.execute(sql`
    SELECT pos_category_name, canonical_category FROM receipt_truth_category_map
  `);
  const categoryMap = new Map<string, string>();
  for (const row of mappingsResult.rows as any[]) {
    categoryMap.set(row.pos_category_name, row.canonical_category);
  }

  // Aggregate items from receipt_truth_line (SALE only)
  const itemsResult = await db.execute(sql`
    SELECT 
      category,
      item_name,
      SUM(quantity) as total_quantity,
      SUM(gross_amount) as gross_amount
    FROM receipt_truth_line
    WHERE receipt_date = ${businessDate}::date
      AND receipt_type = 'SALE'
    GROUP BY category, item_name
    ORDER BY category, item_name
  `);

  const unmappedCategories = new Set<string>();
  let itemsAggregated = 0;

  for (const row of itemsResult.rows as any[]) {
    const posCategory = row.category || '';
    const canonicalCategory = categoryMap.get(posCategory) || 'OTHER';
    
    if (!categoryMap.has(posCategory) && posCategory) {
      unmappedCategories.add(posCategory);
    }

    await db.execute(sql`
      INSERT INTO receipt_truth_item_aggregate 
      (business_date, canonical_category, item_name, total_quantity, gross_amount)
      VALUES (
        ${businessDate}::date,
        ${canonicalCategory},
        ${row.item_name},
        ${Number(row.total_quantity)},
        ${Number(row.gross_amount)}
      )
    `);
    itemsAggregated++;
  }

  // Aggregate modifiers from receipt_truth_modifier
  const modifiersResult = await db.execute(sql`
    SELECT 
      m.modifier_name,
      SUM(m.quantity) as total_quantity
    FROM receipt_truth_modifier m
    WHERE m.receipt_id IN (
      SELECT DISTINCT receipt_id FROM receipt_truth_line 
      WHERE receipt_date = ${businessDate}::date AND receipt_type = 'SALE'
    )
    GROUP BY m.modifier_name
    ORDER BY m.modifier_name
  `);

  let modifiersAggregated = 0;
  for (const row of modifiersResult.rows as any[]) {
    await db.execute(sql`
      INSERT INTO receipt_truth_modifier_aggregate 
      (business_date, modifier_name, total_quantity)
      VALUES (
        ${businessDate}::date,
        ${row.modifier_name},
        ${Number(row.total_quantity)}
      )
    `);
    modifiersAggregated++;
  }

  console.log(`[RECEIPT_TRUTH_REBUILD_OK] Aggregates for ${businessDate}: ${itemsAggregated} items, ${modifiersAggregated} modifiers`);

  return {
    ok: true,
    date: businessDate,
    itemsAggregated,
    modifiersAggregated,
    unmappedCategories: Array.from(unmappedCategories),
  };
}

// 🔒 GET: Query aggregates for a date
export async function getAggregates(businessDate: string): Promise<AggregateQueryResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  // Check if aggregates exist
  const checkResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM receipt_truth_item_aggregate WHERE business_date = ${businessDate}::date
  `);
  
  if (Number((checkResult.rows[0] as any).count) === 0) {
    return null;
  }

  // Get items grouped by category
  const itemsResult = await db.execute(sql`
    SELECT business_date, canonical_category, item_name, total_quantity, gross_amount
    FROM receipt_truth_item_aggregate
    WHERE business_date = ${businessDate}::date
    ORDER BY canonical_category, total_quantity DESC, item_name
  `);

  const itemsByCategory: Record<string, ItemAggregate[]> = {
    BURGERS: [],
    SIDES: [],
    DRINKS: [],
    MEAL_DEALS: [],
    OTHER: [],
  };

  const categoryTotals: Record<string, { count: number; gross: number }> = {
    BURGERS: { count: 0, gross: 0 },
    SIDES: { count: 0, gross: 0 },
    DRINKS: { count: 0, gross: 0 },
    MEAL_DEALS: { count: 0, gross: 0 },
    OTHER: { count: 0, gross: 0 },
  };

  for (const row of itemsResult.rows as any[]) {
    const cat = row.canonical_category as string;
    const qty = Number(row.total_quantity);
    const gross = Number(row.gross_amount);
    
    if (!itemsByCategory[cat]) {
      itemsByCategory[cat] = [];
    }
    
    itemsByCategory[cat].push({
      businessDate: row.business_date,
      canonicalCategory: cat,
      itemName: row.item_name,
      totalQuantity: qty,
      grossAmount: gross,
    });

    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { count: 0, gross: 0 };
    }
    categoryTotals[cat].count += qty;
    categoryTotals[cat].gross += gross;
  }

  // Get modifiers
  const modifiersResult = await db.execute(sql`
    SELECT business_date, modifier_name, total_quantity
    FROM receipt_truth_modifier_aggregate
    WHERE business_date = ${businessDate}::date
    ORDER BY total_quantity DESC, modifier_name
  `);

  const modifiers: ModifierAggregate[] = (modifiersResult.rows as any[]).map(row => ({
    businessDate: row.business_date,
    modifierName: row.modifier_name,
    totalQuantity: Number(row.total_quantity),
  }));

  // Get unmapped categories
  const unmappedCategories = await getUnmappedCategories(businessDate);

  return {
    date: businessDate,
    itemsByCategory,
    modifiers,
    categoryTotals,
    unmappedCategories,
  };
}
