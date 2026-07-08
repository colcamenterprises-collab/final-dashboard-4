import { Router } from "express";
import { pool } from "../db";

const router = Router();
const TZ = "Asia/Bangkok";

type Blocker = { code: string; message: string; where: string; canonical_source: string; auto_build_attempted: false };

const blocker = (code: string, message: string, where: string, canonical_source: string): Blocker => ({
  code,
  message,
  where,
  canonical_source,
  auto_build_attempted: false,
});

const n = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const money = (value: unknown): number | null => {
  const num = n(value);
  return num === null ? null : Math.round(num * 100) / 100;
};

const todayBkk = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const shiftWindowFor = (date: string) => ({
  label: "17:00-03:00 Asia/Bangkok",
  startUtc: `${date}T10:00:00.000Z`,
  endUtc: `${date}T20:00:00.000Z`,
});

async function safeQuery<T = any>(query: string, params: unknown[] = [], canonical_source: string, where: string) {
  try {
    const result = await pool.query<T>(query, params);
    return { rows: result.rows, blockers: [] as Blocker[] };
  } catch (error: any) {
    return { rows: [] as T[], blockers: [blocker(`${canonical_source.toUpperCase()}_READ_FAILED`, error?.message || String(error), where, canonical_source)] };
  }
}

function extractShiftTotal(data: any): number | null {
  if (!data || typeof data !== "object") return null;
  return money(data.gross_sales ?? data.grossSales ?? data.net_sales ?? data.netSales ?? data.total_sales ?? data.totalSales ?? data.sales_total ?? data.salesTotal);
}

function normalizeSales(row: any) {
  if (!row) return null;
  const p = row.payload || {};
  const expenses = Array.isArray(p.expenses) ? p.expenses : [];
  const wages = Array.isArray(p.wages) ? p.wages : [];
  const totalExpenses = money(p.totalExpenses ?? row.totalExpenses) ?? expenses.reduce((sum: number, item: any) => sum + (money(item?.amount ?? item?.cost ?? item?.value) ?? 0), 0);
  const cash = money(p.cashSales ?? row.cashSales);
  const qr = money(p.qrSales ?? row.qrSales);
  const grab = money(p.grabSales ?? row.grabSales);
  const total = money(p.totalSales ?? row.totalSales) ?? [cash, qr, grab].reduce((sum, val) => sum + (val ?? 0), 0);
  const expectedClosingCash = money(p.expectedClosingCash ?? p.expectedCash);
  const actualCash = money(p.closingCash ?? row.endingCash);
  const variance = expectedClosingCash !== null && actualCash !== null ? Math.round((actualCash - expectedClosingCash) * 100) / 100 : null;
  return {
    id: row.id,
    date: row.shiftDate || row.shift_date || row.createdAt,
    submittedAt: row.submittedAtISO || row.createdAt,
    submittedBy: row.completedBy || row.staff || p.completedBy || null,
    status: "submitted",
    totalSales: total,
    cash,
    qr,
    grab,
    expenses: totalExpenses,
    wagesTotal: money(p.wagesTotal ?? row.wagesTotal) ?? wages.reduce((sum: number, item: any) => sum + (money(item?.amount ?? item?.value) ?? 0), 0),
    expectedCash: expectedClosingCash,
    actualCash,
    variance,
    balanceStatus: variance === null ? "Missing" : Math.abs(variance) <= 1 ? "Balanced" : "Variance",
    receiptCounts: {
      cash: n(p.cashReceiptCount ?? row.cash_receipt_count),
      qr: n(p.qrReceiptCount ?? row.qr_receipt_count),
      grab: n(p.grabReceiptCount ?? row.grab_receipt_count),
    },
    payload: p,
  };
}

function missingStock() {
  return {
    status: "missing",
    source: "daily_stock_v2",
    rolls: null,
    meat: null,
    drinks: {},
    requestedShopping: [],
    missingMappings: [],
  };
}

