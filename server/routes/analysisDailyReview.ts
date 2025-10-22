import { Router } from "express";
import { prisma } from "../../lib/prisma";
import type {
  DailyComparisonResponse,
  DailySource,
  ExpenseItem,
  SalesBreakdown,
  Availability,
} from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number((n ?? 0).toFixed(2));

async function fetchPOSFromDB(businessDate: string): Promise<DailySource | null> {
  const row = await prisma.posShiftReport.findFirst({
    where: { businessDate: new Date(businessDate) },
  });
  if (!row) return null;

  const cash = row.cashTotal ?? 0;
  const qr = row.qrTotal ?? 0;
  const grab = row.grabTotal ?? 0;
  const other = row.otherTotal ?? 0;
  const total = (row.grandTotal ?? (cash + qr + grab + other)) as number;

  const shopping = row.shoppingTotal ?? 0;
  const wages = row.wagesTotal ?? 0;
  const otherExp = row.otherExpense ?? 0;
  const expensesTotal = shopping + wages + otherExp;
  const startingCash = row.startingCash ?? 0;

  const items: ExpenseItem[] = [
    { id: "shopping", label: "Shopping", amount: shopping, category: "shopping" },
    { id: "wages", label: "Wages", amount: wages, category: "wage" },
  ];
  if (otherExp) items.push({ id: "other", label: "Other", amount: otherExp, category: "other" });

  return {
    date: businessDate,
    sales: { cash, qr, grab, other, total },
    expenses: { shoppingTotal: shopping, wageTotal: wages, otherTotal: otherExp, items },
    banking: {
      startingCash,
      cashPayments: cash,
      qrPayments: qr,
      expensesTotal,
      expectedCash: THB(startingCash + cash - expensesTotal),
      estimatedNetBanked: THB(startingCash + cash - expensesTotal + qr),
    },
  };
}

async function fetchForm1FromDB(businessDate: string): Promise<DailySource | null> {
  const row = await prisma.dailySales.findFirst({
    where: { businessDate: new Date(businessDate) },
  });
  if (!row) return null;

  const cash = row.cashSales ?? 0;
  const qr = row.qrSales ?? 0;
  const grab = row.grabSales ?? 0;
  const other = row.otherSales ?? 0;
  const total = cash + qr + grab + other;

  const shopping = row.shoppingTotal ?? 0;
  const wages = row.wagesTotal ?? 0;
  const otherExp = row.otherExpense ?? 0;
  const expensesTotal = shopping + wages + otherExp;

  const startingCash = row.startingCash ?? 0;

  const items: ExpenseItem[] = [
    { id: "shopping", label: "Shopping", amount: shopping, category: "shopping" },
    { id: "wages", label: "Wages", amount: wages, category: "wage" },
  ];
  if (otherExp) items.push({ id: "other", label: "Other", amount: otherExp, category: "other" });

  return {
    date: businessDate,
    sales: { cash, qr, grab, other, total },
    expenses: { shoppingTotal: shopping, wageTotal: wages, otherTotal: otherExp, items },
    banking: {
      startingCash,
      cashPayments: cash,
      qrPayments: qr,
      expensesTotal,
      expectedCash: THB(startingCash + cash - expensesTotal),
      estimatedNetBanked: THB(startingCash + cash - expensesTotal + qr),
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

function availabilityOf(pos: DailySource | null, form: DailySource | null): Availability {
  if (!pos && !form) return "missing_both";
  if (!pos) return "missing_pos";
  if (!form) return "missing_form";
  return "ok";
}

analysisDailyReviewRouter.get("/daily-comparison", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Provide date=YYYY-MM-DD" });

  const [pos, form] = await Promise.all([fetchPOSFromDB(date), fetchForm1FromDB(date)]);
  const availability = availabilityOf(pos, form);

  const payload: DailyComparisonResponse = { date, availability };
  if (pos) payload.pos = pos;
  if (form) payload.form = form;
  if (availability === "ok") payload.variance = buildVariance(pos!, form!);

  res.json(payload);
});

analysisDailyReviewRouter.get("/daily-comparison-range", async (req, res) => {
  const month = String(req.query.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Provide month=YYYY-MM" });

  const [Y, M] = month.split("-").map((x) => parseInt(x, 10));
  const daysInMonth = new Date(Y, M, 0).getDate();

  const out: DailyComparisonResponse[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${month}-${String(d).padStart(2, "0")}`;
    const [pos, form] = await Promise.all([fetchPOSFromDB(ds), fetchForm1FromDB(ds)]);
    const availability = availabilityOf(pos, form);

    const entry: DailyComparisonResponse = { date: ds, availability };
    if (pos) entry.pos = pos;
    if (form) entry.form = form;
    if (availability === "ok") entry.variance = buildVariance(pos!, form!);

    out.push(entry);
  }

  res.json(out);
});
