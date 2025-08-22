import express from 'express';
import { db } from '../../lib/prisma';

const router = express.Router();

// GET /api/library/daily-sales - Library endpoint with proper ISO dates and numeric fields
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

    // Combine and format data from both tables
    const salesData = salesRows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: r.completedBy ?? "",
      startingCash: Number(r.startingCash ?? 0),
      closingCash: Number(r.endingCash ?? 0),
      totalSales: Number(r.totalSales ?? 0),
      totalExpenses: Number(r.totalExpenses ?? 0),
      bankCash: Number(r.cashBanked ?? 0),
      bankQr: Number(r.qrSales ?? 0),
      status: "Completed",
      pdfPath: null,
      type: "sales"
    }));
    
    const stockData = stockRows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: "Stock Form",
      startingCash: 0,
      closingCash: 0,
      totalSales: 0,
      totalExpenses: 0,
      bankCash: 0,
      bankQr: 0,
      status: "Completed",
      pdfPath: null,
      type: "stock",
      rolls: r.burgerBuns ?? 0,
      meatGrams: r.meatWeightG ?? 0,
      shiftId: r.salesId
    }));
    
    const data = [...salesData, ...stockData].sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Library API error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get library data' });
  }
});

export async function getDailySalesLibrary(req: express.Request, res: express.Response) {
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

    // Combine and format data from both tables
    const salesData = salesRows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: r.completedBy ?? "",
      startingCash: Number(r.startingCash ?? 0),
      closingCash: Number(r.endingCash ?? 0),
      totalSales: Number(r.totalSales ?? 0),
      totalExpenses: Number(r.totalExpenses ?? 0),
      bankCash: Number(r.cashBanked ?? 0),
      bankQr: Number(r.qrSales ?? 0),
      status: "Completed",
      pdfPath: null,
      type: "sales"
    }));
    
    const stockData = stockRows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: "Stock Form",
      startingCash: 0,
      closingCash: 0,
      totalSales: 0,
      totalExpenses: 0,
      bankCash: 0,
      bankQr: 0,
      status: "Completed",
      pdfPath: null,
      type: "stock",
      rolls: r.burgerBuns ?? 0,
      meatGrams: r.meatWeightG ?? 0,
      shiftId: r.salesId
    }));
    
    const data = [...salesData, ...stockData].sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Library API error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get library data' });
  }
}

export default router;