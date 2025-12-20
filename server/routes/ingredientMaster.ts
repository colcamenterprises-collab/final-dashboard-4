import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';

const router = Router();

const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional().nullable(),
  baseUnit: z.string().min(1, 'Base unit is required'),
  defaultPortion: z.number().optional().nullable(),
  linkedPurchasingItemId: z.number().optional().nullable(),
  verified: z.boolean().optional(),
});

router.get('/', async (_req, res) => {
  try {
    const ingredients = await prisma.ingredientV2.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        defaultPortion: true,
        linkedPurchasingItemId: true,
        verified: true,
        createdAt: true,
      },
    });

    const purchasingItems = await prisma.purchasingItem.findMany({
      select: {
        id: true,
        item: true,
        brand: true,
        unitDescription: true,
        unitCost: true,
        orderUnit: true,
      },
      orderBy: { item: 'asc' },
    });

    const purchasingMap = new Map(purchasingItems.map(p => [p.id, p]));

    const enriched = ingredients.map(ing => {
      const linked = ing.linkedPurchasingItemId 
        ? purchasingMap.get(ing.linkedPurchasingItemId) 
        : null;

      let costPreview: number | null = null;
      if (linked && linked.unitCost) {
        costPreview = Number(linked.unitCost);
      }

      return {
        id: ing.id,
        name: ing.name,
        category: ing.category,
        baseUnit: ing.baseUnit,
        defaultPortion: ing.defaultPortion ? Number(ing.defaultPortion) : null,
        linkedPurchasingItemId: ing.linkedPurchasingItemId,
        linkedPurchasingItem: linked ? {
          id: linked.id,
          item: linked.item,
          brand: linked.brand,
          unitDescription: linked.unitDescription,
          unitCost: linked.unitCost ? Number(linked.unitCost) : null,
        } : null,
        costPreview,
        verified: ing.verified,
      };
    });

    res.json({ ok: true, ingredients: enriched, purchasingItems });
  } catch (e: any) {
    console.error('ingredient-master GET error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = ingredientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Validation failed', details: parsed.error.flatten() });
    }

    const ingredient = await prisma.ingredientV2.create({
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        baseUnit: parsed.data.baseUnit,
        defaultPortion: parsed.data.defaultPortion,
        linkedPurchasingItemId: parsed.data.linkedPurchasingItemId,
        verified: false,
      },
    });

    res.json({ ok: true, ingredient });
  } catch (e: any) {
    console.error('ingredient-master POST error:', e);
    if (e.code === 'P2002') {
      return res.status(400).json({ ok: false, error: 'Ingredient with this name already exists' });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = ingredientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Validation failed', details: parsed.error.flatten() });
    }

    const ingredient = await prisma.ingredientV2.update({
      where: { id },
      data: parsed.data,
    });

    res.json({ ok: true, ingredient });
  } catch (e: any) {
    console.error('ingredient-master PUT error:', e);
    if (e.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'Ingredient not found' });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
