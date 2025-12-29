import { Router, Request, Response } from 'express';
import { rebuildReceiptBatch, getReceiptBatchSummary } from '../services/receiptBatchSummary';

const router = Router();

router.post('/receipts/rebuild', async (req: Request, res: Response) => {
  try {
    const { business_date } = req.body;
    
    if (!business_date || !/^\d{4}-\d{2}-\d{2}$/.test(business_date)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'business_date required in YYYY-MM-DD format' 
      });
    }

    console.log(`[API] Rebuilding receipt batch for ${business_date}`);
    const result = await rebuildReceiptBatch(business_date);
    
    res.json({ 
      ok: true, 
      message: `Receipt truth confirmed for ${business_date}`,
      ...result 
    });
  } catch (error: any) {
    console.error('[API] Receipt batch rebuild failed:', error.message);
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

router.get('/receipts/summary', async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || '').trim();
    
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'date query param required in YYYY-MM-DD format' 
      });
    }

    const result = await getReceiptBatchSummary(date);
    
    if (!result) {
      return res.status(404).json({ 
        ok: false, 
        error: `NO RECEIPT BATCH for ${date}. Truth missing.`,
        hasBatch: false 
      });
    }

    res.json({ 
      ok: true, 
      hasBatch: true,
      ...result 
    });
  } catch (error: any) {
    console.error('[API] Receipt batch summary failed:', error.message);
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

export default router;
