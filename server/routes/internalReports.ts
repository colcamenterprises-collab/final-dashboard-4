/**
 * Internal read-only reporting endpoints for Bob / Theft Engine v1.
 * These endpoints expose aggregated POS data from existing receipt truth tables.
 *
 * Base path: /internal/api/reports
 *
 * Endpoints:
 *   GET /internal/api/reports/item-sales?date=YYYY-MM-DD
 *   GET /internal/api/reports/modifier-sales?date=YYYY-MM-DD
 *   GET /internal/api/reports/category-totals?date=YYYY-MM-DD
 *
 * Data sources (read-only, no writes):
 *   - receipt_truth_line  (item-level line items with SALE/REFUND type, pos_category_name)
 *   - lv_modifier         (raw modifier rows with modifier group in raw_json->>'name')
 *   - lv_receipt          (receipt-level header, used to filter modifiers by shift window)
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// Helper: validate YYYY-MM-DD
function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Helper: next calendar day as YYYY-MM-DD string
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/api/reports/item-sales?date=YYYY-MM-DD
//
// Returns all items sold/refunded in the shift for that date, aggregated by
// (sku, item_name, pos_category_name).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/item-sales", async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(l.sku, '') AS sku,
        l.item_name AS name,
        COALESCE(l.pos_category_name, 'UNCATEGORIZED') AS category,
        SUM(CASE WHEN l.receipt_type = 'SALE' THEN l.quantity ELSE 0 END)::int AS sold,
        SUM(CASE WHEN l.receipt_type = 'REFUND' THEN ABS(l.quantity) ELSE 0 END)::int AS refunds
      FROM receipt_truth_line l
      WHERE l.receipt_date = ${date}::date
      GROUP BY l.sku, l.item_name, l.pos_category_name
      ORDER BY sold DESC, l.item_name
    `);

    const items = (result.rows as any[]).map((row) => {
      const sold = Number(row.sold);
      const refunds = Number(row.refunds);
      const category: string = row.category || "";
      const isSet =
        category.toLowerCase().includes("set") ||
        category.toLowerCase().includes("meal deal");

      return {
        sku: row.sku || null,
        name: row.name,
        category,
        sold,
        refunds,
        net: sold - refunds,
        is_set: isSet,
      };
    });

    return res.json(items);
  } catch (err: any) {
    console.error("[internalReports/item-sales] error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/api/reports/modifier-sales?date=YYYY-MM-DD
//
// Returns modifier counts for all sale receipts in the shift window.
// Modifier group comes from lv_modifier.raw_json->>'name' (the Loyverse modifier
// set name, e.g. "Drink Options (Sets)").
// Modifier name comes from lv_modifier.name (the option selected).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/modifier-sales", async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  // Shift window in Bangkok time: 17:00 that day → 03:00 next day
  const shiftStart = `${date} 17:00:00+07`;
  const shiftEnd = `${nextDay(date)} 03:00:00+07`;

  try {
    const result = await db.execute(sql`
      SELECT
        m.raw_json->>'name' AS modifier_group,
        m.name AS modifier,
        SUM(m.qty)::int AS count
      FROM lv_modifier m
      JOIN lv_receipt r ON r.receipt_id = m.receipt_id
      WHERE r.datetime_bkk >= ${shiftStart}::timestamptz
        AND r.datetime_bkk < ${shiftEnd}::timestamptz
        AND (r.raw_json->>'refund_for') IS NULL
      GROUP BY modifier_group, modifier
      ORDER BY count DESC, modifier_group, modifier
    `);

    const modifiers = (result.rows as any[]).map((row) => ({
      modifier_group: row.modifier_group || "Unknown Group",
      modifier: row.modifier,
      count: Number(row.count),
    }));

    return res.json(modifiers);
  } catch (err: any) {
    console.error("[internalReports/modifier-sales] error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/api/reports/category-totals?date=YYYY-MM-DD
//
// Returns an object mapping POS category name → total units sold (SALE only).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/category-totals", async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(pos_category_name, 'UNCATEGORIZED') AS category,
        SUM(quantity)::int AS total
      FROM receipt_truth_line
      WHERE receipt_date = ${date}::date
        AND receipt_type = 'SALE'
      GROUP BY COALESCE(pos_category_name, 'UNCATEGORIZED')
      ORDER BY total DESC
    `);

    const totals: Record<string, number> = {};
    for (const row of result.rows as any[]) {
      totals[row.category] = Number(row.total);
    }

    return res.json(totals);
  } catch (err: any) {
    console.error("[internalReports/category-totals] error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
