import { Router } from "express";
import { getLatestShiftDate, getPrimeCostForDate, getPrimeCostMTD } from "../services/primeCost.js";

const router = Router();

/**
 * GET /api/metrics/prime-cost?date=YYYY-MM-DD
 * If date omitted, uses latest shift_date from daily_sales_v2.
 * Returns { daily: {...}, mtd: {...} }
 */
router.get("/api/metrics/prime-cost", async (req, res) => {
  try {
    const date = (req.query.date as string) || (await getLatestShiftDate());
    if (!date) return res.json({ ok: false, error: "no-shift-date" });

    const daily = await getPrimeCostForDate(date);
    const mtd = await getPrimeCostMTD(date);
    res.json({ ok: true, date, daily, mtd });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message ?? "prime-cost-failed" });
  }
});

export default router;
