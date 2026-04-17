/**
 * GET /api/analysis/drinks-variance?date=YYYY-MM-DD
 *
 * Drinks Stock Variance per SKU/item.
 *
 * Data sources (canonical, additive only):
 *   Item name / SKU / Category  → purchasing_items (category='Drinks', active=true)
 *   Starting Stock               → daily_stock_v2.drink_stock_json (prior date)
 *                                   fallback: daily_sales_v2.payload->drinkStock (prior date)
 *   Purchased                    → purchase_tally_drink + purchase_tally (by date)
 *   Items Sold                   → receipt_truth_line (pos_category_name ILIKE '%drink%', receipt_date)
 *   Modifier Sold                → receipt_truth_modifier_aggregate (drink modifiers from set meals)
 *   End Stock                    → daily_stock_v2.drink_stock_json (current date)
 *                                   fallback: daily_sales_v2.payload->drinkStock
 *   Adjustment                   → 0 (manual, set in UI)
 *   Variance                     → Starting + Purchased - Items Sold - Modifier Sold - End Stock + Adjustment
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Split a name into lowercase word tokens (min 3 chars).
 */
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((t) => t.length >= 3);
}

/**
 * Token overlap score between two names.
 * Returns count of matched token pairs (prefix match within first 5 chars).
 */
function tokenScore(a: string, b: string): number {
  const tA = tokens(a);
  const tB = tokens(b);
  let score = 0;
  for (const ta of tA) {
    for (const tb of tB) {
      const len = Math.min(5, ta.length, tb.length);
      if (ta.slice(0, len) === tb.slice(0, len)) {
        score++;
        break;
      }
    }
  }
  return score;
}

/**
 * Given a raw JSONB value from postgres (may be object or null),
 * return a Map of normalized_name → qty.
 */
function jsonbToQtyMap(raw: any): Map<string, { qty: number; rawName: string }> {
  const map = new Map<string, { qty: number; rawName: string }>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
  for (const [k, v] of Object.entries(raw)) {
    if (k && Number(v) >= 0) {
      map.set(normKey(k), { qty: Number(v) || 0, rawName: k });
    }
  }
  return map;
}

/**
 * Look up a canonical drink name in a qty map using:
 *  1. exact normalized match
 *  2. partial match (one name starts with or contains the other)
 */
function lookupQty(
  canonicalName: string,
  qtyMap: Map<string, { qty: number; rawName: string }>,
): number {
  const norm = normKey(canonicalName);
  const exact = qtyMap.get(norm);
  if (exact !== undefined) return exact.qty;
  for (const [mapKey, mapVal] of qtyMap.entries()) {
    if (mapKey.includes(norm) || norm.includes(mapKey)) return mapVal.qty;
  }
  return 0;
}

/**
 * Build a map of canonical_normKey → total modifier qty by scoring each
 * modifier row against all canonical drink names and assigning it to the
 * best match. Each modifier row is assigned to at most one canonical drink.
 */
function buildModifierSoldMap(
  modifierRows: { modifier_name: string; total_quantity: number }[],
  canonicalNames: Map<string, string>, // normKey → displayName
): Map<string, number> {
  const result = new Map<string, number>();

  for (const mRow of modifierRows) {
    const mName = mRow.modifier_name;
    const mNorm = normKey(mName);
    let bestNk = '';
    let bestScore = -1;

    for (const [nk, displayName] of canonicalNames.entries()) {
      const dNorm = normKey(displayName);
      // Score 1: exact normKey match
      if (dNorm === mNorm) {
        bestNk = nk;
        bestScore = 100;
        break;
      }
      // Score 2: partial contains
      if (dNorm.includes(mNorm) || mNorm.includes(dNorm)) {
        const s = 50;
        if (s > bestScore) { bestScore = s; bestNk = nk; }
        continue;
      }
      // Score 3: token overlap
      const s = tokenScore(displayName, mName);
      if (s > bestScore) { bestScore = s; bestNk = nk; }
    }

    if (bestNk && bestScore > 0) {
      result.set(bestNk, (result.get(bestNk) ?? 0) + Number(mRow.total_quantity));
    }
  }

  return result;
}

