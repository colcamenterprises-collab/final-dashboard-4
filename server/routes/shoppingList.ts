import { Router } from 'express';
import { estimateShoppingList } from '../services/shoppingList';
import { db as drizzleDb } from '../db';
import { sql } from 'drizzle-orm';
import { shoppingListV2 } from '../../shared/schema';

const router = Router();

// KEEP EXISTING ESTIMATE ROUTE
router.get('/:id/estimate', async (req, res) => {
  try {
    const { id } = req.params;
    const estimate = await estimateShoppingList(Number(id));
    res.json({ data: estimate });
  } catch (error: any) {
    console.error('shopping-list.estimate error', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: Latest shopping list
router.get('/latest', async (_req, res) => {
  try {
    const [row] = await drizzleDb
      .select()
      .from(shoppingListV2)
      .orderBy(sql`"created_at" DESC`)
      .limit(1);

    if (!row) return res.json({ date: null, items: [] });

    res.json({
      date: (row as any).shiftDate,
      items: (row as any).itemsJson || [],
    });
  } catch (err) {
    console.error('shopping-list.latest error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: List by date
router.get('/by-date', async (req, res) => {
  try {
    const { date } = req.query as { date?: string };
    if (!date) return res.status(400).json({ error: 'date is required' });

    const [row] = await drizzleDb
      .select()
      .from(shoppingListV2)
      .where(sql`"shiftDate" = ${date}`)
      .limit(1);

    if (!row)
      return res.status(404).json({ error: 'Shopping list not found for this date' });

    res.json({
      date,
      items: (row as any).itemsJson || [],
    });
  } catch (err) {
    console.error('shopping-list.by-date error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
