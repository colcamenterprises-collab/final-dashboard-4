import { Router } from "express";
import { shiftWindow } from "../services/time/shiftWindow.js";
import { PrismaClient } from "@prisma/client";
import { computeShift } from "../services/shiftItems.js";

const db = new PrismaClient();
const router = Router();

router.get("/analysis/shift/items", async (req, res) => {
  try {
    const { date, category } = req.query as { date: string; category?: string };
    const { shiftDate } = shiftWindow(date);

    const rows = await db.$queryRaw<any[]>`
      SELECT sku, name, category, qty, patties, red_meat_g, chicken_g, rolls
      FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date
      ORDER BY category, name`;

    if ((rows?.length ?? 0) === 0) {
      const out = await computeShift(date);
      return res.json({
        ok: true,
        sourceUsed: "live",
        ...out,
        items: category ? out.items.filter((x) => x.category === category) : out.items,
      });
    }

    res.json({
      ok: true,
      sourceUsed: "cache",
      date: shiftDate,
      items: category ? rows.filter((x) => x.category === category) : rows,
    });
  } catch (error: any) {
    console.error("[shiftAnalysis] items query failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/analysis/shift/rebuild", async (req, res) => {
  try {
    const { date } = req.query as { date: string };
    const out = await computeShift(date);
    res.json({ ok: true, sourceUsed: "live", ...out });
  } catch (error: any) {
    console.error("[shiftAnalysis] rebuild failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/analysis/shift/raw", async (req, res) => {
  try {
    const { date } = req.query as { date: string };
    const { fromISO, toISO } = shiftWindow(date);
    const rows = await db.$queryRaw<any[]>`
      SELECT ri.sku, COALESCE(c.name, ri.name) AS name, SUM(ri.quantity)::int AS qty
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri."receiptId"
      LEFT JOIN item_catalog c ON c.sku = ri.sku
      WHERE r."createdAtUTC" >= ${fromISO}::timestamptz AND r."createdAtUTC" < ${toISO}::timestamptz
      GROUP BY ri.sku, COALESCE(c.name, ri.name)
      ORDER BY name`;
    res.json({ ok: true, fromISO, toISO, rows });
  } catch (error: any) {
    console.error("[shiftAnalysis] raw query failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
