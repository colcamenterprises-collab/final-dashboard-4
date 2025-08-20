import express from 'express';
import { db } from '../db';
import { shoppingMaster } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

const router = express.Router();

// GET /api/stock-catalog - Get active stock items grouped by category
router.get('/', async (req, res) => {
  try {
    console.log('[stock-catalog] Loading stock items from database...');
    
    const items = await db
      .select()
      .from(shoppingMaster)
      .where(eq(shoppingMaster.isActive, true))
      .orderBy(asc(shoppingMaster.internalCategory), asc(shoppingMaster.item));

    console.log(`[stock-catalog] Found ${items.length} active items`);

    const formattedItems = items.map(item => ({
      id: item.item.toLowerCase().replace(/\s+/g, '-'),
      name: item.item,
      category: item.internalCategory,
      type: item.internalCategory === 'Drinks' ? 'drink' : 'item',
      supplier: item.supplier,
      brand: item.brand,
      costMinor: item.costMinor,
      packagingQty: item.packagingQty,
      unitMeasure: item.unitMeasure,
      portionSize: item.portionSize,
      minStockAmount: item.minStockAmount
    }));

    res.json({
      ok: true,
      items: formattedItems
    });

  } catch (error) {
    console.error('[stock-catalog] Database error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to load stock catalog',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;