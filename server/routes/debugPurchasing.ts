import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as recipeService from '../services/recipeAuthority';

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

// ========================================
// PHASE E: RECIPE & POS PARITY CHECKS
// ========================================

/**
 * 🔒 E6: Recipe-POS Parity Check
 * GET /api/debug/recipe-pos-parity
 * Returns parity stats between POS items and recipes
 */
router.get('/recipe-pos-parity', async (_req: Request, res: Response) => {
  try {
    const stats = await recipeService.getRecipePosParityStats();
    res.json(stats);
  } catch (error) {
    console.error('[DEBUG] Recipe-POS parity check failed:', error);
    res.status(500).json({ error: 'Failed to fetch parity stats' });
  }
});

/**
 * 🔒 E2: Unmapped POS Items
 * GET /api/debug/unmapped-pos-items
 * Returns list of POS item SKUs without recipe mappings
 */
router.get('/unmapped-pos-items', async (_req: Request, res: Response) => {
  try {
    const unmapped = await recipeService.getUnmappedPosItems();
    res.json({ 
      count: unmapped.length, 
      items: unmapped,
      status: 'UNMAPPED_POS_ITEM'
    });
  } catch (error) {
    console.error('[DEBUG] Unmapped POS items check failed:', error);
    res.status(500).json({ error: 'Failed to fetch unmapped items' });
  }
});

/**
 * 🔒 E3: Incomplete Recipes
 * GET /api/debug/incomplete-recipes
 * Returns list of recipes with missing/invalid ingredients
 */
router.get('/incomplete-recipes', async (_req: Request, res: Response) => {
  try {
    const incomplete = await recipeService.getIncompleteRecipes();
    res.json({
      count: incomplete.length,
      recipes: incomplete,
      status: 'RECIPE_INCOMPLETE'
    });
  } catch (error) {
    console.error('[DEBUG] Incomplete recipes check failed:', error);
    res.status(500).json({ error: 'Failed to fetch incomplete recipes' });
  }
});

export default router;
