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
    const now = new Date();

    // Use Asia/Bangkok business month boundaries from POS shift reports.
    const { rows } = await db.execute(sql`
      WITH month_window AS (
        SELECT
          date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date AS month_start,
          (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date AS next_month_start
      )
      SELECT
        COALESCE(SUM("netSales"), 0) AS total_sales,
        COUNT(*)::int AS shift_count
      FROM "PosShiftReport", month_window
      WHERE "businessDate" >= month_window.month_start
        AND "businessDate" < month_window.next_month_start
        AND "businessDate" IS NOT NULL
    `);
    
    // Get shift expenses from PosShiftReport for current month
    const expenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("shoppingTotal"), 0) as shopping_total,
        COALESCE(SUM("wagesTotal"), 0) as wages_total,
        COALESCE(SUM("otherExpense"), 0) as other_total
      FROM "PosShiftReport"
      WHERE "businessDate" >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND "businessDate" < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
        AND "businessDate" IS NOT NULL
    `);
    
    // Get business expenses from expenses table for current month (amount stored in cents as costCents)
    const businessExpenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("costCents") / 100.0, 0) as business_total
      FROM expenses
      WHERE ("shiftDate" AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND ("shiftDate" AT TIME ZONE 'Asia/Bangkok')::date < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const shiftCount = parseInt(rows[0]?.shift_count || '0');

    const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const expectedCompletedShifts = Math.max(bangkokNow.getDate() - 1, 0);
    const missingShiftReports = Math.max(expectedCompletedShifts - shiftCount, 0);

    const latestShiftResult = await db.execute(sql`
      SELECT MAX("businessDate") AS latest_business_date
      FROM "PosShiftReport"
      WHERE "businessDate" >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND "businessDate" < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
        AND "businessDate" IS NOT NULL
    `);

    const latestBusinessDate = latestShiftResult.rows[0]?.latest_business_date || null;
    
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
      shiftCoverage: {
        expectedCompletedShifts,
        syncedShiftReports: shiftCount,
        missingShiftReports,
        latestBusinessDate,
        status: missingShiftReports > 0 ? 'MISSING_SHIFT_REPORTS' : 'OK',
      },
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
      shiftCoverage: {
        expectedCompletedShifts: 0,
        syncedShiftReports: 0,
        missingShiftReports: 0,
        latestBusinessDate: null,
        status: 'MISSING_DATA',
      },
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
