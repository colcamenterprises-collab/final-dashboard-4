import { Router } from "express";
import { getPrimeCostForDate, getPrimeCostMTD } from "../services/primeCost.js";

const router = Router();

/**
 * GET /api/metrics/prime-cost?date=YYYY-MM-DD
 * If date omitted, uses latest shift_date from daily_sales_v2.
 * Returns { daily: {...}, mtd: {...} }
 */
router.get("/api/metrics/prime-cost", async (req, res) => {
  try {
    const date = (req.query.date as string) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        ok: false,
        status: "error",
        reason: "INVALID_DATE",
        message: "date query parameter is required in YYYY-MM-DD format",
      });
    }

    const daily = await getPrimeCostForDate(date);
    if (!daily) {
      return res.json({
        ok: false,
        status: "missing",
        reason: "NO_SHIFT_DATA",
        date,
      });
    }
    const mtd = await getPrimeCostMTD(date);
    res.json({ ok: true, date, daily, mtd });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message ?? "prime-cost-failed" });
  }
});

export default router;
