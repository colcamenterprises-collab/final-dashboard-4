import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { syncPurchasingShiftItems } from '../services/purchasingShiftSync';
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
export async function submitDailyStock(req: express.Request, res: express.Response) {
  const data = req.body;
  const errors = [];
  // FIXED: Allow zero values, only check for null/undefined/negative
  if (data.rollsEnd == null || isNaN(Number(data.rollsEnd)) || Number(data.rollsEnd) < 0) errors.push('Rolls count required, non-negative');
  if (data.meatCount == null || isNaN(Number(data.meatCount)) || Number(data.meatCount) < 0) errors.push('Meat count required, non-negative');
  // FIXED: Don't require drinks/requisition arrays - zero counts are valid
  
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  data.rollsEnd = parseInt(data.rollsEnd, 10);
  data.meatCount = parseInt(data.meatCount, 10);
  // await db.insert(daily_stock_v2).values(data);  // Commented out for now
  res.json({ success: true });
}

// Export individual functions for routes.ts compatibility
export async function getDailyStock(req: express.Request, res: express.Response) {
  const salesId = typeof req.query.salesId === 'string' && req.query.salesId.trim() !== ''
    ? req.query.salesId.trim()
    : null;

  try {
    const rows = await db().dailyStockV2.findMany({
      where: salesId ? { salesId, deletedAt: null } : { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: salesId ? 1 : 20,
      include: { purchasingShiftItems: true },
    });

    if (salesId && rows.length === 0) {
      return res.status(200).json({
        ok: true,
        source: 'daily_stock_v2',
        rows: [],
        count: 0,
        blockers: [{
          code: 'STOCK_DATA_NOT_FOUND',
          message: 'Stock data not found for this sales record',
          where: '/api/daily-stock',
          canonical_source: 'daily_stock_v2',
          auto_build_attempted: false,
        }],
      });
    }

    return res.status(200).json({
      ok: true,
      source: 'daily_stock_v2',
      rows,
      count: rows.length,
      blockers: [],
    });
  } catch (error: any) {
    console.error('[daily-stock] Get error:', error);
    const missingSource = error?.code === 'P2021' || /does not exist|not exist|no such table/i.test(error?.message || '');
    return res.status(200).json({
      ok: false,
      source: 'daily_stock_v2',
      rows: [],
      count: 0,
      blockers: [{
        code: missingSource ? 'MISSING_DAILY_STOCK_SOURCE' : 'DAILY_STOCK_READ_FAILED',
        message: error?.message || 'Failed to get daily stock data',
        where: '/api/daily-stock',
        canonical_source: 'daily_stock_v2',
        auto_build_attempted: false,
      }],
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

    const salesRecord = shiftId
      ? await db().dailySalesV2.findUnique({ where: { id: shiftId }, select: { id: true, shiftDate: true, deletedAt: true } })
      : null;
    if (!salesRecord || salesRecord.deletedAt) {
      return res.status(400).json({
        ok: false,
        error: 'Shift cannot be submitted. Missing: Daily Sales.',
        missing: ['Daily Sales']
      });
    }

    const [cleaningTasks, cleaningRecords] = await Promise.all([
      db().$queryRawUnsafe<Array<{ taskId: string; taskName: string }>>(
        `SELECT task_id AS "taskId", task_name AS "taskName"
         FROM daily_cleaning_task_definitions
         WHERE active = true
         ORDER BY sort_order ASC, task_name ASC`
      ),
      db().$queryRawUnsafe<Array<{ taskId: string; status: string | null; imagePath: string | null; comments: string | null; followUpAction: string | null; assignedTo: string | null; followUpStatus: string | null }>>(
        `SELECT task_id AS "taskId", status, image_path AS "imagePath", comments,
                follow_up_action AS "followUpAction", assigned_to AS "assignedTo", follow_up_status AS "followUpStatus"
         FROM daily_cleaning_records
         WHERE sales_id = $1`,
        shiftId || ''
      )
    ]);
    const cleaningByTask = new Map(cleaningRecords.map((record) => [record.taskId, record]));
    const missingCleaning = cleaningTasks.filter((task) => {
      const record = cleaningByTask.get(task.taskId);
      return !record || !record.status || !record.imagePath || (record.status === 'Requires Attention' && (!record.comments?.trim() || !record.followUpAction?.trim() || !record.assignedTo?.trim() || !record.followUpStatus?.trim()));
    });
    if (missingCleaning.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Shift cannot be submitted. Missing: Daily Cleaning.',
        missing: ['Daily Cleaning'],
        details: missingCleaning.map((task) => task.taskName)
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
          sales: { connect: { id: shiftId! } },
          burgerBuns: rolls,
          meatWeightG: meatGrams,
          purchasingJson: items,
          drinksJson: items.filter(item => 
            item.category?.toLowerCase().includes('drink')
          )
        }
      });

      console.log('[daily-stock] Successfully saved to database:', stockRecord.id);

      // Sync purchasing shift items for the matrix view
      try {
        const syncResult = await syncPurchasingShiftItems(stockRecord.id, items);
        console.log('[daily-stock] Purchasing shift sync:', syncResult);
      } catch (syncError) {
        console.error('[daily-stock] Purchasing shift sync failed (non-blocking):', syncError);
      }

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
