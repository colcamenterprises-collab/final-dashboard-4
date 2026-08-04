import { pool } from "../db";

async function main() {
  if (!pool) throw new Error("Database pool unavailable");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const categories = await client.query(
      `SELECT id, name_en FROM ordering_menu_categories
       WHERE lower(trim(name_en)) IN ('phase 1 test menu','phase 1 test','phase1 test menu')
       FOR UPDATE`,
    );

    if (!categories.rows.length) {
      await client.query("ROLLBACK");
      console.log(JSON.stringify({ ok: true, removed: false, message: "No Phase 1 test menu category found." }, null, 2));
      return;
    }

    const ids = categories.rows.map((row: any) => row.id);
    const items = await client.query(
      `DELETE FROM ordering_menu_items WHERE category_id = ANY($1::uuid[]) RETURNING id, name_en, category_id`,
      [ids],
    );
    const deletedCategories = await client.query(
      `DELETE FROM ordering_menu_categories WHERE id = ANY($1::uuid[]) RETURNING id, name_en`,
      [ids],
    );
    await client.query("COMMIT");

    console.log(JSON.stringify({
      ok: true,
      removed: true,
      categories: deletedCategories.rows,
      deletedItemCount: items.rowCount ?? items.rows.length,
      deletedItems: items.rows.map((row: any) => ({ id: row.id, name: row.name_en })),
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
});
