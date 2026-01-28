/**
 * Normalize ingredient cost to THB per base unit (gram/ml/each)
 * Handles packaging items (boxes, bags, packs) and weight/volume units
 */
export function computeUnitCostPerBase(
  costTHB: number,
  packagingQty: number | null,
  unit: string
): number {
  if (!costTHB || costTHB <= 0) return 0;

  const normalizedUnit = unit?.toLowerCase().trim() || '';

  // EACH-based items (packaging, buns, bags, boxes, etc.)
  if (normalizedUnit === 'each' || normalizedUnit === 'pcs' || normalizedUnit === 'piece') {
    if (!packagingQty || packagingQty <= 0) return costTHB;
    return costTHB / packagingQty;
  }

  // Weight-based: kg → grams
  if (normalizedUnit === 'kg') {
    return costTHB / 1000;
  }

  // Weight-based: grams (already base unit)
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    return costTHB;
  }

  // Volume-based: litre → ml
  if (normalizedUnit === 'litre' || normalizedUnit === 'liter' || normalizedUnit === 'l') {
    return costTHB / 1000;
  }

  // Volume-based: ml (already base unit)
  if (normalizedUnit === 'ml') {
    return costTHB;
  }

  // Fallback (no conversion possible)
  return costTHB;
}

/**
 * Parse packaging quantity from text like "10kg bag", "box of 50", "1kg pack"
 * Returns numeric value for division
 */
export function parsePackagingQty(packagingText: string | null): number | null {
  if (!packagingText) return null;
  
  const text = packagingText.toLowerCase().trim();
  
  // Pattern: "box of 50", "pack of 100"
  const ofMatch = text.match(/(?:box|pack|bag|case)\s*(?:of)?\s*(\d+)/i);
  if (ofMatch) return parseFloat(ofMatch[1]);
  
  // Pattern: "50 pcs", "100 each"
  const pcsMatch = text.match(/(\d+)\s*(?:pcs|pieces?|each)/i);
  if (pcsMatch) return parseFloat(pcsMatch[1]);
  
  // Pattern: just a number
  const numMatch = text.match(/^(\d+)$/);
  if (numMatch) return parseFloat(numMatch[1]);
  
  return null;
}

/**
 * Get base unit from unit string
 */
export function getBaseUnit(unit: string | null): string {
  if (!unit) return 'each';
  
  const lower = unit.toLowerCase().trim();
  
  if (lower === 'kg' || lower === 'g' || lower === 'gram' || lower === 'grams') {
    return 'g';
  }
  
  if (lower === 'litre' || lower === 'liter' || lower === 'l' || lower === 'ml') {
    return 'ml';
  }
  
  return 'each';
}
