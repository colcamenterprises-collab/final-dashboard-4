import { Router, Request, Response, NextFunction } from "express";
import { DateTime } from "luxon";
import { buildAndSaveBurgerShiftCache } from "../services/shiftBurgerCache";
import { PrismaClient } from "@prisma/client";
import { schedulerService } from "../services/scheduler";

const router = Router();
const TZ = "Asia/Bangkok";
const prisma = new PrismaClient();

// ── Auth ─────────────────────────────────────────────────────────────────────
// POST /sync and GET /sync-health require either:
//   - x-internal-token: <INTERNAL_APP_PASSWORD>
//   - Authorization: Bearer <INTERNAL_APP_PASSWORD>
//   - x-bob-token: <BOB_TOKEN / INTERNAL_APP_PASSWORD>
// Without this any external caller could trigger expensive Loyverse API calls.
function requireInternalAuth(req: Request, res: Response, next: NextFunction) {
  const pwd = process.env.INTERNAL_APP_PASSWORD;
  if (!pwd) {
    // Token not configured — allow through in dev; warn in production
    console.warn("[loyverseSync] INTERNAL_APP_PASSWORD not set — sync endpoint unprotected");
    return next();
  }
  const provided =
    (req.headers["x-internal-token"] as string | undefined) ||
    (req.headers["x-bob-token"] as string | undefined) ||
    (req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");

  if (provided !== pwd) {
    return res.status(401).json({ ok: false, error: "Unauthorized — invalid or missing auth token" });
  }
  return next();
}

// ── GET /api/loyverse/sync ────────────────────────────────────────────────────
// Legacy status endpoint — no auth required (read-only metadata).
router.get("/sync", async (_req, res) => {
  try {
    const [receiptMeta, shiftMeta] = await Promise.all([
      prisma.$queryRaw<any[]>(`
        SELECT COUNT(*)::int AS count, MAX(datetime_bkk) AS latest_receipt_at, MAX(created_at) AS latest_sync_at
        FROM lv_receipt
      `).catch((error: any) => ({ error })),
      prisma.$queryRaw<any[]>(`
        SELECT COUNT(*)::int AS count, MAX(shift_date) AS latest_shift_date
        FROM loyverse_shifts
      `).catch((error: any) => ({ error })),
    ]);

    const receiptError = !Array.isArray(receiptMeta) ? (receiptMeta as any).error : null;
    const shiftError   = !Array.isArray(shiftMeta)   ? (shiftMeta   as any).error : null;
    const receiptRow   = Array.isArray(receiptMeta)  ? receiptMeta[0] : null;
    const shiftRow     = Array.isArray(shiftMeta)    ? shiftMeta[0]   : null;

    return res.json({
      ok: !receiptError && !shiftError,
      source: {
        canonicalReceiptTable:       "lv_receipt",
        canonicalReceiptItemsTable:  "lv_line_item",
        canonicalShiftReportTable:   "loyverse_shifts",
        syncEndpoint:                "POST /api/loyverse/sync",
        timezone:                    TZ,
        shiftWindow:                 "18:00-03:00 Asia/Bangkok",
      },
      data: {
        receipts: receiptError
          ? { count: 0, latestReceiptAt: null, latestSyncAt: null }
          : { count: Number(receiptRow?.count || 0), latestReceiptAt: receiptRow?.latest_receipt_at ?? null, latestSyncAt: receiptRow?.latest_sync_at ?? null },
        shifts: shiftError
          ? { count: 0, latestShiftDate: null }
          : { count: Number(shiftRow?.count || 0), latestShiftDate: shiftRow?.latest_shift_date ?? null },
      },
      blockers: [
        ...(receiptError ? [{ code: "MISSING_RECEIPT_SOURCE", message: receiptError.message, where: "lv_receipt" }] : []),
        ...(shiftError   ? [{ code: "MISSING_SHIFT_SOURCE",   message: shiftError.message,   where: "loyverse_shifts" }] : []),
      ],
      last_updated: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[loyverseSync] status failed:", e);
    return res.status(200).json({ ok: false, data: {}, blockers: [{ code: "POS_STATUS_UNAVAILABLE", message: e?.message ?? String(e) }] });
  }
});

// ── POST /api/loyverse/sync ───────────────────────────────────────────────────
// Protected: requires INTERNAL_APP_PASSWORD token.
// Triggers a receipt + shift-cache sync for the given date range.
router.post("/sync", requireInternalAuth, async (req, res) => {
  try {
    const { from, to } = (req.query.from ? req.query : req.body) as { from: string; to: string };
    if (!from || !to) return res.status(400).json({ ok: false, error: "from/to required (YYYY-MM-DD)" });

    const start = DateTime.fromISO(from, { zone: TZ }).startOf("day");
    const end   = DateTime.fromISO(to,   { zone: TZ }).startOf("day");
    if (!start.isValid || !end.isValid || end < start) {
      return res.status(400).json({ ok: false, error: "invalid date range" });
    }

    const { importReceiptsV2 } = await import("../services/loyverseImportV2.js");

    const fromUTC = start.toUTC().toISO()!;
    const toUTC   = end.plus({ days: 1 }).toUTC().toISO()!;
    console.log(`[loyverseSync] Manual sync from=${fromUTC} to=${toUTC}`);
    const imported = await importReceiptsV2(fromUTC, toUTC);
    console.log(`[loyverseSync] Import result: ${imported.importedReceipts} new, ${imported.updatedReceipts} updated, ${imported.failedReceipts} failed`);

    const caches: Record<string, { burgers: number }> = {};
    const errors: string[] = [];
    const days: string[] = [];
    for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d.toISODate()!);

    for (const day of days) {
      try {
        const d = DateTime.fromISO(day, { zone: TZ }).startOf("day");
        const metrics = await buildAndSaveBurgerShiftCache({
          fromISO:        d.plus({ hours: 18 }).toISO()!,
          toISO:          d.plus({ days: 1, hours: 3 }).toISO()!,
          shiftDateLabel: day,
          restaurantId:   null,
        });
        caches[day] = { burgers: metrics.totals.burgers };
      } catch (e: any) {
        const msg = `${day}: ${e?.message ?? String(e)}`;
        errors.push(msg);
        console.error(`[loyverseSync] Cache error: ${msg}`);
      }
    }

    res.json({ ok: true, imported, caches, errors });
  } catch (e: any) {
    console.error("[loyverseSync] sync failed:", e);
    res.status(500).json({ ok: false, error: e?.message ?? "sync failed" });
  }
});

// ── GET /api/loyverse/sync-health ─────────────────────────────────────────────
// Protected: requires INTERNAL_APP_PASSWORD token.
// Returns current sync state, staleness, missing dates, and blockers.
router.get("/sync-health", requireInternalAuth, async (_req, res) => {
  try {
    const bkkNow = DateTime.now().setZone(TZ);

    // ── Fetch key timestamps from DB ────────────────────────────────────────
    const [receiptMeta, shiftMeta, importLogMeta] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*)::int                    AS total_receipts,
          MAX(datetime_bkk)                AS latest_receipt_at,
          MAX(created_at)                  AS latest_sync_at
        FROM lv_receipt`,
      prisma.$queryRaw<any[]>`
        SELECT MAX(shift_date) AS latest_shift_date, COUNT(*)::int AS total_shifts
        FROM loyverse_shifts`,
      prisma.$queryRaw<any[]>`
        SELECT MAX(COALESCE(finished_at, started_at)) AS latest_import_at
        FROM import_log
        WHERE provider = 'loyverse'`.catch(() => [{ latest_import_at: null }]),
    ]);

    const receiptRow    = receiptMeta[0] ?? {};
    const shiftRow      = shiftMeta[0]   ?? {};
    const importLogRow  = importLogMeta[0] ?? {};

    const latestReceiptAt   = receiptRow.latest_receipt_at   ? new Date(receiptRow.latest_receipt_at)  : null;
    const latestSyncAt      = importLogRow.latest_import_at  ? new Date(importLogRow.latest_import_at) : null;
    const latestShiftDate   = shiftRow.latest_shift_date     ? String(shiftRow.latest_shift_date).slice(0, 10) : null;

    const minutesSinceLatestReceipt = latestReceiptAt
      ? Math.round((Date.now() - latestReceiptAt.getTime()) / 60_000)
      : null;
    const hoursSinceLatestReceipt = minutesSinceLatestReceipt !== null
      ? Math.round(minutesSinceLatestReceipt / 60)
      : null;

    // ── Last 7 completed BKK business dates ─────────────────────────────────
    const last7Dates: string[] = [];
    for (let i = 1; i <= 7; i++) {
      last7Dates.push(bkkNow.minus({ days: i }).toISODate()!);
    }

    // Dates with receipts
    const receiptDateRows = await prisma.$queryRaw<{ biz_date: string }[]>`
      SELECT DISTINCT
        CASE
          WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
          THEN ((datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day')::text
          ELSE  (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date::text
        END AS biz_date
      FROM lv_receipt
      WHERE datetime_bkk >= NOW() - INTERVAL '8 days'`;
    const datesWithReceipts = new Set(receiptDateRows.map(r => String(r.biz_date).slice(0, 10)));

    // Dates with loyverse_shifts row
    const shiftDateRows = await prisma.$queryRaw<{ shift_date: string }[]>`
      SELECT shift_date::text FROM loyverse_shifts
      WHERE shift_date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 7`;
    const datesWithShifts = new Set(shiftDateRows.map(r => String(r.shift_date).slice(0, 10)));

    const missingReceiptDates = last7Dates.filter(d => !datesWithReceipts.has(d));
    const missingShiftDates   = last7Dates.filter(d => !datesWithShifts.has(d));

    // ── Scheduler state ─────────────────────────────────────────────────────
    const jobsRegistered          = schedulerService.isJobsRegistered();
    const lastStartupCatchupAt    = schedulerService.getLastStartupCatchupAt();
    const lastScheduledSyncResult = schedulerService.getLastScheduledSyncResult();

    // ── Blockers ────────────────────────────────────────────────────────────
    const blockers: { code: string; message: string }[] = [];

    if (!latestReceiptAt) {
      blockers.push({ code: "NO_RECEIPTS", message: "No receipts found in lv_receipt" });
    } else if (hoursSinceLatestReceipt !== null && hoursSinceLatestReceipt > 48) {
      blockers.push({ code: "STALE_RECEIPTS", message: `Latest receipt is ${hoursSinceLatestReceipt}h old (>48h threshold)` });
    }

    if (missingReceiptDates.length > 0) {
      blockers.push({ code: "MISSING_RECEIPT_DATES", message: `No receipts for business dates: ${missingReceiptDates.join(", ")}` });
    }

    if (missingShiftDates.length > 0) {
      blockers.push({ code: "MISSING_SHIFT_DATES", message: `No loyverse_shifts row for: ${missingShiftDates.join(", ")}` });
    }

    if (!jobsRegistered) {
      blockers.push({ code: "SCHEDULER_NOT_STARTED", message: "schedulerService.start() has not been called" });
    }

    res.json({
      ok: blockers.length === 0,
      currentBangkokTime:        bkkNow.toISO(),
      database: {
        totalReceipts:            Number(receiptRow.total_receipts ?? 0),
        latestReceiptAt:          latestReceiptAt?.toISOString() ?? null,
        latestReceiptBangkok:     latestReceiptAt ? DateTime.fromJSDate(latestReceiptAt).setZone(TZ).toISO() : null,
        minutesSinceLatestReceipt,
        hoursSinceLatestReceipt,
        latestSyncAt:             latestSyncAt?.toISOString() ?? null,
        latestShiftDate,
        totalShifts:              Number(shiftRow.total_shifts ?? 0),
      },
      last7BusinessDates: {
        dates:                    last7Dates,
        missingReceiptDates,
        missingShiftDates,
        datesWithReceipts:        [...datesWithReceipts].sort(),
        datesWithShifts:          [...datesWithShifts].sort(),
      },
      scheduler: {
        jobsRegistered,
        lastStartupCatchupAt,
        lastScheduledSyncResult,
      },
      blockers,
    });
  } catch (e: any) {
    console.error("[loyverseSync] sync-health failed:", e);
    res.status(500).json({ ok: false, error: e?.message ?? "sync-health failed" });
  }
});

export default router;
