import { pool } from '../db';

export async function getStockStatus(shiftDate: string) {
  if (!pool) return { shiftDate, rolls: null, meat: null, drinks: null, fries: null };
  try {
    const r = await pool.query(
      `SELECT payload FROM daily_sales_v2 WHERE shift_date::text = $1 ORDER BY shift_date DESC LIMIT 1`,
      [shiftDate]
    );
    const p = r.rows[0]?.payload ?? {};
    const metrics = p.stockControl ?? {};
    return {
      shiftDate,
      rolls: metrics.rolls ?? null,
      meat: metrics.meat ?? null,
      drinks: metrics.drinks ?? null,
      fries: metrics.fries ?? null,
      thresholds: { rolls: 4, meat: 500, drinks: 2, fries: 3 },
      friesThresholdNote: 'Temporary threshold ±3 units until canonical fries baseline table is finalized.',
    };
  } catch {
    return { shiftDate, rolls: null, meat: null, drinks: null, fries: null };
  }
}