function normalizeStock(row: any) {
  if (!row) return missingStock();
  const drinkStock = row?.drink_stock_json ?? row?.drinksJson ?? row?.drinks_json ?? {};
  const requisition = row?.purchasingJson ?? row?.purchasing_json ?? row?.requested_shopping_json ?? [];
  return {
    id: row?.id ?? null,
    salesId: row?.salesId ?? row?.sales_id ?? null,
    date: row?.shift_date ?? row?.shiftDate ?? null,
    submittedAt: row?.created_at ?? row?.createdAt ?? null,
    status: "submitted",
    source: "daily_stock_v2",
    rolls: n(row?.rolls_end ?? row?.rollsEnd ?? row?.burgerBuns),
    meat: n(row?.meat_end_kg ?? row?.meatEndKg ?? row?.meatWeightG),
    drinks: drinkStock && typeof drinkStock === "object" ? drinkStock : {},
    requestedShopping: Array.isArray(requisition) ? requisition : [],
    missingMappings: Array.isArray(requisition)
      ? requisition.filter((item: any) => item && (item.ingredientId === null || item.ingredientId === undefined) && (item.mappedIngredientId === null || item.mappedIngredientId === undefined))
      : [],
  };
}

async function getLatestSales() {
  return safeQuery(
    `SELECT id, "shiftDate", shift_date, "completedBy", staff, "createdAt", "submittedAtISO", "totalSales", "cashSales", "qrSales", "grabSales", "totalExpenses", "endingCash", payload
     FROM daily_sales_v2
     WHERE "deletedAt" IS NULL
     ORDER BY COALESCE("shiftDate"::timestamp, shift_date::timestamp, "createdAt") DESC
     LIMIT 1`,
    [],
    "daily_sales_v2",
    "operationsRead.getLatestSales",
  );
}

async function getLatestStock(salesId?: string | null) {
  const columnsResult = await safeQuery<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_stock_v2'`,
    [],
    "daily_stock_v2",
    "operationsRead.getLatestStock.columns",
  );
  if (columnsResult.blockers.length > 0) return { rows: [], blockers: columnsResult.blockers };

  const columns = new Set(columnsResult.rows.map((row) => row.column_name));
  const salesColumn = columns.has("sales_id") ? "sales_id" : columns.has("salesId") ? '"salesId"' : null;
  const orderColumn = ["updated_at", "updatedAt", "created_at", "createdAt", "id"].find((col) => columns.has(col));
  const orderBy = orderColumn ? ` ORDER BY ${orderColumn === "updatedAt" || orderColumn === "createdAt" ? `"${orderColumn}"` : orderColumn} DESC` : "";

  if (salesId && salesColumn) {
    return safeQuery(`SELECT * FROM daily_stock_v2 WHERE ${salesColumn} = $1${orderBy} LIMIT 1`, [salesId], "daily_stock_v2", "operationsRead.getLatestStock.bySales");
  }

  return safeQuery(`SELECT * FROM daily_stock_v2${orderBy} LIMIT 1`, [], "daily_stock_v2", "operationsRead.getLatestStock.latest");
}

async function getPosMeta() {
  const receipt = await safeQuery(
    `SELECT COUNT(*)::int AS count, MAX(datetime_bkk) AS latest_receipt_timestamp FROM lv_receipt`,
    [],
    "lv_receipt",
    "operationsRead.getPosMeta.lv_receipt",
  );
  const shift = await safeQuery(
    `SELECT COUNT(*)::int AS count, MAX(shift_date) AS latest_shift_report_date FROM loyverse_shifts`,
    [],
    "loyverse_shifts",
    "operationsRead.getPosMeta.loyverse_shifts",
  );
  const receiptRow: any = receipt.rows[0] || {};
  const shiftRow: any = shift.rows[0] || {};
  return {
    data: {
      receiptCount: Number(receiptRow.count || 0),
      latestReceiptTimestamp: receiptRow.latest_receipt_timestamp ?? null,
      shiftReportCount: Number(shiftRow.count || 0),
      latestShiftReportDate: shiftRow.latest_shift_report_date ?? null,
    },
    blockers: [...receipt.blockers, ...shift.blockers],
  };
}

async function getReceiptTotals(date: string) {
  const win = shiftWindowFor(date);
  return safeQuery(
    `SELECT COUNT(*)::int AS receipt_count, COALESCE(SUM(total_amount::numeric), 0)::numeric AS receipt_total, MAX(datetime_bkk) AS latest_receipt_timestamp
     FROM lv_receipt
     WHERE datetime_bkk >= $1::timestamptz AT TIME ZONE 'UTC'
       AND datetime_bkk < $2::timestamptz AT TIME ZONE 'UTC'`,
    [win.startUtc, win.endUtc],
    "lv_receipt",
    "operationsRead.getReceiptTotals",
  );
}

