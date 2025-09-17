// Utility functions for ingredient packaging calculations

export interface PackagingInfo {
  numericValue: number;
  unit: string;
  originalText: string;
}

export interface CalculatedIngredient {
  packageCost: number;
  packageSize: PackagingInfo;
  portionSize: PackagingInfo;
  unitPrice: number; // cost per base unit (e.g., per gram, per can)
  costPerPortion: number; // cost for one menu portion
  calculationNote?: string;
}

/**
 * Parse packaging quantity text to extract numeric value and unit
 * Examples: "Per kg" -> {numericValue: 1000, unit: "grams", originalText: "Per kg"}
 *           "6 Cans" -> {numericValue: 6, unit: "cans", originalText: "6 Cans"}
 *           "300g" -> {numericValue: 300, unit: "grams", originalText: "300g"}
 */
export function parsePackagingQuantity(text: string): PackagingInfo {
  if (!text || text.trim() === '') {
    return { numericValue: 1, unit: 'unit', originalText: text };
  }

  const cleaned = text.toLowerCase().trim();
  
  // Handle "per kg" or "per kilogram"
  if (cleaned.includes('per kg') || cleaned.includes('per kilogram')) {
    return { numericValue: 1000, unit: 'grams', originalText: text };
  }
  
  // Handle "per litre" or "per liter"
  if (cleaned.includes('per litre') || cleaned.includes('per liter') || cleaned.includes('per l')) {
    return { numericValue: 1000, unit: 'ml', originalText: text };
  }
  
  // Extract numbers and units from text like "6 Cans", "300g", "1 litre"
  const numberMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  const number = numberMatch ? parseFloat(numberMatch[1]) : 1;
  
  // Determine unit based on text content
  let unit = 'unit';
  let numericValue = number;
  
  if (cleaned.includes('can') || cleaned.includes('bottle')) {
    unit = 'each';
    numericValue = number;
  } else if (cleaned.includes('kg') || cleaned.includes('kilogram')) {
    unit = 'grams';
    numericValue = number * 1000; // Convert to grams
  } else if (cleaned.includes('g') && !cleaned.includes('kg')) {
    unit = 'grams';
    numericValue = number;
  } else if (cleaned.includes('ml') || cleaned.includes('millilitre')) {
    unit = 'ml';
    numericValue = number;
  } else if (cleaned.includes('l') || cleaned.includes('litre') || cleaned.includes('liter')) {
    unit = 'ml';
    numericValue = number * 1000; // Convert to ml
  } else if (cleaned.includes('pack') || cleaned.includes('piece') || cleaned.includes('each')) {
    unit = 'each';
    numericValue = number;
  }
  
  return { numericValue, unit, originalText: text };
}

/**
 * Parse portion size text to extract numeric value and unit
 * Examples: "95 gr" -> {numericValue: 95, unit: "grams", originalText: "95 gr"}
 *           "Each" -> {numericValue: 1, unit: "each", originalText: "Each"}
 *           "30g" -> {numericValue: 30, unit: "grams", originalText: "30g"}
 */
export function parsePortionSize(text: string): PackagingInfo {
  if (!text || text.trim() === '') {
    return { numericValue: 1, unit: 'unit', originalText: text };
  }

  const cleaned = text.toLowerCase().trim();
  
  // Handle "each" or similar
  if (cleaned === 'each' || cleaned === 'per' || cleaned === '1') {
    return { numericValue: 1, unit: 'each', originalText: text };
  }
  
  // Extract numbers and units
  const numberMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  const number = numberMatch ? parseFloat(numberMatch[1]) : 1;
  
  // Determine unit
  let unit = 'unit';
  let numericValue = number;
  
  if (cleaned.includes('gr') || cleaned.includes('g') || cleaned.includes('gram')) {
    unit = 'grams';
    numericValue = number;
  } else if (cleaned.includes('ml') || cleaned.includes('millilitre')) {
    unit = 'ml';
    numericValue = number;
  } else if (cleaned.includes('each') || cleaned.includes('piece') || cleaned.includes('can') || cleaned.includes('bottle')) {
    unit = 'each';
    numericValue = number;
  } else if (cleaned.includes('kg') || cleaned.includes('kilogram')) {
    unit = 'grams';
    numericValue = number * 1000;
  } else if (cleaned.includes('l') || cleaned.includes('litre') || cleaned.includes('liter')) {
    unit = 'ml';
    numericValue = number * 1000;
  }
  
  return { numericValue, unit, originalText: text };
}

/**
 * Calculate unit price and cost per portion for an ingredient
 */
export function calculateIngredientCosts(
  costString: string,
  packagingQty: string,
  averageMenuPortion: string
): CalculatedIngredient {
  // Parse package cost - extract number from currency string like "฿319.00"
  const packageCost = parseFloat(costString.replace(/[^\d.]/g, '') || '0');
  
  // Parse packaging and portion information
  const packageSize = parsePackagingQuantity(packagingQty);
  const portionSize = parsePortionSize(averageMenuPortion);
  
  let unitPrice = 0;
  let costPerPortion = 0;
  let calculationNote = '';
  
  // Calculate unit price (cost per base unit)
  if (packageSize.numericValue > 0) {
    unitPrice = packageCost / packageSize.numericValue;
  }
  
  // Calculate cost per portion
  if (unitPrice > 0 && portionSize.numericValue > 0) {
    // If units match, direct calculation
    if (packageSize.unit === portionSize.unit) {
      costPerPortion = unitPrice * portionSize.numericValue;
    } else if (packageSize.unit === 'each' && portionSize.unit === 'each') {
      // Both are "each" - direct calculation
      costPerPortion = unitPrice * portionSize.numericValue;
    } else if (packageSize.unit === 'grams' && portionSize.unit === 'grams') {
      // Both are grams - direct calculation
      costPerPortion = unitPrice * portionSize.numericValue;
    } else if (packageSize.unit === 'ml' && portionSize.unit === 'ml') {
      // Both are ml - direct calculation  
      costPerPortion = unitPrice * portionSize.numericValue;
    } else {
      // Units don't match - note the issue
      calculationNote = `Unit mismatch: package is ${packageSize.unit}, portion is ${portionSize.unit}`;
      costPerPortion = 0;
    }
  }
  
  // Add calculation notes
  if (!calculationNote) {
    calculationNote = `${THB(packageCost)} ÷ ${packageSize.numericValue} ${packageSize.unit} = ${THB(unitPrice)}/${packageSize.unit}`;
    if (costPerPortion > 0) {
      calculationNote += `, ${portionSize.numericValue} ${portionSize.unit} × ${THB(unitPrice)} = ${THB(costPerPortion)}`;
    }
  }
  
  return {
    packageCost,
    packageSize,
    portionSize,
    unitPrice,
    costPerPortion,
    calculationNote
  };
}

/**
 * Format currency in Thai Baht
 */
export const THB = (n: number) => 
  new Intl.NumberFormat("th-TH", { 
    style: "currency", 
    currency: "THB", 
    maximumFractionDigits: 3 
  }).format(n || 0);

/**
 * Format unit price with appropriate precision
 */
export function formatUnitPrice(unitPrice: number, unit: string): string {
  if (unitPrice < 0.01) {
    return `${THB(unitPrice * 1000)}/1000${unit}`;
  } else if (unitPrice < 1) {
    return `${THB(unitPrice * 100)}/100${unit}`;
  } else {
    return `${THB(unitPrice)}/${unit}`;
  }
}