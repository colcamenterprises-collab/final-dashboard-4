/**
 * 🔒 FOUNDATION-01: Canonical Ingredients From Purchasing Items
 * 
 * Ingredients are DERIVED from purchasing_items WHERE is_ingredient = true
 * This is a VIEW, NOT a separate source. Cost is owned by Purchasing List.
 * 
 * Editable fields (stored back to purchasing_items):
 * - portionUnit (g / ml / piece)
 * - portionSize
 * - yield (nullable)
 * 
 * Cost is NOT editable here - it comes from purchasing_items.unitCost
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const ingredientUpdateSchema = z.object({
  portionUnit: z.string().optional().nullable(),
  portionSize: z.number().optional().nullable(),
  yield: z.number().optional().nullable(),
});

router.get('/', async (_req, res) => {
  try {
    const ingredients = await prisma.purchasingItem.findMany({
      where: {
        isIngredient: true,
      },
      orderBy: [
        { category: 'asc' },
        { item: 'asc' },
      ],
      select: {
        id: true,
        item: true,
        category: true,
        brand: true,
        orderUnit: true,
        unitDescription: true,
        unitCost: true,
        portionUnit: true,
        portionSize: true,
        yield: true,
        active: true,
      },
    });

    const enriched = ingredients.map(ing => ({
      id: ing.id,
      name: ing.item,
      category: ing.category,
      brand: ing.brand,
      orderUnit: ing.orderUnit,
      unitDescription: ing.unitDescription,
      unitCost: ing.unitCost ? Number(ing.unitCost) : null,
      portionUnit: ing.portionUnit,
      portionSize: ing.portionSize ? Number(ing.portionSize) : null,
      yield: ing.yield ? Number(ing.yield) : null,
      active: ing.active,
    }));

    res.json({ 
      ok: true, 
      ingredients: enriched,
      source: 'purchasing_items.is_ingredient',
    });
  } catch (e: any) {
    console.error('ingredient-master GET error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid ID' });
    }

    const parsed = ingredientUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Validation failed', 
        details: parsed.error.flatten() 
      });
    }

    const existing = await prisma.purchasingItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Ingredient not found' });
    }

    if (!existing.isIngredient) {
      return res.status(400).json({ 
        ok: false, 
        error: 'This item is not marked as an ingredient' 
      });
    }

    const updated = await prisma.purchasingItem.update({
      where: { id },
      data: {
        portionUnit: parsed.data.portionUnit,
        portionSize: parsed.data.portionSize,
        yield: parsed.data.yield,
      },
    });

    res.json({ 
      ok: true, 
      ingredient: {
        id: updated.id,
        name: updated.item,
        portionUnit: updated.portionUnit,
        portionSize: updated.portionSize ? Number(updated.portionSize) : null,
        yield: updated.yield ? Number(updated.yield) : null,
      }
    });
  } catch (e: any) {
    console.error('ingredient-master PUT error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
