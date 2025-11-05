import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ingestPosForBusinessDate } from "../services/loyverseIngest";
import { extractFormExpenseTotals, extractPosExpenseTotals } from "../lib/expenseTotals";
import type {
  DailyComparisonResponse,
  DailySource,
  ExpenseItem,
  SalesBreakdown,
  Availability,
} from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number((n ?? 0).toFixed(2));

// Helper to build [date, date+1) UTC range safely for DATE columns
function dayRange(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function fetchPOSFromDB(businessDate: string): Promise<DailySource | null> {
  const { start, end } = dayRange(businessDate);
  const row = await prisma.posShiftReport.findFirst({
    where: { businessDate: { gte: start, lt: end } },
  });
  if (!row) return null;

  const cash = row.cashTotal ?? 0;
  const qr = row.qrTotal ?? 0;
  const grab = row.grabTotal ?? 0;
  const other = row.otherTotal ?? 0;
  const total = (row.grandTotal ?? (cash + qr + grab + other)) as number;

  const expenseNorms = extractPosExpenseTotals(row);
  const shopping = expenseNorms.shoppingTotal;
  const wages = expenseNorms.wageTotal;
  const otherExp = expenseNorms.otherTotal;
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
      expectedCash: THB(cash - expensesTotal),
      estimatedNetBanked: THB(cash - expensesTotal + qr),
    },
  };
}

async function fetchForm1FromDB(businessDate: string): Promise<DailySource | null> {
  const { start, end } = dayRange(businessDate);
  const row = await prisma.dailySalesV2.findFirst({
    where: { 
      shift_date: { gte: start, lt: end },
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  if (!row) return null;

  // Data is stored in payload JSONB field
  const payload = row.payload as any;
  
  const cash = payload?.cashSales ?? row.cashSales ?? 0;
  const qr = payload?.qrSales ?? row.qrSales ?? 0;
  const grab = payload?.grabSales ?? row.grabSales ?? 0;
  const other = payload?.otherSales ?? row.aroiSales ?? 0;
  const total = payload?.totalSales ?? row.totalSales ?? (cash + qr + grab + other);

  // Use normalizer to extract expense totals (handles columns, payload totals, and arrays)
  const expenseNorms = extractFormExpenseTotals(row);
  const shopping = expenseNorms.shoppingTotal;
  const wages = expenseNorms.wageTotal;
  const otherExp = expenseNorms.otherTotal;
  const expensesTotal = expenseNorms.grandTotal;

  const startingCash = row.startingCash ?? payload?.startingCash ?? 0;

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
      expectedCash: THB(cash - expensesTotal),
      estimatedNetBanked: THB(cash - expensesTotal + qr),
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

// Diagnostic endpoint to help troubleshoot data presence
analysisDailyReviewRouter.get("/diag/day", async (req, res) => {
  const date = String(req.query.date || "").trim();
  const { start, end } = dayRange(date);
  const [posCount, formCount] = await Promise.all([
    prisma.posShiftReport.count({ where: { businessDate: { gte: start, lt: end } } }),
    prisma.dailySalesV2.count({ where: { shift_date: { gte: start, lt: end }, deletedAt: null } }),
  ]);
  res.json({ date, posCount, formCount, start, end });
});

// Manual sync endpoint for Daily Review page
analysisDailyReviewRouter.post("/sync-pos-for-date", async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "Provide date=YYYY-MM-DD" });
    }

    console.log(`📊 Manual sync requested for ${date}`);
    
    // Get store ID from environment or default to Smash Brothers Burgers store
    const storeId = process.env.LOYVERSE_STORE_ID || '0c87cebd-e5e5-45b6-b57a-6764b869f38e';
    
    // Call the POS ingestion service
    await ingestPosForBusinessDate(storeId, date);
    
    // Fetch the synced data to return to frontend
    const pos = await fetchPOSFromDB(date);
    
    if (!pos) {
      return res.json({ 
        ok: false, 
        error: "Sync completed but no POS data found. The shift may not have opened yet." 
      });
    }

    res.json({
      ok: true,
      message: `Successfully synced POS data for ${date}`,
      date: date,
      sales: pos.sales.total,
      expenses: pos.expenses.shoppingTotal + pos.expenses.wageTotal + pos.expenses.otherTotal,
    });
  } catch (error: any) {
    console.error("❌ Sync error:", error);
    res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to sync POS data" 
    });
  }
});
