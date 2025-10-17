// server/routes/receiptsBurgers.ts
import { Router } from "express";
import { DateTime } from "luxon";
import { computeMetrics } from "../services/burgerMetrics";

const router = Router();
const TZ = "Asia/Bangkok";

// Shift window helper (18:00 → 03:00 next day)
function getWindow(dateISO?: string, from?: string, to?: string) {
  if (from && to) {
    return {
      fromISO: from,
      toISO: to,
      label: DateTime.fromISO(from, { zone: TZ }).toISODate() || from,
    };
  }
  if (dateISO) {
    const d = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
    return {
      fromISO: d.plus({ hours: 18 }).toISO()!,
      toISO: d.plus({ days: 1, hours: 3 }).toISO()!,
      label: d.toISODate() || dateISO,
    };
  }
  const now = DateTime.now().setZone(TZ);
  const today = now.startOf("day");
  const start = today.plus({ hours: 18 });
  const end = today.plus({ days: 1, hours: 3 });
  if (now < start) {
    const y = today.minus({ days: 1 });
    return {
      fromISO: y.plus({ hours: 18 }).toISO()!,
      toISO: today.plus({ hours: 3 }).toISO()!,
      label: y.toISODate() || y.toISO(),
    };
  }
  return { fromISO: start.toISO()!, toISO: end.toISO()!, label: today.toISODate() || today.toISO() };
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
 * Query:
 *  - date=YYYY-MM-DD (optional)
 *  - from, to (ISO) optional
 */
router.get("/shift/burgers", async (req, res) => {
  try {
    const { date, from, to } = req.query as { date?: string; from?: string; to?: string };
    const w = getWindow(date, from, to);
    const metrics = await computeMetrics(w.fromISO, w.toISO, w.label || 'unknown');
    res.json({ ok: true, data: metrics });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

export default router;
