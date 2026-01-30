import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/purchasing/drinks
 * 
 * CANONICAL SOURCE: purchasing_items WHERE category = 'Drinks'
 * 
 * Returns active drinks from the Purchasing List.
 * This is the ONLY source of truth for drink types.
 * Ingredients may reference drink costs, but never define drink existence.
 */
router.get('/drinks', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        id,
        item as name,
        "orderUnit" as unit,
        "unitCost" as cost
      FROM purchasing_items
      WHERE category = 'Drinks'
        AND active = true
      ORDER BY item ASC
    `);

    res.json({
      items: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        cost: parseFloat(row.cost) || 0
      }))
    });
  } catch (error) {
    console.error('[purchasing/drinks] Error fetching drinks:', error);
    res.status(500).json({ error: 'Failed to fetch drinks from purchasing list' });
  }
});

export default router;
