import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';
import { syncIngredientFromPurchasing, syncAllIngredientsFromPurchasing } from '../services/ingredientSync.service';

const router = Router();

/**
 * GET /api/ingredients
 * Returns enriched rows with base_unit and unit_cost_per_base for recipe costing.
 * DISTINCT ON (name) to avoid duplicates - prefers records with cost data.
 * Supports ?search= query parameter for filtering by name
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : null;

    // DISTINCT ON (name) to avoid duplicates, prefer records with cost data
    const result = search
      ? await db.execute(sql`
          SELECT DISTINCT ON (i.name)
            i.id,
            i.name,
            i.category,
            i.base_unit,
            i.unit_cost_per_base,
            i.portion_unit
          FROM ingredients i
          WHERE LOWER(i.name) LIKE ${'%' + search + '%'}
          ORDER BY i.name ASC, i.unit_cost_per_base DESC NULLS LAST
          LIMIT ${limit};
        `)
      : await db.execute(sql`
          SELECT DISTINCT ON (i.name)
            i.id,
            i.name,
            i.category,
            i.base_unit,
            i.unit_cost_per_base,
            i.portion_unit
          FROM ingredients i
          ORDER BY i.name ASC, i.unit_cost_per_base DESC NULLS LAST
          LIMIT ${limit};
        `);

    const rows = result.rows || result;
    const enriched = rows.map(r => {
      const unitCostPerBase = Number(r.unit_cost_per_base) || 0;
      const baseUnit = r.base_unit || r.portion_unit || 'each';

      return {
        id: r.id,
        name: r.name,
        category: r.category || null,
        portionUnit: baseUnit,
        baseUnit: baseUnit,
        unitCostPerBase: unitCostPerBase,
      };
    });

    res.json(enriched);
  } catch (e: any) {
    console.error('ingredients.list error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/ingredients/canonical
 * LOCKED: Returns ALL ingredients from database
 * NO MOCKS - NO ENV FLAGS - READ-ONLY
 * Used by Recipe builder for ingredient selection and costing
 */
router.get('/canonical', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        i.id,
        i.name,
        i.category,
        i.package_unit AS "purchaseUnit",
        i.package_qty AS "purchaseQty",
        i.package_cost AS "purchaseCost",
        COALESCE(i.package_unit, 'each') AS "baseUnit",
        CASE 
          WHEN i.package_qty > 0 AND i.package_cost > 0 
          THEN i.package_cost / i.package_qty
          ELSE 0
        END AS "unitCostPerBase"
      FROM ingredients i
      ORDER BY i.name ASC
      LIMIT 1000;
    `);
    
    const rows = result.rows || result;
    res.json({ items: rows, count: rows.length });
  } catch (e: any) {
    console.error('ingredients.canonical error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/ingredients/sync/:purchasingItemId
 * Sync a single purchasing item to the canonical ingredients layer
 */
router.post('/sync/:purchasingItemId', async (req, res) => {
  try {
    const purchasingItemId = parseInt(req.params.purchasingItemId);
    if (isNaN(purchasingItemId)) {
      return res.status(400).json({ error: 'Invalid purchasing item ID' });
    }
    
    const result = await syncIngredientFromPurchasing(purchasingItemId);
    
    if (result.success) {
      res.json({ success: true, ingredientId: result.ingredientId });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (e: any) {
    console.error('ingredients.sync error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/ingredients/sync-all
 * Sync all purchasing items marked as ingredients
 */
router.post('/sync-all', async (req, res) => {
  try {
    const result = await syncAllIngredientsFromPurchasing();
    res.json({ 
      success: true, 
      synced: result.synced, 
      errors: result.errors 
    });
  } catch (e: any) {
    console.error('ingredients.sync-all error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
