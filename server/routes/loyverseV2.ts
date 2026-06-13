import { Router, type NextFunction, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { db } from "../lib/prisma.js";
import { getBangkokBusinessWindow } from "../services/loyverseMirrorCommon.js";
import { buildLoyverseMirrorDiagnostic } from "../services/loyverseMirrorDiagnostic.js";
import { attachSessionUser, requireSessionAuth } from "../middleware/sessionAuth.js";
import { getPinSessionUser } from "./pinAuth.js";

const router = Router();
const prisma = new PrismaClient();

const CASH_PT = "3fbd6501-9dc0-42d7-abc8-f7a004d0f524";
const GRAB_PT = "a2559e59-dc8b-4c77-8478-9a9fc348b397";
const QR_PT   = "4ca8276c-d8ab-48e3-91ee-fe0fbe1387c2";

function requireMirrorDiagnosticAuth(req: Request, res: Response, next: NextFunction) {
  if (res.locals.isBotRequest) return next();
  if (attachSessionUser(req)) return next();

  const pinUser = getPinSessionUser(req);
  if (pinUser?.role === "owner") return next();

  return res.status(401).json({ ok: false, error: "Unauthorized" });
}


router.get("/loyverse/mirror-diagnostic", requireMirrorDiagnosticAuth, async (_req, res) => {
  try {
    const diagnostic = await buildLoyverseMirrorDiagnostic();
    res.json(diagnostic);
  } catch (error: any) {
    console.error("[loyverseV2] mirror diagnostic failed:", error);
    res.status(200).json({
      status: "fail",
      latestSyncAt: null,
      latestReceiptDate: null,
      latestShiftDate: null,
      canonicalTables: {},
      receiptCounts: {},
      integrity: {},
      paymentMapping: { mappedPayments: [], unmappedPayments: [], rules: {} },
      latestShiftComparison: null,
      sevenDayComparison: [],
      mismatches: [],
      blockers: [{
        code: "MIRROR_DIAGNOSTIC_ERROR",
        message: error?.message || "Loyverse mirror diagnostic failed.",
        where: "GET /api/loyverse/mirror-diagnostic (protected)",
        canonical_source: "lv_receipt/lv_line_item/lv_modifier",
        auto_build_attempted: false,
      }],
      sourceMap: {},
    });
  }
});

// ── UI data endpoint: same diagnostic, session-gated (owner UI) ────────────
// In-memory cache — 2-minute TTL so the React page loads instantly on repeat visits.
let _mirrorUiCache: { data: any; expiresAt: number } | null = null;

router.get("/loyverse/mirror-ui-data", requireSessionAuth, async (_req, res) => {
  const now = Date.now();
  if (_mirrorUiCache && _mirrorUiCache.expiresAt > now) {
    return res.json(_mirrorUiCache.data);
  }
  try {
    const diagnostic = await buildLoyverseMirrorDiagnostic();
    _mirrorUiCache = { data: diagnostic, expiresAt: now + 120_000 };
    res.json(diagnostic);
  } catch (error: any) {
    console.error("[loyverseV2] mirror-ui-data failed:", error);
    res.status(200).json({
      status: "fail",
      latestSyncAt: null,
      latestReceiptDate: null,
      latestShiftDate: null,
      canonicalTables: {},
      receiptCounts: {},
      integrity: {},
      paymentMapping: { mappedPayments: [], unmappedPayments: [], rules: {} },
      latestShiftComparison: null,
      sevenDayComparison: [],
      mismatches: [],
      blockers: [{ code: "MIRROR_DIAGNOSTIC_ERROR", message: error?.message || "Failed." }],
      sourceMap: {},
    });
  }
});

function dateRange(from: string, to: string) {
  const start = DateTime.fromISO(from, { zone: "Asia/Bangkok" }).startOf("day");
  const end = DateTime.fromISO(to, { zone: "Asia/Bangkok" }).startOf("day");
  if (!start.isValid || !end.isValid || end < start) return [];
  const days: string[] = [];
  let current = start;
  while (current <= end && days.length < 31) {
    days.push(current.toISODate()!);
    current = current.plus({ days: 1 });
  }
  return days;
}

async function canonicalReceiptCount(fromISO: string, toISO: string) {
  const rows = await db().$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM lv_receipt WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
    fromISO,
    toISO,
  );
  return Number(rows[0]?.count ?? 0);
}

