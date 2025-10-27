import { Router } from "express";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { computeShiftAll } from "../services/shiftItems.js";

const router = Router();

router.get("/admin/sync-loyverse", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const endDate = DateTime.now().setZone("Asia/Bangkok");
    const startDate = endDate.minus({ days });
    
    const fromBkk = startDate.startOf("day");
    const toBkk = endDate.endOf("day");
    
    const fromUTC = fromBkk.toUTC().toISO()!;
    const toUTC = toBkk.toUTC().toISO()!;
    
    console.log(`📊 Syncing Loyverse from ${fromBkk.toISODate()} to ${toBkk.toISODate()}`);
    
    const syncResult = await importReceiptsV2(fromUTC, toUTC);
    
    const analyticsResults = [];
    let currentDate = fromBkk;
    while (currentDate <= toBkk) {
      const dateStr = currentDate.toISODate()!;
      try {
        const result = await computeShiftAll(dateStr);
        analyticsResults.push({
          date: dateStr,
          success: true,
          itemCount: result.items.length
        });
      } catch (error: any) {
        analyticsResults.push({
          date: dateStr,
          success: false,
          error: error.message
        });
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    
    res.json({
      ok: true,
      sync: syncResult,
      analytics: analyticsResults,
      period: { from: fromBkk.toISODate(), to: toBkk.toISODate() }
    });
  } catch (error: any) {
    console.error("[adminSync] failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