router.get('/drinks-variance', async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query param required (YYYY-MM-DD)' });
  }

  const prior = new Date(`${date}T00:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const prevDate = prior.toISOString().slice(0, 10);

  const [catalog, endStk, prevStk, sales2End, sales2Prev, purchases, sold, modifiers] = await Promise.all([
    // 1. Canonical drink list
    pool
      .query<{ name: string; sku: string | null }>(
        `SELECT item AS name, "supplierSku" AS sku
         FROM purchasing_items
         WHERE category = 'Drinks' AND active = true
         ORDER BY item ASC`,
      )
      .catch(() => ({ rows: [] } as any)),

    // 2. End stock — daily_stock_v2 for the date
    pool
      .query<{ drink_stock_json: any }>(
        `SELECT drink_stock_json FROM daily_stock_v2
         WHERE shift_date = $1 ORDER BY created_at DESC LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),

    // 3. Start stock — daily_stock_v2 for prior date
    pool
      .query<{ drink_stock_json: any }>(
        `SELECT drink_stock_json FROM daily_stock_v2
         WHERE shift_date = $1 ORDER BY created_at DESC LIMIT 1`,
        [prevDate],
      )
      .catch(() => ({ rows: [] } as any)),

    // 4. End stock fallback — daily_sales_v2.payload->drinkStock
    pool
      .query<{ drinkstock: any }>(
        `SELECT payload->'drinkStock' AS drinkstock FROM daily_sales_v2
         WHERE "shiftDate" = $1 AND "deletedAt" IS NULL
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),

    // 5. Start stock fallback — daily_sales_v2.payload->drinkStock for prior date
    pool
      .query<{ drinkstock: any }>(
        `SELECT payload->'drinkStock' AS drinkstock FROM daily_sales_v2
         WHERE "shiftDate" = $1 AND "deletedAt" IS NULL
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [prevDate],
      )
      .catch(() => ({ rows: [] } as any)),

    // 6. Purchases — purchase_tally_drink for the date
    pool
      .query<{ item_name: string; qty: number }>(
        `SELECT d.item_name, SUM(d.qty)::int AS qty
         FROM purchase_tally_drink d
         JOIN purchase_tally t ON t.id = d.tally_id
         WHERE t.date = $1::date
         GROUP BY d.item_name ORDER BY d.item_name`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),

    // 7. Items sold — receipt_truth_line (drinks category)
    pool
      .query<{ item_name: string; qty: number }>(
        `SELECT item_name, SUM(quantity)::int AS qty
         FROM receipt_truth_line
         WHERE receipt_date = $1::date
           AND receipt_type = 'SALE'
           AND (
             pos_category_name ILIKE '%drink%'
             OR pos_category_name ILIKE '%beverage%'
           )
         GROUP BY item_name ORDER BY item_name`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),

    // 8. Modifier sold — deduplicated from receipt_truth_modifier
    //    (receipt_truth_modifier_aggregate has ETL duplicates — raw dedup is accurate)
    pool
      .query<{ modifier_name: string; total_quantity: number }>(
        `SELECT modifier_name, SUM(quantity)::int AS total_quantity
         FROM (
           SELECT DISTINCT ON (rtm.receipt_id, rtm.line_sku, rtm.modifier_name)
             rtm.modifier_name, rtm.quantity
           FROM receipt_truth_modifier rtm
           WHERE rtm.receipt_id IN (
             SELECT DISTINCT receipt_id
             FROM receipt_truth_line
             WHERE receipt_date = $1::date AND receipt_type = 'SALE'
           )
           ORDER BY rtm.receipt_id, rtm.line_sku, rtm.modifier_name
         ) deduped
         GROUP BY modifier_name`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
  ]);

  const endStockRaw: any =
    endStk.rows[0]?.drink_stock_json ?? sales2End.rows[0]?.drinkstock ?? {};
  const prevStockRaw: any =
    prevStk.rows[0]?.drink_stock_json ?? sales2Prev.rows[0]?.drinkstock ?? {};

  const endStockMap = jsonbToQtyMap(endStockRaw);
  const prevStockMap = jsonbToQtyMap(prevStockRaw);

  const purchaseMap = new Map<string, number>();
  for (const r of purchases.rows) {
    purchaseMap.set(normKey(r.item_name), (purchaseMap.get(normKey(r.item_name)) ?? 0) + Number(r.qty));
  }

  const soldMap = new Map<string, number>();
  for (const r of sold.rows) {
    soldMap.set(normKey(r.item_name), (soldMap.get(normKey(r.item_name)) ?? 0) + Number(r.qty));
  }

  // Union all drink names from catalog + stock maps + purchases + sales
  const allNames = new Map<string, string>(); // normKey → displayName
  for (const r of catalog.rows) allNames.set(normKey(r.name), r.name);
  for (const [nk, v] of endStockMap) if (!allNames.has(nk)) allNames.set(nk, v.rawName);
  for (const [nk, v] of prevStockMap) if (!allNames.has(nk)) allNames.set(nk, v.rawName);
  for (const r of purchases.rows) {
    const nk = normKey(r.item_name);
    if (!allNames.has(nk)) allNames.set(nk, r.item_name);
  }
  for (const r of sold.rows) {
    const nk = normKey(r.item_name);
    if (!allNames.has(nk)) allNames.set(nk, r.item_name);
  }

  // Build modifier sold map (scored matching: modifier name → canonical drink)
  const modifierSoldMap = buildModifierSoldMap(modifiers.rows, allNames);

  const catalogMap = new Map<string, { sku: string | null }>();
  for (const r of catalog.rows) {
    catalogMap.set(normKey(r.name), { sku: r.sku || null });
  }

  const rows = [];
  for (const [nk, displayName] of allNames.entries()) {
    const startingStock = lookupQty(displayName, prevStockMap);
    const purchased = purchaseMap.get(nk) ?? 0;
    const itemsSold = soldMap.get(nk) ?? 0;
    const modifierSold = modifierSoldMap.get(nk) ?? 0;
    const endStock = lookupQty(displayName, endStockMap);
    const adjustment = 0;
    const variance = startingStock + purchased - itemsSold - modifierSold - endStock + adjustment;
    const catInfo = catalogMap.get(nk);

    rows.push({
      item_name: displayName,
      sku: catInfo?.sku ?? null,
      category: 'Drinks',
      starting_stock: startingStock,
      purchased,
      items_sold: itemsSold,
      modifier_sold: modifierSold,
      end_stock: endStock,
      adjustment,
      variance,
    });
  }

  rows.sort((a, b) => {
    const aInCatalog = catalogMap.has(normKey(a.item_name));
    const bInCatalog = catalogMap.has(normKey(b.item_name));
    if (aInCatalog && !bInCatalog) return -1;
    if (!aInCatalog && bInCatalog) return 1;
    return a.item_name.localeCompare(b.item_name);
  });

  return res.json({
    ok: true,
    date,
    prev_date: prevDate,
    row_count: rows.length,
    data: rows,
  });
});

export default router;
