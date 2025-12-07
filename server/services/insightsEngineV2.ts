/**
 * AI INSIGHTS ENGINE V2
 * Generates anomaly insights and risk scoring
 */

export function generateInsightsV2({ sales, stock, purchasedStock, variance, shoppingList }: any) {
  const insights = [];
  const flags = [];

  // Rolls Theft/Anomaly
  if (variance?.rolls && Math.abs(variance.rolls.diff || 0) > 5) {
    flags.push("ROLLS_VARIANCE");
    insights.push({
      type: "rolls",
      severity: Math.abs(variance.rolls.diff || 0) > 20 ? "high" : "medium",
      message: `Rolls variance is ${variance.rolls.diff}. Expected ${variance.rolls.expected}, actual ${variance.rolls.actual}.`
    });
  }

  // Meat anomaly
  if (variance?.meat && Math.abs(variance.meat.diffGrams || 0) > 500) {
    flags.push("MEAT_VARIANCE");
    insights.push({
      type: "meat",
      severity: Math.abs(variance.meat.diffGrams || 0) > 1500 ? "high" : "medium",
      message: `Meat variance is ${variance.meat.diffKg} kg.`
    });
  }

  // Drinks anomaly per SKU
  if (variance?.drinks) {
    Object.entries(variance.drinks).forEach(([sku, d]: any) => {
      if (Math.abs(d.diff || 0) > 3) {
        flags.push("DRINK_VARIANCE");
        insights.push({
          type: "drinks",
          severity: Math.abs(d.diff || 0) > 10 ? "high" : "medium",
          message: `Drink variance on ${sku}: expected ${d.expected}, actual ${d.actual} (diff ${d.diff}).`
        });
      }
    });
  }

  // Shopping List anomaly
  if ((shoppingList?.length || 0) === 0) {
    flags.push("NO_SHOPPING_LIST");
    insights.push({
      type: "shoppingList",
      severity: "medium",
      message: "No shopping list generated for this shift."
    });
  }

  // Total risk score (0-100)
  const riskScore = Math.min(100, flags.length * 20);

  return { riskScore, insights, flags };
}
