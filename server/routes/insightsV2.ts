/**
 * AI INSIGHTS V2 ROUTES
 * Endpoints for retrieving and regenerating insights
 */

import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { dailyReportsV2 } from "../../shared/schema";
import { generateInsightsV2 } from "../services/insightsEngineV2";

const router = Router();

/**
 * GET /api/insights/:reportId/live
 * Rebuild insights live from stored report data
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

    // Rebuild insights live
    const sales = reportJson.sales || {};
    const stock = reportJson.stock || {};
    const variance = reportJson.variance || {};
    const purchasedStock = reportJson.purchasedStock || {};
    const shoppingList = reportJson.shoppingList?.itemsJson || [];

    const insights = generateInsightsV2({ sales, stock, purchasedStock, variance, shoppingList });

    return res.json({ ok: true, insights });
  } catch (err) {
    console.error("insights/:reportId/live error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
