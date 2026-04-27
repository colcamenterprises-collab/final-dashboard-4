import express, { Request, Response } from "express";
import { bobAuth } from "../middleware/bobAuth";
import { bobReadAuth } from "../middleware/bobReadAuth";
import { getDailyAnalysis } from "../services/dataAnalystService";
import { buildBobInterpretationFromDailyAnalysis } from "../services/bobInterpretationService";
import { pool } from "../db";

const router = express.Router();

// ─── Legacy proxy/alias routes (bobAuth, NOT bobReadAuth) ─────────────────────
// These use the internal session-based bobAuth and remain unchanged.

router.get("/proxy", bobAuth, async (req: Request, res: Response) => {
  return res.status(410).json({
    error: "PROXY_REMOVED",
    message: "Direct proxy access is no longer available. Use structured read endpoints.",
  });
});

router.get("/shift-report/latest", bobAuth, async (req: Request, res: Response) => {
  return res.status(410).json({
    error: "PROXY_REMOVED",
    message: "Use GET /api/bob/read/verify/latest-shift instead.",
  });
});

router.get("/daily-sales",    bobAuth, (_req, res) => res.status(410).json({ error: "PROXY_REMOVED" }));
router.get("/daily-stock",    bobAuth, (_req, res) => res.status(410).json({ error: "PROXY_REMOVED" }));
router.get("/purchase-history",bobAuth,(_req, res) => res.status(410).json({ error: "PROXY_REMOVED" }));
router.get("/stock-usage",    bobAuth, (_req, res) => res.status(410).json({ error: "PROXY_REMOVED" }));

router.get("/analysis/interpretation", bobAuth, async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        ok: false,
        error: "date query parameter required (YYYY-MM-DD)",
      });
    }
    const analyst = await getDailyAnalysis(date);
    const interpretation = buildBobInterpretationFromDailyAnalysis(analyst);
    res.json({
      ok: true,
      date,
      source: "/api/analysis/v2 (getDailyAnalysis)",
      analyst_tables: {
        drinks:    analyst.data.drinks,
        burgers:   analyst.data.burgers,
        sides:     analyst.data.sides,
        modifiers: analyst.data.modifiers,
      },
      blockers: analyst.blockers,
      interpretation,
    });
  } catch (err) {
    console.error("BOB INTERPRETATION ERROR:", err);
    res.status(500).json({ error: "Failed to build Bob interpretation" });
  }
});

// ─── Shift window helper ───────────────────────────────────────────────────────

/**
 * Compute the latest fully-completed SBB shift using reliable UTC+7 arithmetic.
 *
 * Shift window: opens 17:00 BKK, closes 03:00 BKK (next calendar day).
 * shift_date  = the calendar date of the 17:00 opening (BKK).
 *
 * UTC equivalents (Bangkok = UTC+7, no DST):
 *   start_utc = shift_date T10:00:00Z   (17:00 BKK − 7h)
 *   end_utc   = shift_date T20:00:00Z   (03:00 BKK next day − 7h = same UTC date)
 *
 * "Latest completed" rule:
 *   - BKK hour  0–02  → tonight's shift is still open → last closed = 2 calendar days ago (BKK)
 *   - BKK hour 03–23  → yesterday's shift has closed  → last closed = 1 calendar day  ago (BKK)
 */
function latestCompletedShift(): {
  shiftDate: string;
  startBkk: string;
  endBkk: string;
  startUtc: string;
  endUtc: string;
} {
  // Reliable BKK time via direct arithmetic (UTC+7, no DST).
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowMs   = Date.now();
  const bkkMs   = nowMs + BKK_OFFSET_MS;
  const bkkDate = new Date(bkkMs);

  const bkkHour = bkkDate.getUTCHours();   // hour in BKK local time
  const daysBack = bkkHour < 3 ? 2 : 1;   // 0–02 BKK: tonight not closed yet

  // Subtract daysBack full days from the BKK timestamp to get shift calendar date.
  const shiftBkkMs = bkkMs - daysBack * 24 * 60 * 60 * 1000;
  const shiftDate  = new Date(shiftBkkMs).toISOString().slice(0, 10);  // YYYY-MM-DD in BKK calendar

  // UTC window is always anchored on the shift_date string.
  const startUtcObj = new Date(`${shiftDate}T10:00:00.000Z`);   // 17:00 BKK
  const endUtcObj   = new Date(`${shiftDate}T20:00:00.000Z`);   // 03:00 BKK (+1 day) = same UTC date

  const fmtBkk = (d: Date) =>
    d.toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(" ", "T") + "+07:00";

  return {
    shiftDate,
    startBkk: fmtBkk(startUtcObj),
    endBkk:   fmtBkk(endUtcObj),
    startUtc: startUtcObj.toISOString(),
    endUtc:   endUtcObj.toISOString(),
  };
}

// ─── querySafe helper ─────────────────────────────────────────────────────────

async function querySafe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ available: boolean; records: T | null; error: string | null }> {
  try {
    const records = await fn();
    return { available: true, records, error: null };
  } catch (err: any) {
    console.error(`[bob/read/verify/latest-shift] ${label} error:`, err.message);
    return { available: false, records: null, error: err.message };
  }
}