router.post("/loyverse/sync-missing-shifts", async (req, res) => {
  try {
    const bodyDates = Array.isArray(req.body?.dates) ? req.body.dates : [];
    const queryDates = typeof req.query.dates === "string" ? req.query.dates.split(",") : [];
    const from = String(req.query.from || req.body?.from || "");
    const to = String(req.query.to || req.body?.to || from || "");
    const dates = [...bodyDates, ...queryDates].map((value) => String(value).trim()).filter(Boolean);
    const requestedDates = dates.length > 0 ? dates : (from && to ? dateRange(from, to) : []);

    if (requestedDates.length === 0) {
      return res.status(400).json({ ok: false, error: "dates or from/to required (YYYY-MM-DD)" });
    }

    const results = [];
    for (const date of requestedDates) {
      const window = getBangkokBusinessWindow(date);
      const beforeCount = await canonicalReceiptCount(window.startISO, window.endISO);
      if (beforeCount > 0) {
        results.push({ date, status: "skipped_existing", beforeCount, afterCount: beforeCount, shiftWindow: window });
        continue;
      }

      const syncResult = await importReceiptsV2(window.startISO, window.endISO);
      const afterCount = await canonicalReceiptCount(window.startISO, window.endISO);
      results.push({ date, status: afterCount > 0 ? "synced" : "missing_after_sync", beforeCount, afterCount, shiftWindow: window, syncResult });
    }

    res.json({ ok: true, mode: "sync-missing-shifts", dates: requestedDates, results });
  } catch (error: any) {
    console.error("[loyverseV2] sync missing shifts failed:", error);
    res.status(500).json({ ok: false, error: error?.message || "sync-missing-shifts failed" });
  }
});

