/**
 * /api/analysis/fries-reconciliation?date=YYYY-MM-DD — French Fries Stock Reconciliation (CORE STOCK V4 PATCH 1)
 * /api/analysis/fries-reconciliation/reviews — Review persistence
 *
 * Single-row table: French Fries
 *   Start     = previous shift closing friesEnd (canonical source priority below)
 *   Purchased = SUM(purchase_tally.fries_grams) for the shift date; 0 if no record
 *   Used      = (SUM of FRIES_USAGE_SKUS sold + total SET_SKUS sold) × 130g per serving
 *   End       = current shift friesEnd (same priority)
 *   Expected  = Start + Purchased − Used
 *   Variance  = End − Expected
 *
 * FRIES_USAGE_SKUS: 10018 Cajun Fries, 10010 Cheesy Bacon Fries, 10045 Dirty Fries,
 *                   10030 French Fries, 10035 Loaded Fries (Original)
 * EXCLUDED:         10022 Sweet Potato Fries, Chicken Nuggets, Onion Rings, Coleslaw
 *
 * Stock source priority:
 *   1. daily_sales_v2.payload->>'friesEnd'  (v2_canonical)
 *   2. No legacy fallback — daily_stock_v2 has no fries column → source: 'missing'
 *
 * Does NOT touch Drinks, Burgers & Sets, Buns, Meat, or Side Orders logic.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const GRAMS_PER_SERVING = 130;

// ─── French Fries usage SKUs — these SKUs consume 1 serving (130g) each ─────
const FRIES_USAGE_SKUS = ['10018', '10010', '10045', '10030', '10035'];

// ─── Set SKUs — each sold unit includes 1 fries serving (same as Side Orders) ─
const SET_SKUS = ['10003', '10032', '10033', '10034', '10036', '10071'];

// ─── Helper: resolve canonical fries end weight for a shift date ─────────────
async function resolveFriesWeight(shiftDate: string): Promise<{
  value: number | null;
  source: 'v2_canonical' | 'missing';
}> {
  const r = await pool.query(
    `SELECT (payload->>'friesEnd')::numeric AS v2_canonical
     FROM daily_sales_v2
     WHERE "shiftDate" = $1
     ORDER BY (payload->>'friesEnd') IS NOT NULL DESC, "createdAt" DESC
     LIMIT 1`,
    [shiftDate],
  );
  if (!r.rows[0]) return { value: null, source: 'missing' };
  const v2 = r.rows[0].v2_canonical !== null ? Number(r.rows[0].v2_canonical) : null;
  if (v2 !== null && !isNaN(v2)) return { value: v2, source: 'v2_canonical' };
  return { value: null, source: 'missing' };
}

// ─── GET /fries-reconciliation?date=YYYY-MM-DD ────────────────────────────────
router.get('/fries-reconciliation', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // Previous shift date
    const prevDate = new Date(date + 'T12:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    // ── Start: previous shift canonical friesEnd ──────────────────────────
    const startResolved = await resolveFriesWeight(prevDateStr);
    const start: number | null = startResolved.value;
    const startSource = startResolved.source;

    // ── End: current shift canonical friesEnd ─────────────────────────────
    const endResolved = await resolveFriesWeight(date);
    const end: number | null = endResolved.value;
    const endSource = endResolved.source;

    // ── Purchased: sum of fries_grams from purchase_tally for this date ──
    const purchasedRes = await pool.query(
      `SELECT COALESCE(SUM(fries_grams), 0) AS purchased_fries_grams
       FROM purchase_tally
       WHERE date::date = $1::date`,
      [date],
    );
    const purchased = Number(purchasedRes.rows[0]?.purchased_fries_grams ?? 0);

    // ── Fries item sales (usage SKUs) ─────────────────────────────────────
    const friesSalesRes = await pool.query(
      `SELECT sku, item_name, SUM(quantity_sold) AS qty_sold
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND sku = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'
       GROUP BY sku, item_name
       ORDER BY sku`,
      [date, FRIES_USAGE_SKUS],
    );

    // ── Total sets sold ───────────────────────────────────────────────────
    const setsRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total_sets
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND sku = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'`,
      [date, SET_SKUS],
    );
    const totalSets = Number(setsRes.rows[0]?.total_sets ?? 0);

    // ── Usage breakdown ───────────────────────────────────────────────────
    const usageBreakdown: Array<{
      sku: string;
      item_name: string;
      servings: number;
      grams: number;
      source: string;
    }> = friesSalesRes.rows.map((row) => {
      const servings = Number(row.qty_sold);
      return {
        sku: row.sku as string,
        item_name: row.item_name as string,
        servings,
        grams: servings * GRAMS_PER_SERVING,
        source: 'direct_sale',
      };
    });

    // Add set fries as a breakdown line
    if (totalSets > 0) {
      usageBreakdown.push({
        sku: '—',
        item_name: 'Set Meals (fries included)',
        servings: totalSets,
        grams: totalSets * GRAMS_PER_SERVING,
        source: 'set_meal',
      });
    }

    // ── Promo fries: Mix and Match Meal Deal (SKU 10069) = 2 servings per sale ─
    // Rule: each Mix and Match includes 2 French Fries servings. Not Sweet Potato.
    // SKU 10069 is category "Promotions", excluded from SET_SKUS above.
    const PROMO_FRIES_PER_SALE = 2;
    const promoFriesRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total
       FROM receipt_truth_daily_usage
       WHERE business_date = $1 AND sku = '10069'`,
      [date],
    );
    const promoQty = Number(promoFriesRes.rows[0]?.total ?? 0);
    const promoServings = promoQty * PROMO_FRIES_PER_SALE;

    if (promoServings > 0) {
      usageBreakdown.push({
        sku: '10069',
        item_name: 'Mix and Match Meal Deal (promo fries)',
        servings: promoServings,
        grams: promoServings * GRAMS_PER_SERVING,
        source: 'promo',
      });
    }

    const directServings = friesSalesRes.rows.reduce(
      (s: number, r: any) => s + Number(r.qty_sold),
      0,
    );
    const totalServings = directServings + totalSets + promoServings;
    const usedGrams = totalServings * GRAMS_PER_SERVING;

    // ── Formula ───────────────────────────────────────────────────────────
    const expected =
      start !== null ? start + purchased - usedGrams : null;
    const variance =
      end !== null && expected !== null ? end - expected : null;

    // ── Review status ─────────────────────────────────────────────────────
    const reviewRes = await pool.query(
      `SELECT id, owner_note, reviewed_by, reviewed_at
       FROM french_fries_variance_reviews
       WHERE shift_date = $1
       ORDER BY reviewed_at DESC LIMIT 1`,
      [date],
    );
    const hasReview = reviewRes.rows.length > 0;
    const latestReview = reviewRes.rows[0] ?? null;

    // ── Missing data guard ────────────────────────────────────────────────
    if (start === null || end === null) {
      return res.json({
        ok: true,
        date,
        prev_date: prevDateStr,
        status: 'incomplete_component_data',
        missing: [
          ...(start === null ? ['start_stock'] : []),
          ...(end === null ? ['end_stock'] : []),
        ],
        stock_source: { start: startSource, end: endSource },
        data: null,
      });
    }

    return res.json({
      ok: true,
      date,
      prev_date: prevDateStr,
      status: 'complete',
      grams_per_serving: GRAMS_PER_SERVING,
      total_servings: totalServings,
      direct_servings: directServings,
      set_servings: totalSets,
      promo_servings: promoServings,
      usage_breakdown: usageBreakdown,
      stock_source: { start: startSource, end: endSource },
      data: {
        item: 'French Fries',
        start,
        purchased,
        used: usedGrams,
        end,
        expected,
        variance,
        has_review: hasReview,
        latest_review: latestReview,
      },
    });
  } catch (err: any) {
    console.error('[fries-reconciliation] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /fries-reconciliation/reviews?date=YYYY-MM-DD ───────────────────────
router.get('/fries-reconciliation/reviews', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM french_fries_variance_reviews WHERE shift_date = $1 ORDER BY reviewed_at DESC`,
      [date],
    );
    return res.json({ ok: true, date, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /fries-reconciliation/reviews ──────────────────────────────────────
router.post('/fries-reconciliation/reviews', async (req, res) => {
  const { shift_date, variance_amount, owner_note, reviewed_by } = req.body;

  if (!shift_date || !owner_note || !reviewed_by || variance_amount === undefined) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: shift_date, variance_amount, owner_note, reviewed_by',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO french_fries_variance_reviews (shift_date, variance_amount, owner_note, reviewed_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [shift_date, variance_amount, owner_note, reviewed_by],
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
