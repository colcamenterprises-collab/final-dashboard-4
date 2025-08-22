import express from 'express';
import { db } from '../../lib/prisma';

const router = express.Router();

// GET /api/library/daily-sales - Unified library showing complete form submissions
router.get('/', async (req, res) => {
  try {
    console.log('[library] Starting library data fetch...');

    // Fetch from both dailySalesV2 (Form 1) and dailyStockV2 (Form 2) tables
    const [salesRows, stockRows] = await Promise.all([
      db().dailySalesV2.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit for performance
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
        take: 50, // Limit for performance
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

    console.log(`[library] Found ${salesRows.length} sales records, ${stockRows.length} stock records`);

    // Helper function to safely convert database values to numbers
    const safeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = parseFloat(String(value));
      return isNaN(num) ? 0 : num;
    };

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
        staff: salesRecord.completedBy || "Unknown",
        startingCash: safeNumber(salesRecord.startingCash),
        closingCash: safeNumber(salesRecord.endingCash),
        totalSales: safeNumber(salesRecord.totalSales),
        totalExpenses: safeNumber(salesRecord.totalExpenses),
        bankCash: safeNumber(salesRecord.cashBanked),
        bankQr: safeNumber(salesRecord.qrSales),
        status: stockRecord ? "Completed" : "Partial (Form 1 only)",
        pdfPath: null,
        // Stock data (if available)
        rolls: stockRecord ? safeNumber(stockRecord.burgerBuns) : 0,
        meatGrams: stockRecord ? safeNumber(stockRecord.meatWeightG) : 0,
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
          rolls: safeNumber(stockRecord.burgerBuns),
          meatGrams: safeNumber(stockRecord.meatWeightG),
          hasStockData: true
        });
      }
    }
    
    const data = unifiedData.sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );

    console.log(`[library] Returning ${data.length} unified records`);
    if (data.length > 0) {
      console.log(`[library] Sample record:`, {
        id: data[0].id,
        staff: data[0].staff,
        startingCash: data[0].startingCash,
        hasStockData: data[0].hasStockData
      });
    }

    res.json({ ok: true, data });
  } catch (error) {
    console.error('[library] API error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get library data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export async function getDailySalesLibrary(req: express.Request, res: express.Response) {
  try {
    console.log('[library] Starting library data fetch...');

    // Fetch from both dailySalesV2 (Form 1) and dailyStockV2 (Form 2) tables
    const [salesRows, stockRows] = await Promise.all([
      db().dailySalesV2.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit for performance
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
        take: 50, // Limit for performance
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

    console.log(`[library] Found ${salesRows.length} sales records, ${stockRows.length} stock records`);

    // Helper function to safely convert database values to numbers
    const safeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = parseFloat(String(value));
      return isNaN(num) ? 0 : num;
    };

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
        staff: salesRecord.completedBy || "Unknown",
        startingCash: safeNumber(salesRecord.startingCash),
        closingCash: safeNumber(salesRecord.endingCash),
        totalSales: safeNumber(salesRecord.totalSales),
        totalExpenses: safeNumber(salesRecord.totalExpenses),
        bankCash: safeNumber(salesRecord.cashBanked),
        bankQr: safeNumber(salesRecord.qrSales),
        status: stockRecord ? "Completed" : "Partial (Form 1 only)",
        pdfPath: null,
        // Stock data (if available)
        rolls: stockRecord ? safeNumber(stockRecord.burgerBuns) : 0,
        meatGrams: stockRecord ? safeNumber(stockRecord.meatWeightG) : 0,
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
          rolls: safeNumber(stockRecord.burgerBuns),
          meatGrams: safeNumber(stockRecord.meatWeightG),
          hasStockData: true
        });
      }
    }
    
    const data = unifiedData.sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );

    console.log(`[library] Returning ${data.length} unified records`);
    
    res.json({ ok: true, data });
  } catch (error) {
    console.error('[library] API error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get library data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;