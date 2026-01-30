import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { toBase } from '../lib/uom';
import { syncIngredientFromPurchasing, syncAllIngredientsFromPurchasing } from '../services/ingredientSync.service';
import { 
  computeUnitCostPerBase as computeCostNew,
  computePortionCost,
  checkUnitCompatibility,
  getBaseUnit 
} from '../utils/computeUnitCostPerBase';

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
  
  // Parse packaging quantity to get numeric value
  let packagingQtyNum: number | null = null;
  
  // Handle "10kg bag", "1kg pack", "per 1kg", "Per kg" patterns
  const kgMatch = packQty.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) {
    packagingQtyNum = parseFloat(kgMatch[1]) * 1000; // convert kg to grams
  } else if (packQty.includes('per kg') || packQty === 'per 1kg') {
    packagingQtyNum = 1000; // 1kg = 1000g
  }
  // Handle "500g", "3kg" patterns  
  else {
    const gMatch = packQty.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i);
    if (gMatch) {
      packagingQtyNum = parseFloat(gMatch[1]); // already in grams
    }
    // Handle litre patterns
    const litreMatch = packQty.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|l)s?/i);
    if (litreMatch) {
      packagingQtyNum = parseFloat(litreMatch[1]) * 1000; // convert to ml
    }
    // Handle plain numbers like "1", "6", "50"
    const plainNum = packQty.match(/^(\d+)$/);
    if (plainNum) {
      packagingQtyNum = parseFloat(plainNum[1]); // count of items
    }
    // Handle "box of 50", "pack of 100"
    const ofMatch = packQty.match(/(?:box|pack|bag|case)\s*(?:of)?\s*(\d+)/i);
    if (ofMatch) {
      packagingQtyNum = parseFloat(ofMatch[1]);
    }
  }
  
  // For "each" units with no kg/g packaging, try to extract count
  if (unit === 'each' && !packagingQtyNum && !packQty.includes('kg') && !packQty.includes('g')) {
    const countMatch = packQty.match(/(\d+)/);
    if (countMatch) {
      packagingQtyNum = parseFloat(countMatch[1]);
    }
  }
  
  // Use the utility function for final computation
  return computeCostFromUtil(ingredient.price, packagingQtyNum, unit || 'each');
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

/**
 * GET /api/ingredients/management
 * Returns full ingredient data for management page with editable fields
 * Shows explicit yield/portion fields for transparent cost calculation
 * Query params: showHidden=true to include hidden ingredients
 */