// ─── Core shift-verification handler (shared by /verify/latest-shift and /latest-shift) ──

async function handleLatestShift(_req: Request, res: Response) {
  const shift = latestCompletedShift();
  const { shiftDate, startUtc, endUtc, startBkk, endBkk } = shift;

  // ── 1. Daily Sales Form ────────────────────────────────────────────────────
  const dailySalesResult = await querySafe("dailySalesForm", async () => {
    const r = await pool.query(
      `SELECT id, "shiftDate", "createdAt",
              payload->>'completedBy'    AS completed_by,
              payload->>'rollsEnd'       AS rolls_end,
              payload->>'meatEnd'        AS meat_end,
              payload->>'friesEnd'       AS fries_end,
              payload->>'cashBanked'     AS cash_banked,
              payload->>'cashSales'      AS cash_sales,
              payload->>'grabSales'      AS grab_sales,
              payload->>'qrSales'        AS qr_sales,
              payload->>'otherSales'     AS other_sales,
              payload->>'totalExpenses'  AS total_expenses,
              payload->'drinkStock'      AS drink_stock
       FROM daily_sales_v2
       WHERE "shiftDate" = $1
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC, "createdAt" DESC`,
      [shiftDate],
    );
    return r.rows;
  });

  // ── 2. Daily Stock Form ────────────────────────────────────────────────────
  const dailyStockResult = await querySafe("dailyStockForm", async () => {
    const r = await pool.query(
      `SELECT dsv.id, dsv."createdAt", ds."shiftDate",
              dsv."burgerBuns", dsv."meatWeightG", dsv."drinksJson", dsv.notes
       FROM daily_stock_v2 dsv
       JOIN daily_sales_v2 ds ON dsv."salesId" = ds.id
       WHERE ds."shiftDate" = $1
         AND dsv."deletedAt" IS NULL
       ORDER BY dsv."createdAt" DESC`,
      [shiftDate],
    );
    return r.rows;
  });

  // ── 3. POS Receipts ────────────────────────────────────────────────────────
  const posReceiptsResult = await querySafe("posReceipts", async () => {
    const r = await pool.query(
      `SELECT COUNT(*)::int                          AS receipt_count,
              ROUND(SUM(total_amount)::numeric, 2)   AS total_revenue,
              MIN(datetime_bkk)                      AS first_receipt_bkk,
              MAX(datetime_bkk)                      AS last_receipt_bkk
       FROM lv_receipt
       WHERE datetime_bkk >= $1::timestamptz AT TIME ZONE 'UTC'
         AND datetime_bkk <  $2::timestamptz AT TIME ZONE 'UTC'`,
      [startUtc, endUtc],
    );
    return r.rows[0] ?? null;
  });

  // ── 4. Shift Report ────────────────────────────────────────────────────────
  const shiftReportResult = await querySafe("shiftReport", async () => {
    const r = await pool.query(
      `SELECT id, "shiftDate", "createdAt",
              "salesData", "stockData", "variances"
       FROM shift_report_v2
       WHERE "shiftDate"::date = $1::date
       ORDER BY "createdAt" DESC
       LIMIT 5`,
      [shiftDate],
    );
    return r.rows;
  });

  // ── 5. Purchases ───────────────────────────────────────────────────────────
  const purchasesResult = await querySafe("purchases", async () => {
    const r = await pool.query(
      `SELECT id, date, staff, supplier, notes,
              rolls_pcs, meat_grams, fries_grams, sweet_potato_grams,
              amount_thb
       FROM purchase_tally
       WHERE date = $1
       ORDER BY created_at DESC`,
      [shiftDate],
    );
    return r.rows;
  });

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const sources = {
    dailySalesForm: dailySalesResult,
    dailyStockForm: dailyStockResult,
    posReceipts:    posReceiptsResult,
    shiftReport:    shiftReportResult,
    purchases:      purchasesResult,
  };

  const coreSources   = ["dailySalesForm", "posReceipts"] as const;
  const allCoreFailed = coreSources.every((k) => !sources[k].available);
  const anyFailed     = Object.values(sources).some((s) => !s.available);
  const status        = allCoreFailed ? "blocked" : anyFailed ? "partial" : "ok";

  const missingSources = Object.entries(sources)
    .filter(([, s]) => !s.available)
    .map(([name, s]) => ({ source: name, error: s.error }));

  const topSalesRow = Array.isArray(dailySalesResult.records) && dailySalesResult.records.length > 0
    ? dailySalesResult.records[0] : null;
  const topStockRow = Array.isArray(dailyStockResult.records) && dailyStockResult.records.length > 0
    ? dailyStockResult.records[0] : null;

  const verificationInputs = {
    rolls: {
      rollsEnd:    topSalesRow?.rolls_end    != null ? Number(topSalesRow.rolls_end)    : null,
      burgerBuns:  topStockRow?.burgerBuns   != null ? Number(topStockRow.burgerBuns)   : null,
    },
    meat: {
      meatEndGrams: topSalesRow?.meat_end    != null ? Number(topSalesRow.meat_end)     : null,
      meatWeightG:  topStockRow?.meatWeightG != null ? Number(topStockRow.meatWeightG)  : null,
    },
    drinks: {
      drinkStock: topSalesRow?.drink_stock ?? topStockRow?.drinksJson ?? null,
    },
    salesChannels: {
      cashSales:     topSalesRow?.cash_sales     != null ? Number(topSalesRow.cash_sales)     : null,
      grabSales:     topSalesRow?.grab_sales     != null ? Number(topSalesRow.grab_sales)     : null,
      qrSales:       topSalesRow?.qr_sales       != null ? Number(topSalesRow.qr_sales)       : null,
      otherSales:    topSalesRow?.other_sales    != null ? Number(topSalesRow.other_sales)    : null,
      cashBanked:    topSalesRow?.cash_banked    != null ? Number(topSalesRow.cash_banked)    : null,
      totalExpenses: topSalesRow?.total_expenses != null ? Number(topSalesRow.total_expenses) : null,
    },
    receipts: {
      receiptCount:    (posReceiptsResult.records as any)?.receipt_count    ?? null,
      totalRevenue:    (posReceiptsResult.records as any)?.total_revenue    ?? null,
      firstReceiptBkk: (posReceiptsResult.records as any)?.first_receipt_bkk ?? null,
      lastReceiptBkk:  (posReceiptsResult.records as any)?.last_receipt_bkk  ?? null,
    },
  };

  return res.json({
    status,
    shift:               { shiftDate, startBkk, endBkk, startUtc, endUtc },
    sources,
    verificationInputs,
    missingSources,
    generatedAt:         new Date().toISOString(),
  });
}

