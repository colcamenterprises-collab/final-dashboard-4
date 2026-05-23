import { pool } from '../db';

async function sq(query: string, params: any[]): Promise<any[]> {
  if (!pool) return [];
  try {
    const r = await pool.query(query, params);
    return r.rows;
  } catch {
    return [];
  }
}

export async function getShiftVerification(shiftDate: string) {
  // daily_sales_v2: shift_date (date col, snake_case) | "createdAt" (timestamp, camelCase)
  // daily_stock_sales: shift_date (timestamp, snake_case)
  // loyverse_shifts: shift_date (text/date, snake_case)
  // purchasing_items: "createdAt" (timestamp, camelCase)
  const [pos, sales, stock, purchasing, receipts] = await Promise.all([
    sq(`SELECT COUNT(*)::int AS c FROM loyverse_shifts WHERE shift_date::text = $1`, [shiftDate]),
    sq(`SELECT id, payload FROM daily_sales_v2 WHERE shift_date::text = $1 ORDER BY shift_date DESC LIMIT 1`, [shiftDate]),
    sq(`SELECT id FROM daily_stock_sales WHERE DATE(shift_date) = $1::date ORDER BY id DESC LIMIT 1`, [shiftDate]),
    sq(`SELECT COUNT(*)::int AS c FROM purchasing_items WHERE DATE("createdAt") = $1::date`, [shiftDate]),
    sq(`SELECT COUNT(*)::int AS c FROM receipts WHERE DATE("createdAtUTC") = $1::date`, [shiftDate]),
  ]);
  return {
    shiftDate,
    posShiftReportExists: (pos[0]?.c ?? 0) > 0,
    staffDeclaredSales: sales[0]?.payload?.totals?.netSales ?? null,
    paymentBreakdownComparison: sales[0]?.payload?.paymentMethods ?? null,
    receiptCount: Number(receipts[0]?.c ?? 0),
    dailySalesFormStatus: sales.length > 0 ? 'submitted' : 'missing',
    dailyStockFormStatus: stock.length > 0 ? 'submitted' : 'missing',
    purchasingStatus: (purchasing[0]?.c ?? 0) > 0 ? 'logged' : 'missing',
  };
}
