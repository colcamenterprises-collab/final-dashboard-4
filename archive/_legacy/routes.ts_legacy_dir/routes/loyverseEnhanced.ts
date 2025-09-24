import { Router, Request, Response } from 'express';
import { LoyverseDataOrchestrator } from '../services/loyverseDataOrchestrator';
import { EnhancedLoyverseAPI } from '../services/enhancedLoyverseAPI';
import { AIAnalysisService } from '../services/aiAnalysisService';
import { LoyverseDataValidator } from '../services/loyverseDataValidator';

const router = Router();
const orchestrator = LoyverseDataOrchestrator.getInstance();
const validator = LoyverseDataValidator.getInstance();

// Enhanced API connection test
router.get('/enhanced/test-connection', async (req: Request, res: Response) => {
  try {
    const result = await orchestrator.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual sync with enhanced processing
router.post('/enhanced/manual-sync', async (req: Request, res: Response) => {
  try {
    const result = await orchestrator.performManualSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Manual sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Process specific shift data
router.post('/enhanced/process-shift', async (req: Request, res: Response) => {
  try {
    const { shiftDate } = req.body;
    
    if (!shiftDate) {
      return res.status(400).json({
        success: false,
        message: 'Shift date is required'
      });
    }

    const date = new Date(shiftDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift date format'
      });
    }

    const result = await orchestrator.processShiftData(date);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Shift processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get processing status
router.get('/enhanced/status', async (req: Request, res: Response) => {
  try {
    const status = orchestrator.getProcessingStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: `Failed to get processing status: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get processing history
router.get('/enhanced/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = await orchestrator.getProcessingHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({
      error: `Failed to get processing history: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Start automated scheduling
router.post('/enhanced/schedule/start', async (req: Request, res: Response) => {
  try {
    orchestrator.setupAutomatedScheduling();
    res.json({
      success: true,
      message: 'Automated scheduling started',
      scheduleInfo: 'Daily processing at 3:05 AM Bangkok time'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to start scheduling: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Stop automated scheduling
router.post('/enhanced/schedule/stop', async (req: Request, res: Response) => {
  try {
    orchestrator.stopAutomatedScheduling();
    res.json({
      success: true,
      message: 'Automated scheduling stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to stop scheduling: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get validation statistics
router.get('/enhanced/validation-stats', async (req: Request, res: Response) => {
  try {
    const stats = validator.getValidationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: `Failed to get validation stats: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Reset validation statistics
router.post('/enhanced/validation-stats/reset', async (req: Request, res: Response) => {
  try {
    validator.resetValidationStats();
    res.json({
      success: true,
      message: 'Validation statistics reset'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to reset validation stats: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get AI analysis for specific shift
router.get('/enhanced/analysis/:shiftDate', async (req: Request, res: Response) => {
  try {
    const { shiftDate } = req.params;
    const date = new Date(shiftDate);
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift date format'
      });
    }

    // Get AI insights from database
    const { db } = await import('../db');
    const { aiInsights } = await import('../../shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');

    const analysis = await db.select()
      .from(aiInsights)
      .where(and(
        eq(aiInsights.type, 'shift_analysis'),
        gte(aiInsights.relevantDate, date),
        lte(aiInsights.relevantDate, new Date(date.getTime() + 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (analysis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this shift date'
      });
    }

    res.json({
      success: true,
      analysis: analysis[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get ingredient usage analysis
router.get('/enhanced/ingredient-usage/:shiftDate', async (req: Request, res: Response) => {
  try {
    const { shiftDate } = req.params;
    const date = new Date(shiftDate);
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift date format'
      });
    }

    // Get shift receipts from database
    const { db } = await import('../db');
    const { loyverseReceipts } = await import('../../shared/schema');
    const { and, gte, lte } = await import('drizzle-orm');

    const receipts = await db.select()
      .from(loyverseReceipts)
      .where(and(
        gte(loyverseReceipts.shiftDate, date),
        lte(loyverseReceipts.shiftDate, new Date(date.getTime() + 24 * 60 * 60 * 1000))
      ));

    // Convert to validated format for AI analysis
    const validatedReceipts = receipts.map(r => ({
      id: r.receiptId,
      receipt_number: r.receiptNumber,
      receipt_date: r.receiptDate.toISOString(),
      receipt_type: 'SALE',
      total_money: parseFloat(r.totalAmount),
      total_tax: parseFloat(r.taxAmount || '0'),
      total_discount: parseFloat(r.discountAmount || '0'),
      line_items: r.items as any[],
      payments: [{ id: '1', payment_type_id: r.paymentMethod, amount: parseFloat(r.totalAmount) }],
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString()
    }));

    // Use AI service to calculate ingredient usage
    const aiService = AIAnalysisService.getInstance();
    const analysis = await aiService.analyzeShiftReceipts(validatedReceipts, date);

    res.json({
      success: true,
      ingredientUsage: analysis.ingredientUsage,
      itemAnalysis: analysis.itemAnalysis,
      totalCost: analysis.ingredientUsage.reduce((sum, ing) => sum + ing.totalCost, 0),
      shiftDate: shiftDate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get ingredient usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get anomaly detection results
router.get('/enhanced/anomalies/:shiftDate', async (req: Request, res: Response) => {
  try {
    const { shiftDate } = req.params;
    const date = new Date(shiftDate);
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift date format'
      });
    }

    // Get AI insights from database
    const { db } = await import('../db');
    const { aiInsights } = await import('../../shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');

    const analysis = await db.select()
      .from(aiInsights)
      .where(and(
        eq(aiInsights.type, 'shift_analysis'),
        gte(aiInsights.relevantDate, date),
        lte(aiInsights.relevantDate, new Date(date.getTime() + 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (analysis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this shift date'
      });
    }

    const analysisData = analysis[0].content as any;
    res.json({
      success: true,
      anomalies: analysisData.anomalies || [],
      recommendations: analysisData.recommendations || [],
      shiftDate: shiftDate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get anomalies: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get staff form comparison
router.get('/enhanced/staff-comparison/:shiftDate', async (req: Request, res: Response) => {
  try {
    const { shiftDate } = req.params;
    const date = new Date(shiftDate);
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift date format'
      });
    }

    // Get AI insights from database
    const { db } = await import('../db');
    const { aiInsights } = await import('../../shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');

    const analysis = await db.select()
      .from(aiInsights)
      .where(and(
        eq(aiInsights.type, 'shift_analysis'),
        gte(aiInsights.relevantDate, date),
        lte(aiInsights.relevantDate, new Date(date.getTime() + 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (analysis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this shift date'
      });
    }

    const analysisData = analysis[0].content as any;
    res.json({
      success: true,
      staffFormComparison: analysisData.staffFormComparison || null,
      comparisonWithPrevious: analysisData.comparisonWithPrevious || null,
      shiftDate: shiftDate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get staff comparison: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Health check endpoint
router.get('/enhanced/health', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.LOYVERSE_ACCESS_TOKEN || 'c1ba07b4dc304101b8dbff63107a3d87';
    const api = new EnhancedLoyverseAPI(accessToken);
    
    const health = await api.getHealthStatus();
    const validationStats = validator.getValidationStats();
    const processingStatus = orchestrator.getProcessingStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      apiHealth: health,
      validationStats,
      processingStatus,
      services: {
        loyverseAPI: health.isHealthy,
        validator: true,
        orchestrator: true,
        aiAnalysis: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

export default router;