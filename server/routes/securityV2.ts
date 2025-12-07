/**
 * SECURITY & THEFT DETECTION V2 ROUTES
 * Endpoints for retrieving and regenerating security analysis
 */

import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { dailyReportsV2 } from "../../shared/schema";
import { detectSecurityRisksV2 } from "../services/securityEngineV2";

const router = Router();

/**
 * GET /api/security/:reportId/live
 * Rebuild security risks live from stored report data
 */
router.get("/:reportId/live", async (req, res) => {
  try {
    const reportId = Number(req.params.reportId);

    const report = await db
      .select()
      .from(dailyReportsV2)
      .where(eq(dailyReportsV2.id, reportId))
      .limit(1);

    if (!report || report.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const reportJson = report[0].json || {};

    // Rebuild security risks live
    const sales = reportJson.sales || {};
    const stock = reportJson.stock || {};
    const variance = reportJson.variance || {};
    const purchasedStock = reportJson.purchasedStock || {};
    const insights = reportJson.insights || {};

    const security = detectSecurityRisksV2({
      sales, stock, purchasedStock, variance, insights
    });

    return res.json({ ok: true, security });
  } catch (err) {
    console.error("security/:reportId/live error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
