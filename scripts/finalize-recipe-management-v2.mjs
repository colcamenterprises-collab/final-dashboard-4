import fs from "node:fs";

const editorPath = "client/src/pages/menu/recipes/RecipeEditorPage.tsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = editor.replaceAll('form.status === "Live"', 'form.status === "Approved"');
fs.writeFileSync(editorPath, editor);

const routePath = "server/routes/recipes.ts";
let route = fs.readFileSync(routePath, "utf8");

const safeDelete = `router.delete('/:id', async (req, res) => {
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

    const schema = await client.query(\`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name IN ('menu_item_recipes_v3','ordering_item_modifiers','recipe_lines')
    \`);
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
});`;

const deletePattern = /router\.delete\('\/:id',[\s\S]*?\n\}\);\n\nexport default router;/;
if (!deletePattern.test(route)) {
  throw new Error(`Recipe delete route marker not found: ${routePath}`);
}
route = route.replace(deletePattern, `${safeDelete}\n\nexport default router;`);
fs.writeFileSync(routePath, route);

console.log("Recipe Management V2 finalizer applied");
