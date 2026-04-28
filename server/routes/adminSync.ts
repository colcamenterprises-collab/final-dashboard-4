import { Router } from "express";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { computeShiftAll } from "../services/shiftItems.js";

const TZ = "Asia/Bangkok";
const router = Router();

router.get("/admin/sync-loyverse", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const endDate = DateTime.now().setZone(TZ);
    const startDate = endDate.minus({ days });
    
    const fromBkk = startDate.startOf("day");
    const toBkk = endDate.endOf("day");
    
    const fromUTC = fromBkk.toUTC().toISO()!;
    const toUTC = toBkk.toUTC().toISO()!;
    
    console.log(`📊 Syncing Loyverse from ${fromBkk.toISODate()} to ${toBkk.toISODate()}`);
    
    const syncResult = await importReceiptsV2(fromUTC, toUTC);
    
    const analyticsResults = [];
    const buildResults: Record<string, any> = {};
    let currentDate = fromBkk;

    // Collect dates for analysis build (only process if sync fetched something)
    const datesToBuild: string[] = [];
    while (currentDate <= toBkk) {
      datesToBuild.push(currentDate.toISODate()!);
      currentDate = currentDate.plus({ days: 1 });
    }

    for (const dateStr of datesToBuild) {
      try {
        const result = await computeShiftAll(dateStr);
        analyticsResults.push({ date: dateStr, success: true, itemCount: result.items.length });
      } catch (error: any) {
        analyticsResults.push({ date: dateStr, success: false, error: error.message });
      }
    }

    // After sync + computeShiftAll: ensure receipt_truth + daily_usage are built for each date.
    // This prevents Analysis V2 from showing DAILY_USAGE_NOT_BUILT after a fresh sync.
    if (syncResult.upserted > 0) {
      const { ensureAnalysisForDate } = await import("../services/analysisBuildOrchestrator.js");
      for (const dateStr of datesToBuild) {
        try {
          const br = await ensureAnalysisForDate(dateStr, "MANUAL");
          buildResults[dateStr] = { ok: br.ok, autoBuilt: br.autoBuilt, status: br.buildStatus };
          if (br.autoBuilt) console.log(`[adminSync] receipt_truth + daily_usage built for ${dateStr}`);
        } catch (e: any) {
          buildResults[dateStr] = { ok: false, error: e.message };
        }
      }
    }
    
    res.json({
      ok: true,
      sync: syncResult,
      analytics: analyticsResults,
      builds: buildResults,
      period: { from: fromBkk.toISODate(), to: toBkk.toISODate() }
    });
  } catch (error: any) {
    console.error("[adminSync] failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
