import express from 'express';
import { db } from '../../lib/prisma';

const router = express.Router();

// GET /api/library/daily-sales - Unified library showing complete form submissions
router.get('/', async (req, res) => {
  try {
    // Fetch from both dailySalesV2 (Form 1) and dailyStockV2 (Form 2) tables
    const [salesRows, stockRows] = await Promise.all([
      db().dailySalesV2.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          completedBy: true,
          startingCash: true,
          endingCash: true,
          totalSales: true,
          totalExpenses: true,
          cashBanked: true,
          qrSales: true
        }
      }),
      db().dailyStockV2.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          salesId: true,
          burgerBuns: true,
          meatWeightG: true,
          notes: true
        }
      })
    ]);

    // Create unified records by joining Sales and Stock data by shift ID
    const salesMap = new Map(salesRows.map(r => [r.id, r]));
    const stockMap = new Map(stockRows.map(r => [r.salesId, r]));
    
    // Combine data from both forms into unified records
    const unifiedData = [];
    
    // Add sales records with their corresponding stock data
    for (const salesRecord of salesRows) {
      const stockRecord = stockMap.get(salesRecord.id);
      unifiedData.push({
        id: salesRecord.id,
        dateISO: salesRecord.createdAt.toISOString(),
        staff: salesRecord.completedBy ?? "",
        startingCash: Number(salesRecord.startingCash ?? 0),
        closingCash: Number(salesRecord.endingCash ?? 0),
        totalSales: Number(salesRecord.totalSales ?? 0),
        totalExpenses: Number(salesRecord.totalExpenses ?? 0),
        bankCash: Number(salesRecord.cashBanked ?? 0),
        bankQr: Number(salesRecord.qrSales ?? 0),
        status: stockRecord ? "Completed" : "Partial (Form 1 only)",
        pdfPath: null,
        // Stock data (if available)
        rolls: stockRecord ? (stockRecord.burgerBuns ?? 0) : null,
        meatGrams: stockRecord ? (stockRecord.meatWeightG ?? 0) : null,
        hasStockData: !!stockRecord
      });
    }
    
    // Add any orphaned stock records (without corresponding sales)
    for (const stockRecord of stockRows) {
      if (!salesMap.has(stockRecord.salesId)) {
        unifiedData.push({
          id: stockRecord.id,
          dateISO: stockRecord.createdAt.toISOString(),
          staff: "Unknown",
          startingCash: 0,
          closingCash: 0,
          totalSales: 0,
          totalExpenses: 0,
          bankCash: 0,
          bankQr: 0,
          status: "Partial (Form 2 only)",
          pdfPath: null,
          rolls: stockRecord.burgerBuns ?? 0,
          meatGrams: stockRecord.meatWeightG ?? 0,
          hasStockData: true
        });
      }
    }
    
    const data = unifiedData.sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Library API error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get library data' });
  }
});

export async function getDailySalesLibrary(req: express.Request, res: express.Response) {
  // Use the same logic as the router
  return router.handle(req, res, () => {});
}

export default router;