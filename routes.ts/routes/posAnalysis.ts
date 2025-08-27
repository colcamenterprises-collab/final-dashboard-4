import express from 'express';
import { analyzeShift } from '../services/shiftAnalysisService';

const router = express.Router();

// GET /api/pos/analysis/shift?batchId=xxx - Get shift reconciliation analysis
router.get('/analysis/shift', async (req, res) => {
  try {
    const batchId = String(req.query.batchId || "");
    
    if (!batchId) {
      return res.status(400).json({ 
        ok: false, 
        error: "batchId query parameter is required" 
      });
    }

    console.log(`[POS Analysis] Starting shift analysis for batch ${batchId}`);

    const report = await analyzeShift(batchId);
    
    console.log(`[POS Analysis] Analysis complete - ${report.flags.length} flags found`);

    res.json({ 
      ok: true, 
      report,
      summary: {
        hasFlags: report.flags.length > 0,
        flagCount: report.flags.length,
        totalVariance: Math.abs(report.variances.totalSalesDiff) + 
                      Math.abs(report.variances.bankCashVsCashSales) + 
                      Math.abs(report.variances.bankQrVsQrSales)
      }
    });

  } catch (error) {
    console.error('[POS Analysis] Analysis failed:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to analyze shift',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;