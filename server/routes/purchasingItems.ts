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
import { foodCostings } from '../data/foodCostings';

const router = Router();
const prisma = new PrismaClient();

const purchasingItemSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  category: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  supplierSku: z.string().optional().nullable(),
  orderUnit: z.string().optional().nullable(),
  unitDescription: z.string().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  packCost: z.number().optional().nullable(),
  lastReviewDate: z.string().optional().nullable(),
  active: z.boolean().optional(),
  isIngredient: z.boolean().optional(),
  portionUnit: z.string().optional().nullable(),
  portionSize: z.number().optional().nullable(),
  yield: z.number().optional().nullable(),
});

router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const whereClause = activeOnly ? { active: true } : {};
    
    const items = await prisma.purchasingItem.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });
    res.json({ ok: true, items });
  } catch (error) {
    console.error('Error fetching purchasing items:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch items' });
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

    const item = await prisma.purchasingItem.create({
      data: parsed.data,
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
      data: parsed.data,
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

    // PATCH E: Check if item is marked as ingredient (cannot delete)
    const item = await prisma.purchasingItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }

    if (item.isIngredient) {
      return res.status(400).json({
        ok: false,
        error: 'Item is in use and cannot be deleted. Unmark as ingredient first, or deactivate it.'
      });
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
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });

    const headers = ['id', 'item', 'category', 'supplierName', 'brand', 'supplierSku', 'orderUnit', 'unitDescription', 'unitCost', 'lastReviewDate'];
    const csvLines = [headers.join(',')];
    
    for (const row of items) {
      const csvRow = [
        row.id,
        `"${(row.item || '').replace(/"/g, '""')}"`,
        `"${(row.category || '').replace(/"/g, '""')}"`,
        `"${(row.supplierName || '').replace(/"/g, '""')}"`,
        `"${(row.brand || '').replace(/"/g, '""')}"`,
        `"${(row.supplierSku || '').replace(/"/g, '""')}"`,
        `"${(row.orderUnit || '').replace(/"/g, '""')}"`,
        `"${(row.unitDescription || '').replace(/"/g, '""')}"`,
        row.unitCost || '',
        `"${(row.lastReviewDate || '').replace(/"/g, '""')}"`,
      ];
      csvLines.push(csvRow.join(','));
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
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ ok: false, error: 'csvData array required' });
    }

    let inserted = 0;
    let updated = 0;
    
    for (const row of csvData) {
      const item = (row.item || '').trim();
      const supplierName = (row.supplierName || '').trim() || null;
      const brand = (row.brand || '').trim() || null;
      
      if (!item) continue;
      
      // Check if exists
      const existing = await prisma.purchasingItem.findFirst({
        where: {
          item,
          supplierName: supplierName || undefined,
          brand: brand || undefined,
        },
      });
      
      if (existing) {
        // Update
        await prisma.purchasingItem.update({
          where: { id: existing.id },
          data: {
            category: row.category || null,
            supplierSku: row.supplierSku || null,
            orderUnit: row.orderUnit || null,
            unitDescription: row.unitDescription || null,
            unitCost: row.unitCost ? parseFloat(row.unitCost) : null,
            lastReviewDate: row.lastReviewDate || null,
          },
        });
        updated++;
      } else {
        // Insert
        await prisma.purchasingItem.create({
          data: {
            item,
            category: row.category || null,
            supplierName: supplierName,
            brand: brand,
            supplierSku: row.supplierSku || null,
            orderUnit: row.orderUnit || null,
            unitDescription: row.unitDescription || null,
            unitCost: row.unitCost ? parseFloat(row.unitCost) : null,
            lastReviewDate: row.lastReviewDate || null,
          },
        });
        inserted++;
      }
    }
    
    console.log(`[/api/purchasing-items/import/csv] Imported: ${inserted} inserted, ${updated} updated`);
    res.json({ ok: true, inserted, updated });
  } catch (error) {
    console.error('Error importing purchasing items:', error);
    res.status(500).json({ ok: false, error: 'Failed to import purchasing items' });
  }
});

// Sync purchasing list items to Daily Stock V2 form (live from DB)
router.post('/sync-to-daily-stock', async (req, res) => {
  try {
    console.log('[purchasing/sync] Syncing purchasing items to Daily Stock V2...');
    
    // Get all ACTIVE purchasing items from database
    const purchasingItems = await prisma.purchasingItem.findMany({
      where: { active: true },
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });

    // Transform to match Daily Stock ingredient format (simple names only)
    const ingredients = purchasingItems.map((item, index) => ({
      id: `purchasing-${item.id}`, // Unique ID for frontend tracking
      name: item.item, // Simple name only
      category: item.category || 'Uncategorized',
      unit: item.orderUnit || 'unit',
      cost: item.unitCost ? Number(item.unitCost) : 0,
      supplier: item.supplierName || 'Unknown',
      portions: 1 // Default portions for compatibility
    }));

    console.log(`[purchasing/sync] Synced ${ingredients.length} items from purchasing list`);
    res.json({ ok: true, list: ingredients });
  } catch (error) {
    console.error('[purchasing/sync] Error syncing to Daily Stock:', error);
    res.status(500).json({ ok: false, error: 'Failed to sync purchasing items' });
  }
});

/**
 * POST /api/purchasing-items/populate-catalog
 * Populates purchasing_items from foodCostings TypeScript source of truth
 * This should be run once to seed the catalog, then items managed via API
 */
router.post('/populate-catalog', async (req, res) => {
  try {
    console.log('[purchasing/populate] Populating purchasing_items from foodCostings catalog...');
    
    let inserted = 0;
    let updated = 0;
    
    for (const item of foodCostings) {
      // Parse cost (removes ฿ symbol and commas)
      const costStr = (item.cost || '').replace(/[฿,]/g, '').trim();
      const unitCost = parseFloat(costStr) || null;
      
      // Check if exists by item name
      const existing = await prisma.purchasingItem.findFirst({
        where: { item: item.item },
      });
      
      if (existing) {
        // Update existing
        await prisma.purchasingItem.update({
          where: { id: existing.id },
          data: {
            category: item.category || null,
            supplierName: item.supplier || null,
            brand: item.brand || null,
            orderUnit: item.packagingQty || null,
            unitDescription: item.averageMenuPortion || null,
            unitCost: unitCost,
            lastReviewDate: item.lastReviewDate || null,
            active: true,
          },
        });
        updated++;
      } else {
        // Insert new
        await prisma.purchasingItem.create({
          data: {
            item: item.item,
            category: item.category || null,
            supplierName: item.supplier || null,
            brand: item.brand || null,
            orderUnit: item.packagingQty || null,
            unitDescription: item.averageMenuPortion || null,
            unitCost: unitCost,
            lastReviewDate: item.lastReviewDate || null,
            active: true,
          },
        });
        inserted++;
      }
    }
    
    console.log(`[purchasing/populate] Catalog populated: ${inserted} inserted, ${updated} updated`);
    res.json({ ok: true, inserted, updated, total: foodCostings.length });
  } catch (error) {
    console.error('[purchasing/populate] Error populating catalog:', error);
    res.status(500).json({ ok: false, error: 'Failed to populate catalog' });
  }
});

export default router;
