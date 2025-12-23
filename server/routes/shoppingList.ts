import { Router } from 'express';
import { estimateShoppingList } from '../services/shoppingList';
import { db as drizzleDb } from '../db';
import { sql } from 'drizzle-orm';
// Uses canonical shopping_list and shopping_list_items tables via raw SQL

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

// Latest shopping list - uses canonical shopping_list table
router.get('/latest', async (_req, res) => {
  try {
    const result = await drizzleDb.execute(sql`
      SELECT sl.*, 
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', sli.id,
            'name', sli.ingredient_name,
            'quantity', sli.requested_qty,
            'unit', sli.requested_unit,
            'notes', sli.notes
          ))
          FROM shopping_list_items sli 
          WHERE sli.shopping_list_id = sl.id), '[]'::json
        ) as items
      FROM shopping_list sl
      ORDER BY sl.created_at DESC
      LIMIT 1
    `);

    const row = result.rows?.[0];
    if (!row) return res.json({ date: null, items: [] });

    res.json({
      date: (row as any).list_date || (row as any).created_at,
      items: (row as any).items || [],
    });
  } catch (err) {
    console.error('shopping-list.latest error', err);
    res.status(500).json({ error: 'Failed to fetch shopping list' });
  }
});

// List by date - uses canonical shopping_list table
router.get('/by-date', async (req, res) => {
  try {
    const { date } = req.query as { date?: string };
    if (!date) return res.status(400).json({ error: 'date is required' });

    const result = await drizzleDb.execute(sql`
      SELECT sl.*, 
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', sli.id,
            'name', sli.ingredient_name,
            'quantity', sli.requested_qty,
            'unit', sli.requested_unit,
            'notes', sli.notes
          ))
          FROM shopping_list_items sli 
          WHERE sli.shopping_list_id = sl.id), '[]'::json
        ) as items
      FROM shopping_list sl
      WHERE sl.list_date::date = ${date}::date
      LIMIT 1
    `);

    const row = result.rows?.[0];
    if (!row)
      return res.status(404).json({ error: 'Shopping list not found for this date' });

    res.json({
      date,
      items: (row as any).items || [],
    });
  } catch (err) {
    console.error('shopping-list.by-date error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
