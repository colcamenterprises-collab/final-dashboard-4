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

// GET /api/finance/summary/today - Current Month Sales from POS
router.get("/summary/today", async (_req, res) => {
  try {
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Get actual sales from lv_receipt table for current month
    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_sales,
        COUNT(*) as receipt_count
      FROM lv_receipt
      WHERE created_at >= ${startOfMonth.toISOString()}
        AND created_at <= ${endOfMonth.toISOString()}
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const receiptCount = parseInt(rows[0]?.receipt_count || '0');
    
    return res.json({
      sales: currentMonthSales,
      currentMonthSales,
      receiptCount,
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Current month sales error:', error);
    return res.status(500).json({ error: 'Failed to fetch current month sales' });
  }
});

export default router;