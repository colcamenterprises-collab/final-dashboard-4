/**
 * /api/analysis/sweet-potato-reconciliation?date=YYYY-MM-DD — Sweet Potato Fries Stock Reconciliation
 * /api/analysis/sweet-potato-reconciliation/reviews — Review persistence
 *
 * Single-row table: Sweet Potato Fries
 *   Start     = previous shift closing sweetPotatoEnd (canonical source: daily_sales_v2.payload->>'sweetPotatoEnd')
 *   Purchased = SUM(purchase_tally.sweet_potato_grams) for the shift date; 0 if no record
 *   Used      = SKU 10022 (Sweet Potato Fries) qty_sold × 130g per serving — NO sets included
 *   End       = current shift sweetPotatoEnd
 *   Expected  = Start + Purchased − Used
 *   Variance  = End − Expected
 *
 * COMPLETELY ISOLATED from French Fries (friesEnd) and all other stock tables.
 * Does NOT include set meals. Does NOT touch Drinks, Burgers, Buns, Meat, Side Orders, or French Fries.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const SWEET_POTATO_SKU = '10022';
const GRAMS_PER_SERVING = 130;

// ─── Helper: resolve canonical sweet potato end weight for a shift date ───────
async function resolveSweetPotatoWeight(shiftDate: string): Promise<{
  value: number | null;
  source: 'v2_canonical' | 'missing';
}> {
  const r = await pool.query(
    `SELECT (payload->>'sweetPotatoEnd')::numeric AS v2_canonical
     FROM daily_sales_v2
     WHERE "shiftDate" = $1
     LIMIT 1`,
    [shiftDate],
  );
  if (!r.rows[0]) return { value: null, source: 'missing' };
  const v2 = r.rows[0].v2_canonical !== null ? Number(r.rows[0].v2_canonical) : null;
  if (v2 !== null && !isNaN(v2)) return { value: v2, source: 'v2_canonical' };
  return { value: null, source: 'missing' };
}

// ─── GET /sweet-potato-reconciliation?date=YYYY-MM-DD ─────────────────────────
router.get('/sweet-potato-reconciliation', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    // Previous shift date
    const prevDate = new Date(date + 'T12:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    // ── Start: previous shift canonical sweetPotatoEnd ────────────────────
    const startResolved = await resolveSweetPotatoWeight(prevDateStr);
    const start: number | null = startResolved.value;
    const startSource = startResolved.source;

    // ── End: current shift canonical sweetPotatoEnd ───────────────────────
    const endResolved = await resolveSweetPotatoWeight(date);
    const end: number | null = endResolved.value;
    const endSource = endResolved.source;

    // ── Purchased: sum of sweet_potato_grams from purchase_tally ─────────
    const purchasedRes = await pool.query(
      `SELECT COALESCE(SUM(sweet_potato_grams), 0) AS purchased_grams
       FROM purchase_tally
       WHERE date::date = $1::date`,
      [date],
    );
    const purchased = Number(purchasedRes.rows[0]?.purchased_grams ?? 0);

    // ── Used: SKU 10022 only — NO set meals ───────────────────────────────
    const salesRes = await pool.query(
      `SELECT sku, item_name, SUM(quantity_sold) AS qty_sold
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND sku = $2
         AND item_name NOT LIKE 'Add-ons%'
       GROUP BY sku, item_name`,
      [date, SWEET_POTATO_SKU],
    );

    const qtySold = salesRes.rows.length > 0 ? Number(salesRes.rows[0].qty_sold) : 0;
    const usedGrams = qtySold * GRAMS_PER_SERVING;

    const usageBreakdown = salesRes.rows.map((row) => ({
      sku: row.sku as string,
      item_name: row.item_name as string,
      servings: Number(row.qty_sold),
      grams: Number(row.qty_sold) * GRAMS_PER_SERVING,
      source: 'direct_sale' as const,
    }));

    // ── Formula ───────────────────────────────────────────────────────────
    const expected = start !== null ? start + purchased - usedGrams : null;
    const variance = end !== null && expected !== null ? end - expected : null;

    // ── Review status ─────────────────────────────────────────────────────
    const reviewRes = await pool.query(
      `SELECT id, owner_note, reviewed_by, reviewed_at
       FROM sweet_potato_variance_reviews
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
      total_servings: qtySold,
      usage_breakdown: usageBreakdown,
      stock_source: { start: startSource, end: endSource },
      data: {
        item: 'Sweet Potato Fries',
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
    console.error('[sweet-potato-reconciliation] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /sweet-potato-reconciliation/reviews?date=YYYY-MM-DD ────────────────
router.get('/sweet-potato-reconciliation/reviews', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM sweet_potato_variance_reviews WHERE shift_date = $1 ORDER BY reviewed_at DESC`,
      [date],
    );
    return res.json({ ok: true, date, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /sweet-potato-reconciliation/reviews ────────────────────────────────
router.post('/sweet-potato-reconciliation/reviews', async (req, res) => {
  const { shift_date, variance_amount, owner_note, reviewed_by } = req.body;
  if (!shift_date || !owner_note || !reviewed_by || variance_amount === undefined) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: shift_date, variance_amount, owner_note, reviewed_by',
    });
  }
  try {
    const result = await pool.query(
      `INSERT INTO sweet_potato_variance_reviews (shift_date, variance_amount, owner_note, reviewed_by)
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
