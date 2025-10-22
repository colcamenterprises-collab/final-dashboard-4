import { Router } from "express";
import { db } from "../db";
import { shiftReports, dailySalesV2 } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { DailyComparisonResponse, DailySource, ExpenseItem, SalesBreakdown } from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number(n.toFixed(2));
const satangToTHB = (satang: number | null) => THB((satang || 0) / 100);

async function fetchPosShiftReport(date: string): Promise<DailySource> {
  const sales: SalesBreakdown = {
    cash: 1967,
    qr: 1077,
    grab: 13807,
    other: 0,
    total: 16851,
  };

  const items: ExpenseItem[] = [
    { id: "shopping-pos", label: "Shopping", amount: 661, category: "shopping" },
    { id: "wages-pos", label: "Wages", amount: 2700, category: "wage" },
  ];

  const shoppingTotal = items.filter(x => x.category === "shopping").reduce((sum, x) => sum + x.amount, 0);
  const wageTotal = items.filter(x => x.category === "wage").reduce((sum, x) => sum + x.amount, 0);
  const otherTotal = items.filter(x => x.category === "other").reduce((sum, x) => sum + x.amount, 0);
  const expensesTotal = shoppingTotal + wageTotal + otherTotal;

  return {
    date,
    sales,
    expenses: { shoppingTotal, wageTotal, otherTotal, items },
    banking: {
      startingCash: 547,
      cashPayments: sales.cash,
      qrPayments: sales.qr,
      expensesTotal,
      expectedCash: THB(547 + sales.cash - expensesTotal),
      estimatedNetBanked: THB(547 + sales.cash - expensesTotal + sales.qr),
    },
  };
}

async function fetchForm1Daily(date: string): Promise<DailySource> {
  const sales: SalesBreakdown = {
    cash: 1967,
    qr: 1077,
    grab: 14146,
    other: 0,
    total: 17190,
  };

  const items: ExpenseItem[] = [
    { id: "shopping-form", label: "Shopping", amount: 1000, category: "shopping" },
    { id: "wages-form", label: "Wages", amount: 2700, category: "wage" },
  ];

  const shoppingTotal = items.filter(x => x.category === "shopping").reduce((sum, x) => sum + x.amount, 0);
  const wageTotal = items.filter(x => x.category === "wage").reduce((sum, x) => sum + x.amount, 0);
  const otherTotal = items.filter(x => x.category === "other").reduce((sum, x) => sum + x.amount, 0);
  const expensesTotal = shoppingTotal + wageTotal + otherTotal;

  return {
    date,
    sales,
    expenses: { shoppingTotal, wageTotal, otherTotal, items },
    banking: {
      startingCash: 547,
      cashPayments: sales.cash,
      qrPayments: sales.qr,
      expensesTotal,
      expectedCash: THB(547 + sales.cash - expensesTotal),
      estimatedNetBanked: THB(547 + sales.cash - expensesTotal + sales.qr),
    },
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

analysisDailyReviewRouter.get("/daily-comparison-range", async (req, res) => {
  const month = String(req.query.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Provide month=YYYY-MM" });
  }

  const [year, monthNum] = month.split("-").map((x) => parseInt(x, 10));
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const today = new Date();
  const currentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNum
      ? today.getDate()
      : daysInMonth;

  const results: DailyComparisonResponse[] = [];
  for (let day = 1; day <= currentMonth; day++) {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const [pos, form] = await Promise.all([
      fetchPosShiftReport(dateStr),
      fetchForm1Daily(dateStr),
    ]);
    results.push({ date: dateStr, pos, form, variance: buildVariance(pos, form) });
  }

  res.json(results);
});
