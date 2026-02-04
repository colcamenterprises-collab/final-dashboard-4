/**
 * INGREDIENT RECONCILIATION SERVICE (READ-ONLY, DERIVED)
 *
 * Source truth:
 * - receipt_truth_ingredient (POS → receipt truth)
 * - daily_sales_v2 payload (staff daily form)
 * - recipe_ingredients (ingredient catalog + units)
 *
 * Deterministic, rebuildable, idempotent.
 */

import { pool } from '../db';

export interface IngredientReconciliationDetail {
  ingredientName: string;
  unit: string | null;
  usedQuantity: number;
  purchasedQuantity: number;
  varianceQuantity: number;
  variancePct: number | null;
  status: 'OK' | 'INSUFFICIENT_DATA' | 'UNIT_MISMATCH';
}

export interface IngredientReconciliationResult {
  ok: boolean;
  date: string;
  reconciled: boolean;
  variancePct: number | null;
  details: IngredientReconciliationDetail[];
}

interface ReconciliationError {
  ok: false;
  error: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toUnit(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const unit = String(value).trim();
  return unit.length > 0 ? unit : null;
}

export async function getIngredientReconciliationForDate(
  date: string
): Promise<IngredientReconciliationResult | ReconciliationError> {
  if (!DATE_RE.test(date)) {
    return { ok: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
  }

  const recipeIngredientResult = await pool.query(
    `SELECT ri.ingredient_id, i.name, ri.unit
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id`
  );

  if (recipeIngredientResult.rows.length === 0) {
    return { ok: false, error: 'Missing recipe ingredient configuration.' };
  }

  const recipeNameMap = new Map<string, { unit: string | null }>();
  for (const row of recipeIngredientResult.rows) {
    const name = String(row.name).trim();
    if (!name) continue;
    const unit = toUnit(row.unit);
    if (!recipeNameMap.has(name)) {
      recipeNameMap.set(name, { unit });
    }
  }

  const receiptCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM receipt_truth_ingredient
     WHERE receipt_date = $1::date`,
    [date]
  );

  if ((receiptCountResult.rows[0]?.count ?? 0) === 0) {
    return { ok: false, error: 'No Loyverse receipts for date – check sync' };
  }

  const dailySalesResult = await pool.query(
    `SELECT payload
     FROM daily_sales_v2
     WHERE shift_date = $1::date AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [date]
  );

  if (dailySalesResult.rows.length === 0) {
    return { ok: false, error: 'Missing staff daily form entry' };
  }

  const usageResult = await pool.query(
    `SELECT ingredient_name, unit, SUM(CAST(quantity_used AS NUMERIC)) AS total_used
     FROM receipt_truth_ingredient
     WHERE receipt_date = $1::date
     GROUP BY ingredient_name, unit
     ORDER BY ingredient_name`,
    [date]
  );

  const usageByName = new Map<string, { used: number; unit: string | null }>();
  for (const row of usageResult.rows) {
    const name = String(row.ingredient_name).trim();
    if (!name) continue;
    const unit = toUnit(row.unit) ?? recipeNameMap.get(name)?.unit ?? null;
    usageByName.set(name, {
      used: toNumber(row.total_used),
      unit,
    });
  }

  const payload = dailySalesResult.rows[0]?.payload ?? {};
  const requisition = Array.isArray(payload?.requisition) ? payload.requisition : [];
  const purchasingJson = payload?.purchasingJson ?? {};

  const purchaseByName = new Map<string, { purchased: number; unit: string | null }>();
  for (const item of requisition) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const qty = toNumber(item?.qty);
    const unit = toUnit(item?.unit) ?? recipeNameMap.get(name)?.unit ?? null;
    purchaseByName.set(name, { purchased: qty, unit });
  }

  if (purchaseByName.size === 0 && purchasingJson && typeof purchasingJson === 'object') {
    for (const [nameRaw, qtyRaw] of Object.entries(purchasingJson)) {
      const name = String(nameRaw).trim();
      if (!name) continue;
      const qty = toNumber(qtyRaw);
      const unit = recipeNameMap.get(name)?.unit ?? null;
      purchaseByName.set(name, { purchased: qty, unit });
    }
  }

  const allNames = new Set<string>([...usageByName.keys(), ...purchaseByName.keys()]);
  const details: IngredientReconciliationDetail[] = [];

  for (const name of allNames) {
    const usage = usageByName.get(name);
    const purchase = purchaseByName.get(name);
    const usedQty = usage?.used ?? 0;
    const purchasedQty = purchase?.purchased ?? 0;
    const unit = usage?.unit ?? purchase?.unit ?? recipeNameMap.get(name)?.unit ?? null;
    let status: IngredientReconciliationDetail['status'] = 'OK';
    let variancePct: number | null = null;

    if (!purchase || purchasedQty === 0) {
      status = 'INSUFFICIENT_DATA';
    } else if (usage?.unit && purchase?.unit && usage.unit !== purchase.unit) {
      status = 'UNIT_MISMATCH';
    }

    const varianceQuantity = usedQty - purchasedQty;
    if (status === 'OK' && purchasedQty !== 0) {
      variancePct = (varianceQuantity / purchasedQty) * 100;
    }

    details.push({
      ingredientName: name,
      unit,
      usedQuantity: Number(usedQty.toFixed(4)),
      purchasedQuantity: Number(purchasedQty.toFixed(4)),
      varianceQuantity: Number(varianceQuantity.toFixed(4)),
      variancePct: variancePct !== null ? Number(variancePct.toFixed(2)) : null,
      status,
    });
  }

  details.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

  const okRows = details.filter((row) => row.variancePct !== null);
  const totalUsed = okRows.reduce((sum, row) => sum + row.usedQuantity, 0);
  const totalPurchased = okRows.reduce((sum, row) => sum + row.purchasedQuantity, 0);
  const variancePct = totalPurchased > 0 ? ((totalUsed - totalPurchased) / totalPurchased) * 100 : null;
  const reconciled =
    details.length > 0 &&
    details.every((row) => row.variancePct !== null && Math.abs(row.variancePct) <= 10);

  return {
    ok: true,
    date,
    reconciled,
    variancePct: variancePct !== null ? Number(variancePct.toFixed(2)) : null,
    details,
  };
}

export async function getIngredientList(): Promise<{ id: number; name: string; unit: string | null }[]> {
  const result = await pool.query(`
    SELECT i.id, i.name, ri.unit
    FROM ingredients i
    JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
    GROUP BY i.id, i.name, ri.unit
    ORDER BY i.name
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    unit: row.unit ?? null,
  }));
}
