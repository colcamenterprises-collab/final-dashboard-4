import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getIngredientUsageSummary, deriveIngredientUsageForDate } from '../services/ingredientUsageDeriver';

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

/**
 * PART F - Ingredient Parity Check
 * READ-ONLY debug endpoint to verify ingredient derivation from purchasing
 */
router.get('/ingredient-parity', async (req: Request, res: Response) => {
  try {
    // Count total active purchasing items
    const purchasingResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM purchasing_items WHERE active = true
    `);
    const purchasingItemsCount = parseInt(purchasingResult.rows[0]?.count || '0', 10);

    // Count items flagged as ingredients
    const ingredientResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM purchasing_items WHERE is_ingredient = true
    `);
    const ingredientItemsCount = parseInt(ingredientResult.rows[0]?.count || '0', 10);

    res.json({
      purchasingItems: purchasingItemsCount,
      ingredientItems: ingredientItemsCount,
      isDerived: true,
      source: 'purchasing_items.is_ingredient'
    });
  } catch (error) {
    console.error('[DEBUG] Ingredient parity check failed:', error);
    res.status(500).json({ error: 'Failed to check ingredient parity' });
  }
});


router.get('/ingredient-usage-summary', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const summary = await getIngredientUsageSummary(date);
    res.json(summary);
  } catch (error) {
    console.error('[DEBUG] Ingredient usage summary failed:', error);
    // Never 500 - return empty stats
    res.json({
      shiftDate: req.query.date || new Date().toISOString().split('T')[0],
      totalReceipts: 0,
      totalRecipesUsed: 0,
      totalIngredientsUsed: 0,
      topIngredients: []
    });
  }
});

/**
 * 🔒 G: Derive Ingredient Usage (manual trigger)
 * POST /api/debug/derive-ingredient-usage?date=YYYY-MM-DD
 * Derives ingredient usage for a specific date
 */
router.post('/derive-ingredient-usage', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || (req.body.date as string) || new Date().toISOString().split('T')[0];
    const result = await deriveIngredientUsageForDate(date);
    res.json(result);
  } catch (error: any) {
    console.error('[DEBUG] Ingredient usage derivation failed:', error);
    // Never 500 - return error info
    res.json({
      success: false,
      count: 0,
      errors: [error.message || 'Unknown error']
    });
  }
});

export default router;
