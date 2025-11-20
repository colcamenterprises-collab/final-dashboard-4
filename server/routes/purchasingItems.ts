import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

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

// Sync purchasing list items to Daily Stock V2 form
router.post('/sync-to-daily-stock', async (req, res) => {
  try {
    console.log('[purchasing/sync] Syncing purchasing items to Daily Stock V2...');
    
    // Get all purchasing items from database
    const purchasingItems = await prisma.purchasingItem.findMany({
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

export default router;
