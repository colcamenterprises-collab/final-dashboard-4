/**
 * Yield Calculation Utility
 * 
 * Two yield methods:
 * - DIRECT: Math is exact (kg, g, ml, each) - straightforward division
 * - ESTIMATED: Requires avg portion size + variance (rasher, slice, ring, fillet)
 */

export type YieldMethod = 'DIRECT' | 'ESTIMATED';

export interface DirectYieldResult {
  method: 'DIRECT';
  unitCostPerBase: number;
  baseUnit: string;
}

export interface EstimatedYieldResult {
  method: 'ESTIMATED';
  avgPortionSize: number;
  portionUnit: string;
  variancePct: number;
  // Yield counts
  yieldCountAvg: number;
  yieldCountMin: number;
  yieldCountMax: number;
  // Cost per portion
  costPerPortionAvg: number;
  costPerPortionMin: number;
  costPerPortionMax: number;
}

export type YieldResult = DirectYieldResult | EstimatedYieldResult | null;

/**
 * Convert purchase unit to base unit quantity
 * kg -> grams, l -> ml, etc.
 */
function convertToBase(qty: number, purchaseUnit: string, baseUnit: string): number {
  const pu = purchaseUnit.toLowerCase();
  const bu = baseUnit.toLowerCase();
  
  // Weight conversions
  if (pu === 'kg' && bu === 'g') return qty * 1000;
  if (pu === 'g' && bu === 'g') return qty;
  
  // Volume conversions
  if ((pu === 'l' || pu === 'litre' || pu === 'liter') && bu === 'ml') return qty * 1000;
  if (pu === 'ml' && bu === 'ml') return qty;
  
  // Each/count (no conversion)
  if (pu === 'each' && bu === 'each') return qty;
  
  // Fallback - no conversion
  return qty;
}

/**
 * Compute yield for DIRECT method
 * Simple: cost / quantity converted to base unit
 */
export function computeDirectYield(
  purchaseCost: number,
  purchaseQty: number,
  purchaseUnit: string,
  baseUnit: string
): DirectYieldResult | null {
  if (!purchaseCost || purchaseCost <= 0) return null;
  if (!purchaseQty || purchaseQty <= 0) return null;
  
  const baseQty = convertToBase(purchaseQty, purchaseUnit, baseUnit);
  if (baseQty <= 0) return null;
  
  return {
    method: 'DIRECT',
    unitCostPerBase: purchaseCost / baseQty,
    baseUnit,
  };
}

/**
 * Compute yield for ESTIMATED method
 * Returns avg/min/max for both yield counts and costs
 */
export function computeEstimatedYield(
  purchaseCost: number,
  purchaseQty: number,
  purchaseUnit: string,
  baseUnit: string,
  avgPortionSize: number,
  portionUnit: string,
  variancePct: number
): EstimatedYieldResult | null {
  if (!purchaseCost || purchaseCost <= 0) return null;
  if (!purchaseQty || purchaseQty <= 0) return null;
  if (!avgPortionSize || avgPortionSize <= 0) return null;
  if (variancePct < 0 || variancePct > 100) return null;
  
  const totalBaseQty = convertToBase(purchaseQty, purchaseUnit, baseUnit);
  if (totalBaseQty <= 0) return null;
  
  // Calculate portion weights with variance
  const minPortionWeight = avgPortionSize * (1 - variancePct / 100);
  const maxPortionWeight = avgPortionSize * (1 + variancePct / 100);
  
  // Yield counts (portions per purchase)
  // Min yield = max portion size (bigger portions = fewer pieces)
  // Max yield = min portion size (smaller portions = more pieces)
  const yieldCountAvg = totalBaseQty / avgPortionSize;
  const yieldCountMin = maxPortionWeight > 0 ? totalBaseQty / maxPortionWeight : 0;
  const yieldCountMax = minPortionWeight > 0 ? totalBaseQty / minPortionWeight : 0;
  
  // Cost per portion
  const costPerPortionAvg = yieldCountAvg > 0 ? purchaseCost / yieldCountAvg : 0;
  const costPerPortionMin = yieldCountMax > 0 ? purchaseCost / yieldCountMax : 0; // Max yield = min cost
  const costPerPortionMax = yieldCountMin > 0 ? purchaseCost / yieldCountMin : 0; // Min yield = max cost
  
  return {
    method: 'ESTIMATED',
    avgPortionSize,
    portionUnit,
    variancePct,
    yieldCountAvg: Math.round(yieldCountAvg * 10) / 10,
    yieldCountMin: Math.round(yieldCountMin * 10) / 10,
    yieldCountMax: Math.round(yieldCountMax * 10) / 10,
    costPerPortionAvg,
    costPerPortionMin,
    costPerPortionMax,
  };
}

/**
 * Main entry point - compute yield based on method
 */
export function computeYield(ingredient: {
  yieldMethod: YieldMethod;
  purchaseCost: number;
  purchaseQty: number;
  purchaseUnit: string;
  baseUnit: string;
  // ESTIMATED fields
  avgPortionSize?: number | null;
  portionUnit?: string | null;
  variancePct?: number | null;
}): YieldResult {
  const { yieldMethod, purchaseCost, purchaseQty, purchaseUnit, baseUnit } = ingredient;
  
  if (yieldMethod === 'DIRECT') {
    return computeDirectYield(purchaseCost, purchaseQty, purchaseUnit, baseUnit);
  }
  
  if (yieldMethod === 'ESTIMATED') {
    if (!ingredient.avgPortionSize || !ingredient.portionUnit) {
      return null; // Missing required ESTIMATED fields
    }
    return computeEstimatedYield(
      purchaseCost,
      purchaseQty,
      purchaseUnit,
      baseUnit,
      ingredient.avgPortionSize,
      ingredient.portionUnit,
      ingredient.variancePct ?? 10 // Default 10% variance
    );
  }
  
  return null;
}

/**
 * Calculate recipe line cost with variance
 * For ESTIMATED ingredients, returns avg/min/max
 */
export function computeLineCost(
  yieldResult: YieldResult,
  quantity: number
): { avg: number; min: number; max: number } | null {
  if (!yieldResult || quantity <= 0) return null;
  
  if (yieldResult.method === 'DIRECT') {
    const cost = yieldResult.unitCostPerBase * quantity;
    return { avg: cost, min: cost, max: cost };
  }
  
  if (yieldResult.method === 'ESTIMATED') {
    return {
      avg: yieldResult.costPerPortionAvg * quantity,
      min: yieldResult.costPerPortionMin * quantity,
      max: yieldResult.costPerPortionMax * quantity,
    };
  }
  
  return null;
}
