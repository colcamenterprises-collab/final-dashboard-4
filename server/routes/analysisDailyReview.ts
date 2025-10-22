import { Router } from "express";
import { db } from "../db";
import { shiftReports, dailySalesV2, shiftSales, shiftPurchases } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { DailyComparisonResponse, DailySource, ExpenseItem, SalesBreakdown, ExpenseItemVariance } from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number(n.toFixed(2));
const satangToTHB = (satang: number | null) => THB((satang || 0) / 100);

async function fetchPosShiftReport(date: string): Promise<DailySource> {
  const shiftReport = await db.select().from(shiftReports).where(eq(shiftReports.reportDate, date)).limit(1);
  
  if (!shiftReport || shiftReport.length === 0) {
    return {
      date,
      sales: { cash: 0, qr: 0, grab: 0, other: 0, total: 0 },
      expenses: { shoppingTotal: 0, wageTotal: 0, otherTotal: 0, items: [] },
      banking: { startingCash: 0, cashPayments: 0, qrPayments: 0, expensesTotal: 0, expectedCash: 0, estimatedNetBanked: 0 },
    };
  }

  const data: any = shiftReport[0].shiftData || {};
  const sales: SalesBreakdown = {
    cash: THB(data.cashSales || 0),
    qr: THB(data.qrSales || 0),
    grab: THB(data.grabSales || 0),
    other: THB((data.aroiSales || 0) + (data.otherSales || 0)),
    total: THB(data.totalSales || 0),
  };

  return {
    date,
    sales,
    expenses: { shoppingTotal: 0, wageTotal: 0, otherTotal: 0, items: [] },
    banking: {
      startingCash: THB(data.startingCash || 0),
      cashPayments: sales.cash,
      qrPayments: sales.qr,
      expensesTotal: 0,
      expectedCash: THB(data.startingCash || 0),
      estimatedNetBanked: THB(data.startingCash || 0) + sales.qr,
    },
  };
}

async function fetchForm1Daily(date: string): Promise<DailySource> {
  const shiftData = await db.select().from(shiftSales).where(eq(shiftSales.shiftDate, date)).limit(1);
  
  if (!shiftData || shiftData.length === 0) {
    return {
      date,
      sales: { cash: 0, qr: 0, grab: 0, other: 0, total: 0 },
      expenses: { shoppingTotal: 0, wageTotal: 0, otherTotal: 0, items: [] },
      banking: { startingCash: 0, cashPayments: 0, qrPayments: 0, expensesTotal: 0, expectedCash: 0, estimatedNetBanked: 0 },
    };
  }

  const shift = shiftData[0];
  const purchases = await db.select().from(shiftPurchases).where(eq(shiftPurchases.shiftSalesId, shift.id));

  const items: ExpenseItem[] = purchases.map((p, idx) => {
    const desc = (p.description || "").toLowerCase();
    let category: "shopping" | "wage" | "other" = "other";
    if (desc.includes("wage") || desc.includes("salary") || desc.includes("staff")) {
      category = "wage";
    } else if (desc.includes("shopping") || desc.includes("ingredient") || desc.includes("food") || desc.includes("supply")) {
      category = "shopping";
    }
    return {
      id: `expense-${p.id}`,
      label: p.description || "Unknown",
      amount: satangToTHB(p.amountSatang),
      category,
    };
  });

  const shoppingTotal = items.filter(x => x.category === "shopping").reduce((sum, x) => sum + x.amount, 0);
  const wageTotal = items.filter(x => x.category === "wage").reduce((sum, x) => sum + x.amount, 0);
  const otherTotal = items.filter(x => x.category === "other").reduce((sum, x) => sum + x.amount, 0);
  const expensesTotal = shoppingTotal + wageTotal + otherTotal;

  const sales: SalesBreakdown = {
    cash: satangToTHB(shift.cashSatang),
    qr: satangToTHB(shift.qrSatang),
    grab: satangToTHB(shift.grabSatang),
    other: satangToTHB(shift.aroiDeeSatang) + satangToTHB(shift.otherSatang),
    total: satangToTHB(shift.cashSatang) + satangToTHB(shift.qrSatang) + satangToTHB(shift.grabSatang) + satangToTHB(shift.aroiDeeSatang) + satangToTHB(shift.otherSatang),
  };

  const banking = {
    startingCash: satangToTHB(shift.startingCashSatang),
    cashPayments: sales.cash,
    qrPayments: sales.qr,
    expensesTotal,
    expectedCash: THB(satangToTHB(shift.startingCashSatang) + sales.cash - expensesTotal),
    estimatedNetBanked: THB(satangToTHB(shift.startingCashSatang) + sales.cash - expensesTotal + sales.qr),
  };

  return {
    date,
    sales,
    expenses: { shoppingTotal, wageTotal, otherTotal, items },
    banking,
  };
}

function buildVariance(pos: DailySource, form: DailySource): DailyComparisonResponse["variance"] {
  const diff = (p: number, f: number) => THB(f - p);
  
  // Build itemized expense variance
  const allExpenseIds = new Set([...pos.expenses.items.map(x => x.id), ...form.expenses.items.map(x => x.id)]);
  const expenseItems = Array.from(allExpenseIds).map(id => {
    const posItem = pos.expenses.items.find(x => x.id === id);
    const formItem = form.expenses.items.find(x => x.id === id);
    const posAmount = posItem?.amount || 0;
    const formAmount = formItem?.amount || 0;
    return {
      id,
      label: posItem?.label || formItem?.label || id,
      category: (posItem?.category || formItem?.category || "other") as "shopping" | "wage" | "other",
      posAmount,
      formAmount,
      variance: diff(posAmount, formAmount),
    };
  });

  return {
    sales: {
      cash: diff(pos.sales.cash, form.sales.cash),
      qr: diff(pos.sales.qr, form.sales.qr),
      grab: diff(pos.sales.grab, form.sales.grab),
      other: diff(pos.sales.other, form.sales.other),
      total: diff(pos.sales.total, form.sales.total),
    },
    expenses: {
      items: expenseItems,
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
