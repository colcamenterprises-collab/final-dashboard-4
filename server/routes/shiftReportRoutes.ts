// SHIFT REPORT ROUTES — SOURCE ALIGNMENT PATCH
// Reads from verified sources: loyverse_shifts, lv_receipt, daily_sales_v2
// Does NOT use broken Prisma builder or empty shift_report_v2 as primary source.

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { db as prismaDb } from "../lib/prisma";

const router = Router();

// ─────────────────────────────────────────────────────────────
// Shared query: build shift rows from verified sources
// ─────────────────────────────────────────────────────────────
async function buildShiftRows(limitOrDate: number | string) {
  if (!db) throw new Error("DB not available");
  const isDate = typeof limitOrDate === "string";

  const { rows } = await db.execute(sql`
    WITH
    shifts AS (
      SELECT
        shift_date::date AS shift_date,
        (data->'shifts'->0->>'gross_sales')::numeric   AS gross_sales,
        (data->'shifts'->0->>'net_sales')::numeric     AS net_sales,
        (data->'shifts'->0->>'cash_payments')::numeric AS pos_cash
      FROM loyverse_shifts
      ${isDate ? sql`WHERE shift_date = ${limitOrDate}::date` : sql`ORDER BY shift_date DESC LIMIT ${sql.raw(String(limitOrDate))}`}
    ),
    receipts AS (
      SELECT
        CASE
          WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 17
          THEN ((datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date + INTERVAL '1 day')::date
          ELSE  (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
        END AS biz_date,
        COUNT(*) AS receipt_count,
        COALESCE(SUM(pay.total), 0)    AS receipt_gross,
        COALESCE(SUM(pay.cash_amt), 0) AS cash_total,
        COALESCE(SUM(pay.grab_amt), 0) AS grab_total,
        COALESCE(SUM(pay.qr_amt),   0) AS qr_total
      FROM lv_receipt
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM((e->>'money_amount')::numeric), 0) AS total,
          COALESCE(SUM(CASE WHEN e->>'name' = 'Cash'           THEN (e->>'money_amount')::numeric ELSE 0 END), 0) AS cash_amt,
          COALESCE(SUM(CASE WHEN e->>'name' = 'GRAB'           THEN (e->>'money_amount')::numeric ELSE 0 END), 0) AS grab_amt,
          COALESCE(SUM(CASE WHEN e->>'name' = 'SCAN (QR Code)' THEN (e->>'money_amount')::numeric ELSE 0 END), 0) AS qr_amt
        FROM jsonb_array_elements(payment_json) e
      ) pay
      GROUP BY biz_date
    ),
    forms AS (
      SELECT DISTINCT ON (COALESCE(shift_date, "shiftDate"::date))
        COALESCE(shift_date, "shiftDate"::date) AS form_date,
        id AS form_id,
        "cashSales" AS staff_cash,
        "qrSales" AS staff_qr,
        "grabSales" AS staff_grab,
        "aroiSales" AS staff_other,
        "totalSales" AS staff_total,
        (COALESCE("cash_receipt_count", 0) + COALESCE("qr_receipt_count", 0) + COALESCE("grab_receipt_count", 0)) AS staff_receipts
      FROM daily_sales_v2
      WHERE "deletedAt" IS NULL
      ORDER BY COALESCE(shift_date, "shiftDate"::date), "createdAt" DESC
    ),
    stocks AS (
      SELECT DISTINCT ON (COALESCE(d."shiftDate"::date, d.shift_date))
        COALESCE(d."shiftDate"::date, d.shift_date) AS stock_date,
        s.id AS stock_id
      FROM daily_stock_v2 s
      LEFT JOIN daily_sales_v2 d ON d.id = s."salesId"
      ORDER BY COALESCE(d."shiftDate"::date, d.shift_date), s."createdAt" DESC
    )
    SELECT
      s.shift_date,
      s.gross_sales,
      s.net_sales,
      COALESCE(s.pos_cash, r.cash_total) AS pos_cash,
      r.receipt_count,
      r.receipt_gross,
      r.grab_total,
      r.qr_total,
      f.form_id,
      f.staff_cash,
      f.staff_qr,
      f.staff_grab,
      f.staff_total,
      f.staff_receipts,
      st.stock_id
    FROM shifts s
    LEFT JOIN receipts r ON r.biz_date = s.shift_date
    LEFT JOIN forms f    ON f.form_date = s.shift_date
    LEFT JOIN stocks st  ON st.stock_date = s.shift_date
    ${isDate ? sql`` : sql`ORDER BY s.shift_date DESC`}
  `);

  const toNumber = (value: unknown): number | null => value == null ? null : Number(value);
  const diff = (staff: number | null, pos: number | null): number | null => staff == null || pos == null ? null : staff - pos;
  const matchMessage = (label: string, value: number | null, unit: "money" | "count") => {
    if (value == null) return "Not Available";
    if (value === 0) return `${label} Match`;
    const amount = unit === "money" ? `฿${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : String(Math.abs(value));
    return `${label} Difference ${amount}`;
  };

  return (rows as any[]).map((row) => {
    const posGross = toNumber(row.gross_sales ?? row.receipt_gross);
    const staffGross = toNumber(row.staff_total);
    const posCash = toNumber(row.pos_cash);
    const staffCash = toNumber(row.staff_cash);
    const posReceipts = toNumber(row.receipt_count);
    const staffReceipts = toNumber(row.staff_receipts);
    const grossDiff = diff(staffGross, posGross);
    const receiptDiff = diff(staffReceipts, posReceipts);
    const cashDiff = diff(staffCash, posCash);
    const hasDailySalesV2 = Boolean(row.form_id);
    const hasDailyStockV2 = Boolean(row.stock_id);

    const issues: string[] = [];
    if (!hasDailySalesV2) issues.push("Daily Sales V2 form is missing.");
    if (!hasDailyStockV2) issues.push("Daily Stock V2 form is missing.");
    if (grossDiff != null && grossDiff !== 0) issues.push(`Gross sales differ by ฿${Math.abs(grossDiff).toLocaleString("en-US", { maximumFractionDigits: 0 })}.`);
    if (receiptDiff != null && receiptDiff !== 0) issues.push(`Staff reported ${staffReceipts} receipts but POS recorded ${posReceipts}.`);
    if (cashDiff != null && cashDiff !== 0) issues.push(`Cash ${cashDiff < 0 ? "under" : "over"}-reported by ฿${Math.abs(cashDiff).toLocaleString("en-US", { maximumFractionDigits: 0 })}.`);

    let status: "VERIFIED" | "ISSUE" | "MISSING_FORM" | "MISSING_STOCK" = "VERIFIED";
    if (!hasDailySalesV2) status = "MISSING_FORM";
    else if (!hasDailyStockV2) status = "MISSING_STOCK";
    else if (issues.length > 0) status = "ISSUE";

    const issueSummary = !hasDailySalesV2 ? "Missing Daily Sales V2 form" : !hasDailyStockV2 ? "Missing Daily Stock V2 form" : issues[0]?.replace(/\.$/, "") ?? null;
    const maxAbs = Math.max(Math.abs(grossDiff ?? 0), Math.abs(cashDiff ?? 0), Math.abs(receiptDiff ?? 0));
    const severity = status === "VERIFIED" ? null : maxAbs >= 500 ? "High" : maxAbs >= 100 ? "Medium" : "Low";

    return {
      id: `sr-${String(row.shift_date).slice(0, 10)}`,
      shiftDate: String(row.shift_date).slice(0, 10),
      pos: { grossSales: posGross, cash: posCash, qr: toNumber(row.qr_total), grab: toNumber(row.grab_total), receipts: posReceipts },
      staff: { grossSales: hasDailySalesV2 ? staffGross : null, cash: hasDailySalesV2 ? staffCash : null, qr: hasDailySalesV2 ? toNumber(row.staff_qr) : null, grab: hasDailySalesV2 ? toNumber(row.staff_grab) : null, receipts: hasDailySalesV2 ? staffReceipts : null },
      differences: { grossSales: grossDiff, receipts: receiptDiff, cash: cashDiff },
      status,
      issueExplanation: issues.length > 0 ? issues.join(" ") : "All checked values match.",
      issueSummary,
      severity,
      hasDailySalesV2,
      hasDailyStockV2,
      verification: [
        { label: "Gross Sales", status: grossDiff == null ? "NOT_AVAILABLE" : grossDiff === 0 ? "MATCH" : "DIFFERENCE", message: matchMessage("Gross sales", grossDiff, "money") },
        { label: "Receipts", status: receiptDiff == null ? "NOT_AVAILABLE" : receiptDiff === 0 ? "MATCH" : "DIFFERENCE", message: matchMessage("Receipts", receiptDiff, "count") },
        { label: "Cash", status: cashDiff == null ? "NOT_AVAILABLE" : cashDiff === 0 ? "MATCH" : "DIFFERENCE", message: matchMessage("Cash", cashDiff, "money") },
      ],
      source: "loyverse_shifts + lv_receipt + daily_sales_v2 + daily_stock_v2",
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GET /history  — last 30 shifts
// ─────────────────────────────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    const reports = await buildShiftRows(30);
    return res.json({ reports, source: "loyverse_shifts + lv_receipt + daily_sales_v2 + daily_stock_v2", blockers: [] });
  } catch (err: any) {
    console.error("[shift-report/history]", err?.message);
    return res.json({
      reports: [],
      source: "loyverse_shifts + lv_receipt + daily_sales_v2 + daily_stock_v2",
      blockers: [{ code: "HISTORY_QUERY_FAILED", message: err?.message ?? "Query failed" }],
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /latest  — most recent shift
// ─────────────────────────────────────────────────────────────
router.get("/latest", async (req, res) => {
  try {
    const rows = await buildShiftRows(1);
    return res.json(rows[0] ?? null);
  } catch (err: any) {
    console.error("[shift-report/latest]", err?.message);
    return res.status(500).json({ error: "Unable to fetch latest shift", message: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /generate  — on-demand report for a specific date
// ─────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  const { shiftDate } = req.body ?? {};

  if (!shiftDate || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    return res.status(400).json({
      success: false,
      blockers: [{ code: "INVALID_DATE", message: "shiftDate (YYYY-MM-DD) is required" }],
    });
  }

  try {
    const rows = await buildShiftRows(shiftDate);

    if (rows.length === 0) {
      return res.json({
        success: false,
        report: null,
        blockers: [{ code: "NO_POS_DATA", message: `No Loyverse shift data found for ${shiftDate}` }],
      });
    }

    const report = rows[0];

    // Try to persist to shift_report_v2 (non-blocking — schema is compatible)
    let persistenceSkipped = false;
    try {
      const prisma = prismaDb();
      const shiftDateObj = new Date(`${shiftDate}T12:00:00+07:00`);

      // Delete any existing record for this date then create fresh
      await prisma.$executeRaw`
        DELETE FROM shift_report_v2 WHERE "shiftDate"::date = ${shiftDate}::date
      `;
      await prisma.shift_report_v2.create({
        data: {
          id:         report.id,
          shiftDate:  shiftDateObj,
          posData:    {
            grossSales:   report.pos.grossSales,
            cashSales:    report.pos.cash,
            grabSales:    report.pos.grab,
            qrSales:      report.pos.qr,
            receiptCount: report.pos.receipts,
            status:       report.status,
          } as object,
          salesData:  {
            staffTotal:      report.staff.grossSales,
            staffCash:       report.staff.cash,
            staffGrab:       report.staff.grab,
            staffQr:         report.staff.qr,
            staffReceipts:   report.staff.receipts,
            dailySalesV2:    report.hasDailySalesV2 ? "submitted" : "missing",
          } as object,
          stockData:  { dailyStockV2: report.hasDailyStockV2 ? "submitted" : "missing" } as object,
          variances:  report.differences as object,
          aiInsights: null,
        },
      });
    } catch (persistErr: any) {
      console.warn("[shift-report/generate] Persistence skipped:", persistErr?.message);
      persistenceSkipped = true;
    }

    return res.json({ success: true, report, persistenceSkipped });
  } catch (err: any) {
    console.error("[shift-report/generate]", err?.message);
    return res.json({
      success: false,
      report: null,
      blockers: [{ code: "GENERATE_FAILED", message: err?.message ?? "Generation failed" }],
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /view/:id  — kept for legacy compatibility
// ─────────────────────────────────────────────────────────────
router.get("/view/:id", async (req, res) => {
  const dateStr = req.params.id.replace(/^sr-/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: "Invalid report id" });
  }
  try {
    const rows = await buildShiftRows(dateStr);
    return res.json(rows[0] ?? null);
  } catch (err: any) {
    return res.status(500).json({ error: "Unable to fetch report", message: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /pdf/:id  — placeholder (PDF not rebuilt in this patch)
// ─────────────────────────────────────────────────────────────
router.get("/pdf/:id", (_req, res) => {
  res.status(501).json({ error: "PDF export not available in current build" });
});

export default router;
