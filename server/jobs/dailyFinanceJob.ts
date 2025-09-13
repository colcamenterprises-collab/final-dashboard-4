import { pool } from "../db";
import { calculateFinance } from "../utils/financeCalculations";

export async function runDailyFinanceJob() {
  console.log("▶ Running Daily Finance Job…");

  try {
    const result = await pool.query(
      `SELECT id, payload 
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC 
       LIMIT 1`
    );

    if (!result.rows.length) return;
    const row = result.rows[0];
    const payload = row.payload || {};

    // TODO: Re-enable expense aggregation when schema imports are fixed
    const totals = { direct: 0, business: 0, stock: 0 };

    const finance = calculateFinance({
      sales: payload.totalSales || 0,
      cogs: payload.cogs || 0,
      labor: (payload.wages || []).reduce((sum: number, w: any) => sum + (w.amount || 0), 0),
      totals,
    });

    const updatedPayload = {
      ...payload,
      finance_summary: finance
    };

    await pool.query(
      `UPDATE daily_sales_v2 
       SET payload = $1 
       WHERE id = $2`,
      [JSON.stringify(updatedPayload), row.id]
    );

    console.log("✔ Daily Finance Job complete");
  } catch (err) {
    console.error("Daily Finance Job failed:", err);
  }
}