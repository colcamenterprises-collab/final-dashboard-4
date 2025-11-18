import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const fieldMapSchema = z.object({
  fieldKey: z.string().min(1, 'Field key is required'),
  purchasingItemId: z.number().int().positive('Valid purchasing item ID is required'),
});

// GET all field mappings with related purchasing item data
router.get('/', async (req, res) => {
  try {
    const maps = await prisma.purchasingFieldMap.findMany({
      include: {
        purchasingItem: true,
      },
      orderBy: {
        fieldKey: 'asc',
      },
    });
    res.json({ ok: true, maps });
  } catch (error) {
    console.error('Error fetching field maps:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch field maps' });
  }
});

// GET field mapping by fieldKey
router.get('/by-key/:fieldKey', async (req, res) => {
  try {
    const { fieldKey } = req.params;
    const map = await prisma.purchasingFieldMap.findUnique({
      where: { fieldKey },
      include: {
        purchasingItem: true,
      },
    });
    
    if (!map) {
      return res.status(404).json({ ok: false, error: 'Field mapping not found' });
    }
    
    res.json({ ok: true, map });
  } catch (error) {
    console.error('Error fetching field map:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch field map' });
  }
});

// POST create new field mapping
router.post('/', async (req, res) => {
  try {
    const parsed = fieldMapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid data', 
        details: parsed.error.flatten() 
      });
    }

    // Check if purchasing item exists
    const purchasingItem = await prisma.purchasingItem.findUnique({
      where: { id: parsed.data.purchasingItemId },
    });

    if (!purchasingItem) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Purchasing item not found' 
      });
    }

    const map = await prisma.purchasingFieldMap.create({
      data: parsed.data,
      include: {
        purchasingItem: true,
      },
    });

    res.json({ ok: true, map });
  } catch (error: any) {
    console.error('Error creating field map:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Field key already mapped' });
    }
    res.status(500).json({ ok: false, error: 'Failed to create field map' });
  }
});

// PUT update field mapping
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
    }

    const parsed = fieldMapSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid data', 
        details: parsed.error.flatten() 
      });
    }

    // If updating purchasingItemId, check if it exists
    if (parsed.data.purchasingItemId) {
      const purchasingItem = await prisma.purchasingItem.findUnique({
        where: { id: parsed.data.purchasingItemId },
      });

      if (!purchasingItem) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Purchasing item not found' 
        });
      }
    }

    const map = await prisma.purchasingFieldMap.update({
      where: { id },
      data: parsed.data,
      include: {
        purchasingItem: true,
      },
    });

    res.json({ ok: true, map });
  } catch (error: any) {
    console.error('Error updating field map:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'Field mapping not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Field key already mapped' });
    }
    res.status(500).json({ ok: false, error: 'Failed to update field map' });
  }
});

// DELETE field mapping
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
    }

    await prisma.purchasingFieldMap.delete({
      where: { id },
    });

    res.json({ ok: true, message: 'Field mapping deleted' });
  } catch (error: any) {
    console.error('Error deleting field map:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'Field mapping not found' });
    }
    res.status(500).json({ ok: false, error: 'Failed to delete field map' });
  }
});

export default router;
