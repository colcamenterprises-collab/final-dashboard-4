import express from 'express';
import { db } from '../db';
import { posReceipt } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// GET /api/pos/receipts?batchId=xxx - Get receipts for a specific batch
router.get('/receipts', async (req, res) => {
  try {
    const batchId = String(req.query.batchId || "");
    
    if (!batchId) {
      return res.status(400).json({ 
        ok: false, 
        error: "batchId query parameter is required" 
      });
    }

    console.log(`[POS Receipts] Fetching receipts for batch ${batchId}`);

    const receipts = await db
      .select({
        id: posReceipt.id,
        receiptId: posReceipt.receiptId,
        datetime: posReceipt.datetime,
        total: posReceipt.total,
        payment: posReceipt.payment,
        itemsJson: posReceipt.itemsJson,
      })
      .from(posReceipt)
      .where(eq(posReceipt.batchId, batchId))
      .orderBy(posReceipt.datetime);

    console.log(`[POS Receipts] Found ${receipts.length} receipts`);

    res.json({ 
      ok: true, 
      data: receipts,
      count: receipts.length
    });

  } catch (error) {
    console.error('[POS Receipts] Failed to fetch receipts:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch receipts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;