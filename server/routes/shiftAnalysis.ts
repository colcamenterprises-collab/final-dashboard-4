import { Router } from "express";
import { shiftWindow } from "../services/time/shiftWindow.js";
import { PrismaClient } from "@prisma/client";
import { computeShiftAll } from "../services/shiftItems.js";
import { backfillShiftAnalytics, backfillLastNDays } from "../services/backfillShiftAnalytics.js";
import { normalizeDateParam } from "../utils/normalizeDate.js";

const db = new PrismaClient();
const router = Router();

router.get("/analysis/shift/items", async (req, res) => {
  try {
    const rawDate = req.query.date as string;
    const shiftDate = normalizeDateParam(rawDate);
    const category = req.query.category as string | undefined;

    const rows = await db.$queryRaw<any[]>`
      SELECT sku, name, category, qty, patties, red_meat_g, chicken_g, rolls
      FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date
      ORDER BY category, name`;

    const modRows = await db.$queryRaw<any[]>`
      SELECT sku, name, category, qty
      FROM analytics_shift_modifier WHERE shift_date = ${shiftDate}::date
      ORDER BY name`;

    if ((rows?.length ?? 0) === 0) {
      const out = await computeShiftAll(shiftDate);
      return res.json({
        ok: true,
        ...out,
        items: category ? out.items.filter((x) => x.category === category) : out.items,
      });
    }

    res.json({
      ok: true,
      sourceUsed: "cache",
      date: shiftDate,
      items: category ? rows.filter((x) => x.category === category) : rows,
      modifiers: modRows,
    });
  } catch (error: any) {
    console.error("[shiftAnalysis] items query failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/analysis/shift/rebuild", async (req, res) => {
  try {
    const rawDate = req.query.date as string;
    const shiftDate = normalizeDateParam(rawDate);
    const out = await computeShiftAll(shiftDate);
    res.json({ ok: true, ...out });
  } catch (error: any) {
    console.error("[shiftAnalysis] rebuild failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/analysis/shift/raw", async (req, res) => {
  try {
    const rawDate = req.query.date as string;
    const shiftDate = normalizeDateParam(rawDate);
    const { fromISO, toISO } = shiftWindow(shiftDate);
    const rows = await db.$queryRaw<any[]>`
      SELECT ri.sku, COALESCE(c.name, ri.name) AS name, SUM(ri.qty)::int AS qty
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

router.post("/analysis/shift/backfill", async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query as { startDate?: string; endDate?: string; days?: string };
    
    let results;
    if (days) {
      const numDays = parseInt(days, 10);
      if (isNaN(numDays) || numDays < 1) {
        return res.status(400).json({ ok: false, error: "Invalid days parameter" });
      }
      console.log(`📊 Backfilling last ${numDays} days...`);
      results = await backfillLastNDays(numDays);
    } else if (startDate && endDate) {
      console.log(`📊 Backfilling from ${startDate} to ${endDate}...`);
      results = await backfillShiftAnalytics(startDate, endDate);
    } else {
      return res.status(400).json({ 
        ok: false, 
        error: "Provide either 'days' or both 'startDate' and 'endDate'" 
      });
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({ 
      ok: true, 
      message: `Backfilled ${successful} days successfully, ${failed} failed`,
      results 
    });
  } catch (error: any) {
    console.error("[shiftAnalysis] backfill failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
