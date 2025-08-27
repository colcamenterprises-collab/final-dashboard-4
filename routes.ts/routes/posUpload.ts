import express from 'express';
import { processPosUpload, UploadBody } from '../services/posUploadService';

const router = express.Router();

// POST /api/pos/upload-bundle - Process POS CSV bundle upload
router.post('/upload-bundle', async (req, res) => {
  try {
    console.log('[POS Upload Route] Received upload request');
    
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const body: UploadBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    
    // Validate that at least one CSV is provided
    if (!body.receiptsCsv && !body.shiftReportCsv && !body.salesByItemCsv && !body.salesByModifierCsv && !body.salesByPaymentCsv) {
      return res.status(400).json({ 
        ok: false, 
        error: "At least one CSV file must be provided" 
      });
    }

    const batchId = await processPosUpload(body);
    
    console.log(`[POS Upload Route] Successfully processed batch ${batchId}`);
    
    res.json({ 
      ok: true, 
      batchId,
      message: `POS data uploaded successfully to batch ${batchId}`
    });

  } catch (error) {
    console.error('[POS Upload Route] Upload failed:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to process POS upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;