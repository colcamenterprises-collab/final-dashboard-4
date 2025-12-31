/**
 * 🔒 POST-SHIFT PROCESSOR
 * 
 * Orchestrates post-shift derivation tasks:
 * 1. Calculate expected ingredient usage
 * 2. Run variance analysis
 * 
 * Trigger this after:
 * - All receipts are ingested for the shift
 * - Daily Stock form is submitted
 */

import { calculateExpectedUsage } from '../services/expectedUsageCalculator';
import { runIngredientVariance } from '../services/ingredientVarianceEngine';

/**
 * Process a completed shift.
 * Runs all post-shift derivation tasks in order.
 */
export async function processShift(shiftId: string): Promise<void> {
  console.log(`[PostShiftProcessor] Starting shift processing: ${shiftId}`);
  
  try {
    await calculateExpectedUsage(shiftId);
    
    await runIngredientVariance(shiftId);
    
    console.log(`[PostShiftProcessor] Completed shift processing: ${shiftId}`);
  } catch (error) {
    console.error(`[PostShiftProcessor] Error processing shift ${shiftId}:`, error);
    throw error;
  }
}

/**
 * Process multiple shifts in sequence.
 */
export async function processShifts(shiftIds: string[]): Promise<void> {
  for (const shiftId of shiftIds) {
    await processShift(shiftId);
  }
}
