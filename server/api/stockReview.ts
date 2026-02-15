import express from 'express';
import { pool } from '../db';

const router = express.Router();

function parseDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseDays(value: unknown): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 7;
  const intDays = Math.trunc(raw);
  return Math.max(1, Math.min(31, intDays));
}

router.get('/rolls', async (req, res) => {
  const endDate = parseDay(req.query.endDate);
  const days = parseDays(req.query.days);

  if (!endDate) {
    return res.status(400).json({
      error: 'endDate query parameter is required (YYYY-MM-DD)'
    });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  try {
    const result = await pool.query(
      `
      WITH date_window AS (
        SELECT generate_series(
          $1::date - (($2::int - 1) * interval '1 day'),
          $1::date,
          interval '1 day'
        )::date AS shift_date
      ), normalized_sales AS (
        SELECT
          COALESCE(
            d.shift_date,
            CASE
              WHEN NULLIF(d."shiftDate", '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN NULLIF(d."shiftDate", '')::date
              ELSE NULL
            END
          ) AS shift_date,
          d.payload,
          d."createdAt"
        FROM daily_sales_v2 d
        WHERE d."deletedAt" IS NULL
      ), latest_sales AS (
        SELECT DISTINCT ON (n.shift_date)
          n.shift_date,
          n.payload
        FROM normalized_sales n
        WHERE n.shift_date BETWEEN $1::date - (($2::int - 1) * interval '1 day') AND $1::date
        ORDER BY n.shift_date, n."createdAt" DESC
      )
      SELECT
        w.shift_date::text AS "shiftDate",
        CASE
          WHEN (l.payload ? 'rollsEnd') AND (l.payload->>'rollsEnd') ~ '^-?\\d+(\\.\\d+)?$' THEN (l.payload->>'rollsEnd')::numeric
          WHEN (l.payload ? 'rolls_end') AND (l.payload->>'rolls_end') ~ '^-?\\d+(\\.\\d+)?$' THEN (l.payload->>'rolls_end')::numeric
          ELSE NULL
        END AS "rollsEnd",
        CASE
          WHEN ((l.payload ? 'rollsEnd') AND (l.payload->>'rollsEnd') ~ '^-?\\d+(\\.\\d+)?$')
            OR ((l.payload ? 'rolls_end') AND (l.payload->>'rolls_end') ~ '^-?\\d+(\\.\\d+)?$')
          THEN 'daily_sales_v2.payload.rollsEnd'
          ELSE NULL
        END AS source
      FROM date_window w
      LEFT JOIN latest_sales l ON l.shift_date = w.shift_date
      ORDER BY w.shift_date DESC
      `,
      [endDate, days]
    );

    const rows = result.rows.map((row) => ({
      shiftDate: row.shiftDate,
      rollsEnd: row.rollsEnd == null ? null : Number(row.rollsEnd),
      source: row.source,
    }));

    return res.json({ endDate, days, rows });
  } catch (error) {
    console.error('[stock-review] rolls read failed:', error);
    return res.status(500).json({ error: 'Failed to load stock-review rolls data' });
  }
});

export default router;
