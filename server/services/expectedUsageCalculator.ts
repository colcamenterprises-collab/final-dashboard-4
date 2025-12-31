/**
 * 🔒 EXPECTED INGREDIENT USAGE
 * Aggregates sold_item_ingredient per shift
 * 
 * This service calculates what ingredients SHOULD have been used
 * based on what was sold (from the cascade engine).
 */

import { db } from '../db';
import { soldItemIngredient, ingredientExpectedUsage } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Calculate expected ingredient usage for a shift.
 * Aggregates all sold_item_ingredient records by ingredient and unit.
 */
export async function calculateExpectedUsage(shiftId: string): Promise<void> {
  console.log(`[ExpectedUsage] Calculating for shift: ${shiftId}`);

  await db.delete(ingredientExpectedUsage).where(eq(ingredientExpectedUsage.shiftId, shiftId));

  const aggregated = await db
    .select({
      ingredient: soldItemIngredient.ingredient,
      unit: soldItemIngredient.unit,
      totalQuantity: sql<string>`SUM(${soldItemIngredient.quantity})`.as('total_quantity'),
    })
    .from(soldItemIngredient)
    .where(eq(soldItemIngredient.shiftId, shiftId))
    .groupBy(soldItemIngredient.ingredient, soldItemIngredient.unit);

  console.log(`[ExpectedUsage] Found ${aggregated.length} unique ingredients`);

  for (const row of aggregated) {
    await db.insert(ingredientExpectedUsage).values({
      shiftId,
      ingredient: row.ingredient,
      quantity: row.totalQuantity || '0',
      unit: row.unit,
    });
  }

  console.log(`[ExpectedUsage] Completed for shift: ${shiftId}`);
}

/**
 * Get expected usage for a shift (read-only).
 */
export async function getExpectedUsage(shiftId: string) {
  return db
    .select()
    .from(ingredientExpectedUsage)
    .where(eq(ingredientExpectedUsage.shiftId, shiftId));
}
