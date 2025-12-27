/**
 * PHASE I — INGREDIENT RECONCILIATION SERVICE
 * READ-ONLY, DERIVED DATA
 * 
 * Compares ingredient usage (from POS → recipes) with purchases (from purchasing_shift_items).
 * NO judgement, NO thresholds, NO alerts, NO blocking.
 * Missing data = 0, not error.
 */

import { pool } from '../db';

export interface IngredientReconciliation {
  ingredientId: number;
  ingredient: string;
  unit: string;
  usedQuantity: number;
  purchasedQuantity: number;
  delta: number;
  source: 'DERIVED';
}

export interface ReconciliationResult {
  ok: boolean;
  dateRange: { start: string; end: string };
  items: IngredientReconciliation[];
  lastUpdated: string;
  warning?: string;
}

/**
 * Get ingredient reconciliation for a date range.
 * Compares derived usage from ingredient_usage table with purchases from purchasing_shift_items.
 */
export async function getIngredientReconciliation(
  startDate: string,
  endDate: string
): Promise<ReconciliationResult> {
  try {
    // Step 1: Get aggregated ingredient usage from ingredient_usage table
    const usageResult = await pool.query(`
      SELECT 
        iu.purchasing_item_id as ingredient_id,
        p.item as ingredient,
        iu.unit,
        SUM(CAST(iu.quantity_used AS NUMERIC)) as total_used
      FROM ingredient_usage iu
      JOIN purchasing_items p ON iu.purchasing_item_id = p.id
      WHERE iu.shift_date >= $1::date AND iu.shift_date <= $2::date
      GROUP BY iu.purchasing_item_id, p.item, iu.unit
      ORDER BY p.item
    `, [startDate, endDate]);

    // Step 2: Get aggregated purchases from purchasing_shift_items
    const purchaseResult = await pool.query(`
      SELECT 
        psi.purchasing_item_id as ingredient_id,
        p.item as ingredient,
        p."unitDescription" as unit,
        SUM(CAST(psi.quantity AS NUMERIC)) as total_purchased
      FROM purchasing_shift_items psi
      JOIN purchasing_items p ON psi.purchasing_item_id = p.id
      WHERE psi.shift_date >= $1::date AND psi.shift_date <= $2::date
        AND p.is_ingredient = true
      GROUP BY psi.purchasing_item_id, p.item, p."unitDescription"
      ORDER BY p.item
    `, [startDate, endDate]);

    // Step 3: Merge usage and purchase data
    const usageMap = new Map<number, { ingredient: string; unit: string; used: number }>();
    for (const row of usageResult.rows) {
      usageMap.set(Number(row.ingredient_id), {
        ingredient: row.ingredient,
        unit: row.unit || 'unit',
        used: parseFloat(row.total_used) || 0,
      });
    }

    const purchaseMap = new Map<number, { ingredient: string; unit: string; purchased: number }>();
    for (const row of purchaseResult.rows) {
      purchaseMap.set(Number(row.ingredient_id), {
        ingredient: row.ingredient,
        unit: row.unit || 'unit',
        purchased: parseFloat(row.total_purchased) || 0,
      });
    }

    // Step 4: Build reconciliation items (union of all ingredients from both sources)
    const allIngredientIds = new Set([...usageMap.keys(), ...purchaseMap.keys()]);
    const items: IngredientReconciliation[] = [];

    for (const id of allIngredientIds) {
      const usage = usageMap.get(id);
      const purchase = purchaseMap.get(id);

      const ingredient = usage?.ingredient || purchase?.ingredient || 'Unknown';
      const unit = usage?.unit || purchase?.unit || 'unit';
      const usedQuantity = usage?.used || 0;
      const purchasedQuantity = purchase?.purchased || 0;
      const delta = purchasedQuantity - usedQuantity;

      items.push({
        ingredientId: id,
        ingredient,
        unit,
        usedQuantity: Number(usedQuantity.toFixed(2)),
        purchasedQuantity: Number(purchasedQuantity.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        source: 'DERIVED',
      });
    }

    // Sort by ingredient name
    items.sort((a, b) => a.ingredient.localeCompare(b.ingredient));

    return {
      ok: true,
      dateRange: { start: startDate, end: endDate },
      items,
      lastUpdated: new Date().toISOString(),
    };

  } catch (err: any) {
    console.error('[INGREDIENT_RECONCILIATION_SAFE_FAIL]', err?.message);
    // Safe fallback - return empty result, not error
    return {
      ok: true,
      dateRange: { start: startDate, end: endDate },
      items: [],
      lastUpdated: new Date().toISOString(),
      warning: 'SAFE_FALLBACK_USED',
    };
  }
}

/**
 * Get all ingredients with their current usage and purchase totals (all-time).
 * Useful for ingredient filter dropdown.
 */
export async function getIngredientList(): Promise<{ id: number; name: string; unit: string }[]> {
  try {
    const result = await pool.query(`
      SELECT id, item as name, "unitDescription" as unit
      FROM purchasing_items
      WHERE is_ingredient = true AND active = true
      ORDER BY item
    `);
    return result.rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      unit: r.unit || 'unit',
    }));
  } catch {
    return [];
  }
}
