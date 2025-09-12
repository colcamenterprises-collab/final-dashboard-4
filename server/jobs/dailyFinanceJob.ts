import { pool } from "../db";
import { calculateFinance } from "../utils/financeCalculations";

export async function runDailyFinanceJob() {
  console.log("▶ Running Daily Finance Job...");

  try {
    const result = await pool.query(
      `SELECT id, payload 
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC 
       LIMIT 30`
    );

    for (const row of result.rows) {
      try {
        const payload = row.payload || {};
        
        // Extract financial data from payload
        const sales = payload.totalSales || 0;
        const laborCosts = (payload.wages || []).reduce((sum: number, wage: any) => sum + (wage.amount || 0), 0);
        const expenses = (payload.expenses || []).reduce((sum: number, exp: any) => sum + (exp.cost || 0), 0);
        
        // Estimate COGS (Cost of Goods Sold) as 30% of sales for now
        // This can be refined with actual ingredient cost calculations
        const cogs = Math.round(sales * 0.30);
        
        // Estimate occupancy costs (rent, utilities) as 15% of sales
        const occupancy = Math.round(sales * 0.15);

        const finance = calculateFinance({
          sales,
          cogs,
          labor: laborCosts,
          occupancy,
          expenses
        });

        // Update payload with finance summary
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

        console.log(`✓ Updated finance summary for record ${row.id}`);
      } catch (err) {
        console.error("Finance calc failed for row:", row.id, err);
      }
    }

    console.log("✔ Daily Finance Job complete");
  } catch (err) {
    console.error("Daily Finance Job failed:", err);
  }
}