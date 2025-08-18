import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/daily-stock?shift=:uuid - Load any saved values for a shift
export async function getDailyStock(req: Request, res: Response) {
  try {
    const { shift: shiftId } = req.query;

    if (!shiftId || typeof shiftId !== 'string') {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    // Find existing daily stock record
    const stock = await prisma.dailyStock.findUnique({
      where: { salesId: shiftId }
    });

    // Find existing stock requests
    const requests = await prisma.stockRequest.findMany({
      where: { shiftId },
      include: { StockItem: true }
    });

    // Transform requests to expected format
    const requestsFormatted = requests.map(req => ({
      stockItemId: req.stockItemId,
      requestedQty: req.requestedQty
    }));

    res.json({
      ok: true,
      stock: stock ? {
        shiftId: shiftId,
        bunsCount: stock.bunsCount || stock.burgerBuns || 0,
        meatGrams: stock.meatGrams || stock.meatWeightG || 0
      } : {
        shiftId: shiftId,
        bunsCount: 0,
        meatGrams: 0
      },
      requests: requestsFormatted
    });
  } catch (error) {
    console.error('Error fetching daily stock:', error);
    res.status(500).json({ error: 'Failed to fetch daily stock' });
  }
}

// POST /api/daily-stock - Save daily stock for a shift
export async function saveDailyStock(req: Request, res: Response) {
  try {
    const { shiftId, bunsCount, meatGrams, requests } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    // Upsert DailyStock by shiftId (salesId)
    await prisma.dailyStock.upsert({
      where: { salesId: shiftId },
      update: {
        bunsCount: Number(bunsCount) || 0,
        meatGrams: Number(meatGrams) || 0,
        burgerBuns: Number(bunsCount) || 0, // Keep legacy field synced
        meatWeightG: Number(meatGrams) || 0, // Keep legacy field synced
        updatedAt: new Date()
      },
      create: {
        salesId: shiftId,
        bunsCount: Number(bunsCount) || 0,
        meatGrams: Number(meatGrams) || 0,
        burgerBuns: Number(bunsCount) || 0, // Keep legacy field synced
        meatWeightG: Number(meatGrams) || 0 // Keep legacy field synced
      }
    });

    // Handle stock requests - upsert each one
    if (requests && Array.isArray(requests)) {
      for (const request of requests) {
        const { stockItemId, requestedQty } = request;
        
        if (stockItemId && requestedQty !== undefined) {
          await prisma.stockRequest.upsert({
            where: {
              shiftId_stockItemId: {
                shiftId,
                stockItemId: Number(stockItemId)
              }
            },
            update: {
              requestedQty: Number(requestedQty) || null
            },
            create: {
              shiftId,
              stockItemId: Number(stockItemId),
              requestedQty: Number(requestedQty) || null
            }
          });
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving daily stock:', error);
    res.status(500).json({ error: 'Failed to save daily stock' });
  }
}