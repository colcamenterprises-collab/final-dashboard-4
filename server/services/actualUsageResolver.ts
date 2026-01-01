/**
 * 🔒 ACTUAL USAGE RESOLVER
 * ----------------------------------
 * actual = opening + purchases - closing
 *
 * This file defines REAL ingredient usage.
 * No inference. No estimates. No UI writes.
 * 
 * Opening = Previous shift's closing
 * Purchases = Sum from purchasing_shift_items for this shift
 * Closing = Current shift's end count
 */

import { db } from '../db';
import { dailyStockV2, purchasingShiftItems, purchasingItems } from '@shared/schema';
import { eq, and, lt, desc, sql } from 'drizzle-orm';

type ActualUsageResult = number | null;

/**
 * Get actual ingredient usage for a shift.
 * actual = opening + purchases - closing
 * 
 * Returns null if ingredient is not stock-tracked or data is missing.
 */
export async function getActualUsage(
  shiftId: string,
  ingredient: string,
  unit: string
): Promise<ActualUsageResult> {
  const stockKey = mapIngredientToStockKey(ingredient);
  if (!stockKey) return null;

  const [currentStock] = await db
    .select()
    .from(dailyStockV2)
    .where(eq(dailyStockV2.shiftDate, shiftId));

  if (!currentStock) return null;

  const closing = getClosingValue(currentStock, stockKey);
  if (closing === null) return null;

  const [previousStock] = await db
    .select()
    .from(dailyStockV2)
    .where(lt(dailyStockV2.shiftDate, shiftId))
    .orderBy(desc(dailyStockV2.shiftDate))
    .limit(1);

  const opening = previousStock ? getClosingValue(previousStock, stockKey) : null;
  if (opening === null) return null;

  const purchasedQty = await getPurchasedQuantity(shiftId, ingredient, stockKey, currentStock);

  return opening + purchasedQty - closing;
}

/**
 * Get the closing value from a stock record based on the stock key.
 */
function getClosingValue(stock: typeof dailyStockV2.$inferSelect, stockKey: string): number | null {
  switch (stockKey) {
    case 'rolls':
      return stock.rollsEnd ?? null;
    case 'meat':
      return stock.meatEndKg ? parseFloat(stock.meatEndKg) * 1000 : null;
    default:
      return null;
  }
}

/**
 * Get purchased quantity for an ingredient during a shift.
 * Uses both the dedicated purchased fields on dailyStockV2 and purchasingShiftItems.
 */
async function getPurchasedQuantity(
  shiftId: string,
  ingredient: string,
  stockKey: string,
  currentStock: typeof dailyStockV2.$inferSelect
): Promise<number> {
  switch (stockKey) {
    case 'rolls':
      return currentStock.rollsPurchased ?? 0;
    case 'meat':
      return currentStock.meatPurchasedGrams ?? 0;
    default:
      break;
  }

  const purchases = await db
    .select({
      quantity: purchasingShiftItems.quantity,
    })
    .from(purchasingShiftItems)
    .innerJoin(purchasingItems, eq(purchasingShiftItems.purchasingItemId, purchasingItems.id))
    .where(
      and(
        eq(purchasingShiftItems.dailyStockId, shiftId),
        eq(purchasingItems.item, ingredient)
      )
    );

  return purchases.reduce((sum, p) => sum + parseFloat(p.quantity), 0);
}

/**
 * 🔒 CANONICAL INGREDIENT → STOCK FIELD MAP
 * Explicit. No guessing.
 */
function mapIngredientToStockKey(ingredient: string): string | null {
  const MAP: Record<string, string> = {
    "Burger Bun": "rolls",
    "Brioche Bun": "rolls",
    "Burger Buns": "rolls",
    "Beef Patty": "meat",
    "Beef": "meat",
    "Meat": "meat",
  };

  return MAP[ingredient] ?? null;
}
