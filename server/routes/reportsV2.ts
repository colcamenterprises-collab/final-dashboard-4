/**
 * DAILY REPORT V2 ROUTES
 * Generate → Save → (Optional) Email the neobrutalist PDF
 */

import { Router } from "express";
import { compileDailyReportV2, saveDailyReportV2 } from "../services/dailyReportV2";
import { buildDailyReportPDF } from "../pdf/dailyReportV2.pdf";
import { sendDailyReportEmailV2 } from "../lib/dailyReportEmailV2";

const router = Router();

/**
 * POST /api/reports/daily/generate
 * ?date=YYYY-MM-DD
 * ?sendEmail=true|false
 */
router.post("/daily/generate", async (req, res) => {
  try {
    const shiftDate = String(req.query.date);
    const sendEmail = req.query.sendEmail === "true";

    if (!shiftDate) {
      return res.status(400).json({ error: "Missing ?date=YYYY-MM-DD" });
    }

    // 1. Compile JSON
    const reportJson = await compileDailyReportV2(shiftDate);
    if (reportJson.error) {
      return res.status(404).json({ error: reportJson.error });
    }

    // 2. Create PDF
    const pdf = await buildDailyReportPDF(reportJson);

    // 3. Save report to DB
    const reportId = await saveDailyReportV2(reportJson);

    // 4. Optionally email it
    if (sendEmail) {
      await sendDailyReportEmailV2(pdf, shiftDate, reportJson);
    }

    return res.json({
      ok: true,
      reportId,
      date: shiftDate,
      emailed: sendEmail,
    });
  } catch (err) {
    console.error("daily/generate error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports/daily/:date/pdf
 * Returns PDF directly
 */
router.get("/daily/:date/pdf", async (req, res) => {
  try {
    const { date } = req.params;

    const reportJson = await compileDailyReportV2(date);
    if (reportJson.error) {
      return res.status(404).json({ error: reportJson.error });
    }

    // Ensure purchasedStock is present
    if (!reportJson.purchasedStock) {
      reportJson.purchasedStock = { rolls: 0, meatKg: "0.0", drinks: {} };
    }

    const pdf = await buildDailyReportPDF(reportJson);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="SBB-Daily-${date}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("daily/:date/pdf error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
