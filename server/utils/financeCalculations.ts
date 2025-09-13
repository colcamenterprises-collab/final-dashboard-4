interface Totals {
  direct: number;
  business: number;
  stock: number;
}

interface FinanceInput {
  sales: number;
  cogs: number;
  labor: number;
  totals: Totals;
}

export interface FinanceResult {
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  primeCostPct: number;
  foodCostPct: number;
  laborPct: number;
  netMarginPct: number;
  breakdown: Totals;
}

export function calculateFinance(input: FinanceInput): FinanceResult {
  const { sales, cogs, labor, totals } = input;
  const safeSales = sales || 0;
  const grossProfit = safeSales - cogs;

  const totalExpenses = (totals.direct || 0) + (totals.business || 0) + (totals.stock || 0);
  const netProfit = safeSales - (cogs + labor + totalExpenses);

  const pct = (num: number, denom: number) =>
    denom > 0 ? parseFloat(((num / denom) * 100).toFixed(2)) : 0;

  return {
    sales: safeSales,
    cogs,
    grossProfit,
    expenses: totalExpenses + labor,
    netProfit,
    primeCostPct: pct(cogs + labor, safeSales),
    foodCostPct: pct(cogs, safeSales),
    laborPct: pct(labor, safeSales),
    netMarginPct: pct(netProfit, safeSales),
    breakdown: totals,
  };
}