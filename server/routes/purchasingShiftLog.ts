import { Router, Request, Response } from 'express';
import { syncPurchasingShiftItems, getPurchasingShiftMatrix, backfillPurchasingShiftItems } from '../services/purchasingShiftSync';

const router = Router();

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

export default router;
