import { Router } from "express";
import { DateTime } from "luxon";
import { buildAndSaveBurgerShiftCache } from "../services/shiftBurgerCache";

const router = Router();
const TZ = "Asia/Bangkok";

router.post("/sync", async (req, res) => {
  try {
    const { from, to } = (req.query.from ? req.query : req.body) as { from: string; to: string };
    if (!from || !to) return res.status(400).json({ ok: false, error: "from/to required (YYYY-MM-DD)" });

    const start = DateTime.fromISO(from, { zone: TZ }).startOf("day");
    const end   = DateTime.fromISO(to,   { zone: TZ }).startOf("day");
    if (!start.isValid || !end.isValid || end < start) {
      return res.status(400).json({ ok: false, error: "invalid date range" });
    }

    const { importReceiptsV2 } = await import("../services/loyverseImportV2.js");
    
    const fromUTC = start.toUTC().toISO()!;
    const toUTC = end.plus({ days: 1 }).toUTC().toISO()!;
    console.log(`[loyverseSync] Importing from ${fromUTC} to ${toUTC}`);
    const imported = await importReceiptsV2(fromUTC, toUTC);
    console.log(`[loyverseSync] Import result:`, imported);
    const caches: Record<string, { burgers: number }> = {};
    const errors: string[] = [];

    const days: string[] = [];
    for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d.toISODate()!);

    for (const day of days) {
      try {
        const d = DateTime.fromISO(day, { zone: TZ }).startOf("day");

        const fromISO = d.plus({ hours: 18 }).toISO()!;
        const toISO = d.plus({ days: 1, hours: 3 }).toISO()!;
        const metrics = await buildAndSaveBurgerShiftCache({
          fromISO,
          toISO,
          shiftDateLabel: day,
          restaurantId: null
        });
        caches[day] = { burgers: metrics.totals.burgers };
      } catch (e: any) {
        const msg = `${day}: ${e?.message || String(e)}`;
        errors.push(msg);
        console.error(`[loyverseSync] ${msg}`);
      }
    }

    res.json({ ok: true, imported, caches, errors });
  } catch (e: any) {
    console.error("[loyverseSync] sync failed:", e);
    res.status(500).json({ ok: false, error: e?.message ?? "sync failed" });
  }
});

export default router;
