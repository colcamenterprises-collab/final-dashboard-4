import fs from "node:fs";

const routePath = "server/routes/recipes.ts";
const listPath = "client/src/pages/menu/recipes/RecipeListPage.tsx";

const oldRoute = `router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await db.execute(
      sql\`UPDATE recipes SET is_active = false, updated_at = NOW() WHERE id = \${id}\`
    );
    const sync = await syncRecipeToMenu(id);
    res.json({ ok: true, archived: id, menuSync: sync });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});`;

const newRoute = `router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!pool) return res.status(500).json({ error: 'Database unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const recipe = await client.query('SELECT id, name FROM recipes WHERE id = $1 FOR UPDATE', [id]);
    if (!recipe.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Keep published menu items intact, but remove their recipe relationship.
    if (await hasTable('menu_item_recipes_v3')) {
      const linkColumns = await getColumns('menu_item_recipes_v3');
      if (linkColumns.has('recipe_id')) {
        await client.query('DELETE FROM menu_item_recipes_v3 WHERE recipe_id = $1', [id]);
      } else if (linkColumns.has('recipeId')) {
        await client.query('DELETE FROM menu_item_recipes_v3 WHERE "recipeId" = $1', [id]);
      }
    }

    // Remove recipe ingredient rows where the legacy table exists.
    if (await hasTable('recipe_lines')) {
      const lineColumns = await getColumns('recipe_lines');
      if (lineColumns.has('recipe_id')) {
        await client.query('DELETE FROM recipe_lines WHERE recipe_id = $1', [id]);
      } else if (lineColumns.has('recipeId')) {
        await client.query('DELETE FROM recipe_lines WHERE "recipeId" = $1', [id]);
      }
    }

    // Modifier options may optionally use a recipe for costing. Deleting the recipe must not delete the option.
    if (await hasTable('ordering_item_modifiers')) {
      const modifierColumns = await getColumns('ordering_item_modifiers');
      if (modifierColumns.has('costing_recipe_id')) {
        await client.query('UPDATE ordering_item_modifiers SET costing_recipe_id = NULL WHERE costing_recipe_id = $1', [id]);
      }
    }

    await client.query('DELETE FROM recipes WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true, deleted: id, name: recipe.rows[0].name });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});`;

let route = fs.readFileSync(routePath, "utf8");
if (route.includes(oldRoute)) {
  route = route.replace(oldRoute, newRoute);
  fs.writeFileSync(routePath, route);
} else if (!route.includes("res.json({ ok: true, deleted: id")) {
  throw new Error("Recipe delete route did not match expected source");
}

let list = fs.readFileSync(listPath, "utf8");
list = list
  .replace(/archiveMutation/g, "deleteMutation")
  .replace('Archive recipe "${recipe.name}"?', 'Permanently delete recipe "${recipe.name}"? This cannot be undone.')
  .replace('title="Delete"', 'title="Permanently delete"');
fs.writeFileSync(listPath, list);

console.log("Permanent recipe deletion patch applied");
