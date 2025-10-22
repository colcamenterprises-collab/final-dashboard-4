import { Router } from "express";
import type { DailyComparisonResponse, DailySource, ExpenseItem, SalesBreakdown } from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number(n.toFixed(2));

async function fetchPosShiftReport(date: string): Promise<DailySource> {
  const sales: SalesBreakdown = { cash: 1967, qr: 1077, grab: 13807, other: 0, total: 16851 };
  const items: ExpenseItem[] = [
    { id: "s1", label: "Shopping", amount: 661, category: "shopping" },
    { id: "w1", label: "Wages", amount: 2700, category: "wage" },
  ];
  const expensesTotal = 661 + 2700;
  const banking = {
    startingCash: 547,
    cashPayments: sales.cash,
    qrPayments: sales.qr,
    expensesTotal,
    expectedCash: THB(547 + sales.cash - expensesTotal),
    estimatedNetBanked: THB(547 + sales.cash - expensesTotal + sales.qr),
  };
  return {
    date,
    sales,
    expenses: { shoppingTotal: 661, wageTotal: 2700, otherTotal: 0, items },
    banking,
  };
}

async function fetchForm1Daily(date: string): Promise<DailySource> {
  const sales: SalesBreakdown = { cash: 1967, qr: 1077, grab: 14146, other: 0, total: 17190 };
  const items: ExpenseItem[] = [
    { id: "s1", label: "Shopping", amount: 1000, category: "shopping" },
    { id: "w1", label: "Wages", amount: 2700, category: "wage" },
  ];
  const expensesTotal = 1000 + 2700;
  const banking = {
    startingCash: 547,
    cashPayments: sales.cash,
    qrPayments: sales.qr,
    expensesTotal,
    expectedCash: THB(547 + sales.cash - expensesTotal),
    estimatedNetBanked: THB(547 + sales.cash - expensesTotal + sales.qr),
  };
  return {
    date,
    sales,
    expenses: { shoppingTotal: 1000, wageTotal: 2700, otherTotal: 0, items },
    banking,
  };
}

function buildVariance(pos: DailySource, form: DailySource): DailyComparisonResponse["variance"] {
  const diff = (p: number, f: number) => THB(f - p);
  return {
    sales: {
      cash: diff(pos.sales.cash, form.sales.cash),
      qr: diff(pos.sales.qr, form.sales.qr),
      grab: diff(pos.sales.grab, form.sales.grab),
      other: diff(pos.sales.other, form.sales.other),
      total: diff(pos.sales.total, form.sales.total),
    },
    expenses: {
      shoppingTotal: diff(pos.expenses.shoppingTotal, form.expenses.shoppingTotal),
      wageTotal: diff(pos.expenses.wageTotal, form.expenses.wageTotal),
      otherTotal: diff(pos.expenses.otherTotal, form.expenses.otherTotal),
      grandTotal: diff(
        pos.expenses.shoppingTotal + pos.expenses.wageTotal + pos.expenses.otherTotal,
        form.expenses.shoppingTotal + form.expenses.wageTotal + form.expenses.otherTotal
      ),
    },
    banking: {
      expectedCash: diff(pos.banking.expectedCash, form.banking.expectedCash),
      estimatedNetBanked: diff(pos.banking.estimatedNetBanked, form.banking.estimatedNetBanked),
    },
  };
}

analysisDailyReviewRouter.get("/daily-comparison", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date" });

  const [pos, form] = await Promise.all([fetchPosShiftReport(date), fetchForm1Daily(date)]);
  const response: DailyComparisonResponse = { date, pos, form, variance: buildVariance(pos, form) };
  res.json(response);
});
