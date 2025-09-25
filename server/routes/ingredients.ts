import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';

const router = Router();

/**
 * GET /api/ingredients
 * Returns enriched rows with supplierName, unitPrice, costPerPortion, etc.
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 2000), 5000);

    // Pull raw fields. Adjust table/column names to your Drizzle schema if needed.
    const result = await db.execute(sql`
      SELECT
        i.id,
        i.name,
        i.category,
        i.supplier_id,
        s.name AS supplier_name,
        i.brand,
        i.package_cost,
        i.package_qty,
        i.package_unit,
        i.portion_qty,
        i.portion_unit
      FROM ingredients i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      ORDER BY i.name ASC
      LIMIT ${limit};
    `);

    const rows = result.rows || result;
    const enriched = rows.map(r => {
      const packageBase = toBase(r.package_qty, r.package_unit);
      const unitPrice = r.package_cost && packageBase > 0 ? r.package_cost / packageBase : null;

      // For UI only (display). Shopping estimator will compute per request.
      const portionBase = toBase(r.portion_qty, r.portion_unit);
      const costPerPortion = unitPrice && portionBase ? unitPrice * portionBase : null;

      return {
        id: r.id,
        name: r.name,
        category: r.category,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name || null,
        brand: r.brand || null,
        packageCost: r.package_cost ?? null,
        packageQty: r.package_qty ?? null,
        packageUnit: r.package_unit ?? 'each',
        portionQty: r.portion_qty ?? null,
        portionUnit: r.portion_unit ?? null,
        unitPrice,
        costPerPortion
      };
    });

    res.json({ items: enriched, count: enriched.length });
  } catch (e: any) {
    console.error('ingredients.list error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;