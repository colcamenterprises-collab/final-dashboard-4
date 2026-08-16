import { Router } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { calculateRecipeWorkflow, decimalOrNull, recipeStatusFromBody } from '../services/recipes/workflow';

const router = Router();

async function refreshCatalogueCosts(ingredients: any[]): Promise<any[]> {
  // Only catalogue-linked rows are refreshed. Recipe-only/manual rows must keep
  // their special price, package and unit values exactly as entered by the operator.
  const ids = [...new Set(ingredients.filter((row) => row?.sourceType === 'purchasing').map((row) => Number(row?.purchasingItemId)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return ingredients;
  const result = await pool!.query(
    'SELECT id, item, purchase_cost_thb, purchase_quantity, base_unit FROM purchasing_items WHERE id = ANY($1::int[]) AND active = true',
    [ids],
  );
  const catalogue = new Map(result.rows.map((row: any) => [Number(row.id), row]));
  return ingredients.map((row) => {
    const item = row?.sourceType === 'purchasing' && row?.purchasingItemId ? catalogue.get(Number(row.purchasingItemId)) : null;
    if (!item) return row;
    const cost = Number(item.purchase_cost_thb);
    const quantity = Number(item.purchase_quantity);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(quantity) || quantity <= 0 || !item.base_unit) {
      return { ...row, costingStatus: 'MISSING_PURCHASING_PACK_DATA' };
    }
    return {
      ...row,
      ingredientId: null,
      name: item.item,
      purchaseCost: String(cost),
      packageQuantity: String(quantity),
      purchaseUnit: item.base_unit,
      costingStatus: 'CURRENT_PURCHASING_PRICE',
    };
  });
}

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
    expr('ingredients', 'ingredients', "'[]'::jsonb"),
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

async function enrichWithMenuLinks(rows: any[]) {
  if (!pool || !rows.length) return rows;
  try {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isInteger);
    if (!ids.length) return rows;
    const links = await pool.query(
      `SELECT l.recipe_id, i.id AS menu_item_id, i.name_en AS menu_item_name,
              COALESCE(i.direct_price, i.price) AS menu_item_direct_price,
              COALESCE(i.grab_price, i.direct_price, i.price) AS menu_item_partner_price
         FROM ordering_menu_item_recipe_links l
         JOIN ordering_menu_items i ON i.id=l.menu_item_id
        WHERE l.recipe_id = ANY($1::int[])`,
      [ids],
    );
    const byRecipe = new Map(links.rows.map((link: any) => [Number(link.recipe_id), link]));
    return rows.map((row) => {
      const link = byRecipe.get(Number(row.id));
      return link
        ? {
            ...row,
            linkedMenuItemId: String(link.menu_item_id),
            linkedMenuItemName: link.menu_item_name,
            linkedMenuItemDirectPrice: link.menu_item_direct_price,
            linkedMenuItemPartnerPrice: link.menu_item_partner_price,
          }
        : row;
    });
  } catch {
    // The recipe library remains available if an older database has not yet
    // received the additive menu-link table.
    return rows;
  }
}

router.get('/', async (_req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const columns = await getRecipeColumns();
    const result = await pool.query(
      `SELECT ${recipeSelect(columns)} FROM recipes ORDER BY ${recipeOrder(columns)}`
    );
    res.json(await enrichWithMenuLinks(result.rows));
  } catch (e: any) {
    res
      .status(200)
      .json({
        rows: [],
        source: 'recipes',
        blockers: [
          {
            code: 'RECIPES_UNAVAILABLE',
            message: e.message,
            where: '/api/recipes',
            canonical_source: 'recipes',
            auto_build_attempted: false,
          },
        ],
      });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const columns = await getRecipeColumns();
    const result = await pool.query(
      `SELECT ${recipeSelect(columns)} FROM recipes WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recipe not found' });
    res.json((await enrichWithMenuLinks(result.rows))[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!pool) throw new Error('Database unavailable');
    const columns = await getRecipeColumns();
    const {
      name,
      category,
      description,
      yieldQuantity,
      yieldUnit,
      imageUrl,
      totalCost,
      costPerServing,
      sellingPrice,
      suggestedPrice,
      instructions,
      notes,
      isActive,
      status,
      recipeIngredients,
    } = req.body;
    if (!name || !category)
      return res.status(400).json({ error: 'name and category are required' });

    const recipeStatus = recipeStatusFromBody({ status, isActive });
    const resolvedIngredients = await refreshCatalogueCosts(Array.isArray(recipeIngredients) ? recipeIngredients : []);
    const workflow = calculateRecipeWorkflow({ ingredients: resolvedIngredients, yieldQuantity, sellingPrice, suggestedPrice });

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
    add('total_cost', workflow.totalCost);
    add('cost_per_serving', workflow.costPerServing);
    add('ingredients', JSON.stringify(workflow.ingredients));
    if (columns.has('selling_price')) add('selling_price', decimalOrNull(sellingPrice));
    else add('menu_price_thb', decimalOrNull(sellingPrice));
    if (columns.has('suggested_price')) add('suggested_price', decimalOrNull(suggestedPrice));
    else if (!columns.has('selling_price')) add('menu_price_thb', decimalOrNull(suggestedPrice));
    add('delivery_partner_margin_percent', workflow.deliveryPartnerMarginPercent);
    add('direct_margin_percent', workflow.directMarginPercent);
    add('instructions', instructions ?? null);
    add('notes', notes ?? null);
    // Approval makes the recipe available for linking and costing. It does not publish a product.
    add('is_active', recipeStatus === 'Approved');

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO recipes (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING ${recipeSelect(columns)}`,
      values
    );
    res.json({ ...(result.rows[0] as any), costingBlockers: workflow.blockers });
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
    const recipeStatus = recipeStatusFromBody(b);
    const resolvedIngredients = await refreshCatalogueCosts(Array.isArray(b.recipeIngredients) ? b.recipeIngredients : []);
    const workflow = calculateRecipeWorkflow({ ingredients: resolvedIngredients, yieldQuantity: b.yieldQuantity, sellingPrice: b.sellingPrice, suggestedPrice: b.suggestedPrice });
    const values: unknown[] = [];
    const sets: string[] = [];
    const add = (column: string, value: unknown) => {
      if (!columns.has(column) || value === undefined) return;
      values.push(value);
      sets.push(`${column} = COALESCE($${values.length}, ${column})`);
    };
    const set = (column: string, value: unknown) => {
      if (!columns.has(column) || value === undefined) return;
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    add('name', b.name ?? null);
    add('description', b.description ?? null);
    add('category', b.category ?? null);
    add('yield_quantity', b.yieldQuantity ?? null);
    add('yield_unit', b.yieldUnit ?? null);
    add('image_url', b.imageUrl ?? null);
    set('total_cost', workflow.totalCost);
    set('cost_per_serving', workflow.costPerServing);
    set('ingredients', JSON.stringify(workflow.ingredients));
    if (columns.has('selling_price')) set('selling_price', decimalOrNull(b.sellingPrice));
    else set('menu_price_thb', decimalOrNull(b.sellingPrice));
    if (columns.has('suggested_price')) set('suggested_price', decimalOrNull(b.suggestedPrice));
    else if (!columns.has('selling_price')) set('menu_price_thb', decimalOrNull(b.suggestedPrice));
    set('delivery_partner_margin_percent', workflow.deliveryPartnerMarginPercent);
    set('direct_margin_percent', workflow.directMarginPercent);
    if (columns.has('is_active')) {
      values.push(recipeStatus === 'Approved');
      sets.push(`is_active = $${values.length}`);
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
    res.json({ ...(result.rows[0] as any), costingBlockers: workflow.blockers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id, name FROM recipes WHERE id=$1 FOR UPDATE', [id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const schema = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name IN ('menu_item_recipes_v3','ordering_item_modifiers','recipe_lines')
    `);
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of schema.rows) {
      const columns = columnsByTable.get(row.table_name) || new Set<string>();
      columns.add(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }

    const linkColumns = columnsByTable.get('menu_item_recipes_v3');
    if (linkColumns?.has('recipe_id')) {
      const linked = await client.query(
        'SELECT "itemId" FROM menu_item_recipes_v3 WHERE recipe_id=$1 LIMIT 10',
        [id],
      );
      if (linked.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'This recipe is linked to a Menu Item. Unlink it from Menu Items before deleting.',
          linkedMenuItemIds: linked.rows.map((row: any) => row.itemId),
        });
      }
    }

    const modifierColumns = columnsByTable.get('ordering_item_modifiers');
    if (modifierColumns?.has('recipe_id')) {
      await client.query('UPDATE ordering_item_modifiers SET recipe_id=NULL WHERE recipe_id=$1', [id]);
    }

    const recipeLineColumns = columnsByTable.get('recipe_lines');
    if (recipeLineColumns?.has('recipe_id')) {
      await client.query('DELETE FROM recipe_lines WHERE recipe_id=$1', [id]);
    }

    await client.query('DELETE FROM recipes WHERE id=$1', [id]);
    await client.query('COMMIT');
    return res.json({ ok: true, deleted: id });
  } catch (e: any) {
    try { await client.query('ROLLBACK'); } catch {}
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