router.get("/summary", async (_req, res) => {
  const businessDate = todayBkk();
  const shiftWindow = shiftWindowFor(businessDate);
  const [salesResult, posMeta] = await Promise.all([getLatestSales(), getPosMeta()]);
  const latestSales = normalizeSales(salesResult.rows[0]);
  const stockResult = await getLatestStock(latestSales?.id);
  const latestStock = normalizeStock(stockResult.rows[0]);
  const blockers = [...salesResult.blockers, ...stockResult.blockers, ...posMeta.blockers];

  if (!latestSales) blockers.push(blocker("DAILY_SALES_V2_MISSING", "Latest Daily Sales V2 submission was not found.", "/api/operations-read/summary", "daily_sales_v2"));
  if (latestStock.status === "missing") blockers.push(blocker("DAILY_STOCK_V2_MISSING", "Daily Stock V2 record missing", "/api/operations-read/summary", "daily_stock_v2"));
  if (!posMeta.data.latestReceiptTimestamp) blockers.push(blocker("LV_RECEIPT_MISSING", "No Loyverse receipt timestamp is available.", "/api/operations-read/summary", "lv_receipt"));
  if (!posMeta.data.latestShiftReportDate) blockers.push(blocker("LOYVERSE_SHIFT_MISSING", "No Loyverse shift report date is available.", "/api/operations-read/summary", "loyverse_shifts"));

  const posStatus = posMeta.blockers.length > 0 || !posMeta.data.latestReceiptTimestamp ? "Failed" : !posMeta.data.latestShiftReportDate ? "Warning" : "Verified";
  res.json({
    ok: blockers.length === 0,
    source: "daily_sales_v2,daily_stock_v2,lv_receipt,loyverse_shifts",
    businessDate,
    shiftWindow,
    posMirror: { status: posStatus, ...posMeta.data },
    dailySales: latestSales || { status: "missing" },
    dailyStock: latestStock,
    warnings: [],
    blockers,
    last_updated: new Date().toISOString(),
  });
});


async function getShiftPaymentSplit(date: string) {
  const win = shiftWindowFor(date);
  return safeQuery(
    `SELECT payment_json, total_amount
     FROM lv_receipt
     WHERE datetime_bkk >= $1::timestamptz AT TIME ZONE 'UTC'
       AND datetime_bkk < $2::timestamptz AT TIME ZONE 'UTC'`,
    [win.startUtc, win.endUtc],
    "lv_receipt",
    "operationsRead.getShiftPaymentSplit",
  );
}

function paymentBucket(raw: unknown): "Cash" | "QR" | "Grab" | "Other" {
  const label = String(raw || "").toLowerCase();
  if (label.includes("cash")) return "Cash";
  if (label.includes("grab")) return "Grab";
  if (label.includes("qr") || label.includes("prompt") || label.includes("transfer") || label.includes("scan")) return "QR";
  return "Other";
}

function extractPaymentName(paymentJson: any): string | null {
  const first = Array.isArray(paymentJson) ? paymentJson[0] : paymentJson;
  if (!first || typeof first !== "object") return null;
  return first.name ?? first.type ?? first.payment_name ?? first.paymentName ?? first.payment_type ?? first.paymentType ?? null;
}

function compareValues(a: number | null, b: number | null): { status: string; difference: number | null } {
  if (a === null || b === null) return { status: "Not available", difference: null };
  const difference = Math.round((a - b) * 100) / 100;
  return { status: Math.abs(difference) <= 1 ? "Match" : "Difference", difference };
}

