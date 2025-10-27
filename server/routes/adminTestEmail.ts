import { Router } from "express";
import { sendDailyReviewEmail } from "../jobs/dailySummaryEmail";

export const adminTestEmailRouter = Router();

// GET /admin/test-daily-summary?date=2025-10-26
adminTestEmailRouter.get("/admin/test-daily-summary", async (req, res) => {
  const dateISO = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return res.status(400).json({ ok: false, error: "Provide ?date=YYYY-MM-DD" });
  }
  try {
    console.log(`[Admin Test] Sending Daily Review email for ${dateISO}...`);
    await sendDailyReviewEmail(dateISO);
    res.json({ ok: true, message: `Daily Review email sent for ${dateISO}` });
  } catch (e: any) {
    console.error("[Admin Test] Email failed:", e);
    res.status(500).json({ ok: false, error: e?.message || "failed" });
  }
});
