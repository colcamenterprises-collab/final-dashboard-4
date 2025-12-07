/**
 * SECURITY & THEFT DETECTION ENGINE V2
 * Performs detection of suspicious patterns
 */

export function detectSecurityRisksV2({ sales, stock, purchasedStock, variance, insights }: any) {
  const risks = [];
  const flags = [];

  // Rolls Theft Detection
  if (variance?.rolls) {
    const diff = variance.rolls.diff || 0;
    if (diff < -10) {
      risks.push({
        type: "ROLLS_MISSING",
        severity: Math.abs(diff) > 25 ? "critical" : "high",
        message: `Rolls shortfall of ${Math.abs(diff)} units indicates possible misuse or theft.`
      });
      flags.push("ROLLS_MISSING");
    }
  }

  // Meat Theft Detection
  if (variance?.meat) {
    const diffG = variance.meat.diffGrams || 0;
    if (diffG < -800) {
      risks.push({
        type: "MEAT_MISSING",
        severity: Math.abs(diffG) > 2000 ? "critical" : "high",
        message: `Meat variance of ${Math.abs(diffG)}g indicates possible movement without sale.`
      });
      flags.push("MEAT_MISSING");
    }
  }

  // Drinks Theft Detection
  if (variance?.drinks) {
    for (const [sku, d] of Object.entries(variance.drinks) as [string, any][]) {
      if ((d.diff || 0) < -5) {
        risks.push({
          type: "DRINKS_MISSING",
          severity: Math.abs(d.diff || 0) > 15 ? "critical" : "medium",
          message: `Drink shortfall: ${sku} is short by ${Math.abs(d.diff || 0)} units.`
        });
        flags.push("DRINKS_MISSING");
      }
    }
  }

  // Expense-Stock Mismatch
  if ((purchasedStock?.rolls || 0) > 0 && (stock?.rollsEnd || 0) === 0) {
    risks.push({
      type: "ROLLS_PURCHASE_MISMATCH",
      severity: "high",
      message: `Rolls purchased but not reflected in stock count.`
    });
    flags.push("ROLLS_PURCHASE_MISMATCH");
  }

  if ((purchasedStock?.meatGrams || 0) > 0 && (stock?.meatEndGrams || 0) === 0) {
    risks.push({
      type: "MEAT_PURCHASE_MISMATCH",
      severity: "high",
      message: `Meat purchased but meat stock shows zero.`
    });
    flags.push("MEAT_PURCHASE_MISMATCH");
  }

  // Combine overall risk score
  const riskScore = Math.min(100, flags.length * 20);

  return { riskScore, risks, flags };
}
