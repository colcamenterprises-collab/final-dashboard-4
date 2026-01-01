/**
 * 🔒 INGREDIENT VARIANCE ENGINE
 * Expected vs Actual
 * 
 * Compares expected ingredient usage (from sales) against actual usage
 * (from stock counts, purchases, etc.) and flags variances.
 */

import { db } from '../db';
import { ingredientExpectedUsage, ingredientVariance } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getThreshold } from '../config/ingredientThresholds';
import { getActualUsage } from './actualUsageResolver';

type VarianceStatus = 'OK' | 'WARNING' | 'CRITICAL';

/**
 * Run ingredient variance calculation for a shift.
 * Compares expected usage against actual usage and stores results.
 */
export async function runIngredientVariance(shiftId: string): Promise<void> {
  console.log(`[VarianceEngine] Running for shift: ${shiftId}`);

  await db.delete(ingredientVariance).where(eq(ingredientVariance.shiftId, shiftId));

  const expected = await db
    .select()
    .from(ingredientExpectedUsage)
    .where(eq(ingredientExpectedUsage.shiftId, shiftId));

  console.log(`[VarianceEngine] Processing ${expected.length} ingredients`);

  for (const exp of expected) {
    const actual = await getActualUsage(shiftId, exp.ingredient, exp.unit);
    
    if (actual === null) {
      console.log(`[VarianceEngine] Skipping ${exp.ingredient} - no stock tracking data`);
      continue;
    }
    
    const expectedQty = parseFloat(exp.quantity);
    const variance = actual - expectedQty;
    const status = determineStatus(exp.ingredient, variance);

    await db.insert(ingredientVariance).values({
      shiftId,
      ingredient: exp.ingredient,
      expectedQty: exp.quantity,
      actualQty: actual.toString(),
      varianceQty: variance.toString(),
      unit: exp.unit,
      status,
    });
  }

  console.log(`[VarianceEngine] Completed for shift: ${shiftId}`);
}

/**
 * Determine variance status based on thresholds.
 */
function determineStatus(ingredient: string, variance: number): VarianceStatus {
  const threshold = getThreshold(ingredient);
  
  if (!threshold) {
    return 'OK';
  }

  const absVariance = Math.abs(variance);
  
  if (absVariance >= threshold.critical) {
    return 'CRITICAL';
  }
  
  if (absVariance >= threshold.warning) {
    return 'WARNING';
  }
  
  return 'OK';
}

/**
 * Get variance results for a shift (read-only).
 */
export async function getVarianceResults(shiftId: string) {
  return db
    .select()
    .from(ingredientVariance)
    .where(eq(ingredientVariance.shiftId, shiftId));
}

/**
 * Get all variances with WARNING or CRITICAL status for a shift.
 */
export async function getFlaggedVariances(shiftId: string) {
  const results = await db
    .select()
    .from(ingredientVariance)
    .where(eq(ingredientVariance.shiftId, shiftId));
  
  return results.filter(r => r.status === 'WARNING' || r.status === 'CRITICAL');
}
