// SHIFT VERIFICATION ROUTES
// Read-only reconciliation from canonical sources: loyverse_shifts, lv_receipt, daily_sales_v2.

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

type Amount = number | null;
type CompareStatus = "MATCH" | "DIFFERENCE" | "NOT_AVAILABLE";
type PosStatus = "VERIFIED" | "ISSUE" | "MISSING_RECEIPTS" | "MISSING_SHIFT_REPORT";
type StaffStatus = "VERIFIED" | "ISSUE" | "MISSING_FORM";
type OverallStatus = "VERIFIED" | "POS ISSUE" | "STAFF ISSUE" | "MISSING FORM";

const SOURCE_MAPPING = {
  receipts: {
    table: "lv_receipt",
    businessWindow: "Asia/Bangkok shift window: shift_date 18:00 inclusive to next day 03:00 exclusive",
    fields: ["datetime_bkk", "total_amount", "payment_json", "receipt_id"],
  },
  shiftReport: {
    table: "loyverse_shifts",
    dateField: "shift_date",
    fields: ["data.shifts[0].gross_sales", "data.shifts[0].net_sales", "data.shifts[0].cash_payments", "data.shifts[0].qr_payments", "data.shifts[0].grab_payments", "data.shifts[0].receipt_count"],
  },
  dailySalesV2: {
    table: "daily_sales_v2",
    shiftDateField: "COALESCE(shift_date, shiftDate::date)",
    fields: ["totalSales", "cashSales", "qrSales", "grabSales", "aroiSales", "cash_receipt_count", "qr_receipt_count", "grab_receipt_count"],
  },
};

