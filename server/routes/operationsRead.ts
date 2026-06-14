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

export default router;
