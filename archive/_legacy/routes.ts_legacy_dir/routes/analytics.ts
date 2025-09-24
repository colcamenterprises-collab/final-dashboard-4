// server/routes/analytics.ts - Analytics API endpoints
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/latest - Get latest analytics data for a restaurant
router.get('/latest', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId required' });
    }

    // Get the most recent analytics data (using snake_case table name)
    const analytics = await prisma.$queryRaw`
      SELECT * FROM analytics_daily 
      WHERE "restaurantId" = ${String(restaurantId)} 
      ORDER BY "shiftDate" DESC 
      LIMIT 1
    `;

    // Get corresponding daily sales data
    const dailySales = analytics && analytics.length > 0 ? await prisma.$queryRaw`
      SELECT * FROM daily_sales 
      WHERE "restaurantId" = ${String(restaurantId)} 
      AND "shiftDate" = ${analytics[0].shiftDate}
    ` : null;

    if (!analytics || analytics.length === 0) {
      return res.status(404).json({ error: 'No analytics data found' });
    }

    const analyticsData = analytics[0];
    const dailySalesData = dailySales && dailySales.length > 0 ? dailySales[0] : null;

    res.json({
      analytics: analyticsData,
      dailySales: dailySalesData,
      shiftDate: analyticsData.shiftDate
    });

  } catch (error) {
    console.error('Error fetching latest analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// GET /receipts/window - Get receipt summary for a time window  
router.get('/window', async (req, res) => {
  try {
    const { restaurantId, from, to } = req.query;
    
    if (!restaurantId || !from || !to) {
      return res.status(400).json({ error: 'restaurantId, from, and to parameters required' });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));

    // Get receipts in the time window (using snake_case table names)
    const receipts = await prisma.$queryRaw`
      SELECT r.*, 
             json_agg(DISTINCT jsonb_build_object(
               'id', ri.id,
               'name', ri.name,
               'qty', ri.qty,
               'total', ri.total
             )) as items,
             json_agg(DISTINCT jsonb_build_object(
               'id', rp.id,
               'method', rp.method,
               'amount', rp.amount
             )) as payments
      FROM receipts r
      LEFT JOIN receipt_items ri ON r.id = ri."receiptId"
      LEFT JOIN receipt_payments rp ON r.id = rp."receiptId"
      WHERE r."restaurantId" = ${String(restaurantId)}
        AND r."createdAtUTC" >= ${fromDate}
        AND r."createdAtUTC" <= ${toDate}
      GROUP BY r.id
      ORDER BY r."createdAtUTC" DESC
    `;

    // Calculate summary statistics
    let grossCents = 0;
    let discountsCents = 0;
    let netCents = 0;
    const paymentBreakdown: Record<string, number> = {};
    const itemStats: Record<string, { qty: number; revenue: number }> = {};

    for (const receipt of receipts) {
      grossCents += receipt.total + (receipt.discount || 0);
      discountsCents += receipt.discount || 0;
      netCents += receipt.total;

      // Process payments
      for (const payment of receipt.payments) {
        const method = payment.method || 'OTHER';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + payment.amount;
      }

      // Process items
      for (const item of receipt.items) {
        const name = item.name || 'Unknown';
        if (!itemStats[name]) {
          itemStats[name] = { qty: 0, revenue: 0 };
        }
        itemStats[name].qty += item.qty;
        itemStats[name].revenue += item.total;
      }
    }

    // Get top 5 items by revenue
    const topItems = Object.entries(itemStats)
      .sort(([,a], [,b]) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(([name, stats]) => ({
        name,
        qty: stats.qty,
        revenueCents: stats.revenue
      }));

    res.json({
      count: receipts.length,
      grossCents,
      discountsCents,
      netCents,
      payments: paymentBreakdown,
      topItems
    });

  } catch (error) {
    console.error('Error fetching window data:', error);
    res.status(500).json({ error: 'Failed to fetch window data' });
  }
});

export default router;