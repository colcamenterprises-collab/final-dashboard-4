import express from 'express';
import { db } from '../../lib/prisma';

const router = express.Router();

// GET /api/library/daily-sales - Library endpoint with proper ISO dates and numeric fields
router.get('/', async (req, res) => {
  try {
    const rows = await db().dailySales.findMany({
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
        qrTransfer: true,
        status: true
      }
    });

    const data = rows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: r.completedBy ?? "",
      startingCash: Number(r.startingCash ?? 0),
      closingCash: Number(r.endingCash ?? 0),
      totalSales: Number(r.totalSales ?? 0),
      totalExpenses: Number(r.totalExpenses ?? 0),
      bankCash: Number(r.cashBanked ?? 0),
      bankQr: Number(r.qrTransfer ?? 0),
      status: r.status ?? "Completed"
    }));

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Library API error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get library data' });
  }
});

export async function getDailySalesLibrary(req: express.Request, res: express.Response) {
  try {
    const rows = await db().dailySales.findMany({
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
        qrTransfer: true,
        status: true
      }
    });

    const data = rows.map(r => ({
      id: r.id,
      dateISO: r.createdAt.toISOString(),
      staff: r.completedBy ?? "",
      startingCash: Number(r.startingCash ?? 0),
      closingCash: Number(r.endingCash ?? 0),
      totalSales: Number(r.totalSales ?? 0),
      totalExpenses: Number(r.totalExpenses ?? 0),
      bankCash: Number(r.cashBanked ?? 0),
      bankQr: Number(r.qrTransfer ?? 0),
      status: r.status ?? "Completed"
    }));

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Library API error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get library data' });
  }
}

export default router;