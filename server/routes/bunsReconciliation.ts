/**
 * /api/analysis/buns-reconciliation  — Buns Stock Reconciliation (PATCH 1)
 * /api/analysis/buns-reconciliation/reviews — Review persistence
 *
 * CORE STOCK V1 — Buns Only. Does NOT touch Drinks or Burgers & Sets logic.
 *
 * Single-row table: Burger Buns
 *   Start     = previous shift closing burgerBuns (daily_stock_v2 via daily_sales_v2.shiftDate)
 *   Purchased = SUM(purchase_tally.rolls_pcs) WHERE date = shift_date
 *   Used      = SUM(quantity_sold) from receipt_truth_daily_usage burger/set categories
 *   End       = current shift closing burgerBuns (daily_stock_v2 via daily_sales_v2.shiftDate)
 *   Expected  = Start + Purchased − Used
 *   Variance  = End − Expected   (negative = missing buns)
 *
 * If Start or End stock is missing → status: incomplete_component_data
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const BURGER_CATEGORIES = [
  'Burgers',
  'Smash Burgers',
  'Burger Sets',
  'Burger Sets (Meal Deals)',
  'Smash Burger Sets (Meal Deals)',
  'Kids',
  'Kids Will Love This',
];

// ─── GET /buns-reconciliation?date=YYYY-MM-DD ────────────────────────────────
router.get('/buns-reconciliation', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // Previous shift date (subtract 1 calendar day)
    const prevDate = new Date(date + 'T12:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    // ── Start: previous shift's closing bun count ─────────────────────────
    // Source: daily_sales_v2.payload.rollsEnd for the previous shift date.
    // Pick the most complete row: prefer rows where rollsEnd is set, then most recent.
    const startRes = await pool.query(
      `SELECT (payload->>'rollsEnd')::int AS rolls_end
       FROM daily_sales_v2
       WHERE "shiftDate" = $1
         AND (payload->>'rollsEnd') IS NOT NULL
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC, "createdAt" DESC
       LIMIT 1`,
      [prevDateStr],
    );
    const start: number | null = startRes.rows[0]
      ? Number(startRes.rows[0].rolls_end)
      : null;

    // ── End: current shift's closing bun count ────────────────────────────
    // Source: daily_sales_v2.payload.rollsEnd for the current shift date.
    // Must pick the most complete row: prefer rows where rollsEnd is set, then most recent.
    // DO NOT estimate from meat, receipts, SKUs, or fallback values.
    const endRes = await pool.query(
      `SELECT (payload->>'rollsEnd')::int AS rolls_end
       FROM daily_sales_v2
       WHERE "shiftDate" = $1
         AND (payload->>'rollsEnd') IS NOT NULL
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC, "createdAt" DESC
       LIMIT 1`,
      [date],
    );
    const end: number | null = endRes.rows[0]
      ? Number(endRes.rows[0].rolls_end)
      : null;

    // ── Purchased: sum of rolls_pcs from purchase_tally for this date ─────
    const purchRes = await pool.query(
      `SELECT COALESCE(SUM(rolls_pcs), 0) AS total
       FROM purchase_tally
       WHERE date = $1 AND rolls_pcs IS NOT NULL`,
      [date],
    );
    const purchased = Number(purchRes.rows[0]?.total ?? 0);

    // ── Used: sum of quantity_sold across all burger/set categories ───────
    const usedRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND category_name = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'`,
      [date, BURGER_CATEGORIES],
    );
    const usedFromCategories = Number(usedRes.rows[0]?.total ?? 0);

    // ── Promo buns: Mix and Match Meal Deal (SKU 10069) = 2 buns per sale ─
    // Rule: each Mix and Match sale includes 2 burgers → 2 buns.
    // SKU 10069 is category "Promotions", excluded from BURGER_CATEGORIES above.
    const PROMO_BUNS_PER_SALE = 2;
    const promoRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total
       FROM receipt_truth_daily_usage
       WHERE business_date = $1 AND sku = '10069'`,
      [date],
    );
    const promoQty = Number(promoRes.rows[0]?.total ?? 0);
    const promoBunsContribution = promoQty * PROMO_BUNS_PER_SALE;

    const used = usedFromCategories + promoBunsContribution;

    // ── Formula ───────────────────────────────────────────────────────────
    const expected = start !== null ? start + purchased - used : null;
    const variance = end !== null && expected !== null ? end - expected : null;

    // ── Review status ─────────────────────────────────────────────────────
    const reviewRes = await pool.query(
      `SELECT id, owner_note, reviewed_by, reviewed_at
       FROM buns_variance_reviews
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
        status: 'incomplete_component_data',
        missing: [
          ...(start === null ? ['start_stock'] : []),
          ...(end === null ? ['end_stock'] : []),
        ],
        data: null,
      });
    }

    return res.json({
      ok: true,
      date,
      prev_date: prevDateStr,
      status: 'complete',
      promo_breakdown: {
        regular_burger_categories_buns: usedFromCategories,
        mix_and_match_promo_buns: promoBunsContribution,
        promo_qty_sold: promoQty,
        buns_per_promo_sale: PROMO_BUNS_PER_SALE,
      },
      data: {
        item: 'Burger Buns',
        start,
        purchased,
        used,
        end,
        expected,
        variance,
        has_review: hasReview,
        latest_review: latestReview,
      },
    });
  } catch (err: any) {
    console.error('[buns-reconciliation] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /buns-reconciliation/reviews?date=YYYY-MM-DD ────────────────────────
router.get('/buns-reconciliation/reviews', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM buns_variance_reviews WHERE shift_date = $1 ORDER BY reviewed_at DESC`,
      [date],
    );
    return res.json({ ok: true, date, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /buns-reconciliation/reviews ───────────────────────────────────────
router.post('/buns-reconciliation/reviews', async (req, res) => {
  const { shift_date, variance_amount, owner_note, reviewed_by } = req.body;

  if (!shift_date || !owner_note || !reviewed_by || variance_amount === undefined) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: shift_date, variance_amount, owner_note, reviewed_by',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO buns_variance_reviews (shift_date, variance_amount, owner_note, reviewed_by)
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
