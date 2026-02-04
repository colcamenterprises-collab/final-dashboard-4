/**
 * INGREDIENT RECONCILIATION API (READ-ONLY)
 */

import { Router } from 'express';
import {
  getIngredientList,
  getIngredientReconciliationForDate,
} from '../services/ingredientReconciliationService';
import { rebuildReceiptTruth } from '../services/receiptTruthSummary';
import { rebuildIngredientTruth } from '../services/receiptTruthIngredientService';

const router = Router();

router.get('/', async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query parameter required (YYYY-MM-DD)' });
  }

  try {
    const result = await getIngredientReconciliationForDate(date);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    console.error('[INGREDIENT_RECONCILIATION_FAIL]', error?.message);
    return res.status(500).json({ ok: false, error: 'Ingredient reconciliation failed.' });
  }
});

router.post('/rebuild', async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query parameter required (YYYY-MM-DD)' });
  }

  try {
    await rebuildReceiptTruth(date);
    await rebuildIngredientTruth(date);
    const result = await getIngredientReconciliationForDate(date);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    console.error('[INGREDIENT_RECONCILIATION_REBUILD_FAIL]', error?.message);
    return res.status(500).json({ ok: false, error: error?.message || 'Rebuild failed' });
  }
});

router.get('/export.csv', async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query parameter required (YYYY-MM-DD)' });
  }

  try {
    const result = await getIngredientReconciliationForDate(date);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }

    const header = ['Ingredient', 'Unit', 'UsedQuantity', 'PurchasedQuantity', 'VarianceQuantity', 'VariancePct', 'Status'];
    const rows = result.details.map((row) => [
      row.ingredientName,
      row.unit ?? '',
      row.usedQuantity.toFixed(4),
      row.purchasedQuantity.toFixed(4),
      row.varianceQuantity.toFixed(4),
      row.variancePct === null ? '' : row.variancePct.toFixed(2),
      row.status,
    ]);
    const csv = [header, ...rows].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ingredient-reconciliation-${date}.csv"`);
    return res.send(csv);
  } catch (error: any) {
    console.error('[INGREDIENT_RECONCILIATION_EXPORT_FAIL]', error?.message);
    return res.status(500).json({ ok: false, error: 'Failed to export CSV' });
  }
});

router.get('/ingredients', async (_req, res) => {
  try {
    const items = await getIngredientList();
    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error('[INGREDIENT_RECONCILIATION_LIST_FAIL]', error?.message);
    return res.status(500).json({ ok: false, error: 'Failed to load ingredient list.' });
  }
});

export default router;
