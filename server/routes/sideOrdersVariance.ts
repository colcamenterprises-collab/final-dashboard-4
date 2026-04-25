/**
 * /api/analysis/side-orders?date=YYYY-MM-DD — Side Orders Sales Truth (V3 PATCH 1)
 *
 * Columns: SKU | Item Name | POS Category | Sold Direct | Sold via Sets | Total Sold | Notes
 *
 * Source: receipt_truth_daily_usage WHERE category_name = 'Side Orders'
 *
 * Set source (same as burgers table):
 *   SET_SKUS — burger/set SKUs that include 1 fries serving per sold unit
 *   Rule: 1 set = 1 fries serving
 *   Set volume assigned to French Fries (10030) only — the canonical set-fries SKU.
 *   All other fries-based items: Sold via Sets = 0 (note references 10030).
 *   Non-fries items: Sold via Sets = 0, no note.
 *
 * Does NOT touch Drinks, Burgers & Sets, Buns, or Meat logic.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Set SKUs: burger/set items that include 1 fries serving ─────────────────
const SET_SKUS = ['10003', '10032', '10033', '10034', '10036', '10071'];

// French Fries (10030) is the canonical set-fries SKU — receives all set volume
const FRIES_SET_SKU = '10030';

// ─── GET /side-orders?date=YYYY-MM-DD ────────────────────────────────────────
router.get('/side-orders', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // ── Sold Direct: Side Orders from receipt_truth_daily_usage ──────────
    const directRes = await pool.query(
      `SELECT
         sku,
         item_name,
         category_name,
         SUM(quantity_sold) AS sold_direct
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND category_name = 'Side Orders'
         AND item_name NOT LIKE 'Add-ons%'
         AND sku IS NOT NULL
       GROUP BY sku, item_name, category_name
       ORDER BY sku`,
      [date],
    );

    // ── Total sets sold: same SKU set as burgers table ────────────────────
    const setsRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total_sets
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND sku = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'`,
      [date, SET_SKUS],
    );
    const totalSets = Number(setsRes.rows[0]?.total_sets ?? 0);

    // ── Build rows ────────────────────────────────────────────────────────
    const rows = directRes.rows.map((row) => {
      const sku = row.sku as string;
      const itemName = row.item_name as string;
      const soldDirect = Number(row.sold_direct);
      const isFriesBased = itemName.toLowerCase().includes('fries');
      const isSetFriesSku = sku === FRIES_SET_SKU;

      // Only the canonical set-fries SKU (10030) receives the full set volume
      const soldViaSets = isSetFriesSku ? totalSets : 0;
      const totalSold = soldDirect + soldViaSets;

      let notes: string | null = null;
      if (isSetFriesSku && totalSets > 0) {
        notes = `Includes ${totalSets} fries serving${totalSets !== 1 ? 's' : ''} from set meals`;
      } else if (isFriesBased && !isSetFriesSku && totalSets > 0) {
        notes = 'Set meal fries tracked on French Fries (10030)';
      }

      return {
        sku,
        item_name: itemName,
        pos_category: row.category_name as string,
        sold_direct: soldDirect,
        sold_via_sets: soldViaSets,
        total_sold: totalSold,
        is_fries_based: isFriesBased,
        notes,
      };
    });

    return res.json({
      ok: true,
      date,
      total_sets_sold: totalSets,
      set_skus: SET_SKUS,
      fries_set_sku: FRIES_SET_SKU,
      data: rows,
    });
  } catch (err: any) {
    console.error('[side-orders] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