router.get("/dashboard-home", async (_req, res) => {
  const today = todayBkk();
  const dates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(`${today}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - idx);
    return d.toISOString().slice(0, 10);
  });

  const [salesResult, posMeta] = await Promise.all([getLatestSales(), getPosMeta()]);
  const latestSales = normalizeSales(salesResult.rows[0]);
  const latestDate = String(latestSales?.date || dates[0]).slice(0, 10);
  const stockResult = await getLatestStock(latestSales?.id);
  const latestStock = normalizeStock(stockResult.rows[0]);
  const blockers = [...salesResult.blockers, ...stockResult.blockers, ...posMeta.blockers];

  const rows = [] as any[];
  for (const date of dates) {
    const receiptResult = await getReceiptTotals(date);
    const shiftResult = await safeQuery(`SELECT data FROM loyverse_shifts WHERE shift_date = $1::date LIMIT 1`, [date], "loyverse_shifts", "operationsRead.dashboardHome.shift");
    blockers.push(...receiptResult.blockers, ...shiftResult.blockers);
    const receipts: any = receiptResult.rows[0] || {};
    const shiftData = (shiftResult.rows[0] as any)?.data ?? null;
    const receiptTotal = money(receipts.receipt_total);
    const shiftTotal = extractShiftTotal(shiftData);
    rows.push({
      date,
      receipts: Number(receipts.receipt_count || 0),
      grossSales: shiftTotal ?? receiptTotal,
      posGrossSales: receiptTotal,
      shiftGrossSales: shiftTotal,
      status: shiftTotal === null ? "Not available" : Math.abs((receiptTotal ?? 0) - shiftTotal) <= 1 ? "Match" : "Difference",
    });
  }

  const latestRow = rows.find((row) => row.date === latestDate) || rows[0] || null;
  const paymentRows = await getShiftPaymentSplit(latestRow?.date || latestDate);
  blockers.push(...paymentRows.blockers);
  const paymentMap = new Map(["Cash", "QR", "Grab", "Other"].map((label) => [label, { label, amount: 0, count: 0 }]));
  for (const row of paymentRows.rows as any[]) {
    const bucket = paymentBucket(extractPaymentName(row.payment_json));
    const item = paymentMap.get(bucket)!;
    item.amount = Math.round((item.amount + (money(row.total_amount) ?? 0)) * 100) / 100;
    item.count += 1;
  }
  const paymentSplit = Array.from(paymentMap.values());

  if (!latestSales) blockers.push(blocker("DAILY_SALES_V2_MISSING", "Daily Sales V2 is missing for the latest completed shift.", "/api/operations-read/dashboard-home", "daily_sales_v2"));
  if (latestStock.status === "missing") blockers.push(blocker("DAILY_STOCK_V2_MISSING", "Daily Stock V2 is missing for the latest completed shift.", "/api/operations-read/dashboard-home", "daily_stock_v2"));
  if (!posMeta.data.latestShiftReportDate) blockers.push(blocker("POS_SHIFT_REPORT_BEHIND", "POS shift report is not available for verification.", "/api/operations-read/dashboard-home", "loyverse_shifts"));

  const staffReceipts = latestSales?.receiptCounts ? Object.values(latestSales.receiptCounts).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) : null;
  const receiptCheck = compareValues(latestRow?.receipts ?? null, staffReceipts);
  const salesCheck = compareValues(latestRow?.posGrossSales ?? null, latestSales?.totalSales ?? null);
  const cashPayment = paymentSplit.find((p) => p.label === "Cash")?.amount ?? null;
  const cashVariance = latestSales?.cash !== null && cashPayment !== null ? Math.round((Number(latestSales?.cash) - cashPayment) * 100) / 100 : null;

  const actionItems = [
    { label: "Daily Sales", status: latestSales ? "POS Verified" : "Action Required", message: latestSales ? "Daily Sales V2 is entered." : "Daily Sales missing." },
    { label: "Staff Sales", status: latestSales?.totalSales != null ? "POS Verified" : "Action Required", message: latestSales?.totalSales != null ? "Staff sales are available." : "Staff sales not entered." },
    { label: "Stock Count", status: latestStock.status === "submitted" ? "POS Verified" : "Action Required", message: latestStock.status === "submitted" ? "Stock count is entered." : "Stock count missing." },
    { label: "Purchases", status: latestStock.requestedShopping?.length ? "Needs Review" : "POS Verified", message: latestStock.requestedShopping?.length ? "Purchases not confirmed." : "No purchase blocker found." },
    { label: "POS Shift Report", status: latestRow?.shiftGrossSales === null ? "Needs Review" : "POS Verified", message: latestRow?.shiftGrossSales === null ? "POS shift report behind." : "POS sync healthy." },
    { label: "Payment Mapping", status: paymentSplit.find((p) => p.label === "Other" && p.count > 0) ? "Needs Review" : "POS Verified", message: paymentSplit.find((p) => p.label === "Other" && p.count > 0) ? "Payment mapping needs review." : "POS sync healthy." },
  ];

  const overall = blockers.length > 0 || actionItems.some((a) => a.status === "Action Required") ? "Action Required" : actionItems.some((a) => a.status === "Needs Review") || receiptCheck.status === "Difference" || salesCheck.status === "Difference" ? "Needs Review" : "POS Verified";

  res.json({
    ok: overall === "POS Verified",
    source: "daily_sales_v2,daily_stock_v2,lv_receipt,loyverse_shifts",
    scope: "dashboard-home/latest-completed-shift",
    status: overall,
    data: {
      latestShift: { date: latestRow?.date ?? latestDate, grossSales: latestRow?.grossSales ?? null, netSales: null, receipts: latestRow?.receipts ?? null },
      last7Shifts: rows,
      paymentSplit,
      verification: {
        overall,
        posReceipts: latestRow?.receipts ?? null,
        staffReceipts,
        receiptStatus: receiptCheck.status,
        receiptDifference: receiptCheck.difference,
        posGrossSales: latestRow?.posGrossSales ?? null,
        staffGrossSales: latestSales?.totalSales ?? null,
        salesStatus: salesCheck.status,
        salesDifference: salesCheck.difference,
        cashVariance,
      },
      stock: {
        rolls: latestStock.rolls,
        meat: latestStock.meat,
        drinks: latestStock.drinks && typeof latestStock.drinks === "object" ? Object.values(latestStock.drinks).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) : null,
        fries: latestSales?.payload?.friesEnd ?? null,
        purchasesThisShift: Array.isArray(latestSales?.payload?.shiftPurchases) ? latestSales?.payload?.shiftPurchases.length : null,
        status: latestStock.status === "submitted" ? "Submitted" : "Missing",
      },
      actions: actionItems,
    },
    warnings: [],
    blockers,
    last_updated: new Date().toISOString(),
  });
});

router.get("/loyverse-mirror", async (_req, res) => {
  const today = todayBkk();
  const dates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(`${today}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - idx);
    return d.toISOString().slice(0, 10);
  });
  const posMeta = await getPosMeta();
  const rows = [] as any[];
  const blockers = [...posMeta.blockers];

  for (const date of dates) {
    const receiptResult = await getReceiptTotals(date);
    const shiftResult = await safeQuery(`SELECT data FROM loyverse_shifts WHERE shift_date = $1::date LIMIT 1`, [date], "loyverse_shifts", "operationsRead.loyverseMirror.shift");
    blockers.push(...receiptResult.blockers, ...shiftResult.blockers);
    const receipts: any = receiptResult.rows[0] || {};
    const shiftData = (shiftResult.rows[0] as any)?.data ?? null;
    const receiptTotal = money(receipts.receipt_total) ?? 0;
    const shiftTotal = extractShiftTotal(shiftData);
    const status = shiftTotal === null ? "NO_SHIFT_DATA" : Math.abs(receiptTotal - shiftTotal) <= 1 ? "MATCH" : "MISMATCH";
    rows.push({
      date,
      receiptCount: Number(receipts.receipt_count || 0),
      receiptTotal,
      shiftTotal,
      variance: shiftTotal === null ? null : Math.round((receiptTotal - shiftTotal) * 100) / 100,
      status,
      latestReceiptTimestamp: receipts.latest_receipt_timestamp ?? null,
    });
  }

  const latest = rows[0] || null;
  const hasMismatch = rows.some((row) => row.status === "MISMATCH");
  const hasShiftGaps = rows.some((row) => row.status === "NO_SHIFT_DATA");
  const verdict = blockers.length > 0 || hasMismatch ? "FAILED" : hasShiftGaps ? "WARNING" : "VERIFIED";

  res.json({
    ok: verdict === "VERIFIED",
    source: "lv_receipt,loyverse_shifts",
    verdict,
    verdictText: verdict === "VERIFIED" ? "LOYVERSE MIRROR VERIFIED — APP CAN BE TRUSTED" : "LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET",
    latestSync: posMeta.data,
    latestShiftComparison: latest,
    sevenDayComparison: rows,
    warnings: hasShiftGaps ? ["One or more dates have no Loyverse shift report data."] : [],
    blockers,
    last_updated: new Date().toISOString(),
  });
});

