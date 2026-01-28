import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';
import { syncIngredientFromPurchasing, syncAllIngredientsFromPurchasing } from '../services/ingredientSync.service';

const router = Router();

/**
 * Normalize ingredient cost to THB per base unit (gram/ml/each)
 * Parses packaging_qty text like "10kg bag", "1kg pack", "Per kg", "500g" etc.
 */
function computeUnitCostPerBase(ingredient: {
  price: number | null;
  packaging_qty: string | null;
  unit: string | null;
}): number | null {
  if (!ingredient.price) return null;
  
  const packQty = ingredient.packaging_qty?.toLowerCase() || '';
  const unit = ingredient.unit?.toLowerCase() || '';
  
  // Parse packaging quantity to get numeric value and unit type
  let divisor = 1;
  
  // Handle "10kg bag", "1kg pack", "per 1kg", "Per kg" patterns
  const kgMatch = packQty.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) {
    divisor = parseFloat(kgMatch[1]) * 1000; // convert kg to grams
  } else if (packQty.includes('per kg') || packQty === 'per 1kg') {
    divisor = 1000; // 1kg = 1000g
  }
  // Handle "500g", "3kg" patterns  
  else {
    const gMatch = packQty.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i);
    if (gMatch) {
      divisor = parseFloat(gMatch[1]); // already in grams
    }
    // Handle litre patterns
    const litreMatch = packQty.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|l)s?/i);
    if (litreMatch) {
      divisor = parseFloat(litreMatch[1]) * 1000; // convert to ml
    }
    // Handle plain numbers like "1", "6"
    const plainNum = packQty.match(/^(\d+)$/);
    if (plainNum) {
      divisor = parseFloat(plainNum[1]); // count of items
    }
  }
  
  // For "each" units with no kg/g packaging, divisor stays 1
  if (unit === 'each' && divisor === 1 && !packQty.includes('kg') && !packQty.includes('g')) {
    // Try to extract number from packaging_qty for count-based items
    const countMatch = packQty.match(/(\d+)/);
    if (countMatch) {
      divisor = parseFloat(countMatch[1]);
    }
  }
  
  if (divisor <= 0) return null;
  
  return ingredient.price / divisor;
}

/**
 * Parse portion unit to get base unit (g, ml, each)
 */
function parsePortionUnit(unit: string | null): { baseUnit: string; portionGrams: number } {
  if (!unit) return { baseUnit: 'each', portionGrams: 1 };
  
  const lower = unit.toLowerCase().trim();
  
  // Parse "95 gr", "20 gr", "25 gr" → grams
  const grMatch = lower.match(/(\d+)\s*(?:gr|g|gram)/i);
  if (grMatch) {
    return { baseUnit: 'g', portionGrams: parseFloat(grMatch[1]) };
  }
  
  // Parse "5 grams", "1 gram"
  const gramsMatch = lower.match(/(\d+)\s*grams?/i);
  if (gramsMatch) {
    return { baseUnit: 'g', portionGrams: parseFloat(gramsMatch[1]) };
  }
  
  return { baseUnit: 'each', portionGrams: 1 };
}

/**
 * GET /api/ingredients
 * Returns normalized cost per base unit (THB per gram/ml/each)
 * DISTINCT ON (name) to avoid duplicates - prefers records with price data.
 * Supports ?search= query parameter for filtering by name
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : null;

    // Pull raw pricing data for normalization
    const result = search
      ? await db.execute(sql`
          SELECT DISTINCT ON (i.name)
            i.id,
            i.name,
            i.category,
            i.unit,
            i.price,
            i.packaging_qty,
            i.unit_price,
            i.base_unit,
            i.unit_cost_per_base
          FROM ingredients i
          WHERE LOWER(i.name) LIKE ${'%' + search + '%'}
          ORDER BY i.name ASC, i.price DESC NULLS LAST
          LIMIT ${limit};
        `)
      : await db.execute(sql`
          SELECT DISTINCT ON (i.name)
            i.id,
            i.name,
            i.category,
            i.unit,
            i.price,
            i.packaging_qty,
            i.unit_price,
            i.base_unit,
            i.unit_cost_per_base
          FROM ingredients i
          ORDER BY i.name ASC, i.price DESC NULLS LAST
          LIMIT ${limit};
        `);

    const rows = result.rows || result;
    const enriched = rows.map(r => {
      // Compute normalized cost per base unit
      const computedCost = computeUnitCostPerBase({
        price: Number(r.price) || null,
        packaging_qty: r.packaging_qty,
        unit: r.unit
      });
      
      // Use computed cost, or fall back to stored unit_cost_per_base
      const unitCostPerBase = computedCost ?? Number(r.unit_cost_per_base) ?? 0;
      
      // Parse portion unit for base unit
      const { baseUnit } = parsePortionUnit(r.unit);

      return {
        id: r.id,
        name: r.name,
        category: r.category || null,
        unit: r.unit || 'each',
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
