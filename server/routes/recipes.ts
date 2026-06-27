import { randomUUID } from 'crypto';
import { Router } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

type ColumnSet = Set<string>;

async function getColumns(tableName: string): Promise<ColumnSet> {
  if (!pool) throw new Error('Database unavailable');
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row: { column_name: string }) => row.column_name));
}

async function hasTable(tableName: string): Promise<boolean> {
  if (!pool) throw new Error('Database unavailable');
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName]
  );
  return result.rowCount > 0;
}

async function getRecipeColumns(): Promise<ColumnSet> {
  return getColumns('recipes');
}

function recipeSelect(columns: ColumnSet) {
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
    expr('delivery_partner_margin_percent', 'deliveryPartnerMarginPercent'),
    expr('direct_margin_percent', 'directMarginPercent'),
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

function recipeOrder(columns: ColumnSet) {
  return columns.has('category') ? 'category NULLS LAST, name' : 'name';
}

function decimalOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : null;
}

function isLiveRecipe(row: any) {
  return row?.isActive !== false && !String(row?.notes ?? '').includes('Recipe status: Draft');
}

async function syncRecipeToMenu(recipeId: number) {
  if (!pool) throw new Error('Database unavailable');
  const [recipeColumns, itemColumns, linkColumns] = await Promise.all([
    getRecipeColumns(),
    getColumns('menu_items_v3'),
    getColumns('menu_item_recipes_v3'),
  ]);

  if (!(await hasTable('menu_items_v3')) || !(await hasTable('menu_item_recipes_v3'))) {
    return { ok: false, blocker: { code: 'MENU_V3_TABLES_MISSING', message: 'menu_items_v3/menu_item_recipes_v3 tables are unavailable.', where: 'syncRecipeToMenu', canonical_source: 'menu_items_v3', auto_build_attempted: false } };
  }
  if (!linkColumns.has('recipeId') && !linkColumns.has('recipe_id')) {
    return { ok: false, blocker: { code: 'MENU_RECIPE_LINK_COLUMN_MISSING', message: 'menu_item_recipes_v3 requires additive recipe_id linkage migration before recipes can sync deterministically.', where: 'syncRecipeToMenu', canonical_source: 'menu_item_recipes_v3.recipe_id', auto_build_attempted: false } };
  }

  const result = await pool.query(`SELECT ${recipeSelect(recipeColumns)} FROM recipes WHERE id = $1 LIMIT 1`, [recipeId]);
  const recipe = result.rows[0];
  if (!recipe) return { ok: false, blocker: { code: 'RECIPE_NOT_FOUND', message: `Recipe ${recipeId} not found.`, where: 'syncRecipeToMenu', canonical_source: 'recipes', auto_build_attempted: false } };

  const recipeIdColumn = linkColumns.has('recipe_id') ? 'recipe_id' : 'recipeId';
  const existingLink = await pool.query(`SELECT "itemId" FROM menu_item_recipes_v3 WHERE "${recipeIdColumn}" = $1 LIMIT 1`, [recipeId]);
  const linkedItemId = existingLink.rows[0]?.itemId;

  if (!isLiveRecipe(recipe)) {
    if (linkedItemId) await pool.query('UPDATE menu_items_v3 SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1', [linkedItemId]);
    return { ok: true, status: 'inactive' };
  }

  const price = decimalOrNull(recipe.suggestedPrice) ?? decimalOrNull(recipe.sellingPrice);
  if (price === null) {
    return { ok: false, blocker: { code: 'LIVE_RECIPE_PRICE_MISSING', message: 'Live recipe has no suggested or selling price, so no active menu item was created.', where: 'recipes.suggested_price', canonical_source: 'recipes', auto_build_attempted: false } };
  }

  let categoryId: string | null = null;
  if (recipe.category) {
    const category = await pool.query('SELECT id FROM menu_categories_v3 WHERE lower(name) = lower($1) ORDER BY "sortOrder" ASC, id ASC LIMIT 1', [recipe.category]);
    categoryId = category.rows[0]?.id ?? null;
    if (!categoryId) {
      categoryId = randomUUID();
      await pool.query('INSERT INTO menu_categories_v3 (id, name, "sortOrder", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 0, true, NOW(), NOW())', [categoryId, recipe.category]);
    }
  }
  if (!categoryId) return { ok: false, blocker: { code: 'LIVE_RECIPE_CATEGORY_MISSING', message: 'Live recipe has no category, so no active menu item was created.', where: 'recipes.category', canonical_source: 'recipes', auto_build_attempted: false } };

  if (linkedItemId) {
    await pool.query('UPDATE menu_items_v3 SET name = $2, description = $3, "categoryId" = $4, "basePrice" = $5, "imageUrl" = $6, "isActive" = true, "onlineEnabled" = true, "updatedAt" = NOW() WHERE id = $1', [linkedItemId, recipe.name, recipe.description ?? null, categoryId, Number(price), recipe.imageUrl ?? null]);
    return { ok: true, status: 'updated', menuItemId: linkedItemId };
  }

  const itemId = randomUUID();
  await pool.query('INSERT INTO menu_items_v3 (id, "categoryId", name, description, "basePrice", "imageUrl", "posEnabled", "onlineEnabled", "partnerEnabled", "kitchenStation", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, true, true, true, $7, 0, true, NOW(), NOW())', [itemId, categoryId, recipe.name, recipe.description ?? null, Number(price), recipe.imageUrl ?? null, itemColumns.has('kitchenStation') ? 'prep' : null]);
  await pool.query(`INSERT INTO menu_item_recipes_v3 (id, "itemId", "ingredientId", "quantityUsed", unit, "${recipeIdColumn}", "createdAt", "updatedAt") VALUES ($1, $2, $3, 0, $4, $5, NOW(), NOW())`, [randomUUID(), itemId, `recipe:${recipeId}`, 'recipe', recipeId]);
  return { ok: true, status: 'created', menuItemId: itemId };
}

