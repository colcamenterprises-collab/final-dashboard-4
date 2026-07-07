/**
 * /api/analysis/rolls-reconciliation?date=YYYY-MM-DD — Rolls Reconciliation
 *
 * Read-only, single-row reconciliation for Shift Analysis.
 * Sources:
 * - Previous: previous completed Daily Stock V2 closing rolls count from daily_sales_v2.payload.rollsEnd
 * - Purchased: current Daily Stock V2 shift purchase rolls from daily_sales_v2.payload.shiftPurchases.rollsPcs
 * - Used: burger/set receipt count from receipt_truth_daily_usage (1 burger sold = 1 roll used)
 * - Actual: current Daily Stock V2 closing rolls count from daily_sales_v2.payload.rollsEnd
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

function toNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get('/rolls-reconciliation', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  try {
    const currentRes = await pool.query(
      `SELECT id, "shiftDate", payload
       FROM daily_sales_v2
       WHERE COALESCE("shiftDate", shift_date::text) = $1
         AND "deletedAt" IS NULL
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC,
                (payload->'shiftPurchases'->>'rollsPcs') IS NOT NULL DESC,
                "createdAt" DESC
       LIMIT 1`,
      [date],
    );
    const current = currentRes.rows[0] ?? null;
    const currentPayload = current?.payload ?? null;

    const previousRes = await pool.query(
      `SELECT id, COALESCE("shiftDate", shift_date::text) AS shift_date, payload
       FROM daily_sales_v2
       WHERE COALESCE("shiftDate", shift_date::text) < $1
         AND "deletedAt" IS NULL
         AND (payload->>'rollsEnd') IS NOT NULL
       ORDER BY COALESCE("shiftDate", shift_date::text) DESC, "createdAt" DESC
       LIMIT 1`,
      [date],
    );
    const previous = previousRes.rows[0] ?? null;
    const previousPayload = previous?.payload ?? null;

    const usedRes = await pool.query(
      `SELECT COALESCE(SUM(quantity_sold), 0) AS total,
              COUNT(*)::int AS row_count
       FROM receipt_truth_daily_usage
       WHERE business_date = $1
         AND category_name = ANY($2::text[])
         AND item_name NOT LIKE 'Add-ons%'`,
      [date, BURGER_CATEGORIES],
    );

    const previousValue = toNullableNumber(previousPayload?.rollsEnd);
    const purchasedValue = currentPayload
      ? toNullableNumber(currentPayload?.shiftPurchases?.rollsPcs)
      : null;
    const usedValue = Number(usedRes.rows[0]?.row_count ?? 0) > 0
      ? toNullableNumber(usedRes.rows[0]?.total)
      : null;
    const actualValue = currentPayload ? toNullableNumber(currentPayload?.rollsEnd) : null;
    const expectedValue = previousValue !== null && purchasedValue !== null && usedValue !== null
      ? previousValue + purchasedValue - usedValue
      : null;
    const varianceValue = actualValue !== null && expectedValue !== null
      ? actualValue - expectedValue
      : null;

    const missing = [
      ...(previousValue === null ? ['previous_completed_daily_stock_v2_rollsEnd'] : []),
      ...(purchasedValue === null ? ['current_daily_stock_v2_shiftPurchases.rollsPcs'] : []),
      ...(usedValue === null ? ['receipt_truth_daily_usage_burger_count'] : []),
      ...(actualValue === null ? ['current_daily_stock_v2_rollsEnd'] : []),
      ...(expectedValue === null ? ['expected'] : []),
      ...(varianceValue === null ? ['variance'] : []),
    ];

    return res.json({
      ok: true,
      date,
      source: 'daily_sales_v2.payload.rollsEnd,daily_sales_v2.payload.shiftPurchases.rollsPcs,receipt_truth_daily_usage.quantity_sold',
      status: missing.length === 0 ? 'complete' : 'partial',
      missing,
      previous_shift_date: previous?.shift_date ?? null,
      data: {
        previous: previousValue,
        purchased: purchasedValue,
        used: usedValue,
        expected: expectedValue,
        actual: actualValue,
        variance: varianceValue,
        status: varianceValue === null ? null : varianceValue === 0 ? 'OK' : 'FLAG',
      },
    });
  } catch (err: any) {
    console.error('[rolls-reconciliation] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
