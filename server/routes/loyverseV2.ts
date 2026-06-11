import { Router } from "express";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { getBangkokBusinessWindow } from "../services/loyverseMirrorCommon.js";
import { buildLoyverseMirrorDiagnostic } from "../services/loyverseMirrorDiagnostic.js";

const router = Router();

router.get("/loyverse/mirror-diagnostic", async (_req, res) => {
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
