import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

// PHASE H HARDENED - All finance routes with safe fallbacks

router.get("/summary", async (_req, res) => {
  try {
    const { rows } = await db.execute(sql`
      SELECT payload
      FROM "daily_sales_v2"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);
    const payload = rows?.[0]?.payload || {};
    return res.json({ success: true, data: payload.finance_summary || {} });
  } catch (err) {
    console.error('[EXPENSE_SAFE_FAIL] finance/summary:', err);
    return res.status(200).json({
      success: true,
      data: {},
      warning: 'SAFE_FALLBACK_USED'
    });
  }
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
    
    // Get shift expenses from PosShiftReport for current month
    const expenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("shoppingTotal"), 0) as shopping_total,
        COALESCE(SUM("wagesTotal"), 0) as wages_total,
        COALESCE(SUM("otherExpense"), 0) as other_total
      FROM "PosShiftReport"
      WHERE EXTRACT(YEAR FROM "businessDate") = ${year}
        AND EXTRACT(MONTH FROM "businessDate") = ${month}
        AND "businessDate" IS NOT NULL
    `);
    
    // Get business expenses from expenses table for current month (amount stored in cents as costCents)
    const businessExpenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("costCents") / 100.0, 0) as business_total
      FROM expenses
      WHERE EXTRACT(YEAR FROM "shiftDate") = ${year}
        AND EXTRACT(MONTH FROM "shiftDate") = ${month}
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const shiftCount = parseInt(rows[0]?.shift_count || '0');
    
    const shoppingExpenses = parseFloat(expenseResult.rows[0]?.shopping_total || '0');
    const wagesExpenses = parseFloat(expenseResult.rows[0]?.wages_total || '0');
    const otherExpenses = parseFloat(expenseResult.rows[0]?.other_total || '0');
    const shiftExpensesTotal = shoppingExpenses + wagesExpenses + otherExpenses;
    
    const businessExpenses = parseFloat(businessExpenseResult.rows[0]?.business_total || '0');
    
    const totalExpenses = shiftExpensesTotal + businessExpenses;
    
    return res.json({
      sales: currentMonthSales,
      currentMonthSales,
      shiftCount,
      expenses: totalExpenses,
      currentMonthExpenses: totalExpenses,
      expenseBreakdown: {
        shopping: shoppingExpenses,
        wages: wagesExpenses,
        other: otherExpenses,
        business: businessExpenses,
        shiftTotal: shiftExpensesTotal
      },
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales - totalExpenses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[EXPENSE_SAFE_FAIL] finance/summary/today:', error);
    return res.status(200).json({
      success: true,
      sales: 0,
      currentMonthSales: 0,
      shiftCount: 0,
      expenses: 0,
      currentMonthExpenses: 0,
      expenseBreakdown: {
        shopping: 0,
        wages: 0,
        other: 0,
        business: 0,
        shiftTotal: 0
      },
      month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: 0,
      timestamp: new Date().toISOString(),
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

export default router;