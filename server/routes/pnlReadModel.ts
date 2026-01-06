/**
 * 🔐 PATCH 1.6.18: P&L READ MODEL API ROUTES
 * Read-only access to P&L data from pnl_read_model table.
 * Rebuild endpoint for deterministic recalculation.
 */

import { Router, Request, Response } from 'express';
import * as pnlService from '../services/pnlReadModelService';

const router = Router();

/**
 * GET /api/pnl/years
 * Get distinct years that have P&L data in the read model.
 */
router.get('/years', async (req: Request, res: Response) => {
  try {
    const years = await pnlService.getDistinctYears();
    res.json({ ok: true, years });
  } catch (error: any) {
    console.error('[PnlReadModel] Error fetching years:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to fetch years' });
  }
});

/**
 * GET /api/pnl
 * Read P&L data for a date range.
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing required query params: from, to (YYYY-MM-DD format)' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid date format. Use YYYY-MM-DD.' 
      });
    }

    const data = await pnlService.getRange(from, to);
    
    // Aggregate for summary
    const summary = {
      totalGrossSales: data.reduce((sum, d) => sum + d.grossSales, 0),
      totalNetSales: data.reduce((sum, d) => sum + d.netSales, 0),
      totalDiscounts: data.reduce((sum, d) => sum + d.discounts, 0),
      totalRefunds: data.reduce((sum, d) => sum + d.refunds, 0),
      totalShiftExpenses: data.reduce((sum, d) => sum + d.shiftExpenses, 0),
      totalBusinessExpenses: data.reduce((sum, d) => sum + d.businessExpenses, 0),
      totalExpenses: data.reduce((sum, d) => sum + d.totalExpenses, 0),
      totalGrossProfit: data.reduce((sum, d) => sum + d.grossProfit, 0),
      daysWithData: data.filter(d => d.dataStatus !== 'MISSING').length,
      daysPartial: data.filter(d => d.dataStatus === 'PARTIAL').length,
      daysMissing: data.filter(d => d.dataStatus === 'MISSING').length,
    };

    res.json({ 
      ok: true, 
      from,
      to,
      days: data,
      summary,
    });
  } catch (error: any) {
    console.error('[PnlReadModel] Error fetching P&L data:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to fetch P&L data' });
  }
});

/**
 * GET /api/pnl/year
 * Legacy-compatible endpoint for year-based P&L data (matches frontend expectations)
 * Query param: year (YYYY)
 */
router.get('/year', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const data = await pnlService.getRange(from, to);
    
    // Aggregate by month for legacy format
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData: Record<string, { sales: number; cogs: number; grossProfit: number; expenses: number; netProfit: number }> = {};
    
    months.forEach(month => {
      monthlyData[month] = { sales: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
    });

    data.forEach(day => {
      const monthIndex = new Date(day.date).getMonth();
      const monthName = months[monthIndex];
      if (monthName) {
        monthlyData[monthName].sales += day.netSales;
        monthlyData[monthName].expenses += day.totalExpenses;
        monthlyData[monthName].grossProfit += day.grossProfit;
        monthlyData[monthName].netProfit += day.grossProfit; // Same as grossProfit without COGS
      }
    });

    const ytdTotals = {
      sales: data.reduce((sum, d) => sum + d.netSales, 0),
      cogs: 0,
      grossProfit: data.reduce((sum, d) => sum + d.grossProfit, 0),
      expenses: data.reduce((sum, d) => sum + d.totalExpenses, 0),
      netProfit: data.reduce((sum, d) => sum + d.grossProfit, 0),
    };

    res.json({
      success: true,
      year,
      monthlyData,
      ytdTotals,
      dataSource: {
        salesRecords: data.filter(d => d.dataStatus !== 'MISSING').length,
        loyverseRecords: data.filter(d => d.dataStatus === 'OK').length,
        expenseRecords: data.length,
      },
    });
  } catch (error: any) {
    console.error('[PnlReadModel] Error fetching year P&L data:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch P&L data' });
  }
});

/**
 * POST /api/pnl/rebuild
 * Rebuild P&L data for a single date.
 * Query param: date (YYYY-MM-DD)
 */
router.post('/rebuild', async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string;

    if (!dateStr) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing required query param: date (YYYY-MM-DD format)' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid date format. Use YYYY-MM-DD.' 
      });
    }

    const result = await pnlService.rebuildDate(dateStr);
    
    res.json({ 
      ok: true, 
      rebuilt: result,
    });
  } catch (error: any) {
    console.error('[PnlReadModel] Error rebuilding P&L data:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to rebuild P&L data' });
  }
});

/**
 * POST /api/pnl/rebuild-range
 * Rebuild P&L data for a date range.
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.post('/rebuild-range', async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing required query params: from, to (YYYY-MM-DD format)' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid date format. Use YYYY-MM-DD.' 
      });
    }

    const result = await pnlService.rebuildRange(from, to);
    
    res.json({ 
      ok: true, 
      ...result,
    });
  } catch (error: any) {
    console.error('[PnlReadModel] Error rebuilding P&L range:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to rebuild P&L range' });
  }
});

export default router;
