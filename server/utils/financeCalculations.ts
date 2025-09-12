export interface FinanceInput {
  sales: number; // THB (not cents)
  cogs: number; // THB (not cents)
  labor: number; // THB (not cents)
  occupancy: number; // THB (not cents)
  expenses: number; // THB (not cents)
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
  occupancyPct: number;
  netMarginPct: number;
}

export function calculateFinance(input: FinanceInput): FinanceResult {
  const { sales, cogs, labor, occupancy, expenses } = input;

  const safeSales = sales || 0;
  const safeCogs = cogs || 0;
  const safeLabor = labor || 0;
  const safeOccupancy = occupancy || 0;
  const safeExpenses = expenses || 0;

  const grossProfit = safeSales - safeCogs;
  const netProfit = safeSales - (safeCogs + safeLabor + safeOccupancy + safeExpenses);

  const pct = (num: number, denom: number) =>
    denom > 0 ? parseFloat(((num / denom) * 100).toFixed(2)) : 0;

  return {
    sales: safeSales,
    cogs: safeCogs,
    grossProfit,
    expenses: safeExpenses + safeLabor + safeOccupancy,
    netProfit,
    primeCostPct: pct(safeCogs + safeLabor, safeSales),
    foodCostPct: pct(safeCogs, safeSales),
    laborPct: pct(safeLabor, safeSales),
    occupancyPct: pct(safeOccupancy, safeSales),
    netMarginPct: pct(netProfit, safeSales),
  };
}