router.get('/', async (_req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const columns = await getRecipeColumns();
    const result = await pool.query(`SELECT ${recipeSelect(columns)} FROM recipes ORDER BY ${recipeOrder(columns)}`);
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
    if (!pool) throw new Error('Database unavailable');
    const columns = await getRecipeColumns();
    const { name, category, description, yieldQuantity, yieldUnit, imageUrl, totalCost, costPerServing, sellingPrice, suggestedPrice, deliveryPartnerMarginPercent, directMarginPercent, instructions, notes, isActive } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

    const insertColumns: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      if (!columns.has(column)) return;
      insertColumns.push(column);
      values.push(value);
    };

    add('name', name);
    add('category', category);
    add('description', description ?? null);
    add('yield_quantity', String(yieldQuantity ?? 1));
    add('yield_unit', yieldUnit ?? 'servings');
    add('image_url', imageUrl ?? null);
    add('total_cost', totalCost ?? 0);
    add('cost_per_serving', costPerServing ?? 0);
    add('selling_price', sellingPrice ?? null);
    add('suggested_price', suggestedPrice ?? null);
    add('delivery_partner_margin_percent', deliveryPartnerMarginPercent ?? null);
    add('direct_margin_percent', directMarginPercent ?? null);
    add('instructions', instructions ?? null);
    add('notes', notes ?? null);
    add('is_active', isActive === true);

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO recipes (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING ${recipeSelect(columns)}`,
      values
    );
    const sync = await syncRecipeToMenu(Number((result.rows[0] as any).id));
    res.json({ ...(result.rows[0] as any), menuSync: sync });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const columns = await getRecipeColumns();
    const b = req.body;
    const values: unknown[] = [];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      if (!columns.has(column) || value === undefined) return;
      values.push(value);
      sets.push(`${column} = COALESCE($${values.length}, ${column})`);
    };

    add('name', b.name ?? null);
    add('description', b.description ?? null);
    add('category', b.category ?? null);
    add('yield_quantity', b.yieldQuantity ?? null);
    add('yield_unit', b.yieldUnit ?? null);
    add('image_url', b.imageUrl ?? null);
    add('total_cost', b.totalCost ?? null);
    add('cost_per_serving', b.costPerServing ?? null);
    add('selling_price', b.sellingPrice ?? null);
    add('suggested_price', b.suggestedPrice ?? null);
    add('delivery_partner_margin_percent', b.deliveryPartnerMarginPercent ?? null);
    add('direct_margin_percent', b.directMarginPercent ?? null);
    if (columns.has('is_active')) {
      values.push(typeof b.isActive === 'boolean' ? b.isActive : null);
      sets.push(`is_active = COALESCE($${values.length}, is_active)`);
    }
    add('instructions', b.instructions ?? null);
    add('notes', b.notes ?? null);
    if (columns.has('updated_at')) sets.push('updated_at = NOW()');

    values.push(id);
    const result = await pool.query(
      `UPDATE recipes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${recipeSelect(columns)}`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    const sync = await syncRecipeToMenu(id);
    res.json({ ...(result.rows[0] as any), menuSync: sync });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await db.execute(sql`UPDATE recipes SET is_active = false, updated_at = NOW() WHERE id = ${id}`);
    const sync = await syncRecipeToMenu(id);
    res.json({ ok: true, archived: id, menuSync: sync });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
