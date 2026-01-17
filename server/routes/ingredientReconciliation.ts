/**
 * PHASE I — INGREDIENT RECONCILIATION API
 * READ-ONLY ENDPOINTS
 */

import { Router } from 'express';

const router = Router();

/**
 * GET /api/analysis/ingredient-reconciliation
 * Returns reconciliation data for a date range
 */
router.get('/', async (_req, res) => {
  console.warn('[INGREDIENT_RECONCILIATION_DISABLED] Schema mismatch - module disabled');
  return res.status(503).json({
    ok: false,
    error: 'INGREDIENT_RECONCILIATION_DISABLED',
    message: 'Ingredient Reconciliation is disabled due to schema mismatch. Re-enable after schema alignment.',
  });
});

/**
 * GET /api/analysis/ingredient-reconciliation/ingredients
 * Returns list of ingredients for filter dropdown
 */
router.get('/ingredients', async (_req, res) => {
  console.warn('[INGREDIENT_RECONCILIATION_DISABLED] Ingredients list blocked');
  return res.status(503).json({
    ok: false,
    error: 'INGREDIENT_RECONCILIATION_DISABLED',
    message: 'Ingredient Reconciliation is disabled; ingredients list unavailable.',
  });
});

export default router;
