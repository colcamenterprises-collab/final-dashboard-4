/**
 * PHASE I — INGREDIENT RECONCILIATION API
 * READ-ONLY ENDPOINTS
 */

import { Router } from 'express';
import { getIngredientReconciliation, getIngredientList } from '../services/ingredientReconciliationService';

const router = Router();

/**
 * GET /api/analysis/ingredient-reconciliation
 * Returns reconciliation data for a date range
 */
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const startDate = (req.query.start as string) || thirtyDaysAgo;
    const endDate = (req.query.end as string) || today;
    
    const result = await getIngredientReconciliation(startDate, endDate);
    return res.json(result);
  } catch (err: any) {
    console.error('[RECONCILIATION_SAFE_FAIL]', err?.message);
    return res.status(200).json({
      ok: true,
      dateRange: { start: '', end: '' },
      items: [],
      lastUpdated: new Date().toISOString(),
      warning: 'SAFE_FALLBACK_USED',
    });
  }
});

/**
 * GET /api/analysis/ingredient-reconciliation/ingredients
 * Returns list of ingredients for filter dropdown
 */
router.get('/ingredients', async (_req, res) => {
  try {
    const ingredients = await getIngredientList();
    return res.json({ ok: true, ingredients });
  } catch (err: any) {
    console.error('[RECONCILIATION_INGREDIENTS_SAFE_FAIL]', err?.message);
    return res.json({ ok: true, ingredients: [], warning: 'SAFE_FALLBACK_USED' });
  }
});

export default router;
