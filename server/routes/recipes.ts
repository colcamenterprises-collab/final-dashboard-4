import { Router } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

async function getRecipeColumns(): Promise<Set<string>> {
  if (!pool) throw new Error('Database unavailable');
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recipes'`
  );
  return new Set(result.rows.map((row: { column_name: string }) => row.column_name));
}

function recipeSelect(columns: Set<string>) {
  const has = (name: string) => columns.has(name);
  const expr = (column: string, alias: string, fallback = 'NULL') =>
    has(column) ? `${column} AS "${alias}"` : `${fallback} AS "${alias}"`;
  const priceExpr = has('selling_price')
    ? 'selling_price AS "sellingPrice"'
    : expr('menu_price_thb', 'sellingPrice');
  const suggestedExpr = has('suggested_price')
    ? 'suggested_price AS "suggestedPrice"'
    : expr('menu_price_thb', 'suggestedPrice');

  return [
    'id',
    'name',
    expr('description', 'description'),
    expr('category', 'category'),
    expr('yield_quantity', 'yieldQuantity'),
    expr('yield_unit', 'yieldUnit'),
    expr('total_cost', 'totalCost'),
    expr('cost_per_serving', 'costPerServing'),
    expr('cogs_percent', 'cogsPercent'),
    suggestedExpr,
    priceExpr,
    expr('waste_factor', 'wasteFactor'),
    expr('image_url', 'imageUrl'),
    expr('instructions', 'instructions'),
    expr('notes', 'notes'),
    expr('is_active', 'isActive', 'true'),
    expr('version', 'version'),
    expr('parent_id', 'parentId'),
    expr('created_at', 'createdAt'),
    expr('updated_at', 'updatedAt'),
  ].join(', ');
}

function recipeOrder(columns: Set<string>) {
  return columns.has('category') ? 'category NULLS LAST, name' : 'name';
}

// Raw SQL using only columns confirmed in the live recipes table.
router.get('/', async (req, res) => {
  try {

    if (!pool) throw new Error('Database unavailable');
const columns = await getRecipeColumns();
const result = await pool.query(
  `SELECT ${recipeSelect(columns)} FROM recipes ORDER BY ${recipeOrder(columns)}`
);
    res.json(result.rows);
  } catch (e: any) {
    res.status(200).json({ rows: [], source: 'recipes', blockers: [{ code: 'RECIPES_UNAVAILABLE', message: e.message, where: '/api/recipes', canonical_source: 'recipes', auto_build_attempted: false }] });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const columns = await getRecipeColumns();
    const result = await pool.query(`SELECT ${recipeSelect(columns)} FROM recipes WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, description, yieldQuantity, yieldUnit, imageUrl, totalCost, costPerServing, sellingPrice, suggestedPrice, instructions, notes, isActive } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
    const result = await db.execute(sql`
      INSERT INTO recipes (name, category, description, yield_quantity, yield_unit, image_url, total_cost, cost_per_serving, selling_price, suggested_price, instructions, notes, is_active)
      VALUES (${name}, ${category}, ${description ?? null}, ${String(yieldQuantity ?? 1)}, ${yieldUnit ?? 'servings'}, ${imageUrl ?? null}, ${totalCost ?? 0}, ${costPerServing ?? 0}, ${sellingPrice ?? null}, ${suggestedPrice ?? null}, ${instructions ?? null}, ${notes ?? null}, ${isActive === true})
      RETURNING id, name, category, selling_price AS "sellingPrice", suggested_price AS "suggestedPrice", is_active AS "isActive"
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
        yield_quantity = COALESCE(${b.yieldQuantity ?? null}, yield_quantity),
        yield_unit = COALESCE(${b.yieldUnit ?? null}, yield_unit),
        image_url = COALESCE(${b.imageUrl ?? null}, image_url),
        total_cost = COALESCE(${b.totalCost ?? null}, total_cost),
        cost_per_serving = COALESCE(${b.costPerServing ?? null}, cost_per_serving),
        selling_price = COALESCE(${b.sellingPrice ?? null}, selling_price),
        suggested_price = COALESCE(${b.suggestedPrice ?? null}, suggested_price),
        is_active = COALESCE(${typeof b.isActive === "boolean" ? b.isActive : null}, is_active),
        instructions = COALESCE(${b.instructions ?? null}, instructions),
        notes = COALESCE(${b.notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, category, selling_price AS "sellingPrice", suggested_price AS "suggestedPrice", is_active AS "isActive", updated_at AS "updatedAt"
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
