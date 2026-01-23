import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        i.id,
        i.name,
        i.category,
        i.package_cost,
        i.package_qty,
        i.package_unit,
        i.portion_qty,
        i.portion_unit,
        CASE 
          WHEN i.package_qty > 0 THEN i.package_cost / i.package_qty
          ELSE 0
        END as unit_price
      FROM ingredients i
      ORDER BY i.name ASC
    `);

    const rows = result.rows || result;
    const legacy = (rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || null,
      unitPrice: parseFloat(r.unit_price) || 0,
      unit: r.package_unit || 'each',
      packageSize: String(r.package_qty ?? 1),
      packageCost: parseFloat(r.package_cost) || 0,
      portionQty: parseFloat(r.portion_qty) || null,
      portionUnit: r.portion_unit || null,
    }));

    res.json(legacy);
  } catch (e: any) {
    console.error('ingredients-legacy error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
