import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { bobAuth } from "../middleware/bobAuth";
import { bobReadAuth } from "../middleware/bobReadAuth";
import { getDailyAnalysis } from "../services/dataAnalystService";
import { buildBobInterpretationFromDailyAnalysis } from "../services/bobInterpretationService";
import { pool } from "../db";

const router = express.Router();

/**
 * INTERNAL HELPER
 * Calls existing app endpoints
 */
async function proxyInternal(path: string, req: Request) {
  const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
  const [pathname, rawQuery = ""] = path.split("?");
  const query = new URLSearchParams(rawQuery);

  for (const [key, raw] of Object.entries(req.query || {})) {
    if (Array.isArray(raw)) {
      for (const value of raw) {
        query.append(key, String(value));
      }
    } else if (raw !== undefined && raw !== null) {
      query.append(key, String(raw));
    }
  }

  const queryString = query.toString();
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.BOB_READ_PROXY_TIMEOUT_MS || 20000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl}${fullPath}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`GET ${fullPath} failed with ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * GENERIC PROXY
 * Example:
 * /api/bob/read/proxy?path=/api/daily-stock-sales
 */
router.get("/proxy", bobAuth, async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;

    if (!path || !path.startsWith("/api/")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    const data = await proxyInternal(path, req);
    res.json(data);
  } catch (err) {
    console.error("BOB PROXY ERROR:", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

/**
 * SHIFT REPORT (CRITICAL FIRST ENDPOINT)
 */
router.get("/shift-report/latest", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/shift-report/latest", req);
    res.json(data);
  } catch (err) {
    console.error("SHIFT REPORT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch shift report" });
  }
});

/**
 * DAILY SALES
 */
router.get("/daily-sales", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/daily-stock-sales", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily sales" });
  }
});

/**
 * DAILY STOCK
 */
router.get("/daily-stock", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/daily-stock-sales", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily stock" });
  }
});

/**
 * PURCHASE HISTORY
 */
router.get("/purchase-history", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/analysis/stock-review/purchase-history", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

/**
 * STOCK USAGE
 */
router.get("/stock-usage", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal(
      `/api/ai-ops/bob/proxy-read?path=analysis/stock-usage&token=${encodeURIComponent(process.env.BOB_READONLY_TOKEN || "")}`,
      req
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stock usage" });
  }
});



/**
 * BOB INTERPRETATION (Analysis V2 aligned)
 */
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
      source: {
        data_analyst: "/api/analysis/v2?date=YYYY-MM-DD (same service: getDailyAnalysis)",
      },
      analyst_tables: {
        drinks: analyst.data.drinks,
        burgers: analyst.data.burgers,
        sides: analyst.data.sides,
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

// ─── Shift window helpers ─────────────────────────────────────────────────────

/**
 * Compute the latest fully-completed SBB shift.
 *
 * Shift window: 17:00 Asia/Bangkok → 03:00 Asia/Bangkok (next calendar day).
 * shift_date = the date of the 17:00 opening.
 *
 * UTC equivalents (BKK = UTC+7):
 *   start_utc = shift_date 10:00 UTC
 *   end_utc   = shift_date 20:00 UTC  (= shift_date+1 03:00 BKK)
 */
function latestCompletedShift(): {
  shiftDate: string;
  startBkk: string;
  endBkk: string;
  startUtc: string;
  endUtc: string;
} {
  const nowUtc = new Date();
  // Current Bangkok time
  const bkkStr = nowUtc.toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour12: false });
  const bkkNow = new Date(bkkStr + " UTC");

  const bkkHour = bkkNow.getUTCHours();
  // If BKK hour is before 03:00 the current overnight shift hasn't closed yet → go back 2 days
  const daysBack = bkkHour < 3 ? 2 : 1;

  const shiftDateObj = new Date(bkkNow);
  shiftDateObj.setUTCDate(shiftDateObj.getUTCDate() - daysBack);
  const shiftDate = shiftDateObj.toISOString().slice(0, 10);

  // UTC window: shift_date 10:00 UTC → shift_date 20:00 UTC
  const startUtcObj = new Date(`${shiftDate}T10:00:00.000Z`);
  const endUtcObj   = new Date(`${shiftDate}T20:00:00.000Z`);

  const fmt = (d: Date, tz: string) =>
    d.toLocaleString("sv-SE", { timeZone: tz }).replace(" ", "T") +
    (tz === "Asia/Bangkok" ? "+07:00" : "Z");

  return {
    shiftDate,
    startBkk: fmt(startUtcObj, "Asia/Bangkok"),
    endBkk:   fmt(endUtcObj,   "Asia/Bangkok"),
    startUtc: startUtcObj.toISOString(),
    endUtc:   endUtcObj.toISOString(),
  };
}

async function querySafe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ available: boolean; records: T | null; error: string | null }> {
  try {
    const records = await fn();
    return { available: true, records, error: null };
  } catch (err: any) {
    console.error(`[bob/read/latest-shift] ${label} error:`, err.message);
    return { available: false, records: null, error: err.message };
  }
}

// ─── GET /health ──────────────────────────────────────────────────────────────

router.get("/health", bobReadAuth, (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "bob-read",
    readOnly: true,
    time: new Date().toISOString(),
  });
});

// ─── GET /latest-shift ────────────────────────────────────────────────────────

router.get("/latest-shift", bobReadAuth, async (_req: Request, res: Response) => {
  const shift = latestCompletedShift();
  const { shiftDate, startUtc, endUtc, startBkk, endBkk } = shift;

  // ── 1. Daily Sales Form (daily_sales_v2) ─────────────────────────────────
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

  // ── 2. Daily Stock Form (daily_stock_v2) ──────────────────────────────────
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

  // ── 3. POS Receipts (lv_receipt) ──────────────────────────────────────────
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

  // ── 4. Shift Report (shift_report_v2) ─────────────────────────────────────
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

  // ── 5. Purchases (purchase_tally) ─────────────────────────────────────────
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

  // ── Build sources map ─────────────────────────────────────────────────────
  const sources = {
    dailySalesForm:  dailySalesResult,
    dailyStockForm:  dailyStockResult,
    posReceipts:     posReceiptsResult,
    shiftReport:     shiftReportResult,
    purchases:       purchasesResult,
  };

  // ── Determine status ──────────────────────────────────────────────────────
  const coreSources = ["dailySalesForm", "posReceipts"] as const;
  const allCoreFailed = coreSources.every((k) => !sources[k].available);
  const anyFailed     = Object.values(sources).some((s) => !s.available);
  const status = allCoreFailed ? "blocked" : anyFailed ? "partial" : "ok";

  const missingSources = Object.entries(sources)
    .filter(([, s]) => !s.available)
    .map(([name, s]) => ({ source: name, error: s.error }));

  // ── Build verificationInputs from the most complete daily_sales_v2 row ───
  const topSalesRow = Array.isArray(dailySalesResult.records) && dailySalesResult.records.length > 0
    ? dailySalesResult.records[0]
    : null;
  const topStockRow = Array.isArray(dailyStockResult.records) && dailyStockResult.records.length > 0
    ? dailyStockResult.records[0]
    : null;

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
      receiptCount:  (posReceiptsResult.records as any)?.receipt_count ?? null,
      totalRevenue:  (posReceiptsResult.records as any)?.total_revenue ?? null,
      firstReceiptBkk: (posReceiptsResult.records as any)?.first_receipt_bkk ?? null,
      lastReceiptBkk:  (posReceiptsResult.records as any)?.last_receipt_bkk ?? null,
    },
  };

  return res.json({
    status,
    shift: { shiftDate, startBkk, endBkk, startUtc, endUtc },
    sources,
    verificationInputs,
    missingSources,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
