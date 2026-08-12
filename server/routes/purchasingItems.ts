/**
 * 🔒 CANONICAL PURCHASING FLOW (AUTO-SYNC)
 * purchasing_items → Form 2 → purchasing_shift_items → Shopping List
 *
 * RULES:
 * - purchasing_items is the ONLY source of truth
 * - Form 2 auto-loads items (no manual sync)
 * - Shopping List & Shift Log are read-only views
 * - DO NOT duplicate or derive items elsewhere
 */
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import {
  CANONICAL_PURCHASING_CATEGORIES,
  isCanonicalPurchasingCategory,
  normalizePurchasingCategory,
} from '../../shared/purchasingCategories';

const router = Router();
const prisma = new PrismaClient();

const purchasingItemSafeSelect = {
  id: true,
  item: true,
  category: true,
  supplierName: true,
  brand: true,
  supplierSku: true,
  orderUnit: true,
  unitDescription: true,
  purchaseUnitLabel: true,
  unitCost: true,
  catalogueCode: true,
  purchaseQuantity: true,
  baseUnit: true,
  purchaseCostThb: true,
  reviewNotes: true,
  lastReviewDate: true,
  active: true,
  isIngredient: true,
  portionUnit: true,
  portionSize: true,
  yield: true,
  createdAt: true,
  updatedAt: true,
} as const;

const purchasingItemSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  category: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  supplierSku: z.string().optional().nullable(),
  orderUnit: z.string().optional().nullable(),
  unitDescription: z.string().optional().nullable(),
  purchaseUnitLabel: z.string().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  catalogueCode: z.string().optional().nullable(),
  purchaseQuantity: z.number().positive().optional().nullable(),
  baseUnit: z.string().optional().nullable(),
  purchaseCostThb: z.number().min(0).optional().nullable(),
  reviewNotes: z.string().optional().nullable(),
  lastReviewDate: z.string().optional().nullable(),
  active: z.boolean().optional(),
  portionUnit: z.string().optional().nullable(),
  portionSize: z.number().optional().nullable(),
  yield: z.number().optional().nullable(),
});

const invalidCategoryResponse = {
  ok: false,
  error: 'Invalid category',
  allowed: CANONICAL_PURCHASING_CATEGORIES,
};

function normalizeCategoryInPayload<T extends { category?: string | null }>(payload: T): T {
  if (!('category' in payload)) return payload;
  return {
    ...payload,
    category: normalizePurchasingCategory(payload.category),
  };
}

function validateCategoryForWrite(payload: { category?: string | null }): boolean {
  if (!('category' in payload)) return true;
  return isCanonicalPurchasingCategory(payload.category ?? null);
}

router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const whereClause = activeOnly ? { active: true } : {};
    
    const items = await prisma.purchasingItem.findMany({
      where: whereClause,
      select: purchasingItemSafeSelect,
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });
    res.json({ ok: true, items });
  } catch (error: any) {
    console.error('Error fetching purchasing items:', error);
    res.status(200).json({ ok: false, items: [], source: 'purchasing_items', blockers: [{ code: 'PURCHASING_ITEMS_UNAVAILABLE', message: error?.message || 'Failed to fetch items', where: '/api/purchasing-items', canonical_source: 'purchasing_items', auto_build_attempted: false }] });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = purchasingItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid data', 
        details: parsed.error.flatten() 
      });
    }

    const normalizedData = normalizeCategoryInPayload(parsed.data);
    if (!validateCategoryForWrite(normalizedData)) {
      return res.status(400).json(invalidCategoryResponse);
    }

    const item = await prisma.purchasingItem.create({
      data: normalizedData,
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error('Error creating purchasing item:', error);
    res.status(500).json({ ok: false, error: 'Failed to create item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
    }

    const parsed = purchasingItemSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid data', 
        details: parsed.error.flatten() 
      });
    }

    const normalizedData = normalizeCategoryInPayload(parsed.data);
    if (!validateCategoryForWrite(normalizedData)) {
      return res.status(400).json(invalidCategoryResponse);
    }

    // PATCH F: Production lock guard - block renames if PRODUCTION_LOCK=1
    if (process.env.PRODUCTION_LOCK === '1') {
      // Check if trying to rename
      if (parsed.data.item) {
        const existing = await prisma.purchasingItem.findUnique({ where: { id } });
        if (existing && existing.item !== parsed.data.item) {
          return res.status(403).json({
            ok: false,
            error: 'PRODUCTION_LOCK: Renaming items is blocked. Deactivate and create new item instead.'
          });
        }
      }
    }

    const item = await prisma.purchasingItem.update({
      where: { id },
      data: normalizedData,
    });

    res.json({ ok: true, item });
  } catch (error: any) {
    console.error('Error updating purchasing item:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.status(500).json({ ok: false, error: 'Failed to update item' });
  }
});

