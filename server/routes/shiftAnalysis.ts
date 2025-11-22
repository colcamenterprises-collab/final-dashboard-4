import { ensureShift } from '../services/ensureShift.js';
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
    const { fromISO, toISO } = shiftWindow(shiftDate);

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

    const receiptsData = await db.$queryRaw<any[]>`
      SELECT COUNT(*)::int as receipt_count, 
             SUM(total_amount)::numeric as total_sales
      FROM lv_receipt
      WHERE datetime_bkk >= ${fromISO}::timestamptz 
        AND datetime_bkk < ${toISO}::timestamptz`;

    const paymentsData = await db.$queryRaw<any[]>`
      SELECT 
        CASE 
          WHEN p->>'name' ILIKE '%cash%' THEN 'Cash'
          WHEN p->>'name' ILIKE '%grab%' THEN 'Grab'
          WHEN p->>'name' ILIKE '%scan%' OR p->>'name' ILIKE '%qr%' THEN 'QR'
          ELSE 'Other'
        END as payment_type,
        COUNT(*)::int as count
      FROM lv_receipt r,
           jsonb_array_elements(r.payment_json) p
      WHERE r.datetime_bkk >= ${fromISO}::timestamptz 
        AND r.datetime_bkk < ${toISO}::timestamptz
      GROUP BY payment_type`;

    const topItemsByCategory = await db.$queryRaw<any[]>`
      SELECT category, 
             json_agg(json_build_object('name', name, 'qty', qty) ORDER BY qty DESC) FILTER (WHERE rn <= 5) as top_items
      FROM (
        SELECT category, name, qty,
               ROW_NUMBER() OVER (PARTITION BY category ORDER BY qty DESC) as rn
        FROM analytics_shift_item 
        WHERE shift_date = ${shiftDate}::date
      ) ranked
      WHERE rn <= 5
      GROUP BY category`;

    const topModifiers = await db.$queryRaw<any[]>`
      SELECT name, qty
      FROM analytics_shift_modifier
      WHERE shift_date = ${shiftDate}::date
      ORDER BY qty DESC
      LIMIT 5`;

    const receiptCount = receiptsData[0]?.receipt_count || 0;
    const totalSales = receiptsData[0]?.total_sales || 0;
    
    const payments = {
      Cash: 0,
      Grab: 0,
      QR: 0,
      Other: 0
    };
    paymentsData.forEach(p => {
      payments[p.payment_type as keyof typeof payments] = p.count;
    });

    const topByCategory: Record<string, any[]> = {};
    topItemsByCategory.forEach(cat => {
      topByCategory[cat.category] = cat.top_items || [];
    });
    topByCategory['Modifiers'] = topModifiers;

    // Map database column names to frontend expected field names
    const items = rows.map(row => ({
      sku: row.sku,
      name: row.name,
      category: row.category,
      qty: row.qty,
      patties: row.patties || 0,
      redMeatGrams: row.red_meat_g || 0,
      chickenGrams: row.chicken_g || 0,
      rolls: row.rolls || 0
    }));

    res.json({
      ok: true,
      sourceUsed: "cache",
      date: shiftDate,
      items: category ? items.filter((x) => x.category === category) : items,
      modifiers: modRows,
      metrics: {
        receiptCount,
        totalSales,
        payments,
        topByCategory
      }
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