router.post("/loyverse/sync", async (req, res) => {
  try {
    console.log("[loyverseV2] sync request - query:", req.query, "body:", req.body);
    const { from, to } = req.query as { from: string; to: string };
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: "from/to required (YYYY-MM-DD)", received: { query: req.query, body: req.body } });
    }

    const fromWindow = getBangkokBusinessWindow(from);
    const toWindow = getBangkokBusinessWindow(to);
    const fromISO = fromWindow.startISO;
    const toISO = toWindow.endISO;

    const result = await importReceiptsV2(fromISO, toISO);
    res.json({ ...result, fromISO, toISO, shiftWindow: { from: fromWindow, to: toWindow } });
  } catch (error: any) {
    console.error("[loyverseV2] sync failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── GET /api/loyverse/mirror-diagnostic ─────────────────────────────────────
// Production mirror verification: confirms lv_receipt, lv_line_item, lv_modifier,
// and loyverse_shifts are populated, current, and consistent for the last 7 business
// days. Uses payment_json[].money_amount as the authoritative Baht source.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/loyverse/mirror-diagnostic", async (req, res) => {
  try {
    const TZ = "Asia/Bangkok";

    // ── 1. Canonical table summary ──────────────────────────────────────────
    const [lvReceipt, lvLineItem, lvModifier, lvShifts] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as total, MAX(datetime_bkk) as latest_receipt, MAX(created_at) as latest_sync
        FROM lv_receipt`,
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as total, MAX(created_at) as latest_sync FROM lv_line_item`,
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as total, MAX(created_at) as latest_sync FROM lv_modifier`,
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as total, MAX(shift_date) as latest_shift FROM loyverse_shifts`,
    ]);

    const canonicalTables = {
      lv_receipt:     { rows: lvReceipt[0].total,   latestReceipt: lvReceipt[0].latest_receipt,  latestSync: lvReceipt[0].latest_sync },
      lv_line_item:   { rows: lvLineItem[0].total,  latestSync: lvLineItem[0].latest_sync },
      lv_modifier:    { rows: lvModifier[0].total,  latestSync: lvModifier[0].latest_sync },
      loyverse_shifts:{ rows: lvShifts[0].total,    latestShift: lvShifts[0].latest_shift },
    };

    // ── 2. Payment type mapping ─────────────────────────────────────────────
    const ptRows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        p->>'payment_type_id' as pt_id,
        p->>'name'            as pt_name,
        p->>'type'            as pt_type,
        COUNT(*)::int         as receipt_count
      FROM lv_receipt,
           LATERAL jsonb_array_elements(payment_json) AS p
      WHERE payment_json IS NOT NULL AND jsonb_typeof(payment_json) = 'array'
      GROUP BY p->>'payment_type_id', p->>'name', p->>'type'
      ORDER BY receipt_count DESC`;

    const paymentMapping = ptRows.map(r => ({
      paymentTypeId: r.pt_id,
      name:          r.pt_name,
      type:          r.pt_type,
      receiptCount:  r.receipt_count,
      appLabel:      r.pt_id === CASH_PT ? "Cash" : r.pt_id === GRAB_PT ? "Grab" : r.pt_id === QR_PT ? "QR" : "Other",
    }));

    // ── 3. Seven-day comparison ─────────────────────────────────────────────
    const sevenDayRows = await prisma.$queryRaw<any[]>`
      WITH bkk_receipts AS (
        SELECT
          r.receipt_id,
          CASE
            WHEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
            THEN (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
            ELSE (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
          END AS biz_date,
          p->>'payment_type_id' as pt_id,
          (p->>'money_amount')::numeric as pay_amount
        FROM lv_receipt r,
             LATERAL jsonb_array_elements(r.payment_json) AS p
        WHERE r.datetime_bkk >= NOW() - INTERVAL '14 days'
          AND r.payment_json IS NOT NULL
          AND jsonb_typeof(r.payment_json) = 'array'
      ),
      daily AS (
        SELECT
          biz_date::date as shift_date,
          COUNT(DISTINCT receipt_id)::int as receipt_count,
          SUM(pay_amount)::numeric as gross,
          SUM(CASE WHEN pt_id = ${CASH_PT} THEN pay_amount ELSE 0 END)::numeric as cash_total,
          SUM(CASE WHEN pt_id = ${GRAB_PT} THEN pay_amount ELSE 0 END)::numeric as grab_total,
          SUM(CASE WHEN pt_id = ${QR_PT}   THEN pay_amount ELSE 0 END)::numeric as qr_total
        FROM bkk_receipts
        GROUP BY biz_date
        ORDER BY biz_date DESC
        LIMIT 7
      )
      SELECT
        d.shift_date,
        d.receipt_count                                     AS app_receipt_count,
        d.gross                                             AS app_gross,
        d.cash_total                                        AS app_cash,
        d.grab_total                                        AS app_grab,
        d.qr_total                                          AS app_qr,
        (s.data->'shifts'->0->>'gross_sales')::numeric      AS shift_gross,
        (s.data->'shifts'->0->>'net_sales')::numeric        AS shift_net,
        (s.data->'shifts'->0->>'discounts')::numeric        AS shift_discounts,
        (s.data->'shifts'->0->>'refunds')::numeric          AS shift_refunds,
        (s.data->'shifts'->0->>'cash_payments')::numeric    AS shift_cash,
        (SELECT SUM((p->>'money_amount')::numeric)
           FROM jsonb_array_elements(s.data->'shifts'->0->'payments') AS p
          WHERE p->>'payment_type_id' = ${GRAB_PT})         AS shift_grab,
        (SELECT SUM((p->>'money_amount')::numeric)
           FROM jsonb_array_elements(s.data->'shifts'->0->'payments') AS p
          WHERE p->>'payment_type_id' = ${QR_PT})           AS shift_qr
      FROM daily d
      LEFT JOIN loyverse_shifts s ON s.shift_date = d.shift_date
      ORDER BY d.shift_date DESC`;

    const sevenDayComparison = sevenDayRows.map(r => {
      const appNet  = Number(r.app_gross  ?? 0);
      const sNet    = Number(r.shift_net  ?? 0);
      const diff    = sNet > 0 ? Math.round(Math.abs(appNet - sNet) * 100) / 100 : null;
      const status  = r.shift_net == null ? "NO_SHIFT_DATA"
                    : diff === 0          ? "MATCH"
                    :                       "MISMATCH";
      return {
        shiftDate:          r.shift_date,
        appReceiptCount:    Number(r.app_receipt_count),
        appGross:           Number(r.app_gross       ?? 0),
        appCash:            Number(r.app_cash        ?? 0),
        appGrab:            Number(r.app_grab        ?? 0),
        appQr:              Number(r.app_qr          ?? 0),
        shiftGross:         r.shift_gross    != null ? Number(r.shift_gross)    : null,
        shiftNet:           r.shift_net      != null ? Number(r.shift_net)      : null,
        shiftDiscounts:     r.shift_discounts != null ? Number(r.shift_discounts) : null,
        shiftRefunds:       r.shift_refunds  != null ? Number(r.shift_refunds)  : null,
        shiftCash:          r.shift_cash     != null ? Number(r.shift_cash)     : null,
        shiftGrab:          r.shift_grab     != null ? Number(r.shift_grab)     : null,
        shiftQr:            r.shift_qr       != null ? Number(r.shift_qr)       : null,
        netDifference:      diff,
        status,
      };
    });

    // ── 4. Latest shift full comparison ────────────────────────────────────
    const latestShiftRow = sevenDayComparison[0] ?? null;

    // Item + modifier counts for latest biz day
    let itemCount = 0; let modifierCount = 0;
    if (latestShiftRow) {
      const latestDate = latestShiftRow.shiftDate;
      const icRows = await prisma.$queryRaw<any[]>`
        WITH bkk AS (
          SELECT receipt_id,
            CASE WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
                 THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
                 ELSE (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
            END AS biz_date
          FROM lv_receipt
        )
        SELECT
          (SELECT COUNT(*)::int FROM lv_line_item li JOIN bkk ON li.receipt_id = bkk.receipt_id WHERE bkk.biz_date = ${latestDate}::date) AS item_count,
          (SELECT COUNT(*)::int FROM lv_modifier  m  JOIN bkk ON m.receipt_id  = bkk.receipt_id WHERE bkk.biz_date = ${latestDate}::date) AS modifier_count`;
      itemCount    = Number(icRows[0]?.item_count    ?? 0);
      modifierCount= Number(icRows[0]?.modifier_count ?? 0);
    }

    const latestShiftComparison = latestShiftRow ? { ...latestShiftRow, itemCount, modifierCount } : null;

    // ── 5. Integrity summary ────────────────────────────────────────────────
    const mismatches  = sevenDayComparison.filter(r => r.status === "MISMATCH");
    const noShiftData = sevenDayComparison.filter(r => r.status === "NO_SHIFT_DATA");
    const blockers: string[] = [];

    const fmtDate = (d: any) => d ? String(d).slice(0, 10) : "unknown";

    if (mismatches.length > 0) {
      blockers.push(`${mismatches.length} day(s) with net sales mismatch: ${mismatches.map(r => fmtDate(r.shiftDate)).join(", ")}`);
    }
    if (noShiftData.length > 0) {
      blockers.push(`${noShiftData.length} day(s) in lv_receipt have no loyverse_shifts entry: ${noShiftData.map(r => fmtDate(r.shiftDate)).join(", ")}`);
    }

    // Only flag stale receipts outside Bangkok shift window (17:00–03:00).
    // During daytime (03:00–17:00 Bangkok) no new receipts are expected.
    const latestReceiptAge = lvReceipt[0].latest_receipt
      ? Math.round((Date.now() - new Date(lvReceipt[0].latest_receipt).getTime()) / 1000 / 60)
      : null;
    const bkkHour    = new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false });
    const hourNum    = parseInt(bkkHour, 10);
    const inShiftWindow = hourNum >= 17 || hourNum < 3;
    if (latestReceiptAge !== null && latestReceiptAge > 120 && inShiftWindow) {
      blockers.push(`Latest receipt is ${latestReceiptAge} minutes old during active shift window — sync may be behind`);
    }

    // ── 6. Duplicate & orphan data integrity ────────────────────────────────
    const [dupRows, orphanItemRows, orphanModRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS total, COUNT(DISTINCT receipt_id)::int AS distinct_count
        FROM lv_receipt`,
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS orphan_count
        FROM lv_line_item li
        WHERE NOT EXISTS (SELECT 1 FROM lv_receipt r WHERE r.receipt_id = li.receipt_id)`,
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS orphan_count
        FROM lv_modifier m
        WHERE NOT EXISTS (SELECT 1 FROM lv_receipt r WHERE r.receipt_id = m.receipt_id)`,
    ]);

    const duplicateReceiptCount = dupRows[0].total - dupRows[0].distinct_count;
    const orphanLineItemCount   = Number(orphanItemRows[0].orphan_count);
    const orphanModifierCount   = Number(orphanModRows[0].orphan_count);

    if (duplicateReceiptCount > 0)
      blockers.push(`${duplicateReceiptCount} duplicate receipt_id(s) detected in lv_receipt`);
    if (orphanLineItemCount > 0)
      blockers.push(`${orphanLineItemCount} orphan line item(s) in lv_line_item (receipt not in lv_receipt)`);
    if (orphanModifierCount > 0)
      blockers.push(`${orphanModifierCount} orphan modifier(s) in lv_modifier (receipt not in lv_receipt)`);

    // Unmapped payments: payment type IDs not covered by the 3 known payment types.
    // All unknown IDs currently resolve to "Other" (acceptable per spec). Listed here
    // explicitly so any future new Loyverse payment type is immediately visible.
    const unmappedPayments = paymentMapping.filter(
      p => ![CASH_PT, GRAB_PT, QR_PT].includes(p.paymentTypeId)
    );

    const allMatch = blockers.length === 0;

    const integrity = {
      totalDaysChecked:    sevenDayComparison.length,
      matchingDays:        sevenDayComparison.filter(r => r.status === "MATCH").length,
      mismatchDays:        mismatches.length,
      noShiftDataDays:     noShiftData.length,
      latestReceiptAgeMin: latestReceiptAge,
      duplicateReceipts:   duplicateReceiptCount,
      orphanLineItems:     orphanLineItemCount,
      orphanModifiers:     orphanModifierCount,
    };

    const dataIntegrity = {
      duplicateReceipts:   duplicateReceiptCount,
      orphanLineItems:     orphanLineItemCount,
      orphanModifiers:     orphanModifierCount,
      unmappedPayments,
      idempotencyNote:     "lv_line_item and lv_modifier use ON CONFLICT DO NOTHING. lv_receipt uses ON CONFLICT DO UPDATE (non-financial fields only). Re-running the same sync range cannot create duplicates.",
    };

    const status = allMatch ? "MIRROR_VERIFIED" : "MIRROR_ISSUES_FOUND";

    return res.json({
      ok: true,
      status,
      latestSyncAt:          lvReceipt[0].latest_sync,
      latestReceiptDate:     lvReceipt[0].latest_receipt,
      latestShiftDate:       lvShifts[0].latest_shift,
      canonicalTables,
      paymentMapping,
      integrity,
      dataIntegrity,
      latestShiftComparison,
      sevenDayComparison,
      blockers,
      mismatches,
      note: "All financial values derived from payment_json[].money_amount (Baht). total_amount is not used.",
    });
  } catch (err: any) {
    console.error("[mirror-diagnostic] error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/loyverse/sync-missing-shifts ───────────────────────────────────
// Manual trigger for the missing shift recovery. Checks the last N BKK business
// days (default 3) for dates that have receipts but no loyverse_shifts row, then
// fetches and upserts them from the Loyverse API.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/loyverse/sync-missing-shifts", async (req, res) => {
  try {
    const lookbackDays = Math.min(Number(req.query.days ?? 3), 14);

    const [missingRows] = await Promise.all([
      prisma.$queryRaw<{ biz_date: string }[]>`
        WITH bkk_dates AS (
          SELECT DISTINCT
            CASE
              WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
              THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
              ELSE (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
            END AS biz_date
          FROM lv_receipt
          WHERE datetime_bkk >= NOW() - (${lookbackDays + 1} || ' days')::interval
        )
        SELECT biz_date::text
        FROM bkk_dates
        WHERE biz_date < (NOW() AT TIME ZONE 'Asia/Bangkok')::date
          AND biz_date NOT IN (SELECT shift_date FROM loyverse_shifts)
        ORDER BY biz_date DESC
      `,
    ]);

    if (missingRows.length === 0) {
      return res.json({ ok: true, recovered: [], message: `No missing shift dates in last ${lookbackDays} days` });
    }

    const { loyverseAPI } = await import("../loyverseAPI");
    const { db }              = await import("../db");
    const { loyverse_shifts } = await import("../../shared/schema");

    const results: { biz_date: string; status: string; shifts?: number; error?: string }[] = [];

    if (!db) throw new Error("DB not available");

    for (const { biz_date } of missingRows) {
      const dateStr = String(biz_date).slice(0, 10); // "2026-06-09 00:00:00" → "2026-06-09"
      try {
        const midnight   = new Date(`${dateStr}T00:00:00Z`);
        const retryStart = new Date(midnight.getTime() - (14 * 3_600_000));
        const retryEnd   = new Date(midnight.getTime() + ( 4 * 3_600_000));

        const retryResp    = await loyverseAPI.getShifts({
          start_time: retryStart.toISOString(),
          end_time:   retryEnd.toISOString(),
          limit: 10,
        });
        const closedShifts = (retryResp.shifts as any[]).filter((s: any) => !!s.closed_at);

        if (closedShifts.length > 0) {
          await db.insert(loyverse_shifts)
            .values({ shiftDate: dateStr, data: { shifts: closedShifts } })
            .onConflictDoUpdate({
              target: loyverse_shifts.shiftDate,
              set: { data: { shifts: closedShifts } },
            });
          results.push({ biz_date: dateStr, status: "recovered", shifts: closedShifts.length });
        } else {
          results.push({ biz_date: dateStr, status: "not_finalised_yet" });
        }
      } catch (e: any) {
        results.push({ biz_date: dateStr, status: "error", error: e.message });
      }
    }

    return res.json({ ok: true, recovered: results });
  } catch (err: any) {
    console.error("[sync-missing-shifts] error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
