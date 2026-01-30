/**
 * Compute unit cost per base unit using explicit baseYieldQty
 * NO text parsing - calculations rely on numeric fields only
 * Returns null if required data is missing (fails loudly)
 */
export function computeUnitCostPerBase(
  purchaseCost: number | null | undefined,
  baseYieldQty: number | null | undefined
): number | null {
  // Fail loudly if missing required data
  if (!purchaseCost || purchaseCost <= 0) return null;
  if (!baseYieldQty || baseYieldQty <= 0) return null;
  
  return purchaseCost / baseYieldQty;
}

/**
 * Compute portion cost from unit cost and portion quantity
 */
export function computePortionCost(
  unitCostPerBase: number | null | undefined,
  portionQty: number | null | undefined
): number | null {
  if (!unitCostPerBase || unitCostPerBase <= 0) return null;
  if (!portionQty || portionQty <= 0) return null;
  
  return unitCostPerBase * portionQty;
}

/**
 * Check if base unit and portion unit are compatible
 * g/ml can only match g/ml, each can only match each
 */
export function checkUnitCompatibility(
  baseUnit: string | null | undefined,
  portionUnit: string | null | undefined
): { compatible: boolean; warning?: string } {
  if (!baseUnit || !portionUnit) {
    return { compatible: false, warning: "Missing unit information" };
  }
  
  const normalizedBase = baseUnit.toLowerCase().trim();
  const normalizedPortion = portionUnit.toLowerCase().trim();
  
  // g/grams can match g/grams
  const isBaseGrams = ['g', 'gram', 'grams'].includes(normalizedBase);
  const isPortionGrams = ['g', 'gram', 'grams'].includes(normalizedPortion);
  
  // ml can match ml
  const isBaseMl = ['ml', 'milliliter', 'milliliters'].includes(normalizedBase);
  const isPortionMl = ['ml', 'milliliter', 'milliliters'].includes(normalizedPortion);
  
  // each/pcs can match each/pcs
  const isBaseEach = ['each', 'pcs', 'piece', 'pieces'].includes(normalizedBase);
  const isPortionEach = ['each', 'pcs', 'piece', 'pieces'].includes(normalizedPortion);
  
  if (isBaseGrams && isPortionGrams) return { compatible: true };
  if (isBaseMl && isPortionMl) return { compatible: true };
  if (isBaseEach && isPortionEach) return { compatible: true };
  
  // Mismatch detected
  return { 
    compatible: false, 
    warning: `Unit mismatch: base is ${baseUnit}, portion is ${portionUnit}` 
  };
}

/**
 * Get normalized base unit type
 */
export function getBaseUnit(unit: string | null): 'g' | 'ml' | 'each' {
  if (!unit) return 'each';
  
  const lower = unit.toLowerCase().trim();
  
  if (['g', 'gram', 'grams', 'kg'].includes(lower)) {
    return 'g';
  }
  
  if (['ml', 'milliliter', 'milliliters', 'l', 'litre', 'liter'].includes(lower)) {
    return 'ml';
  }
  
  return 'each';
}
