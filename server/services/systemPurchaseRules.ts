// PATCH 15 — System-Generated Purchase Rules
// Automatically calculates meat & roll purchase requirements based on stock form
// These items are READ-ONLY and cannot be manually edited

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { PURCHASE_TARGETS, SYSTEM_PURCHASE_ITEM_IDS } from '../config/purchaseTargets';

export interface SystemPurchaseItem {
  purchasingItemId: number;
  item: string;
  quantity: number;
  unit: string;
  target: number;
  endOfShift: number;
  unitCost: number;
  lineTotal: number;
  supplier: string;
  source: 'SYSTEM_RULE';
  rule: 'SHIFT_STOCK_TARGET';
}

export interface SystemPurchaseResult {
  shiftDate: string;
  stockFormMissing: boolean;
  items: SystemPurchaseItem[];
  totalCost: number;
}

/**
 * Calculate system-generated purchase items for a given shift date
 * Reads from daily_stock_v2 to determine current stock levels
 * 
 * Column mapping:
 * - burgerBuns = end-of-shift buns count
 * - meatWeightG = end-of-shift meat in GRAMS (convert to kg for calculations)
 */
export async function calculateSystemPurchases(shiftDate: string): Promise<SystemPurchaseResult> {
  // Find the stock form for this shift date
  // Note: shiftDate in DB may be stored as timestamp, so we compare dates
  const stockResult = await db.execute(sql`
    SELECT 
      ds.id,
      ds."burgerBuns",
      ds."meatWeightG"
    FROM daily_stock_v2 ds
    JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
    WHERE dsv."shiftDate"::date = ${shiftDate}::date
      AND dsv."deletedAt" IS NULL
      AND ds."deletedAt" IS NULL
    LIMIT 1
  `);

  if (stockResult.rows.length === 0) {
    // Stock form not submitted - cannot calculate
    return {
      shiftDate,
      stockFormMissing: true,
      items: [],
      totalCost: 0,
    };
  }

  const stock = stockResult.rows[0] as any;
  const rollsEnd = Number(stock.burgerBuns) || 0;
  // Convert grams to kg for comparison with targets
  const meatEndKg = (Number(stock.meatWeightG) || 0) / 1000;

  // Get purchasing item details
  const itemsResult = await db.execute(sql`
    SELECT id, item, "supplierName", "unitCost", "orderUnit"
    FROM purchasing_items
    WHERE id IN (${SYSTEM_PURCHASE_ITEM_IDS.TOPSIDE_BEEF}, ${SYSTEM_PURCHASE_ITEM_IDS.BURGER_ROLLS})
  `);

  const itemsMap = new Map<number, any>();
  for (const row of itemsResult.rows as any[]) {
    itemsMap.set(row.id, row);
  }

  const items: SystemPurchaseItem[] = [];

  // MEAT: target - current stock = needed
  const meatNeeded = Math.max(0, PURCHASE_TARGETS.MEAT_KG_PER_SHIFT - meatEndKg);
  if (meatNeeded > 0) {
    const meatItem = itemsMap.get(SYSTEM_PURCHASE_ITEM_IDS.TOPSIDE_BEEF);
    if (meatItem) {
      const unitCost = Number(meatItem.unitCost) || 0;
      items.push({
        purchasingItemId: SYSTEM_PURCHASE_ITEM_IDS.TOPSIDE_BEEF,
        item: meatItem.item || 'Topside Beef',
        quantity: meatNeeded,
        unit: 'kg',
        target: PURCHASE_TARGETS.MEAT_KG_PER_SHIFT,
        endOfShift: meatEndKg,
        unitCost,
        lineTotal: meatNeeded * unitCost,
        supplier: meatItem.supplierName || 'Makro',
        source: 'SYSTEM_RULE',
        rule: 'SHIFT_STOCK_TARGET',
      });
    }
  }

  // ROLLS: target - current stock = needed
  const rollsNeeded = Math.max(0, PURCHASE_TARGETS.ROLLS_PER_SHIFT - rollsEnd);
  if (rollsNeeded > 0) {
    const rollItem = itemsMap.get(SYSTEM_PURCHASE_ITEM_IDS.BURGER_ROLLS);
    if (rollItem) {
      const unitCost = Number(rollItem.unitCost) || 0;
      items.push({
        purchasingItemId: SYSTEM_PURCHASE_ITEM_IDS.BURGER_ROLLS,
        item: rollItem.item || 'Burger Bun',
        quantity: rollsNeeded,
        unit: 'each',
        target: PURCHASE_TARGETS.ROLLS_PER_SHIFT,
        endOfShift: rollsEnd,
        unitCost,
        lineTotal: rollsNeeded * unitCost,
        supplier: rollItem.supplierName || 'Bakery',
        source: 'SYSTEM_RULE',
        rule: 'SHIFT_STOCK_TARGET',
      });
    }
  }

  const totalCost = items.reduce((sum, i) => sum + i.lineTotal, 0);

  return {
    shiftDate,
    stockFormMissing: false,
    items,
    totalCost,
  };
}