// ─── GET /health ───────────────────────────────────────────────────────────────

router.get("/health", bobReadAuth, (_req: Request, res: Response) => {
  const shift = latestCompletedShift();
  res.json({
    status:      "ok",
    service:     "bob-read",
    readOnly:    true,
    shiftDate:   shift.shiftDate,
    shiftWindow: { startUtc: shift.startUtc, endUtc: shift.endUtc },
    time:        new Date().toISOString(),
  });
});

// ─── GET /tools ────────────────────────────────────────────────────────────────

router.get("/tools", bobReadAuth, (_req: Request, res: Response) => {
  res.json({
    service: "bob-read",
    version: "2.1",
    auth:    "x-bob-token header required for all endpoints",
    note:    "All endpoints are GET-only. No write access is possible through this layer.",
    tools: [
      {
        name:        "health",
        method:      "GET",
        endpoint:    "/api/bob/read/health",
        description: "Service liveness check. Returns current BKK shift date and window.",
        params:      [],
        returns:     { status: "ok", shiftDate: "YYYY-MM-DD", shiftWindow: { startUtc: "ISO8601", endUtc: "ISO8601" } },
      },
      {
        name:        "tools",
        method:      "GET",
        endpoint:    "/api/bob/read/tools",
        description: "This endpoint registry. Lists all callable tools with params and return shapes.",
        params:      [],
      },
      {
        name:        "verify/latest-shift",
        method:      "GET",
        endpoint:    "/api/bob/read/verify/latest-shift",
        description: "Canonical latest-completed-shift snapshot from 5 canonical sources: " +
                     "daily_sales_v2 (staff sales form), daily_stock_v2 (staff stock form), " +
                     "lv_receipt (POS receipts aggregated), shift_report_v2, purchase_tally. " +
                     "Returns status ok|partial|blocked, shift window details, per-source availability, " +
                     "verificationInputs (rolls/meat/drinks/salesChannels/receipts), and missingSources.",
        params:      [],
        returns: {
          status:              "ok | partial | blocked",
          shift:               { shiftDate: "YYYY-MM-DD", startBkk: "ISO8601+07:00", endBkk: "ISO8601+07:00", startUtc: "ISO8601Z", endUtc: "ISO8601Z" },
          sources:             "{ dailySalesForm, dailyStockForm, posReceipts, shiftReport, purchases }",
          verificationInputs:  "{ rolls, meat, drinks, salesChannels, receipts }",
          missingSources:      "Array<{ source, error }> — empty when status=ok",
        },
      },
      {
        name:        "analysis/interpretation",
        method:      "GET",
        endpoint:    "/api/bob/read/analysis/interpretation?date=YYYY-MM-DD",
        description: "Bob interpretation layer over Analysis V2 daily data. " +
                     "Returns drinks/burgers/sides/modifiers tables plus AI-readable interpretation.",
        params: [
          { name: "date", type: "YYYY-MM-DD", required: true, description: "Shift date to analyse" },
        ],
      },
    ],
  });
});

// ─── GET /verify/latest-shift  (canonical) ────────────────────────────────────

router.get("/verify/latest-shift", bobReadAuth, handleLatestShift);

// ─── GET /latest-shift  (backward-compat alias) ───────────────────────────────

router.get("/latest-shift", bobReadAuth, handleLatestShift);

export default router;
