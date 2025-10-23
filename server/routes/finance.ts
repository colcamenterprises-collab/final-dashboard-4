import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

router.get("/summary", async (_req, res) => {
  const { rows } = await db.execute(sql`
    SELECT payload
    FROM "daily_sales_v2"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);
  const payload = rows?.[0]?.payload || {};
  return res.json(payload.finance_summary || {});
});

// GET /api/finance/summary/today - Current Month Sales and Expenses
router.get("/summary/today", async (_req, res) => {
  try {
    // Get current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // Get verified sales from loyverse_shifts table for current month
    // Extract net_sales from each shift in the jsonb data array
    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(
          SUM(
            (shift_data->>'net_sales')::decimal
          ), 0
        ) as total_sales,
        COUNT(*) as shift_count
      FROM loyverse_shifts,
      jsonb_array_elements(data->'shifts') as shift_data
      WHERE EXTRACT(YEAR FROM shift_date) = ${year}
        AND EXTRACT(MONTH FROM shift_date) = ${month}
        AND jsonb_array_length(data->'shifts') > 0
    `);
    
    // Get expenses from PosShiftReport for current month
    const expenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("shoppingTotal"), 0) as shopping_total,
        COALESCE(SUM("wagesTotal"), 0) as wages_total,
        COALESCE(SUM("otherExpense"), 0) as other_total
      FROM "PosShiftReport"
      WHERE EXTRACT(YEAR FROM TO_DATE("businessDate", 'YYYY-MM-DD')) = ${year}
        AND EXTRACT(MONTH FROM TO_DATE("businessDate", 'YYYY-MM-DD')) = ${month}
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const shiftCount = parseInt(rows[0]?.shift_count || '0');
    
    const shoppingExpenses = parseFloat(expenseResult.rows[0]?.shopping_total || '0');
    const wagesExpenses = parseFloat(expenseResult.rows[0]?.wages_total || '0');
    const otherExpenses = parseFloat(expenseResult.rows[0]?.other_total || '0');
    const totalExpenses = shoppingExpenses + wagesExpenses + otherExpenses;
    
    return res.json({
      sales: currentMonthSales,
      currentMonthSales,
      shiftCount,
      expenses: totalExpenses,
      currentMonthExpenses: totalExpenses,
      expenseBreakdown: {
        shopping: shoppingExpenses,
        wages: wagesExpenses,
        other: otherExpenses
      },
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales - totalExpenses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Current month summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch current month summary' });
  }
});

export default router;