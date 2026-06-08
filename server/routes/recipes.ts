import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Raw SQL using only confirmed DB columns (no ORM schema dependency)
router.get('/', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        id, name, description, category,
        yield_quantity AS "yieldQuantity",
        yield_unit AS "yieldUnit",
        total_cost AS "totalCost",
        cost_per_serving AS "costPerServing",
        cogs_percent AS "cogsPercent",
        suggested_price AS "suggestedPrice",
        waste_factor AS "wasteFactor",
        image_url AS "imageUrl",
        instructions, notes, is_active AS "isActive",
        version, parent_id AS "parentId",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM recipes
      WHERE is_active = true
      ORDER BY category, name
    `);
    res.json(result.rows);
  } catch (e: any) {
    res.status(200).json({ rows: [], source: 'recipes', blockers: [{ code: 'RECIPES_UNAVAILABLE', message: e.message, where: '/api/recipes', canonical_source: 'recipes', auto_build_attempted: false }] });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.execute(sql`
      SELECT
        id, name, description, category,
        yield_quantity AS "yieldQuantity",
        yield_unit AS "yieldUnit",
        total_cost AS "totalCost",
        cost_per_serving AS "costPerServing",
        cogs_percent AS "cogsPercent",
        suggested_price AS "suggestedPrice",
        waste_factor AS "wasteFactor",
        image_url AS "imageUrl",
        instructions, notes, is_active AS "isActive",
        version, parent_id AS "parentId",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM recipes
      WHERE id = ${id}
      LIMIT 1
    `);
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, description, yieldQuantity, yieldUnit, instructions, notes } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
    const result = await db.execute(sql`
      INSERT INTO recipes (name, category, description, yield_quantity, yield_unit, instructions, notes, is_active)
      VALUES (${name}, ${category}, ${description ?? null}, ${String(yieldQuantity ?? 1)}, ${yieldUnit ?? 'servings'}, ${instructions ?? null}, ${notes ?? null}, true)
      RETURNING id, name, category, is_active AS "isActive"
    `);
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body;
    const result = await db.execute(sql`
      UPDATE recipes SET
        name = COALESCE(${b.name ?? null}, name),
        description = COALESCE(${b.description ?? null}, description),
        category = COALESCE(${b.category ?? null}, category),
        instructions = COALESCE(${b.instructions ?? null}, instructions),
        notes = COALESCE(${b.notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, category, is_active AS "isActive", updated_at AS "updatedAt"
    `);
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await db.execute(sql`UPDATE recipes SET is_active = false, updated_at = NOW() WHERE id = ${id}`);
    res.json({ ok: true, archived: id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
