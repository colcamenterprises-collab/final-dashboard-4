import fs from "node:fs";

function replaceRequired(path, find, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(replacement)) return;
  if (!source.includes(find)) throw new Error(`Required patch marker not found: ${path}`);
  fs.writeFileSync(path, source.replace(find, replacement));
}

const editorPath = "client/src/pages/menu/recipes/RecipeEditorPage.tsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = editor.replaceAll('form.status === "Live"', 'form.status === "Approved"');
fs.writeFileSync(editorPath, editor);

const routePath = "server/routes/recipes.ts";
const oldDelete = `router.delete('/:id', async (req, res) => {
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

const newDelete = `router.delete('/:id', async (req, res) => {
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
    const linked = await client.query(
      'SELECT "itemId" FROM menu_item_recipes_v3 WHERE recipe_id=$1 LIMIT 10',
      [id],
    ).catch(() => ({ rows: [] }));
    if (linked.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This recipe is linked to a Menu Item. Unlink it from Menu Items before deleting.',
        linkedMenuItemIds: linked.rows.map((row: any) => row.itemId),
      });
    }
    await client.query('UPDATE ordering_item_modifiers SET recipe_id=NULL WHERE recipe_id=$1', [id]).catch(() => undefined);
    await client.query('DELETE FROM recipe_lines WHERE recipe_id=$1', [id]).catch(() => undefined);
    await client.query('DELETE FROM recipes WHERE id=$1', [id]);
    await client.query('COMMIT');
    return res.json({ ok: true, deleted: id });
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});`;
replaceRequired(routePath, oldDelete, newDelete);

console.log("Recipe Management V2 finalizer applied");
