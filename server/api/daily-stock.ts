import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface DailyStockRequest {
  shiftId: string | null;
  rollsPcs: number;
  meatGrams: number;
  drinks: Record<string, number>;
  requisition: Record<string, number>;
}

// POST /api/daily-stock - Save daily stock form data
router.post('/', async (req, res) => {
  try {
    console.log('[daily-stock] Received payload:', JSON.stringify(req.body, null, 2));

    const { shiftId, rollsPcs, meatGrams, drinks, requisition }: DailyStockRequest = req.body;

    // Validate required fields
    if (typeof rollsPcs !== 'number' || typeof meatGrams !== 'number') {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: rollsPcs and meatGrams must be numbers'
      });
    }

    if (!drinks || typeof drinks !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: drinks must be an object'
      });
    }

    if (!requisition || typeof requisition !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: requisition must be an object'
      });
    }

    // Generate a saved ID for the response
    const savedId = shiftId || uuidv4();

    console.log('[daily-stock] Processing stock data:');
    console.log('- Rolls:', rollsPcs, 'pcs');
    console.log('- Meat:', meatGrams, 'grams');
    console.log('- Drinks:', Object.keys(drinks).length, 'items');
    console.log('- Requisition:', Object.keys(requisition).length, 'items');

    // Filter non-zero drinks and requisition items
    const nonZeroDrinks = Object.fromEntries(
      Object.entries(drinks).filter(([_, qty]) => qty > 0)
    );

    const nonZeroRequisition = Object.fromEntries(
      Object.entries(requisition).filter(([_, qty]) => qty > 0)
    );

    console.log('[daily-stock] Non-zero items:');
    console.log('- Drinks with stock:', Object.keys(nonZeroDrinks));
    console.log('- Requisition items:', Object.keys(nonZeroRequisition));

    // TODO: Save to database when required
    // For now, just log and return success

    res.json({
      ok: true,
      savedId,
      summary: {
        rollsPcs,
        meatGrams,
        drinksCount: Object.keys(nonZeroDrinks).length,
        requisitionCount: Object.keys(nonZeroRequisition).length,
        totalItems: Object.keys(nonZeroDrinks).length + Object.keys(nonZeroRequisition).length
      }
    });

  } catch (error) {
    console.error('[daily-stock] Save error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save daily stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;