/**
 * 🔒 CANONICAL PURCHASING FLOW (SHIFT LOG API)
 * purchasing_items → Form 2 → purchasing_shift_items → Shift Log
 *
 * Provides shift-by-shift visibility into purchasing quantities
 */
import { Router, Request, Response } from 'express';
import { syncPurchasingShiftItems, getPurchasingShiftMatrix, backfillPurchasingShiftItems } from '../services/purchasingShiftSync';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/purchasing-shift-matrix', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const matrix = await getPurchasingShiftMatrix(
      from as string | undefined,
      to as string | undefined
    );
    res.json(matrix);
  } catch (err: any) {
    console.error('[purchasing-shift-matrix] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchasing-shift-sync/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    const { purchasingJson } = req.body;
    
    if (!stockId) {
      return res.status(400).json({ error: 'Stock ID is required' });
    }

    const result = await syncPurchasingShiftItems(stockId, purchasingJson);
    res.json(result);
  } catch (err: any) {
    console.error('[purchasing-shift-sync] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchasing-shift-backfill', async (req: Request, res: Response) => {
  try {
    const result = await backfillPurchasingShiftItems();
    res.json(result);
  } catch (err: any) {
    console.error('[purchasing-shift-backfill] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/purchasing-shift-log
 * Returns all items with quantities across shifts for the Shift Log page
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all shifts in date range
    const shifts = await prisma.dailyStockV2.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        createdAt: true,
        salesId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get shift dates from related sales records
    const salesIds = shifts.map(s => s.salesId).filter(Boolean) as string[];
    const salesRecords = await prisma.dailySalesV2.findMany({
      where: {
        id: { in: salesIds },
      },
      select: {
        id: true,
        shiftDate: true,
      },
    });
    
    const salesDateMap = new Map(salesRecords.map(s => [s.id, s.shiftDate]));
    
    const shiftData = shifts.map(s => ({
      id: s.id,
      date: (s.salesId && salesDateMap.get(s.salesId)) || s.createdAt.toISOString().split('T')[0],
    }));

    // Get all active purchasing items
    const items = await prisma.purchasingItem.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { item: 'asc' }],
    });

    // Get all shift item quantities
    const shiftItemsRaw = await prisma.purchasingShiftItem.findMany({
      where: {
        dailyStockId: { in: shifts.map(s => s.id) },
      },
    });

    // Build quantity map: itemId -> { shiftId -> quantity }
    const qtyMap = new Map<number, Map<string, number>>();
    for (const si of shiftItemsRaw) {
      if (!qtyMap.has(si.purchasingItemId)) {
        qtyMap.set(si.purchasingItemId, new Map());
      }
      qtyMap.get(si.purchasingItemId)!.set(si.dailyStockId, si.quantity);
    }

    // Build response with all items and their quantities per shift
    const responseItems = items.map(item => {
      const quantities: Record<string, number> = {};
      let totalQty = 0;
      
      for (const shift of shifts) {
        const qty = qtyMap.get(item.id)?.get(shift.id) || 0;
        quantities[shift.id] = qty;
        totalQty += qty;
      }
      
      const avgQty = shifts.length > 0 ? totalQty / shifts.length : 0;
      
      return {
        itemId: item.id,
        itemName: item.item,
        category: item.category,
        quantities,
        totalQty,
        avgQty,
      };
    });

    res.json({
      items: responseItems,
      shifts: shiftData,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Error fetching shift log:', error);
    res.status(500).json({ error: 'Failed to fetch shift log' });
  }
});

export default router;
