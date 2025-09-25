import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';

type Breakdown = {
  name: string;
  supplierId: number | null;
  requested: string;
  unitPrice: number;
  estimated: number;
  priceSource: 'package' | 'last_purchase' | 'category_avg' | 'missing';
};

async function getLastPurchaseUnitPrice(ingredientName: string): Promise<number | null> {
  // Optional fallback: derive unit price from last purchase if you track purchases
  const rows: any[] = await db.execute(sql`
    SELECT p.total_cost, p.package_qty, p.package_unit
    FROM purchases p
    WHERE p.ingredient_name = ${ingredientName}
    ORDER BY p.purchased_at DESC
    LIMIT 1;
  `);
  const r = rows[0];
  if (!r) return null;
  const base = toBase(r.package_qty, r.package_unit);
  if (!r.total_cost || !base) return null;
  return Number(r.total_cost) / base;
}

async function getCategoryAvgUnitPrice(category: string | null): Promise<number | null> {
  if (!category) return null;
  const rows: any[] = await db.execute(sql`
    SELECT AVG(i.package_cost / NULLIF( (CASE
      WHEN LOWER(i.package_unit) IN ('kg','l','l','each','pc','g','ml') THEN 1
      ELSE 1
    END) * 1.0 *
      CASE
        WHEN LOWER(i.package_unit) = 'kg' THEN 1
        WHEN LOWER(i.package_unit) = 'g' THEN 0.001
        WHEN LOWER(i.package_unit) IN ('l','L') THEN 1
        WHEN LOWER(i.package_unit) = 'ml' THEN 0.001
        ELSE 1
      END
    ,0)) AS avg_unit_price
    FROM ingredients i
    WHERE i.category = ${category}
      AND i.package_cost IS NOT NULL
      AND i.package_cost > 0
      AND i.package_qty IS NOT NULL
      AND i.package_qty > 0;
  `);
  const v = rows?.[0]?.avg_unit_price;
  return v != null ? Number(v) : null;
}

/**
 * Estimate a shopping list by listId.
 * Expects shopping_list_items with: ingredient_id, requested_qty, requested_unit
 */
export async function estimateShoppingList(listId: string | number) {
  const result = await db.execute(sql`
    SELECT
      sli.id,
      sli.ingredient_name,
      sli.requested_qty,
      COALESCE(sli.requested_unit, 'each') AS requested_unit,
      i.name,
      i.category,
      i.supplier_id,
      i.package_cost,
      i.package_qty,
      i.package_unit
    FROM shopping_list_items sli
    LEFT JOIN ingredients i ON i.name = sli.ingredient_name
    WHERE sli.shopping_list_id = ${listId}
    ORDER BY COALESCE(i.name, sli.ingredient_name) ASC;
  `);

  const items = result.rows || result;
  let total = 0;
  const breakdown: Breakdown[] = [];
  const missingPricing: string[] = [];

  for (const row of items) {
    const packageBase = toBase(row.package_qty, row.package_unit);
    const unitPriceFromPkg = row.package_cost && packageBase > 0
      ? Number(row.package_cost) / packageBase
      : null;

    const unitPriceFromLast = unitPriceFromPkg ? null : await getLastPurchaseUnitPrice(row.name);
    const unitPriceFromCat = unitPriceFromPkg || unitPriceFromLast ? null : await getCategoryAvgUnitPrice(row.category);

    const unitPrice =
      unitPriceFromPkg ??
      unitPriceFromLast ??
      unitPriceFromCat ??
      0;

    const priceSource: Breakdown['priceSource'] =
      unitPriceFromPkg ? 'package' :
      unitPriceFromLast ? 'last_purchase' :
      unitPriceFromCat ? 'category_avg' : 'missing';

    if (!unitPrice) missingPricing.push(row.name || row.ingredient_name);

    const reqBase = toBase(row.requested_qty, row.requested_unit);

    // If requesting by full packs, buy whole packages; else use unit pricing
    const estimated = row.requested_unit.toLowerCase() === 'pack' && row.package_cost && packageBase > 0
      ? Math.ceil(reqBase / packageBase) * Number(row.package_cost)
      : reqBase * unitPrice;

    total += estimated;
    breakdown.push({
      name: row.name,
      supplierId: row.supplier_id ?? null,
      requested: `${row.requested_qty} ${row.requested_unit}`,
      unitPrice,
      estimated,
      priceSource
    });
  }

  return { total, breakdown, missingPricing };
}