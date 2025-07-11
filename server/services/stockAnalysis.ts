interface StockCounts {
  burgerBunsUsed: number;
  meatUsedGrams: number;
  drinksUsed: number;
}

interface StockForm {
  burgerBunsStock: number;
  meatWeight: number;
  drinkStockCount: number;
}

interface DiscrepancyResult {
  item: string;
  expected: number;
  actual: number;
  difference: number;
  threshold: number;
  isOutOfBounds: boolean;
  alert: string | null;
}

export const getExpectedStockFromReceipts = async (receipts: any[]): Promise<StockCounts> => {
  let burgerCount = 0;
  let pattyCount = 0;
  let drinkCount = 0;

  for (const receipt of receipts) {
    for (const item of receipt.line_items || []) {
      const name = item.variant_name?.toLowerCase() || "";
      const qty = item.quantity || 1;

      if (name.includes("burger")) {
        burgerCount += qty;
        // Estimate patties per burger by name
        if (name.includes("double")) pattyCount += 2 * qty;
        else if (name.includes("triple")) pattyCount += 3 * qty;
        else pattyCount += qty;
      }

      if (name.includes("drink") || name.includes("soda") || name.includes("coke")) {
        drinkCount += qty;
      }

      // Optional: detect combo meals and parse inner modifiers if needed
    }
  }

  return {
    burgerBunsUsed: burgerCount,
    meatUsedGrams: pattyCount * 90,
    drinksUsed: drinkCount
  };
};

export const analyzeStockDiscrepancy = (expected: StockCounts, actual: StockForm): DiscrepancyResult[] => {
  const results: DiscrepancyResult[] = [];

  const bunStart = 100; // replace with dynamic start tracking later
  const meatStart = 10000; // in grams
  const drinkStart = 50;

  const bunOrdered = Number(actual["rollsOrderedCount"]) || 0;
  const meatOrdered = 0; // Update if tracked
  const drinksOrdered = 0; // Update if tracked

  const bunEnd = Number(actual["burgerBunsStock"]) || 0;
  const meatEnd = Number(actual["meatWeight"]) || 0;
  const drinkEnd = Number(actual["drinkStockCount"]) || 0;

  const actualUsedBuns = bunStart + bunOrdered - bunEnd;
  const actualUsedMeat = meatStart + meatOrdered - meatEnd;
  const actualUsedDrinks = drinkStart + drinksOrdered - drinkEnd;

  const thresholds = {
    buns: 5,
    meat: 500,
    drinks: 3
  };

  results.push({
    item: "Burger Buns",
    expected: expected.burgerBunsUsed,
    actual: actualUsedBuns,
    difference: actualUsedBuns - expected.burgerBunsUsed,
    threshold: thresholds.buns,
    isOutOfBounds: Math.abs(actualUsedBuns - expected.burgerBunsUsed) > thresholds.buns,
    alert: Math.abs(actualUsedBuns - expected.burgerBunsUsed) > thresholds.buns
      ? `Discrepancy in buns: ${actualUsedBuns - expected.burgerBunsUsed}`
      : null
  });

  results.push({
    item: "Meat (grams)",
    expected: expected.meatUsedGrams,
    actual: actualUsedMeat,
    difference: actualUsedMeat - expected.meatUsedGrams,
    threshold: thresholds.meat,
    isOutOfBounds: Math.abs(actualUsedMeat - expected.meatUsedGrams) > thresholds.meat,
    alert: Math.abs(actualUsedMeat - expected.meatUsedGrams) > thresholds.meat
      ? `Discrepancy in meat: ${actualUsedMeat - expected.meatUsedGrams}g`
      : null
  });

  results.push({
    item: "Drinks",
    expected: expected.drinksUsed,
    actual: actualUsedDrinks,
    difference: actualUsedDrinks - expected.drinksUsed,
    threshold: thresholds.drinks,
    isOutOfBounds: Math.abs(actualUsedDrinks - expected.drinksUsed) > thresholds.drinks,
    alert: Math.abs(actualUsedDrinks - expected.drinksUsed) > thresholds.drinks
      ? `Discrepancy in drinks: ${actualUsedDrinks - expected.drinksUsed}`
      : null
  });

  return results;
};
