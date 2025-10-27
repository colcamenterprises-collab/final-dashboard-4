import { Router } from "express";
import { DateTime } from "luxon";
import { importReceiptsV2 } from "../services/loyverseImportV2.js";
import { computeShiftAll } from "../services/shiftItems.js";

const router = Router();

// Manual sync endpoint that actually works
router.get("/admin/sync-loyverse", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const endDate = DateTime.now().setZone("Asia/Bangkok");
    const startDate = endDate.minus({ days });
    
    const fromISO = startDate.startOf("day").toISO()!;
    const toISO = endDate.endOf("day").toISO()!;
    
    console.log(`📊 Syncing Loyverse receipts from ${startDate.toISODate()} to ${endDate.toISODate()}`);
    
    const syncResult = await importReceiptsV2(fromISO, toISO);
    
    // Also rebuild analytics cache for the synced dates
    const analyticsResults = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
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
      period: { from: startDate.toISODate(), to: endDate.toISODate() }
    });
  } catch (error: any) {
    console.error("[adminSync] failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
