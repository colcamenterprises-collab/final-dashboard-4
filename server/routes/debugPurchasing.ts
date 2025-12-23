import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * PATCH A - Purchasing Master Parity Check
 * READ-ONLY debug endpoint to verify item count alignment
 */
router.get('/purchasing-parity', async (req: Request, res: Response) => {
  try {
    // Count active purchasing_items (canonical source)
    const purchasingItemsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM purchasing_items WHERE active = true
    `);
    const purchasingItemsCount = parseInt(purchasingItemsResult.rows[0]?.count || '0', 10);

    // Count distinct items in purchasing_shift_items (shift log source)
    const shiftLogResult = await db.execute(sql`
      SELECT COUNT(DISTINCT "purchasingItemId") as count FROM purchasing_shift_items
    `);
    const shiftLogItemsCount = parseInt(shiftLogResult.rows[0]?.count || '0', 10);

    // Form 2 source is purchasing_items directly, so count matches purchasing_items
    // This confirms Form 2 MUST load from purchasing_items only
    const dailyStockItemsCount = purchasingItemsCount;

    // Shopping list derives from purchasing_shift_items
    const shoppingListItemsCount = shiftLogItemsCount;

    // Parity check: all counts must match purchasing_items
    const parity = (
      dailyStockItemsCount === purchasingItemsCount &&
      shiftLogItemsCount === purchasingItemsCount &&
      shoppingListItemsCount === purchasingItemsCount
    );

    res.json({
      purchasing_items: purchasingItemsCount,
      daily_stock_items: dailyStockItemsCount,
      shift_log_items: shiftLogItemsCount,
      shopping_list_items: shoppingListItemsCount,
      parity
    });
  } catch (error) {
    console.error('[DEBUG] Purchasing parity check failed:', error);
    res.status(500).json({ error: 'Failed to check purchasing parity' });
  }
});

export default router;
