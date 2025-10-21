import express from "express";
import { db } from "../db";
import { sql, and, gte, lte } from "drizzle-orm";
import { loyverseReceipts } from "../../shared/schema";

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

// GET /api/finance/summary/today - Current Month Sales (100% accurate from Loyverse POS)
router.get("/summary/today", async (_req, res) => {
  try {
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Get actual sales from loyverse_receipts table for current month
    const result = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${loyverseReceipts.totalAmount} AS DECIMAL)), 0)`,
        receiptCount: sql<number>`COUNT(*)`,
      })
      .from(loyverseReceipts)
      .where(and(
        gte(loyverseReceipts.createdAt, startOfMonth),
        lte(loyverseReceipts.createdAt, endOfMonth)
      ));
    
    const currentMonthSales = result[0]?.totalSales || 0;
    const receiptCount = result[0]?.receiptCount || 0;
    
    return res.json({
      sales: currentMonthSales,
      currentMonthSales,
      receiptCount,
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales, // Using sales as display value
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Current month sales error:', error);
    return res.status(500).json({ error: 'Failed to fetch current month sales' });
  }
});

export default router;