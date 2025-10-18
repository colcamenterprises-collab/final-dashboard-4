import { Router } from "express";
import { DateTime } from "luxon";
import { computeMetrics } from "../services/burgerMetrics";
import { buildAndSaveBurgerShiftCache, readBurgerShiftCache } from "../services/shiftBurgerCache";

const router = Router();
const TZ = "Asia/Bangkok";

function windowFromDate(dateISO?: string) {
  if (!dateISO) {
    const now = DateTime.now().setZone(TZ);
    const today = now.startOf("day");
    const start = today.plus({ hours: 18 });
    if (now < start) {
      const y = today.minus({ days: 1 });
      return {
        shiftDateLabel: y.toISODate()!,
        fromISO: y.plus({ hours: 18 }).toISO()!,
        toISO: today.plus({ hours: 3 }).toISO()!,
      };
    }
    return {
      shiftDateLabel: today.toISODate()!,
      fromISO: start.toISO()!,
      toISO: today.plus({ days: 1, hours: 3 }).toISO()!,
    };
  }
  const d = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  return {
    shiftDateLabel: d.toISODate()!,
    fromISO: d.plus({ hours: 18 }).toISO()!,
    toISO: d.plus({ days: 1, hours: 3 }).toISO()!,
  };
}

/**
 * GET /api/receipts/shift/burgers/ping
 * Health check endpoint
 */
router.get("/shift/burgers/ping", (_req, res) => {
  res.json({ ok: true, message: "receipts burgers endpoint alive" });
});

/**
 * GET /api/receipts/shift/burgers
 * Query: date=YYYY-MM-DD (optional), source=cache|live (default cache)
 * - cache: read from analytics tables; if missing, compute+save then return
 * - live : compute from receipts directly (does NOT save)
 */
router.get("/shift/burgers", async (req, res) => {
  try {
    const { date, source } = req.query as { date?: string; source?: "cache" | "live" };
    const { shiftDateLabel, fromISO, toISO } = windowFromDate(date);

    if (source !== "live") {
      const cached = await readBurgerShiftCache(shiftDateLabel, null);
      if (cached) return res.json({ ok: true, data: cached, cached: true });

      const metrics = await buildAndSaveBurgerShiftCache({ fromISO, toISO, shiftDateLabel, restaurantId: null });
      return res.json({ ok: true, data: metrics, cached: false, saved: true });
    } else {
      const metrics = await computeMetrics(fromISO, toISO, shiftDateLabel);
      return res.json({ ok: true, data: metrics, cached: false, saved: false });
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

/**
 * POST /api/receipts/shift/burgers/rebuild
 * Query: date=YYYY-MM-DD
 * - recompute from receipts and persist to cache
 */
router.post("/shift/burgers/rebuild", async (req, res) => {
  try {
    const { date } = req.query as { date: string };
    if (!date) {
      return res.status(400).json({ ok: false, error: "date query parameter required (YYYY-MM-DD)" });
    }
    const { shiftDateLabel, fromISO, toISO } = windowFromDate(date);
    const metrics = await buildAndSaveBurgerShiftCache({ fromISO, toISO, shiftDateLabel, restaurantId: null });
    res.json({ ok: true, data: metrics, rebuilt: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

export default router;
