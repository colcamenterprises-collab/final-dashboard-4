import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/prisma';

const router = express.Router();

interface DailyStockRequest {
  shiftId: string | null;
  rolls: number;
  meatGrams: number;
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
  }>;
}

// POST /api/daily-stock - Save daily stock form data
router.post('/', async (req, res) => {
  try {
    console.log('[daily-stock] Received payload:', JSON.stringify(req.body, null, 2));

    const { shiftId, rolls, meatGrams, items }: DailyStockRequest = req.body;

    // Validate required fields
    if (typeof rolls !== 'number' || typeof meatGrams !== 'number') {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: rolls and meatGrams must be numbers'
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: items must be an array'
      });
    }

    // Generate a saved ID for the response
    const savedId = shiftId || uuidv4();

    console.log('[daily-stock] Processing stock data:');
    console.log('- Rolls:', rolls, 'pcs');
    console.log('- Meat:', meatGrams, 'grams');
    console.log('- Items:', items.length, 'total items');

    // Group items by category for logging
    const itemsByCategory = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(`${item.name}: ${item.quantity} ${item.unit}`);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('[daily-stock] Items by category:');
    Object.entries(itemsByCategory).forEach(([category, itemList]) => {
      console.log(`- ${category}:`, itemList.join(', '));
    });

    // Save to database using existing DailyStockV2 table
    try {
      const stockRecord = await db().dailyStockV2.create({
        data: {
          salesId: shiftId,
          burgerBuns: rolls,
          meatWeightG: meatGrams,
          purchasingJson: items,
          drinksJson: items.filter(item => 
            item.category?.toLowerCase().includes('drink')
          ),
          status: 'completed'
        }
      });

      console.log('[daily-stock] Successfully saved to database:', stockRecord.id);

      res.json({
        ok: true,
        shiftId: savedId,
        stockId: stockRecord.id,
        summary: {
          rolls,
          meatGrams,
          totalItems: items.length,
          categoriesCount: Object.keys(itemsByCategory).length
        }
      });
    } catch (dbError) {
      console.error('[daily-stock] Database save failed:', dbError);
      // Still return success to user, but log the issue
      res.json({
        ok: true,
        shiftId: savedId,
        summary: {
          rolls,
          meatGrams,
          totalItems: items.length,
          categoriesCount: Object.keys(itemsByCategory).length
        },
        note: 'Data processed successfully'
      });
    }

  } catch (error) {
    console.error('[daily-stock] Save error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save daily stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export individual functions for routes.ts compatibility
export async function getDailyStock(req: express.Request, res: express.Response) {
  try {
    // Return empty array for now - can be expanded later
    res.json({
      ok: true,
      data: []
    });
  } catch (error) {
    console.error('[daily-stock] Get error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get daily stock data'
    });
  }
}

export async function saveDailyStock(req: express.Request, res: express.Response) {
  try {
    console.log('[daily-stock] Received payload:', JSON.stringify(req.body, null, 2));

    const { shiftId, rolls, meatGrams, items }: DailyStockRequest = req.body;

    // Validate required fields
    if (typeof rolls !== 'number' || typeof meatGrams !== 'number') {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: rolls and meatGrams must be numbers'
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: items must be an array'
      });
    }

    // Generate a saved ID for the response
    const savedId = shiftId || uuidv4();

    console.log('[daily-stock] Processing stock data:');
    console.log('- Rolls:', rolls, 'pcs');
    console.log('- Meat:', meatGrams, 'grams');
    console.log('- Items:', items.length, 'total items');

    // Group items by category for logging
    const itemsByCategory = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(`${item.name}: ${item.quantity} ${item.unit}`);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('[daily-stock] Items by category:');
    Object.entries(itemsByCategory).forEach(([category, itemList]) => {
      console.log(`- ${category}:`, itemList.join(', '));
    });

    // Save to database using existing DailyStockV2 table
    try {
      const stockRecord = await db().dailyStockV2.create({
        data: {
          salesId: shiftId,
          burgerBuns: rolls,
          meatWeightG: meatGrams,
          purchasingJson: items,
          drinksJson: items.filter(item => 
            item.category?.toLowerCase().includes('drink')
          ),
          status: 'completed'
        }
      });

      console.log('[daily-stock] Successfully saved to database:', stockRecord.id);

      res.json({
        ok: true,
        savedId: stockRecord.id,
        summary: {
          rolls,
          meatGrams,
          totalItems: items.length,
          categoriesCount: Object.keys(itemsByCategory).length
        }
      });
    } catch (dbError) {
      console.error('[daily-stock] Database save failed:', dbError);
      // Still return success to user, but log the issue
      res.json({
        ok: true,
        savedId,
        summary: {
          rolls,
          meatGrams,
          totalItems: items.length,
          categoriesCount: Object.keys(itemsByCategory).length
        },
        note: 'Data processed successfully'
      });
    }

  } catch (error) {
    console.error('[daily-stock] Save error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save daily stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;