const toNumber = (value: unknown): Amount => value == null ? null : Number(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const diff = (left: Amount, right: Amount): Amount => left == null || right == null ? null : round(left - right);
const isZero = (value: Amount) => value != null && Math.abs(value) < 0.005;
const absMoney = (value: number) => `฿${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function compare(receiptsValue: Amount, shiftValue: Amount) {
  const difference = diff(receiptsValue, shiftValue);
  const status: CompareStatus = difference == null ? "NOT_AVAILABLE" : isZero(difference) ? "MATCH" : "DIFFERENCE";
  return { receiptsValue, shiftReportValue: shiftValue, difference, status };
}

function compareStaff(shiftValue: Amount, staffValue: Amount) {
  const difference = diff(staffValue, shiftValue);
  const status: CompareStatus = difference == null ? "NOT_AVAILABLE" : isZero(difference) ? "MATCH" : "DIFFERENCE";
  return { shiftReportValue: shiftValue, dailySalesV2Value: staffValue, difference, status };
}

function issueSentence(prefix: string, field: string, difference: Amount, unit: "money" | "count") {
  if (difference == null || isZero(difference)) return null;
  if (unit === "count") return `${prefix} ${field} differs by ${Math.abs(difference)} receipts.`;
  const direction = difference < 0 ? "under-reported" : "over-reported";
  return `${prefix} ${field} is ${direction} by ${absMoney(difference)}.`;
}

async function buildShiftRows(limitOrDate: number | string) {
  if (!db) throw new Error("DB not available");
  const isDate = typeof limitOrDate === "string";

  const { rows } = await db.execute(sql`
    WITH selected_shifts AS (
      SELECT shift_date::date AS shift_date, data
      FROM loyverse_shifts
      ${isDate ? sql`WHERE shift_date = ${limitOrDate}::date` : sql`ORDER BY shift_date DESC LIMIT ${sql.raw(String(limitOrDate))}`}
    ),
    shift_reports AS (
      SELECT
        shift_date,
        NULLIF(data->'shifts'->0->>'gross_sales', '')::numeric AS shift_gross,
        NULLIF(data->'shifts'->0->>'net_sales', '')::numeric AS shift_net,
        NULLIF(data->'shifts'->0->>'cash_payments', '')::numeric AS shift_cash,
        COALESCE(NULLIF(data->'shifts'->0->>'qr_payments', '')::numeric, NULLIF(data->'shifts'->0->>'qr_sales', '')::numeric) AS shift_qr,
        COALESCE(NULLIF(data->'shifts'->0->>'grab_payments', '')::numeric, NULLIF(data->'shifts'->0->>'grab_sales', '')::numeric) AS shift_grab,
        NULLIF(data->'shifts'->0->>'receipt_count', '')::numeric AS shift_receipts
      FROM selected_shifts
    ),
    receipts AS (
      SELECT
        CASE
          WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18 THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
          WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3 THEN ((datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day')::date
          ELSE NULL
        END AS shift_date,
        COUNT(*)::numeric AS receipt_count,
        SUM(total_amount)::numeric AS receipt_gross,
        SUM(pay.cash_amt)::numeric AS receipt_cash,
        SUM(pay.qr_amt)::numeric AS receipt_qr,
        SUM(pay.grab_amt)::numeric AS receipt_grab,
        (SUM(total_amount) - SUM(pay.cash_amt) - SUM(pay.qr_amt) - SUM(pay.grab_amt))::numeric AS receipt_other
      FROM lv_receipt
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN lower(e->>'name') = 'cash' THEN NULLIF(e->>'money_amount', '')::numeric ELSE 0 END), 0) AS cash_amt,
          COALESCE(SUM(CASE WHEN lower(e->>'name') LIKE '%qr%' OR lower(e->>'name') LIKE '%scan%' THEN NULLIF(e->>'money_amount', '')::numeric ELSE 0 END), 0) AS qr_amt,
          COALESCE(SUM(CASE WHEN lower(e->>'name') LIKE '%grab%' THEN NULLIF(e->>'money_amount', '')::numeric ELSE 0 END), 0) AS grab_amt
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(payment_json) = 'array' THEN payment_json ELSE '[]'::jsonb END) e
      ) pay
      WHERE EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18 OR EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
      GROUP BY 1
    ),
    forms AS (
      SELECT DISTINCT ON (COALESCE(shift_date, "shiftDate"::date))
        COALESCE(shift_date, "shiftDate"::date) AS shift_date,
        id AS form_id,
        "totalSales"::numeric AS staff_gross,
        "cashSales"::numeric AS staff_cash,
        "qrSales"::numeric AS staff_qr,
        "grabSales"::numeric AS staff_grab,
        "aroiSales"::numeric AS staff_other,
        (COALESCE("cash_receipt_count", 0) + COALESCE("qr_receipt_count", 0) + COALESCE("grab_receipt_count", 0))::numeric AS staff_receipts
      FROM daily_sales_v2
      WHERE "deletedAt" IS NULL
      ORDER BY COALESCE(shift_date, "shiftDate"::date), "createdAt" DESC
    )
    SELECT s.shift_date, r.receipt_count, r.receipt_gross, NULL::numeric AS receipt_net, r.receipt_cash, r.receipt_qr, r.receipt_grab, r.receipt_other,
           s.shift_gross, s.shift_net, s.shift_cash, s.shift_qr, s.shift_grab,
           (s.shift_gross - COALESCE(s.shift_cash,0) - COALESCE(s.shift_qr,0) - COALESCE(s.shift_grab,0))::numeric AS shift_other,
           s.shift_receipts, f.form_id, f.staff_gross, f.staff_cash, f.staff_qr, f.staff_grab, f.staff_other, f.staff_receipts
    FROM shift_reports s
    LEFT JOIN receipts r ON r.shift_date = s.shift_date
    LEFT JOIN forms f ON f.shift_date = s.shift_date
    ${isDate ? sql`` : sql`ORDER BY s.shift_date DESC`}
  `);

  return (rows as any[]).map((row) => {
    const receipts = { grossSales: toNumber(row.receipt_gross), netSales: toNumber(row.receipt_net), cash: toNumber(row.receipt_cash), qr: toNumber(row.receipt_qr), grab: toNumber(row.receipt_grab), other: toNumber(row.receipt_other), receiptCount: toNumber(row.receipt_count) };
    const shiftReport = { grossSales: toNumber(row.shift_gross), netSales: toNumber(row.shift_net), cash: toNumber(row.shift_cash), qr: toNumber(row.shift_qr), grab: toNumber(row.shift_grab), other: toNumber(row.shift_other), receiptCount: toNumber(row.shift_receipts) };
    const dailySalesV2 = row.form_id ? { grossSales: toNumber(row.staff_gross), cash: toNumber(row.staff_cash), qr: toNumber(row.staff_qr), grab: toNumber(row.staff_grab), other: toNumber(row.staff_other), receiptCount: toNumber(row.staff_receipts) } : { grossSales: null, cash: null, qr: null, grab: null, other: null, receiptCount: null };

    const posFields = {
      grossSales: compare(receipts.grossSales, shiftReport.grossSales), netSales: compare(receipts.netSales, shiftReport.netSales), cash: compare(receipts.cash, shiftReport.cash), qr: compare(receipts.qr, shiftReport.qr), grab: compare(receipts.grab, shiftReport.grab), other: compare(receipts.other, shiftReport.other), receiptCount: compare(receipts.receiptCount, shiftReport.receiptCount),
    };
    const staffFields = {
      grossSales: compareStaff(shiftReport.grossSales, dailySalesV2.grossSales), cash: compareStaff(shiftReport.cash, dailySalesV2.cash), qr: compareStaff(shiftReport.qr, dailySalesV2.qr), grab: compareStaff(shiftReport.grab, dailySalesV2.grab), other: compareStaff(shiftReport.other, dailySalesV2.other), receiptCount: compareStaff(shiftReport.receiptCount, dailySalesV2.receiptCount),
    };

    const hasReceipts = receipts.receiptCount != null;
    const hasShiftReport = shiftReport.grossSales != null || shiftReport.netSales != null;
    const hasDailySalesV2 = Boolean(row.form_id);
    const posComparable = Object.values(posFields).filter((f) => f.status !== "NOT_AVAILABLE");
    const staffComparable = Object.values(staffFields).filter((f) => f.status !== "NOT_AVAILABLE");
    const posIntegrityStatus: PosStatus = !hasShiftReport ? "MISSING_SHIFT_REPORT" : !hasReceipts ? "MISSING_RECEIPTS" : posComparable.some((f) => f.status === "DIFFERENCE") ? "ISSUE" : "VERIFIED";
    const staffVerificationStatus: StaffStatus = !hasDailySalesV2 ? "MISSING_FORM" : staffComparable.some((f) => f.status === "DIFFERENCE") ? "ISSUE" : "VERIFIED";
    const overallStatus: OverallStatus = posIntegrityStatus === "ISSUE" || posIntegrityStatus.startsWith("MISSING_") ? "POS ISSUE" : staffVerificationStatus === "MISSING_FORM" ? "MISSING FORM" : staffVerificationStatus === "ISSUE" ? "STAFF ISSUE" : "VERIFIED";

    const explanations: string[] = [];
    if (posIntegrityStatus === "MISSING_RECEIPTS") explanations.push("Receipts are not available for this Bangkok business shift window.");
    if (posIntegrityStatus === "MISSING_SHIFT_REPORT") explanations.push("Loyverse shift report is not available for this shift.");
    for (const [label, field] of [["Gross sales", posFields.grossSales], ["Cash", posFields.cash], ["QR", posFields.qr], ["Grab", posFields.grab], ["Other", posFields.other], ["Receipt count", posFields.receiptCount]] as const) {
      const s = issueSentence("POS receipt import does not match the Loyverse shift report.", label, field.difference, label === "Receipt count" ? "count" : "money");
      if (s) explanations.push(s);
    }
    if (!hasDailySalesV2) explanations.push("Daily Sales V2 form is missing for this shift.");
    for (const [label, field] of [["Gross sales", staffFields.grossSales], ["Cash", staffFields.cash], ["QR", staffFields.qr], ["Grab", staffFields.grab], ["Other", staffFields.other], ["Receipt count", staffFields.receiptCount]] as const) {
      const s = issueSentence("Staff form does not match the Loyverse shift report.", label, field.difference, label === "Receipt count" ? "count" : "money");
      if (s) explanations.push(s);
    }

    const maxAbs = Math.max(...[...Object.values(posFields), ...Object.values(staffFields)].map((f) => Math.abs(f.difference ?? 0)));
    return {
      id: `sr-${String(row.shift_date).slice(0, 10)}`,
      shiftDate: String(row.shift_date).slice(0, 10),
      receipts, shiftReport, dailySalesV2,
      posIntegrityStatus, staffVerificationStatus, overallStatus,
      comparisons: { posIntegrity: posFields, staffVerification: staffFields },
      issueExplanation: explanations.length ? explanations.join(" ") : "Receipts match the Loyverse shift report and Daily Sales V2 matches the Loyverse shift report.",
      issues: explanations.map((explanation) => ({ shiftDate: String(row.shift_date).slice(0, 10), issueType: explanation.includes("Daily Sales V2 form is missing") ? "Missing Form" : explanation.startsWith("Staff") ? "Staff Issue" : "POS Issue", severity: maxAbs >= 500 ? "High" : maxAbs >= 100 ? "Medium" : "Low", explanation, status: "Open" })),
      sourceMapping: SOURCE_MAPPING,
    };
  });
}

router.get("/history", async (_req, res) => {
  try {
    const reports = await buildShiftRows(30);
    return res.json({ reports, sourceMapping: SOURCE_MAPPING, statusRules: { posIntegrityStatus: ["VERIFIED", "ISSUE", "MISSING_RECEIPTS", "MISSING_SHIFT_REPORT"], staffVerificationStatus: ["VERIFIED", "ISSUE", "MISSING_FORM"], overallStatus: "VERIFIED only if both POS integrity and staff verification are verified; POS ISSUE if receipts vs shift report fails; STAFF ISSUE if staff vs shift report fails; MISSING FORM if Daily Sales V2 missing." }, blockers: [] });
  } catch (err: any) {
    console.error("[shift-report/history]", err?.message);
    return res.json({ reports: [], sourceMapping: SOURCE_MAPPING, blockers: [{ code: "HISTORY_QUERY_FAILED", message: err?.message ?? "Query failed", where: "/api/shift-report/history", canonical_source: "loyverse_shifts,lv_receipt,daily_sales_v2", auto_build_attempted: false }] });
  }
});

router.get("/latest", async (_req, res) => {
  try { const rows = await buildShiftRows(1); return res.json(rows[0] ?? null); }
  catch (err: any) { return res.status(500).json({ error: "Unable to fetch latest shift", message: err?.message }); }
});

router.post("/generate", async (req, res) => {
  const { shiftDate } = req.body ?? {};
  if (!shiftDate || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return res.status(400).json({ success: false, blockers: [{ code: "INVALID_DATE", message: "shiftDate (YYYY-MM-DD) is required", where: "/api/shift-report/generate", canonical_source: "loyverse_shifts", auto_build_attempted: false }] });
  try {
    const rows = await buildShiftRows(shiftDate);
    return res.json({ success: rows.length > 0, report: rows[0] ?? null, readOnly: true, blockers: rows.length ? [] : [{ code: "NO_SHIFT_REPORT", message: `No Loyverse shift report found for ${shiftDate}.`, where: "/api/shift-report/generate", canonical_source: "loyverse_shifts", auto_build_attempted: false }] });
  } catch (err: any) {
    return res.json({ success: false, report: null, blockers: [{ code: "GENERATE_FAILED", message: err?.message ?? "Generation failed", where: "/api/shift-report/generate", canonical_source: "loyverse_shifts,lv_receipt,daily_sales_v2", auto_build_attempted: false }] });
  }
});

router.get("/view/:id", async (req, res) => {
  const dateStr = req.params.id.replace(/^sr-/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: "Invalid report id" });
  try { const rows = await buildShiftRows(dateStr); return res.json(rows[0] ?? null); }
  catch (err: any) { return res.status(500).json({ error: "Unable to fetch report", message: err?.message }); }
});

router.get("/pdf/:id", (_req, res) => res.status(501).json({ error: "PDF export not available in current build" }));

export default router;