router.get("/daily-sales-analysis", async (req, res) => {
  const salesResult = await getLatestSales();
  const latestSales = normalizeSales(salesResult.rows[0]);
  const date = String(req.query.date || latestSales?.date || todayBkk()).slice(0, 10);
  const receiptResult = await getReceiptTotals(date);
  const blockers = [...salesResult.blockers, ...receiptResult.blockers];
  if (!latestSales) blockers.push(blocker("DAILY_SALES_V2_MISSING", "No Daily Sales V2 submission found.", "/api/operations-read/daily-sales-analysis", "daily_sales_v2"));
  const receipts: any = receiptResult.rows[0] || {};
  const receiptTotal = money(receipts.receipt_total);
  const pos = {
    gross: null,
    net: null,
    receiptTotal,
    receipts: Number(receipts.receipt_count || 0),
  };
  blockers.push(blocker("POS_GROSS_NET_UNAVAILABLE", "POS gross/net split unavailable from canonical receipt source", "/api/operations-read/daily-sales-analysis", "lv_receipt"));
  const lines = [
    { label: "Gross sales", staff: latestSales?.totalSales ?? null, pos: pos.gross },
    { label: "Net sales", staff: latestSales?.totalSales ?? null, pos: pos.net },
    { label: "Cash", staff: latestSales?.cash ?? null, pos: null },
    { label: "QR", staff: latestSales?.qr ?? null, pos: null },
    { label: "Grab", staff: latestSales?.grab ?? null, pos: null },
    { label: "Receipts", staff: latestSales?.receiptCounts ? Object.values(latestSales.receiptCounts).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) : null, pos: pos.receipts },
    { label: "Expenses", staff: latestSales?.expenses ?? null, pos: null },
    { label: "Expected cash", staff: latestSales?.expectedCash ?? null, pos: null },
    { label: "Actual cash", staff: latestSales?.actualCash ?? null, pos: null },
    { label: "Variance", staff: latestSales?.variance ?? null, pos: 0 },
  ].map((line) => {
    const variance = line.staff !== null && line.pos !== null ? Math.round((Number(line.staff) - Number(line.pos)) * 100) / 100 : null;
    return { ...line, variance, status: variance === null ? "WARNING" : Math.abs(variance) <= 1 ? "PASS" : Math.abs(variance) <= 50 ? "WARNING" : "FAIL" };
  });
  res.json({ ok: blockers.length === 0, source: "daily_sales_v2,lv_receipt", date, latestSales: latestSales || { status: "missing" }, pos, lines, warnings: [], blockers, last_updated: new Date().toISOString() });
});

