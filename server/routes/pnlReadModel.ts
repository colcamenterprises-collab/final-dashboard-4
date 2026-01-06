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
 * Enterprise P&L endpoint with structured sections
 * Query param: year (YYYY)
 */
router.get('/year', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const data = await pnlService.getRange(from, to);
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    interface PLMonthData {
      posCash: number;
      posQr: number;
      posOther: number;
      grabGross: number;
      onlineOrdering: number;
      totalRevenue: number;
      foodCogs: number;
      packagingCogs: number;
      totalCogs: number;
      grossProfit: number;
      grabCommission: number;
      grabAds: number;
      shiftWages: number;
      overtime: number;
      bonuses: number;
      rent: number;
      utilities: number;
      maintenance: number;
      cleaning: number;
      otherBusiness: number;
      totalOpex: number;
      operatingIncome: number;
      bankFees: number;
      interest: number;
      adjustments: number;
      incomeTax: number;
      netIncome: number;
    }

    const createEmptyMonth = (): PLMonthData => ({
      posCash: 0,
      posQr: 0,
      posOther: 0,
      grabGross: 0,
      onlineOrdering: 0,
      totalRevenue: 0,
      foodCogs: 0,
      packagingCogs: 0,
      totalCogs: 0,
      grossProfit: 0,
      grabCommission: 0,
      grabAds: 0,
      shiftWages: 0,
      overtime: 0,
      bonuses: 0,
      rent: 0,
      utilities: 0,
      maintenance: 0,
      cleaning: 0,
      otherBusiness: 0,
      totalOpex: 0,
      operatingIncome: 0,
      bankFees: 0,
      interest: 0,
      adjustments: 0,
      incomeTax: 0,
      netIncome: 0,
    });

    const monthlyData: Record<string, PLMonthData> = {};
    months.forEach(month => {
      monthlyData[month] = createEmptyMonth();
    });

    data.forEach(day => {
      const monthIndex = new Date(day.date).getMonth();
      const monthName = months[monthIndex];
      if (!monthName) return;

      const m = monthlyData[monthName];
      
      m.posCash += day.netSales - day.grabGross;
      m.grabGross += day.grabGross;
      m.totalRevenue += day.netSales;
      
      m.shiftWages += day.shiftExpenses;
      m.otherBusiness += day.businessExpenses;
      m.totalOpex += day.totalExpenses;
      
      m.grossProfit = m.totalRevenue - m.totalCogs;
      m.operatingIncome = m.grossProfit - m.totalOpex;
      m.netIncome = m.operatingIncome - m.incomeTax;
    });

    const ytdTotals = createEmptyMonth();
    months.forEach(month => {
      const m = monthlyData[month];
      ytdTotals.posCash += m.posCash;
      ytdTotals.posQr += m.posQr;
      ytdTotals.posOther += m.posOther;
      ytdTotals.grabGross += m.grabGross;
      ytdTotals.onlineOrdering += m.onlineOrdering;
      ytdTotals.totalRevenue += m.totalRevenue;
      ytdTotals.foodCogs += m.foodCogs;
      ytdTotals.packagingCogs += m.packagingCogs;
      ytdTotals.totalCogs += m.totalCogs;
      ytdTotals.grabCommission += m.grabCommission;
      ytdTotals.grabAds += m.grabAds;
      ytdTotals.shiftWages += m.shiftWages;
      ytdTotals.overtime += m.overtime;
      ytdTotals.bonuses += m.bonuses;
      ytdTotals.rent += m.rent;
      ytdTotals.utilities += m.utilities;
      ytdTotals.maintenance += m.maintenance;
      ytdTotals.cleaning += m.cleaning;
      ytdTotals.otherBusiness += m.otherBusiness;
      ytdTotals.totalOpex += m.totalOpex;
      ytdTotals.bankFees += m.bankFees;
      ytdTotals.interest += m.interest;
      ytdTotals.adjustments += m.adjustments;
      ytdTotals.incomeTax += m.incomeTax;
    });
    
    ytdTotals.grossProfit = ytdTotals.totalRevenue - ytdTotals.totalCogs;
    ytdTotals.operatingIncome = ytdTotals.grossProfit - ytdTotals.totalOpex;
    ytdTotals.netIncome = ytdTotals.operatingIncome - ytdTotals.incomeTax;

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
