import { Router, type NextFunction, type Request, type Response } from "express";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { db } from "../lib/prisma.js";
import { getBangkokBusinessWindow } from "../services/loyverseMirrorCommon.js";
import { buildLoyverseMirrorDiagnostic } from "../services/loyverseMirrorDiagnostic.js";
import { attachSessionUser } from "../middleware/sessionAuth.js";
import { getPinSessionUser } from "./pinAuth.js";

const router = Router();

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
        where: "GET /api/loyverse/mirror-diagnostic",
        canonical_source: "lv_receipt/lv_line_item/lv_modifier",
        auto_build_attempted: false,
      }],
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

export default router;
