import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { ingestPosForBusinessDate } from "../services/loyverseIngest";
import { extractFormExpenseTotals, extractPosExpenseTotals } from "../lib/expenseTotals";
import { shiftWindow } from "../services/time/shiftWindow";
import type {
  DailyComparisonResponse,
  DailySource,
  ExpenseItem,
  SalesBreakdown,
  Availability,
} from "../../shared/analysisTypes";

export const analysisDailyReviewRouter = Router();

const THB = (n: number) => Number((n ?? 0).toFixed(2));

// K-4.2: Receipt status types
type ReceiptStatus = 
  | "EVIDENCE_MATCH"      // POS = Cashier
  | "MISSING_RECEIPTS"    // POS > Cashier
  | "PHANTOM_RECEIPTS"    // POS < Cashier
  | "POS_UNAVAILABLE"     // POS missing
  | "FORM_MISSING"        // Cashier missing
  | "NO_EVIDENCE";        // Both missing

interface ReceiptEvidence {
  posReceiptCount: number | null;
  cashierReceiptCount: number | null;
  receiptDifference: number | null;
  receiptStatus: ReceiptStatus;
}

// K-4.1: Fetch POS receipt count from lv_receipt within shift window
async function fetchPosReceiptCount(businessDate: string): Promise<number | null> {
  try {
    const { fromISO, toISO } = shiftWindow(businessDate);
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count 
      FROM lv_receipt 
      WHERE datetime_bkk >= ${fromISO}::timestamptz 
        AND datetime_bkk < ${toISO}::timestamptz`;
    
    const count = Number(result[0]?.count ?? 0);
    if (count === 0) {
      console.log(`[SAFE_FALLBACK_USED] No POS receipts found for ${businessDate}`);
      return null;
    }
    return count;
  } catch (error: any) {
    console.error(`[SAFE_FALLBACK_USED] Error fetching POS receipt count for ${businessDate}:`, error.message);
    return null;
  }
}

// K-4.1: Fetch cashier receipt count from daily_sales_v2
async function fetchCashierReceiptCount(businessDate: string): Promise<number | null> {
  try {
    const { start, end } = dayRange(businessDate);
    const row = await prisma.dailySalesV2.findFirst({
      where: { 
        shift_date: { gte: start, lt: end },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!row) {
      console.log(`[SAFE_FALLBACK_USED] No Daily Sales form found for ${businessDate}`);
      return null;
    }
    
    // Check payload for receipt_count or receiptCount
    const payload = row.payload as any;
    const receiptCount = payload?.receipt_count ?? payload?.receiptCount ?? (row as any).receipt_count ?? null;
    
    // If no explicit receipt count, derive from POS receipt count in form if available
    if (receiptCount === null || receiptCount === undefined) {
      console.log(`[SAFE_FALLBACK_USED] No receipt count field in Daily Sales for ${businessDate}`);
      return null;
    }
    
    return Number(receiptCount);
  } catch (error: any) {
    console.error(`[SAFE_FALLBACK_USED] Error fetching cashier receipt count for ${businessDate}:`, error.message);
    return null;
  }
}

// K-4.2: Derive receipt status from counts
function deriveReceiptStatus(posCount: number | null, cashierCount: number | null): ReceiptStatus {
  if (posCount === null && cashierCount === null) return "NO_EVIDENCE";
  if (posCount === null) return "POS_UNAVAILABLE";
  if (cashierCount === null) return "FORM_MISSING";
  
  const diff = posCount - cashierCount;
  if (diff === 0) return "EVIDENCE_MATCH";
  if (diff > 0) return "MISSING_RECEIPTS";  // POS has more than cashier declared
  return "PHANTOM_RECEIPTS";  // Cashier declared more than POS shows
}

// K-4.1: Build receipt evidence object
async function buildReceiptEvidence(businessDate: string): Promise<ReceiptEvidence> {
  const [posCount, cashierCount] = await Promise.all([
    fetchPosReceiptCount(businessDate),
    fetchCashierReceiptCount(businessDate)
  ]);
  
  const status = deriveReceiptStatus(posCount, cashierCount);
  const diff = (posCount !== null && cashierCount !== null) 
    ? posCount - cashierCount 
    : null;
  
  return {
    posReceiptCount: posCount,
    cashierReceiptCount: cashierCount,
    receiptDifference: diff,
    receiptStatus: status
  };
}

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

// PATCH B: Use receipts as truth for POS availability, not pos_shift_report
function availabilityOf(pos: DailySource | null, form: DailySource | null, hasReceipts?: boolean): Availability {
  const hasPOS = hasReceipts ?? (pos !== null);
  const hasForm = form !== null;
  
  if (!hasPOS && !hasForm) return "missing_both";
  if (!hasPOS) return "missing_pos";
  if (!hasForm) return "missing_form";
  return "ok";
}

analysisDailyReviewRouter.get("/daily-comparison", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Provide date=YYYY-MM-DD" });

  // K-4.1: Fetch all data including receipt evidence in parallel
  const [pos, form, receiptEvidence] = await Promise.all([
    fetchPOSFromDB(date), 
    fetchForm1FromDB(date),
    buildReceiptEvidence(date)
  ]);
  
  // PATCH B: Use receipt count as truth for POS availability
  const hasReceipts = (receiptEvidence.posReceiptCount ?? 0) > 0;
  const availability = availabilityOf(pos, form, hasReceipts);
  
  // PATCH E: Log missing data for debugging
  if (availability !== "ok") {
    console.error('[ANALYSIS_MISSING_DATA]', {
      businessDate: date,
      hasReceipts,
      hasDailySales: form !== null,
      posReceiptCount: receiptEvidence.posReceiptCount,
      availability
    });
  }

  const payload: DailyComparisonResponse & { receiptEvidence?: ReceiptEvidence } = { date, availability };
  if (pos) payload.pos = pos;
  if (form) payload.form = form;
  // Variance requires BOTH pos summary AND form - pos summary may not exist even when receipts do
  if (pos && form) payload.variance = buildVariance(pos, form);
  
  // K-4.1: Always include receipt evidence
  payload.receiptEvidence = receiptEvidence;

  res.json(payload);
});

analysisDailyReviewRouter.get("/daily-comparison-range", async (req, res) => {
  const month = String(req.query.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Provide month=YYYY-MM" });

  const [Y, M] = month.split("-").map((x) => parseInt(x, 10));
  const daysInMonth = new Date(Y, M, 0).getDate();

  const out: (DailyComparisonResponse & { receiptEvidence?: ReceiptEvidence })[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${month}-${String(d).padStart(2, "0")}`;
    // K-4.1: Fetch receipt evidence in parallel with other data
    const [pos, form, receiptEvidence] = await Promise.all([
      fetchPOSFromDB(ds), 
      fetchForm1FromDB(ds),
      buildReceiptEvidence(ds)
    ]);
    
    // PATCH B: Use receipt count as truth for POS availability
    const hasReceipts = (receiptEvidence.posReceiptCount ?? 0) > 0;
    const availability = availabilityOf(pos, form, hasReceipts);

    const entry: DailyComparisonResponse & { receiptEvidence?: ReceiptEvidence } = { date: ds, availability };
    if (pos) entry.pos = pos;
    if (form) entry.form = form;
    // Variance requires BOTH pos summary AND form
    if (pos && form) entry.variance = buildVariance(pos, form);
    
    // K-4.1: Always include receipt evidence
    entry.receiptEvidence = receiptEvidence;

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
// K-2.4: SAFE - Always returns HTTP 200 with status field
analysisDailyReviewRouter.post("/sync-pos-for-date", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.json({ 
      ok: false, 
      status: "INVALID_DATE",
      reason: "Invalid date format. Use YYYY-MM-DD"
    });
  }

  console.log(`📊 [SAFE_FALLBACK_USED] Manual sync requested for ${date}`);
  
  try {
    // Get store ID from environment or default to Smash Brothers Burgers store
    const storeId = process.env.LOYVERSE_STORE_ID || '0c87cebd-e5e5-45b6-b57a-6764b869f38e';
    
    // Call the POS ingestion service
    await ingestPosForBusinessDate(storeId, date);
    
    // Fetch the synced data to return to frontend
    const pos = await fetchPOSFromDB(date);
    const form = await fetchForm1FromDB(date);
    
    // K-2.3: Decision table - always return 200 with appropriate status
    if (pos && form) {
      return res.json({
        ok: true,
        status: "OK",
        reconciled: true,
        message: `Successfully synced and reconciled data for ${date}`,
        date,
        sales: pos.sales.total,
        expenses: pos.expenses.shoppingTotal + pos.expenses.wageTotal + pos.expenses.otherTotal,
      });
    }
    
    if (!pos && form) {
      return res.json({ 
        ok: true,
        status: "PARTIAL_DATA",
        reason: "POS_MISSING",
        message: "Daily Sales form found, but no POS data available for this shift."
      });
    }
    
    if (pos && !form) {
      return res.json({ 
        ok: true,
        status: "PARTIAL_DATA",
        reason: "DAILY_SALES_MISSING",
        message: "POS data synced, but no Daily Sales form submitted for this date.",
        date,
        sales: pos.sales.total,
      });
    }
    
    // Neither POS nor form
    return res.json({ 
      ok: true,
      status: "PARTIAL_DATA",
      reason: "BOTH_MISSING",
      message: "No data found. The shift may not have opened yet or forms not submitted."
    });
    
  } catch (error: any) {
    // K-2.4: Never throw 500 - always return 200 with error info
    console.error(`❌ [SAFE_FALLBACK_USED] Sync error for ${date}:`, error.message);
    return res.json({ 
      ok: false, 
      status: "SYNC_ERROR",
      reason: error.message || "Failed to sync POS data",
      message: "Could not sync with POS system. Data shown may be from cache."
    });
  }
});
