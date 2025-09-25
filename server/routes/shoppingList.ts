import { Router } from 'express';
import { estimateShoppingList } from '../services/shoppingList';

const router = Router();

/**
 * GET /api/shopping-list/:id/estimate
 * Returns per-line estimate + total + missing pricing list.
 */
router.get('/:id/estimate', async (req, res) => {
  try {
    const id = req.params.id;
    console.log('Shopping list estimate request - id:', id, 'type:', typeof id);
    if (!id || id.trim() === '') return res.status(400).json({ error: 'list id required' });
    const result = await estimateShoppingList(id);
    res.json(result);
  } catch (e: any) {
    console.error('shopping-list.estimate error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;