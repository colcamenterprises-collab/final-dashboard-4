import { Router } from "express";
import { DateTime } from "luxon";
import { buildAndSaveBurgerShiftCache } from "../services/shiftBurgerCache";

const router = Router();
const TZ = "Asia/Bangkok";


router.get("/sync", async (_req, res) => {
  try {
    const { prisma } = await import("../../lib/prisma");
    const [receiptMeta, shiftMeta] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS count, MAX("createdAtUTC") AS latest_receipt_at, MAX("createdAt") AS latest_sync_at
        FROM receipts
      `).catch((error: any) => ({ error })),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS count, MAX(shift_date) AS latest_shift_date
        FROM loyverse_shifts
      `).catch((error: any) => ({ error })),
    ]);

    const receiptError = !Array.isArray(receiptMeta) ? receiptMeta.error : null;
    const shiftError = !Array.isArray(shiftMeta) ? shiftMeta.error : null;
    const receiptRow = Array.isArray(receiptMeta) ? receiptMeta[0] : null;
    const shiftRow = Array.isArray(shiftMeta) ? shiftMeta[0] : null;

    return res.json({
      ok: !receiptError && !shiftError,
      source: {
        canonicalReceiptTable: "receipts",
        canonicalReceiptItemsTable: "receipt_items",
        canonicalReceiptPaymentsTable: "receipt_payments",
        canonicalShiftReportTable: "loyverse_shifts",
        syncEndpoint: "POST /api/loyverse/sync",
        timezone: TZ,
        shiftWindow: "17:00-03:00 Asia/Bangkok",
      },
      data: {
        receipts: receiptError ? { count: 0, latestReceiptAt: null, latestSyncAt: null } : {
          count: Number(receiptRow?.count || 0),
          latestReceiptAt: receiptRow?.latest_receipt_at ?? null,
          latestSyncAt: receiptRow?.latest_sync_at ?? null,
        },
        shifts: shiftError ? { count: 0, latestShiftDate: null } : {
          count: Number(shiftRow?.count || 0),
          latestShiftDate: shiftRow?.latest_shift_date ?? null,
        },
      },
      blockers: [
        ...(receiptError ? [{ code: "MISSING_RECEIPT_SOURCE", message: receiptError.message || String(receiptError), where: "receipts", canonical_source: "receipts", auto_build_attempted: false }] : []),
        ...(shiftError ? [{ code: "MISSING_SHIFT_SOURCE", message: shiftError.message || String(shiftError), where: "loyverse_shifts", canonical_source: "loyverse_shifts", auto_build_attempted: false }] : []),
      ],
      last_updated: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[loyverseSync] status failed:", e);
    return res.status(200).json({ ok: false, data: {}, blockers: [{ code: "POS_STATUS_UNAVAILABLE", message: e?.message || String(e), where: "/api/loyverse/sync", canonical_source: "receipts", auto_build_attempted: false }] });
  }
});

router.post("/sync", async (req, res) => {
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
    const toUTC = end.plus({ days: 1 }).toUTC().toISO()!;
    console.log(`[loyverseSync] Importing from ${fromUTC} to ${toUTC}`);
    const imported = await importReceiptsV2(fromUTC, toUTC);
    console.log(`[loyverseSync] Import result:`, imported);
    const caches: Record<string, { burgers: number }> = {};
    const errors: string[] = [];

    const days: string[] = [];
    for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d.toISODate()!);

    for (const day of days) {
      try {
        const d = DateTime.fromISO(day, { zone: TZ }).startOf("day");

        const fromISO = d.plus({ hours: 18 }).toISO()!;
        const toISO = d.plus({ days: 1, hours: 3 }).toISO()!;
        const metrics = await buildAndSaveBurgerShiftCache({
          fromISO,
          toISO,
          shiftDateLabel: day,
          restaurantId: null
        });
        caches[day] = { burgers: metrics.totals.burgers };
      } catch (e: any) {
        const msg = `${day}: ${e?.message || String(e)}`;
        errors.push(msg);
        console.error(`[loyverseSync] ${msg}`);
      }
    }

    res.json({ ok: true, imported, caches, errors });
  } catch (e: any) {
    console.error("[loyverseSync] sync failed:", e);
    res.status(500).json({ ok: false, error: e?.message ?? "sync failed" });
  }
});

export default router;