router.get('/management', async (req, res) => {
  try {
    const showHidden = req.query.showHidden === 'true';
    
    const baseQuery = sql`
      SELECT
        i.id,
        i.name,
        i.category,
        i.supplier,
        i.brand,
        i.price,
        i.packaging_qty,
        i.purchase_qty,
        i.purchase_unit,
        i.base_unit,
        i.base_yield_qty,
        i.unit_cost_per_base,
        i.portion_qty,
        i.portion_unit,
        i.notes,
        i.photo_url,
        i.updated_at,
        i.hidden
      FROM ingredients i
      ${showHidden ? sql`` : sql`WHERE i.hidden IS NOT TRUE`}
      ORDER BY i.name ASC
      LIMIT 1000;
    `;
    
    const result = await db.execute(baseQuery);
    const rows = result.rows || result;
    
    const enriched = rows.map((r: any) => {
      const purchaseCost = Number(r.price) || 0;
      const baseYieldQty = Number(r.base_yield_qty) || null;
      const portionQty = Number(r.portion_qty) || null;
      const baseUnit = r.base_unit || 'each';
      const portionUnit = r.portion_unit || baseUnit;
      
      // Compute unit cost using explicit baseYieldQty (no text parsing)
      const unitCostPerBase = baseYieldQty && baseYieldQty > 0 && purchaseCost > 0
        ? purchaseCost / baseYieldQty
        : null;
      
      // Compute portion cost
      const portionCost = unitCostPerBase && portionQty && portionQty > 0
        ? unitCostPerBase * portionQty
        : null;
      
      // Check unit compatibility
      const unitCheck = checkUnitCompatibility(baseUnit, portionUnit);
      
      return {
        id: r.id,
        name: r.name,
        category: r.category || '',
        supplier: r.supplier || '',
        brand: r.brand || '',
        // Purchase side
        purchaseCost: purchaseCost,
        purchaseQty: r.purchase_qty || r.packaging_qty || '',
        purchaseUnit: r.purchase_unit || '',
        // Yield side  
        baseYieldQty: baseYieldQty,
        baseUnit: baseUnit,
        // Computed cost
        unitCostPerBase: unitCostPerBase,
        missingYield: !baseYieldQty || baseYieldQty <= 0,
        // Portion side
        portionQty: portionQty,
        portionUnit: portionUnit,
        portionCost: portionCost,
        unitMismatch: !unitCheck.compatible,
        unitWarning: unitCheck.warning || null,
        // Meta
        notes: r.notes || '',
        photoUrl: r.photo_url || null,
        updatedAt: r.updated_at,
        hidden: r.hidden || false,
      };
    });

    res.json({ items: enriched, count: enriched.length });
  } catch (e: any) {
    console.error('ingredients.management error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/ingredients/:id
 * Update ingredient with explicit yield/portion fields
 * Computed fields (unitCostPerBase, portionCost) calculated server-side from explicit numeric inputs
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ingredient ID' });
    }
    
    const { 
      name, category, supplier, brand,
      purchaseCost, purchaseQty, purchaseUnit,
      baseYieldQty, baseUnit,
      portionQty, portionUnit,
      notes, photoUrl, hidden 
    } = req.body;
    
    // Compute unit cost from explicit fields
    const yieldNum = baseYieldQty ? Number(baseYieldQty) : null;
    const costNum = purchaseCost ? Number(purchaseCost) : null;
    const computedUnitCost = (yieldNum && yieldNum > 0 && costNum && costNum > 0)
      ? costNum / yieldNum
      : null;
    
    await db.execute(sql`
      UPDATE ingredients SET
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        supplier = COALESCE(${supplier}, supplier),
        brand = COALESCE(${brand}, brand),
        price = COALESCE(${costNum}, price),
        purchase_qty = COALESCE(${purchaseQty}, purchase_qty),
        purchase_unit = COALESCE(${purchaseUnit}, purchase_unit),
        base_yield_qty = COALESCE(${yieldNum}, base_yield_qty),
        base_unit = COALESCE(${baseUnit}, base_unit),
        unit_cost_per_base = COALESCE(${computedUnitCost}, unit_cost_per_base),
        portion_qty = COALESCE(${portionQty ? Number(portionQty) : null}, portion_qty),
        portion_unit = COALESCE(${portionUnit}, portion_unit),
        notes = COALESCE(${notes}, notes),
        photo_url = COALESCE(${photoUrl}, photo_url),
        hidden = COALESCE(${hidden}, hidden),
        updated_at = NOW()
      WHERE id = ${id};
    `);
    
    // Fetch updated record
    const updated = await db.execute(sql`
      SELECT id, name, category, supplier, brand, price,
        purchase_qty, purchase_unit, base_yield_qty, base_unit,
        unit_cost_per_base, portion_qty, portion_unit,
        notes, photo_url, updated_at, hidden
      FROM ingredients WHERE id = ${id}
    `);
    
    const row = (updated.rows || updated)[0];
    if (!row) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    
    const unitCostPerBase = Number(row.unit_cost_per_base) || null;
    const finalPortionQty = Number(row.portion_qty) || null;
    const portionCost = (unitCostPerBase && finalPortionQty)
      ? unitCostPerBase * finalPortionQty
      : null;
    
    res.json({
      success: true,
      ingredient: {
        id: row.id,
        name: row.name,
        category: row.category || '',
        supplier: row.supplier || '',
        brand: row.brand || '',
        purchaseCost: Number(row.price) || 0,
        purchaseQty: row.purchase_qty || '',
        purchaseUnit: row.purchase_unit || '',
        baseYieldQty: Number(row.base_yield_qty) || null,
        baseUnit: row.base_unit || 'each',
        unitCostPerBase: unitCostPerBase,
        portionQty: finalPortionQty,
        portionUnit: row.portion_unit || row.base_unit || 'each',
        portionCost: portionCost,
        notes: row.notes || '',
        photoUrl: row.photo_url || null,
        updatedAt: row.updated_at,
        hidden: row.hidden || false,
      }
    });
  } catch (e: any) {
    console.error('ingredients.update error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
