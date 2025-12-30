/**
 * 🔒 RECEIPT TRUTH — AGGREGATION SERVICE (PATCH 4 FIXED)
 * 
 * READ-ONLY SOURCES:
 * - receipt_truth_line (with pos_category_name verbatim from Loyverse)
 * - receipt_truth_modifier
 * 
 * RULES:
 * - NO canonical category mapping
 * - Use exact POS category from Loyverse verbatim
 * - If category missing → "UNCATEGORIZED (POS)"
 * - Modifiers are never collapsed into items
 * - Refund receipts excluded
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface ItemAggregate {
  businessDate: string;
  posCategory: string;
  itemName: string;
  totalQuantity: number;
  grossAmount: number;
}

export interface ModifierAggregate {
  businessDate: string;
  modifierName: string;
  totalQuantity: number;
}

export interface CategoryTotal {
  category: string;
  itemCount: number;
  totalQuantity: number;
  grossAmount: number;
}

export interface AggregateRebuildResult {
  ok: boolean;
  date: string;
  itemsAggregated: number;
  modifiersAggregated: number;
  categories: string[];
}

export interface AggregateQueryResult {
  date: string;
  itemsByCategory: Record<string, ItemAggregate[]>;
  modifiers: ModifierAggregate[];
  categoryTotals: CategoryTotal[];
  categories: string[];
}

// 🔒 REBUILD: Aggregate items and modifiers for a date (NO MAPPING)
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

  // Aggregate items by POS category directly (NO MAPPING)
  const itemsResult = await db.execute(sql`
    SELECT 
      COALESCE(pos_category_name, 'UNCATEGORIZED (POS)') as pos_category,
      item_name,
      SUM(quantity) as total_quantity,
      SUM(gross_amount) as gross_amount
    FROM receipt_truth_line
    WHERE receipt_date = ${businessDate}::date
      AND receipt_type = 'SALE'
    GROUP BY COALESCE(pos_category_name, 'UNCATEGORIZED (POS)'), item_name
    ORDER BY pos_category, item_name
  `);

  const categoriesSet = new Set<string>();
  let itemsAggregated = 0;

  for (const row of itemsResult.rows as any[]) {
    const posCategory = row.pos_category;
    categoriesSet.add(posCategory);

    await db.execute(sql`
      INSERT INTO receipt_truth_item_aggregate 
      (business_date, canonical_category, item_name, total_quantity, gross_amount)
      VALUES (
        ${businessDate}::date,
        ${posCategory},
        ${row.item_name},
        ${Number(row.total_quantity)},
        ${Number(row.gross_amount)}
      )
    `);
    itemsAggregated++;
  }

  // Aggregate modifiers
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

  const categories = Array.from(categoriesSet).sort();
  console.log(`[RECEIPT_TRUTH_REBUILD_OK] Aggregates for ${businessDate}: ${itemsAggregated} items, ${modifiersAggregated} modifiers, Categories: ${categories.join(', ')}`);

  return {
    ok: true,
    date: businessDate,
    itemsAggregated,
    modifiersAggregated,
    categories,
  };
}

// 🔒 GET: Query aggregates for a date (NO MAPPING)
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

  // Get items grouped by POS category
  const itemsResult = await db.execute(sql`
    SELECT business_date, canonical_category as pos_category, item_name, total_quantity, gross_amount
    FROM receipt_truth_item_aggregate
    WHERE business_date = ${businessDate}::date
    ORDER BY canonical_category, total_quantity DESC, item_name
  `);

  const itemsByCategory: Record<string, ItemAggregate[]> = {};
  const categoryTotalsMap: Record<string, { itemCount: number; totalQuantity: number; grossAmount: number }> = {};
  const categoriesSet = new Set<string>();

  for (const row of itemsResult.rows as any[]) {
    const cat = row.pos_category as string;
    const qty = Number(row.total_quantity);
    const gross = Number(row.gross_amount);
    
    categoriesSet.add(cat);
    
    if (!itemsByCategory[cat]) {
      itemsByCategory[cat] = [];
    }
    
    itemsByCategory[cat].push({
      businessDate: row.business_date,
      posCategory: cat,
      itemName: row.item_name,
      totalQuantity: qty,
      grossAmount: gross,
    });

    if (!categoryTotalsMap[cat]) {
      categoryTotalsMap[cat] = { itemCount: 0, totalQuantity: 0, grossAmount: 0 };
    }
    categoryTotalsMap[cat].itemCount++;
    categoryTotalsMap[cat].totalQuantity += qty;
    categoryTotalsMap[cat].grossAmount += gross;
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

  // Build category totals sorted by gross amount
  const categoryTotals: CategoryTotal[] = Array.from(categoriesSet)
    .map(cat => ({
      category: cat,
      itemCount: categoryTotalsMap[cat]?.itemCount || 0,
      totalQuantity: categoryTotalsMap[cat]?.totalQuantity || 0,
      grossAmount: categoryTotalsMap[cat]?.grossAmount || 0,
    }))
    .sort((a, b) => b.grossAmount - a.grossAmount);

  return {
    date: businessDate,
    itemsByCategory,
    modifiers,
    categoryTotals,
    categories: Array.from(categoriesSet).sort(),
  };
}
