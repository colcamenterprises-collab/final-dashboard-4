import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';
import { syncIngredientFromPurchasing, syncAllIngredientsFromPurchasing } from '../services/ingredientSync.service';

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

/**
 * GET /api/ingredients/canonical
 * Returns ingredients with canonical fields (baseUnit, unitCostPerBase)
 * Used by RecipeEditModal for PATCH R1 cost calculation
 */
router.get('/canonical', async (req, res) => {
  try {
    const mockRecipeData = process.env.MOCK_RECIPE_DATA === "true";
    if (process.env.NODE_ENV === "development" && mockRecipeData) {
      return res.json({
        items: [
          {
            id: 1,
            name: "Beef Patty",
            baseUnit: "g",
            unitCostPerBase: 0.42,
            purchaseQty: 5,
            purchaseUnit: "kg",
            purchaseCost: 2100,
            sourcePurchasingItemId: null,
          },
          {
            id: 2,
            name: "Cheddar Slice",
            baseUnit: "g",
            unitCostPerBase: 0.55,
            purchaseQty: 1,
            purchaseUnit: "kg",
            purchaseCost: 550,
            sourcePurchasingItemId: null,
          },
          {
            id: 3,
            name: "Burger Bun",
            baseUnit: "each",
            unitCostPerBase: 7.5,
            purchaseQty: 24,
            purchaseUnit: "each",
            purchaseCost: 180,
            sourcePurchasingItemId: null,
          },
          {
            id: 4,
            name: "Mayo",
            baseUnit: "ml",
            unitCostPerBase: 0.12,
            purchaseQty: 1,
            purchaseUnit: "l",
            purchaseCost: 120,
            sourcePurchasingItemId: null,
          },
          {
            id: 5,
            name: "Tomato",
            baseUnit: "g",
            unitCostPerBase: 0.08,
            purchaseQty: 2,
            purchaseUnit: "kg",
            purchaseCost: 160,
            sourcePurchasingItemId: null,
          },
        ],
        count: 5,
      });
    }

    const result = await db.execute(sql`
      SELECT
        id,
        name,
        category,
        base_unit AS "baseUnit",
        unit_cost_per_base AS "unitCostPerBase",
        purchase_qty AS "purchaseQty",
        purchase_unit AS "purchaseUnit",
        purchase_cost AS "purchaseCost",
        source_purchasing_item_id AS "sourcePurchasingItemId"
      FROM ingredients
      WHERE base_unit IS NOT NULL AND unit_cost_per_base IS NOT NULL
      ORDER BY name ASC
      LIMIT 500;
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
