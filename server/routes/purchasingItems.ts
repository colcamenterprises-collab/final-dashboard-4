import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';
import { join } from 'path';

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
  lastReviewDate: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  try {
    const items = await prisma.purchasingItem.findMany({
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

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
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

// Sync purchasing items to foodCostings.ts and auto-create field mappings
router.post('/sync-to-forms', async (req, res) => {
  try {
    console.log('[Sync] Starting sync from PurchasingItem to foodCostings.ts...');
    
    // Read all purchasing items from database
    const items = await prisma.purchasingItem.findMany({
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
    });
    
    if (items.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No purchasing items found in database. Add items first before syncing.' 
      });
    }
    
    console.log(`[Sync] Found ${items.length} purchasing items to sync`);
    
    // Generate TypeScript code for foodCostings.ts
    const today = new Date().toLocaleDateString('en-GB').split('/').join('.');
    const tsCode = `export const foodCostings = [\n${items.map(item => {
      const cost = item.unitCost ? `฿${item.unitCost.toFixed(2)}` : '฿0.00';
      return `  {
    item: "${item.item}",
    category: "${item.category || 'Other'}",
    supplier: "${item.supplierName || 'Unknown'}",
    brand: "${item.brand || 'Generic'}",
    packagingQty: "${item.unitDescription || 'Each'}",
    cost: "${cost}",
    averageMenuPortion: "${item.orderUnit || 'Each'}",
    lastReviewDate: "${item.lastReviewDate || today}"
  }`;
    }).join(',\n')}\n];\n`;
    
    // Write to foodCostings.ts
    const filePath = join(process.cwd(), 'server', 'data', 'foodCostings.ts');
    await writeFile(filePath, tsCode, 'utf-8');
    console.log(`[Sync] ✅ Written ${items.length} items to foodCostings.ts`);
    
    // Auto-create/update field mappings
    let mappingsCreated = 0;
    let mappingsUpdated = 0;
    
    for (const item of items) {
      const existingMap = await prisma.purchasingFieldMap.findFirst({
        where: { fieldKey: item.item },
      });
      
      if (existingMap) {
        // Update existing mapping to point to correct item
        await prisma.purchasingFieldMap.update({
          where: { id: existingMap.id },
          data: { purchasingItemId: item.id },
        });
        mappingsUpdated++;
      } else {
        // Create new mapping
        await prisma.purchasingFieldMap.create({
          data: {
            fieldKey: item.item,
            purchasingItemId: item.id,
          },
        });
        mappingsCreated++;
      }
    }
    
    console.log(`[Sync] ✅ Created ${mappingsCreated} new field mappings`);
    console.log(`[Sync] ✅ Updated ${mappingsUpdated} existing field mappings`);
    
    res.json({ 
      ok: true, 
      message: 'Sync completed successfully',
      itemsSynced: items.length,
      mappingsCreated,
      mappingsUpdated,
      filePath: 'server/data/foodCostings.ts',
      note: 'Please restart the application to load updated forms'
    });
  } catch (error: any) {
    console.error('[Sync] Error during sync:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Sync failed', 
      details: error.message 
    });
  }
});

export default router;