/**
 * 🔒 SYSTEM LOCK: Prevent deletion if item is referenced in historical data
 * PATCH F: Also block deletion if PRODUCTION_LOCK=1
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
    }

    // PATCH F: Production lock guard - block deletions if PRODUCTION_LOCK=1
    if (process.env.PRODUCTION_LOCK === '1') {
      return res.status(403).json({
        ok: false,
        error: 'PRODUCTION_LOCK: Deleting items is blocked. Deactivate items instead.'
      });
    }

    const item = await prisma.purchasingItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }

    // Check if item is referenced in purchasing_shift_items (historical data)
    const refCount = await prisma.purchasingShiftItem.count({
      where: { purchasingItemId: id },
    });

    if (refCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Cannot delete: Item is referenced in ${refCount} shift records. Deactivate it instead to preserve historical data.` 
      });
    }

    await prisma.purchasingItem.delete({
      where: { id },
    });

    res.json({ ok: true, message: 'Item deleted' });
  } catch (error: any) {
    console.error('Error deleting purchasing item:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    res.status(500).json({ ok: false, error: 'Failed to delete item' });
  }
});

// GET /api/purchasing-items/export/csv - Export all purchasing items as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const items = await prisma.purchasingItem.findMany({
      select: purchasingItemSafeSelect,
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });

    const headers = ['ID', 'Item', 'Category', 'Supplier', 'Brand', 'Supplier SKU', 'Wholesale Cost (THB)', 'Unit Quantity', 'Base Unit', 'Cost per Base Unit (THB)', 'Last Review Date', 'Review Notes'];
    const csvLines = [headers.join(',')];
    
    for (const row of items) {
      const purchaseCost = Number(row.purchaseCostThb ?? row.unitCost ?? 0);
      const quantity = Number(row.purchaseQuantity ?? 0);
      const costPerBase = quantity > 0 ? purchaseCost / quantity : '';
      const value = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      csvLines.push([
        row.catalogueCode ?? row.id, value(row.item), value(row.category), value(row.supplierName),
        value(row.brand), value(row.supplierSku), purchaseCost || '', quantity || '',
        value(row.baseUnit || row.orderUnit || row.unitDescription), costPerBase,
        value(row.lastReviewDate), value(row.reviewNotes),
      ].join(','));
    }
    
    const csvContent = csvLines.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="purchasing-items-export.csv"');
    console.log(`[/api/purchasing-items/export/csv] Exported ${items.length} items`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting purchasing items:', error);
    res.status(500).json({ ok: false, error: 'Failed to export purchasing items' });
  }
});

// POST /api/purchasing-items/import/csv - Import purchasing items from CSV (upsert by item, supplierName, brand)
router.post('/import/csv', async (req, res) => {
  try {
    const { csvData, archiveMissing = false } = req.body;
    if (!Array.isArray(csvData)) return res.status(400).json({ ok: false, error: 'csvData array required' });

    let inserted = 0, updated = 0;
    const importedCodes = new Set<string>();
    for (const row of csvData) {
      const item = String(row.Item ?? row.item ?? '').trim();
      if (!item) continue;
      const code = String(row.ID ?? row.id ?? row.catalogueCode ?? '').trim() || null;
      const category = normalizePurchasingCategory(row.Category ?? row.category ?? null);
      if (!isCanonicalPurchasingCategory(category)) return res.status(400).json(invalidCategoryResponse);
      const number = (value: unknown) => {
        const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : null;
      };
      const purchaseCostThb = number(row['Wholesale Cost (THB)'] ?? row.purchaseCostThb ?? row.unitCost);
      const purchaseQuantity = number(row['Unit Quantity'] ?? row.purchaseQuantity);
      const baseUnit = String(row['Base Unit'] ?? row.baseUnit ?? row.orderUnit ?? '').trim() || null;
      const data = {
        item, category, catalogueCode: code, supplierName: String(row.Supplier ?? row.supplierName ?? '').trim() || null,
        brand: String(row.Brand ?? row.brand ?? '').trim() || null,
        supplierSku: String(row['Supplier SKU'] ?? row.supplierSku ?? '').trim() || null,
        purchaseCostThb, purchaseQuantity, baseUnit,
        // Keep old consumers compatible while all new consumers use the canonical fields.
        unitCost: purchaseCostThb, orderUnit: baseUnit, purchaseUnitLabel: purchaseQuantity && baseUnit ? `${purchaseQuantity} ${baseUnit}` : null,
        lastReviewDate: String(row['Last Review Date'] ?? row.lastReviewDate ?? '').trim() || null,
        reviewNotes: String(row['Review Notes'] ?? row.reviewNotes ?? '').trim() || null, active: true,
      };
      const existing = code
        ? await prisma.purchasingItem.findFirst({ where: { catalogueCode: code } })
        : await prisma.purchasingItem.findFirst({ where: { item, supplierName: data.supplierName || undefined } });
      if (existing) { await prisma.purchasingItem.update({ where: { id: existing.id }, data }); updated++; }
      else { await prisma.purchasingItem.create({ data }); inserted++; }
      if (code) importedCodes.add(code);
    }
    let archived = 0;
    if (archiveMissing) {
      const active = await prisma.purchasingItem.findMany({ where: { active: true }, select: { id: true, catalogueCode: true } });
      for (const existing of active) if (!existing.catalogueCode || !importedCodes.has(existing.catalogueCode)) {
        await prisma.purchasingItem.update({ where: { id: existing.id }, data: { active: false } }); archived++;
      }
    }
    res.json({ ok: true, inserted, updated, archived, source: 'purchasing_items' });
  } catch (error) { console.error('Canonical catalogue import failed:', error); res.status(500).json({ ok: false, error: 'Failed to import purchasing catalogue' }); }
});

// Downloadable, empty operator template. Importing is optional; direct table editing is primary.
router.get('/template/csv', (_req, res) => {
  res.type('text/csv').attachment('purchasing-catalogue-template.csv').send(
    'ID,Item,Category,Supplier,Brand,Supplier SKU,Wholesale Cost (THB),Unit Quantity,Base Unit,Cost per Base Unit (THB),Last Review Date,Review Notes\n'
  );
});

// Sync purchasing list items to Daily Stock V2 form (live from DB)
router.post('/sync-to-daily-stock', async (req, res) => {
  const salesId = typeof req.body?.salesId === 'string' ? req.body.salesId : undefined;
  const shiftDate = typeof req.body?.shiftDate === 'string'
    ? req.body.shiftDate
    : new Date().toISOString().slice(0, 10);

  const diagnostics = {
    purchasingItemsTotal: 0,
    drinksActive: 0,
    ingredientsActive: 0,
    rowsWritten: 0,
  };

  try {
    console.log('[purchasing/sync] Entry', {
      body: {
        salesId: req.body?.salesId ?? null,
        shiftDate: req.body?.shiftDate ?? null,
      },
      derived: { salesId: salesId ?? null, shiftDate },
    });

    if (req.body?.salesId !== undefined && typeof req.body.salesId !== 'string') {
      return res.status(400).json({
        ok: false,
        salesId: salesId ?? null,
        shiftDate,
        counts: diagnostics,
        error: {
          message: 'Invalid salesId. Expected string.',
          code: 'VALIDATION_ERROR',
          where: 'purchasingItems.sync-to-daily-stock',
        },
      });
    }

    if (req.body?.shiftDate !== undefined && typeof req.body.shiftDate !== 'string') {
      return res.status(400).json({
        ok: false,
        salesId: salesId ?? null,
        shiftDate,
        counts: diagnostics,
        error: {
          message: 'Invalid shiftDate. Expected YYYY-MM-DD string.',
          code: 'VALIDATION_ERROR',
          where: 'purchasingItems.sync-to-daily-stock',
        },
      });
    }
    
    // Get all ACTIVE purchasing items from database
    const purchasingItems = await prisma.purchasingItem.findMany({
      where: { active: true },
      select: purchasingItemSafeSelect,
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });

    // Transform to match Daily Stock ingredient format (simple names only)
    diagnostics.purchasingItemsTotal = purchasingItems.length;

    const ingredients = purchasingItems.map((item) => {
      const normalizedCategory = normalizePurchasingCategory(item.category || null);
      return {
        id: `purchasing-${item.id}`, // Unique ID for frontend tracking
        name: item.item || `Unnamed item #${item.id}`,
        category: normalizedCategory || item.category || 'Uncategorized',
        unit: item.baseUnit || item.orderUnit || 'unit',
        cost: item.purchaseCostThb ? Number(item.purchaseCostThb) : (item.unitCost ? Number(item.unitCost) : 0),
        supplier: item.supplierName || 'Unknown',
        portions: 1 // Default portions for compatibility
      };
    });

    diagnostics.drinksActive = ingredients.filter((item) => item.category === 'Drinks').length;
    diagnostics.ingredientsActive = ingredients.filter((item) => item.category !== 'Drinks').length;
    diagnostics.rowsWritten = ingredients.length;

    console.log('[purchasing/sync] Pre-DB counts', {
      purchasingItemsTotal: diagnostics.purchasingItemsTotal,
      drinksActive: diagnostics.drinksActive,
      ingredientsActive: diagnostics.ingredientsActive,
    });

    if (ingredients.length === 0) {
      return res.json({
        ok: true,
        salesId: salesId ?? null,
        shiftDate,
        list: [],
        drinks: [],
        ingredients: [],
        counts: diagnostics,
        warning: 'No purchasing items found; rendering manual stock entry',
      });
    }

    const drinkWarning = diagnostics.drinksActive === 0
      ? 'No drink items found (category mismatch likely). Ensure purchasing_items.category uses Drinks/Drink.'
      : undefined;

    console.log(`[purchasing/sync] Synced ${ingredients.length} items from purchasing list`);
    return res.json({
      ok: true,
      salesId: salesId ?? null,
      shiftDate,
      list: ingredients,
      drinks: ingredients.filter((item) => item.category === 'Drinks'),
      ingredients: ingredients.filter((item) => item.category !== 'Drinks'),
      counts: diagnostics,
      warning: drinkWarning || (diagnostics.rowsWritten === 0
        ? 'No rows written; rendering manual stock entry'
        : undefined),
    });
  } catch (error: any) {
    console.error('[purchasing/sync] Error syncing to Daily Stock', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      where: 'purchasingItems.sync-to-daily-stock',
      salesId: salesId ?? null,
      shiftDate,
    });

    return res.status(500).json({
      ok: false,
      salesId: salesId ?? null,
      shiftDate,
      list: [],
      drinks: [],
      ingredients: [],
      counts: diagnostics,
      error: {
        message: error?.message || 'Failed to sync purchasing items',
        code: error?.code,
        where: 'purchasingItems.sync-to-daily-stock',
        hint: 'Check purchasing_items records and DB connectivity',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
    });
  }
});

/**
 * POST /api/purchasing-items/populate-catalog
 * Populates purchasing_items from foodCostings TypeScript source of truth
 * This should be run once to seed the catalog, then items managed via API
 */
router.post('/populate-catalog', (_req, res) => res.status(410).json({ ok: false, error: 'Retired. Edit or import the Purchasing Catalogue instead.' }));

export default router;
