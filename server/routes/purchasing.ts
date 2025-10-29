import { Router } from 'express';
import { calculatePurchasingPlan, type IngredientNeed } from '../lib/purchasingPlanner';

const router = Router();

/**
 * POST /api/purchasing/plan
 * Calculate purchasing plan based on ingredient needs
 */
router.post('/plan', async (req, res) => {
  try {
    const { needs } = req.body as { needs: IngredientNeed[] };

    if (!needs || !Array.isArray(needs)) {
      return res.status(400).json({ error: 'Invalid request: needs array required' });
    }

    const plan = await calculatePurchasingPlan(needs);

    res.json({
      success: true,
      plan,
      totalCostTHB: plan.reduce((sum, item) => sum + item.lineCostTHB, 0),
    });
  } catch (error: any) {
    console.error('Purchasing plan error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate purchasing plan' });
  }
});

export default router;
