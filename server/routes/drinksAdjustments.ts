/**
 * GET  /api/analysis/drinks-adjustments?date=YYYY-MM-DD
 *   Returns all saved adjustments for a shift date.
 *
 * POST /api/analysis/drinks-adjustments
 *   Body: { shift_date, item_name, sku?, adjustment_qty, note, adjusted_by }
 *   Saves (or replaces) an adjustment for that item+date.
 *   When adjustment_qty is 0 and a prior record exists, it is deleted.
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/drinks-adjustments', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  const result = await pool
    .query(
      `SELECT id, shift_date, item_name, sku, adjustment_qty, note, adjusted_by, adjusted_at
       FROM drinks_variance_adjustments
       WHERE shift_date = $1::date
       ORDER BY adjusted_at ASC`,
      [date],
    )
    .catch(() => ({ rows: [] } as any));

  return res.json({ ok: true, date, data: result.rows });
});

router.post('/drinks-adjustments', async (req, res) => {
  const { shift_date, item_name, sku, adjustment_qty, note, adjusted_by } = req.body;

  if (!shift_date || !item_name || adjustment_qty === undefined || !note?.trim() || !adjusted_by?.trim()) {
    return res.status(400).json({ ok: false, error: 'shift_date, item_name, adjustment_qty, note, and adjusted_by are required' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(shift_date)) {
    return res.status(400).json({ ok: false, error: 'shift_date must be YYYY-MM-DD' });
  }

  const qty = parseInt(adjustment_qty, 10);
  if (isNaN(qty)) {
    return res.status(400).json({ ok: false, error: 'adjustment_qty must be an integer' });
  }

  // Insert always — each save creates a new timestamped record
  const result = await pool.query(
    `INSERT INTO drinks_variance_adjustments
       (shift_date, item_name, sku, adjustment_qty, note, adjusted_by, adjusted_at)
     VALUES ($1::date, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [shift_date, item_name, sku ?? null, qty, note.trim(), adjusted_by.trim()],
  );

  return res.json({ ok: true, data: result.rows[0] });
});

export default router;
