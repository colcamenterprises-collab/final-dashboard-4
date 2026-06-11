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
        shift_date,
        (data->'shifts'->0->>'gross_sales')::numeric  AS gross_sales,
        (data->'shifts'->0->>'net_sales')::numeric    AS net_sales,
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
        id                  AS form_id,
        "completedBy"       AS completed_by,
        "cashSales"         AS staff_cash,
        "qrSales"           AS staff_qr,
        "grabSales"         AS staff_grab,
        "totalSales"        AS staff_total,
        "totalExpenses"     AS staff_expenses
      FROM daily_sales_v2
      WHERE "deletedAt" IS NULL
      ORDER BY COALESCE(shift_date, "shiftDate"::date), "createdAt" DESC
    )
    SELECT
      s.shift_date,
      s.gross_sales,
      s.net_sales,
      s.pos_cash,
      r.receipt_count,
      r.receipt_gross,
      r.cash_total,
      r.grab_total,
      r.qr_total,
      f.form_id,
      f.completed_by,
      f.staff_cash,
      f.staff_qr,
      f.staff_grab,
      f.staff_total,
      f.staff_expenses
    FROM shifts s
    LEFT JOIN receipts r ON r.biz_date = s.shift_date
    LEFT JOIN forms f    ON f.form_date = s.shift_date
    ${isDate ? sql`` : sql`ORDER BY s.shift_date DESC`}
  `);

  return (rows as any[]).map((row) => {
    const grossSales     = row.gross_sales    != null ? Number(row.gross_sales)    : null;
    const staffTotal     = row.staff_total    != null ? Number(row.staff_total)    : null;
    const receiptGross   = row.receipt_gross  != null ? Number(row.receipt_gross)  : null;

    const staffFormStatus: "submitted" | "missing" = row.form_id ? "submitted" : "missing";

    let posStatus: "matched" | "mismatch" | "missing" = "missing";
    let varianceSummary: object | null = null;

    if (grossSales != null && staffFormStatus === "submitted" && staffTotal != null) {
      const diff = Math.abs(staffTotal - grossSales);
      posStatus = diff <= 100 ? "matched" : "mismatch";
      varianceSummary = {
        posGross:       grossSales,
        staffTotal,
        variance:       staffTotal - grossSales,
        absVariance:    diff,
        level:          diff <= 50 ? "GREEN" : diff <= 200 ? "YELLOW" : "RED",
      };
    } else if (grossSales != null) {
      posStatus = "matched";
    }

    return {
      id:             `sr-${String(row.shift_date).slice(0, 10)}`,
      shiftDate:      String(row.shift_date).slice(0, 10),
      grossSales,
      netSales:       row.net_sales    != null ? Number(row.net_sales)    : null,
      cashSales:      row.pos_cash     != null ? Number(row.pos_cash)     : null,
      grabSales:      row.grab_total   != null ? Number(row.grab_total)   : null,
      qrSales:        row.qr_total     != null ? Number(row.qr_total)     : null,
      receiptCount:   row.receipt_count != null ? Number(row.receipt_count) : null,
      receiptGross,
      staffFormStatus,
      posStatus,
      varianceSummary,
      completedBy:    row.completed_by ?? null,
      staffTotal,
      staffExpenses:  row.staff_expenses != null ? Number(row.staff_expenses) : null,
      source:         "loyverse_shifts + lv_receipt + daily_sales_v2",
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GET /history  — last 30 shifts
// ─────────────────────────────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    const reports = await buildShiftRows(30);
    return res.json({ reports, source: "loyverse_shifts", blockers: [] });
  } catch (err: any) {
    console.error("[shift-report/history]", err?.message);
    return res.json({
      reports: [],
      source: "loyverse_shifts",
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
    return res.status(500).json({ error: "Failed to fetch latest shift", message: err?.message });
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
            grossSales:   report.grossSales,
            netSales:     report.netSales,
            cashSales:    report.cashSales,
            grabSales:    report.grabSales,
            qrSales:      report.qrSales,
            receiptCount: report.receiptCount,
            receiptGross: report.receiptGross,
            posStatus:    report.posStatus,
          } as object,
          salesData:  {
            staffTotal:     report.staffTotal,
            staffExpenses:  report.staffExpenses,
            completedBy:    report.completedBy,
            staffFormStatus: report.staffFormStatus,
          } as object,
          stockData:  {} as object,
          variances:  report.varianceSummary as object ?? {} as object,
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
    return res.status(500).json({ error: "Failed to fetch report", message: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /pdf/:id  — placeholder (PDF not rebuilt in this patch)
// ─────────────────────────────────────────────────────────────
router.get("/pdf/:id", (_req, res) => {
  res.status(501).json({ error: "PDF export not available in current build" });
});

export default router;
