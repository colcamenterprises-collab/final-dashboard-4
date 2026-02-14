// server/routes/purchasing.ts
import { Router } from 'express';
import { z } from 'zod';
import { buildPurchasingPlan } from '../lib/purchasingPlanner';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const NeedBase = z.object({
  ingredientId: z.string().uuid(),
  requiredQtyBase: z.number().nonnegative(),
});

const NeedQty = z.object({
  ingredientId: z.string().uuid(),
  requiredQty: z.number().nonnegative(),
  requiredUnit: z.enum(['kg','g','L','ml','each']),
});

const BodySchema = z.object({
  needs: z.array(z.union([NeedBase, NeedQty])).min(1),
});


router.get('/', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const whereClause = category
      ? { category: { equals: category, mode: 'insensitive' as const }, active: true }
      : { active: true };

    const items = await prisma.purchasingItem.findMany({
      where: whereClause,
      orderBy: [{ item: 'asc' }],
      select: {
        id: true,
        item: true,
        supplierSku: true,
        category: true,
      },
    });

    const normalized = items.map((item) => ({
      id: item.id,
      sku: item.supplierSku || item.item,
      item: item.item,
      category: item.category,
    }));

    res.json({ ok: true, items: normalized });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || 'Failed to fetch purchasing items' });
  }
});

router.post('/plan', async (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const plan = await buildPurchasingPlan(parsed.data.needs);
    res.json(plan);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to build purchasing plan' });
  }
});

export default router;