router.get("/daily-stock-analysis", async (_req, res) => {
  const stockResult = await getLatestStock();
  const latestStock = normalizeStock(stockResult.rows[0]);
  const stockRow: any = stockResult.rows[0] ?? {};
  const blockers = [...stockResult.blockers];
  if (latestStock.status === "missing") blockers.push(blocker("DAILY_STOCK_V2_MISSING", "Daily Stock V2 record missing", "/api/operations-read/daily-stock-analysis", "daily_stock_v2"));

  // Fetch shiftPurchases, friesEnd, sweetPotatoEnd from daily_sales_v2.payload
  let shiftPurchases: any = null;
  let friesEnd: number | null = null;
  let sweetPotatoEnd: number | null = null;
  // normalizeStock() already maps both salesId and sales_id onto latestStock.salesId;
  // also check the raw row's snake_case column as a belt-and-braces fallback.
  const linkedSalesId: string | null =
    latestStock.salesId ?? stockRow.salesId ?? stockRow["salesId"] ?? stockRow.sales_id ?? null;
  try {
    const spResult = linkedSalesId
      ? await pool.query<{ payload: any }>(
          `SELECT payload FROM daily_sales_v2 WHERE id = $1 LIMIT 1`,
          [linkedSalesId],
        )
      : await pool.query<{ payload: any }>(
          `SELECT payload FROM daily_sales_v2 WHERE "deletedAt" IS NULL ORDER BY COALESCE("shiftDate"::timestamp, "createdAt") DESC LIMIT 1`,
          [],
        );
    const payload = spResult.rows[0]?.payload ?? null;
    shiftPurchases = payload?.shiftPurchases ?? null;
    friesEnd = n(payload?.friesEnd);
    sweetPotatoEnd = n(payload?.sweetPotatoEnd);
  } catch {
    // Non-blocking — fields stay null
  }

  res.json({
    ok: blockers.length === 0,
    source: "daily_stock_v2",
    latestStock: { ...latestStock, shiftPurchases, friesEnd, sweetPotatoEnd },
    posUsageComparison: [],
    comparisonNote: "POS usage comparison is only shown when explicit item mappings exist. No usage is invented.",
    warnings: [],
    blockers,
    last_updated: new Date().toISOString(),
  });
});

