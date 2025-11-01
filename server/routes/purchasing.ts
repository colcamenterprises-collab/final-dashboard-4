// server/routes/purchasing.ts
import { Router } from 'express';
import { z } from 'zod';
import { buildPurchasingPlan } from '../lib/purchasingPlanner';

const router = Router();

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
