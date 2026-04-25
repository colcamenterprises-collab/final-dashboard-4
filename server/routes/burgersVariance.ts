/**
 * /api/analysis/burgers-sets  — Burgers & Sets Sales-to-Bun-Usage Table
 *
 * Built per FINAL DB spec – PATCH 1 (Apr 2026):
 * - Source: receipt_truth_daily_usage
 * - Included categories: Burgers, Smash Burgers, Burger Sets,
 *   Burger Sets (Meal Deals), Smash Burger Sets (Meal Deals),
 *   Kids, Kids Will Love This
 * - Excluded: Drinks, Side Orders, MODIFIER ADD-ONS, Promotions,
 *   GRAB AND FOODPANDA PROMOTIONS (note: PROMO_EXCLUDED)
 * - Buns Used = Sold Count (every burger/set uses exactly 1 bun)
 * - Notes: MISSING_SKU | CATEGORY_REVIEW
 * - Does NOT touch drinks logic, drinks UI, or drinks reconciliation
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Categories that contain burger / set items ──────────────────────────────
const BURGER_CATEGORIES = [
  'Burgers',
  'Smash Burgers',
  'Burger Sets',
  'Burger Sets (Meal Deals)',
  'Smash Burger Sets (Meal Deals)',
  'Kids',
  'Kids Will Love This',
];

// ─── GET /burgers-sets?date=YYYY-MM-DD ───────────────────────────────────────
router.get('/burgers-sets', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // Pull every burger / set row for the requested date
    const result = await pool.query(
      `SELECT
         sku,
         item_name,
         category_name,
         quantity_sold
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND category_name = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'
       ORDER BY category_name, item_name`,
      [date, BURGER_CATEGORIES],
    );

    type Row = {
      sku: string | null;
      item_name: string;
      category_name: string;
      quantity_sold: string;
    };

    const rows: Row[] = result.rows;

    const data = rows.map((r) => {
      const soldCount = Number(r.quantity_sold);
      const bunsUsed = soldCount; // 1 bun per item, no recipe logic yet

      const notes: string[] = [];
      if (!r.sku) notes.push('MISSING_SKU');

      return {
        sku: r.sku ?? null,
        item_name: r.item_name,
        pos_category: r.category_name,
        sold_count: soldCount,
        buns_used: bunsUsed,
        notes: notes.length > 0 ? notes.join(' | ') : null,
      };
    });

    return res.json({
      ok: true,
      date,
      row_count: data.length,
      data,
    });
  } catch (err: any) {
    console.error('[burgers-sets] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