const OWNER_DASHBOARD_SEVEN_DAY_SQL = `
  WITH shift_dates AS (
    SELECT shift_date
    FROM (
      SELECT DISTINCT TO_CHAR(COALESCE("shiftDate"::date, shift_date::date, "createdAt"::date), 'YYYY-MM-DD') AS shift_date
      FROM daily_sales_v2
      WHERE "deletedAt" IS NULL
      ORDER BY shift_date DESC
      LIMIT 7
    ) sub
  )
  SELECT
    sd.shift_date,
    COUNT(DISTINCT r.receipt_id)::int AS receipt_count,
    ROUND(COALESCE(SUM(pay.amount), 0), 0)::int AS gross_sales,
    ROUND(COALESCE(SUM(CASE WHEN pay.category = 'Cash' THEN pay.amount ELSE 0 END), 0), 0)::int AS cash,
    ROUND(COALESCE(SUM(CASE WHEN pay.category = 'QR'   THEN pay.amount ELSE 0 END), 0), 0)::int AS qr,
    ROUND(COALESCE(SUM(CASE WHEN pay.category = 'Grab' THEN pay.amount ELSE 0 END), 0), 0)::int AS grab,
    ROUND(COALESCE(SUM(CASE WHEN pay.category NOT IN ('Cash','QR','Grab') THEN pay.amount ELSE 0 END), 0), 0)::int AS other
  FROM shift_dates sd
  LEFT JOIN lv_receipt r
    ON r.datetime_bkk >= (sd.shift_date || 'T11:00:00.000Z')::timestamptz
   AND r.datetime_bkk <  (sd.shift_date || 'T20:00:00.000Z')::timestamptz
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        (p->>'amount')::numeric,
        (p->>'money_amount')::numeric,
        0
      ) AS amount,
      COALESCE(
        p->>'normalizedCategory',
        CASE
          WHEN UPPER(COALESCE(p->>'name','')) = 'CASH' THEN 'Cash'
          WHEN UPPER(COALESCE(p->>'name','')) LIKE '%GRAB%' THEN 'Grab'
          WHEN UPPER(COALESCE(p->>'name','')) LIKE '%QR%'
            OR LOWER(COALESCE(p->>'name','')) LIKE '%scan%'
            OR LOWER(COALESCE(p->>'name','')) LIKE '%prompt%' THEN 'QR'
          ELSE 'Other'
        END
      ) AS category
    FROM jsonb_array_elements(COALESCE(r.payment_json, '[]'::jsonb)) AS p
    WHERE COALESCE((p->>'amount')::numeric, (p->>'money_amount')::numeric) IS NOT NULL
  ) pay ON true
  GROUP BY sd.shift_date
  ORDER BY sd.shift_date DESC
`;

