/**
 * VARIANCE ENGINE V2
 * Calculates inventory variance for Rolls, Meat, and Drinks
 */

export function calculateVarianceV2({ sales, stock, purchasedStock }: any) {
  // =========================================================
  // ROLLS VARIANCE
  // =========================================================
  const rollsSold = sales?.salesBreakdown?.burgersSold || 0;
  const rollsExpected = (stock.rollsStart || 0) + (purchasedStock.rolls || 0) - rollsSold;
  const rollsDiff = rollsExpected - (stock.rollsEnd || 0);

  // =========================================================
  // MEAT VARIANCE (in grams)
  // =========================================================
  const meatSoldGrams = rollsSold * 90; // 90g per burger
  const meatExpected = (stock.meatStartGrams || 0) +
                       (purchasedStock.meatGrams || 0) -
                       meatSoldGrams;
  const meatDiff = meatExpected - (stock.meatEndGrams || 0);

  // Convert meat to kg for display
  const meatExpectedKg = (meatExpected / 1000).toFixed(2);
  const meatActualKg = ((stock.meatEndGrams || 0) / 1000).toFixed(2);
  const meatDiffKg = (meatDiff / 1000).toFixed(2);

  // =========================================================
  // DRINKS VARIANCE (per SKU)
  // =========================================================
  const drinksVariance: any = {};
  for (const sku of Object.keys(stock.drinkStockStart || {})) {
    const expected = (stock.drinkStockStart[sku] || 0) +
                     (purchasedStock.drinks?.[sku] || 0) -
                     (sales.drinksSold?.[sku] || 0);
    const diff = expected - (stock.drinkStockEnd[sku] || 0);
    drinksVariance[sku] = {
      expected,
      actual: stock.drinkStockEnd[sku] || 0,
      diff,
    };
  }

  return {
    rolls: { expected: rollsExpected, actual: stock.rollsEnd || 0, diff: rollsDiff },
    meat: { expectedGrams: meatExpected, actualGrams: stock.meatEndGrams || 0, diff: meatDiff, expectedKg: meatExpectedKg, actualKg: meatActualKg, diffKg: meatDiffKg },
    drinks: drinksVariance,
  };
}