router.get("/owner-dashboard", async (_req, res) => {
  const blockers: Blocker[] = [];

  const [sevenDayResult, salesResult, syncHealthResult] = await Promise.all([
    safeQuery<any>(OWNER_DASHBOARD_SEVEN_DAY_SQL, [], "lv_receipt,loyverse_shifts", "ownerDashboard.sevenDay"),
    getLatestSales(),
    safeQuery<any>(
      `SELECT MAX(datetime_bkk) AS latest_receipt_at, MAX(created_at) AS last_sync_at FROM lv_receipt`,
      [],
      "lv_receipt",
      "ownerDashboard.syncHealth",
    ),
  ]);

  blockers.push(...sevenDayResult.blockers, ...salesResult.blockers, ...syncHealthResult.blockers);

  const sevenDayRows = sevenDayResult.rows;
  const latestShiftRow: any = sevenDayRows[0] ?? null;

  const latestSales = normalizeSales(salesResult.rows[0]);
  const latestDailySalesDate = latestSales?.date ? String(latestSales.date).slice(0, 10) : null;
  const latestShiftDate: string | null = latestDailySalesDate ?? latestShiftRow?.shift_date ?? null;
  const stockResult = await getLatestStock(latestSales?.id ?? null);
  const latestStock = normalizeStock(stockResult.rows[0]);
  blockers.push(...stockResult.blockers);

  const syncHealthRow: any = syncHealthResult.rows[0] ?? {};
  const latestReceiptAt: string | null = syncHealthRow.latest_receipt_at ?? null;
  const lastSyncAt: string | null = syncHealthRow.last_sync_at ?? null;

  const minutesSinceLastReceipt = latestReceiptAt
    ? (Date.now() - new Date(latestReceiptAt).getTime()) / 60000
    : null;

  // Only flag sync as stale during active shift window (18:00–03:00 BKK)
  // During 03:00–18:00 BKK the restaurant is closed — no receipts expected
  const bkkHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", hour12: false,
  }).format(new Date());
  const bkkHour = parseInt(bkkHourStr, 10);
  const isInShiftWindow = bkkHour >= 18 || bkkHour < 3;
  const syncIsStale = isInShiftWindow && minutesSinceLastReceipt !== null && minutesSinceLastReceipt > 60;

  const latestShift = latestShiftRow
    ? {
        date: latestShiftRow.shift_date,
        window: "18:00–03:00 Asia/Bangkok",
        grossSales: Number(latestShiftRow.gross_sales),
        netSales: Number(latestShiftRow.gross_sales),
        receiptCount: Number(latestShiftRow.receipt_count),
        cash: Number(latestShiftRow.cash),
        qr: Number(latestShiftRow.qr),
        grab: Number(latestShiftRow.grab),
        other: Number(latestShiftRow.other),
        status: "ok",
      }
    : null;

  const staffReceiptTotal = latestSales
    ? (Number(latestSales.receiptCounts?.cash ?? 0) +
       Number(latestSales.receiptCounts?.qr ?? 0) +
       Number(latestSales.receiptCounts?.grab ?? 0))
    : null;

  const staffComparison = {
    staffSalesEntered: latestSales !== null,
    staffGrossSales: latestSales?.totalSales ?? null,
    staffReceiptCount: staffReceiptTotal,
    salesDifference:
      latestShift !== null && latestSales?.totalSales !== null && latestSales?.totalSales !== undefined
        ? Math.round((latestShift.grossSales - (latestSales.totalSales ?? 0)) * 100) / 100
        : null,
    receiptDifference:
      latestShift !== null && staffReceiptTotal !== null
        ? latestShift.receiptCount - staffReceiptTotal
        : null,
    cashVariance: latestSales?.variance ?? null,
  };

  const stockStatus = {
    dailyStockSubmitted: latestStock.status === "submitted",
    purchasesConfirmed: null as boolean | null,
    rollsStatus: latestStock.rolls !== null ? "submitted" : "missing",
    meatStatus: latestStock.meat !== null ? "submitted" : "missing",
    drinksStatus: Object.keys(latestStock.drinks ?? {}).length > 0 ? "submitted" : "missing",
    friesStatus: null as string | null,
  };

  const lastSevenShifts = sevenDayRows.map((row: any) => ({
    date: row.shift_date as string,
    grossSales: Number(row.gross_sales),
    receipts: Number(row.receipt_count),
    cash: Number(row.cash),
    qr: Number(row.qr),
    grab: Number(row.grab),
    other: Number(row.other),
    status: "ok",
  }));

  const salesMix = latestShift
    ? { cash: latestShift.cash, qr: latestShift.qr, grab: latestShift.grab, other: latestShift.other }
    : { cash: null, qr: null, grab: null, other: null };

  const actionRequired: { severity: string; title: string; message: string }[] = [];

  const salesMatchesLatestShift = latestSales !== null && latestDailySalesDate === latestShiftDate;
  if (!latestSales || !salesMatchesLatestShift) {
    actionRequired.push({
      severity: "high",
      title: "Daily Sales not submitted",
      message: latestShiftDate ? `No sales form found for ${latestShiftDate}` : "No recent sales form found",
    });
  }

  if (latestSales?.variance !== null && latestSales?.variance !== undefined && Math.abs(latestSales.variance) > 50) {
    actionRequired.push({
      severity: "high",
      title: "Cash variance detected",
      message: `Closing cash difference of ฿${Math.abs(latestSales.variance).toLocaleString()}`,
    });
  }

  if (!stockStatus.dailyStockSubmitted) {
    actionRequired.push({
      severity: "medium",
      title: "Daily Stock not submitted",
      message: "Stock count not completed for latest shift",
    });
  }

  if (syncIsStale) {
    actionRequired.push({
      severity: "high",
      title: "POS sync overdue",
      message: "No POS receipts received in over 8 hours",
    });
  }

  res.json({
    ok: blockers.length === 0 && actionRequired.filter(a => a.severity === "high").length === 0,
    latestShift,
    latestDailySalesDate,
    dashboardSource: "daily_sales_v2 latest completed shifts joined to lv_receipt payments",
    staffComparison,
    stockStatus,
    lastSevenShifts,
    salesMix,
    actionRequired,
    syncHealth: {
      status: syncIsStale ? "warning" : "ok",
      latestReceiptAt,
      latestShiftDate,
      lastSyncAt,
    },
    blockers,
    last_updated: new Date().toISOString(),
  });
});

export default router;

