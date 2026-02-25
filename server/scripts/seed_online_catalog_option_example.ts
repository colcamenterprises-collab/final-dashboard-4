import { pool } from "../db";
import { ensureOnlineCatalogOptionTables } from "../services/onlineCatalogOptionsService";

async function run() {
  await ensureOnlineCatalogOptionTables();

  const itemResult = await pool.query(
    `SELECT id, name
     FROM online_catalog_items
     WHERE is_published = true
       AND source_type = 'manual'
     ORDER BY id ASC
     LIMIT 1`
  );

  if (!itemResult.rows[0]) {
    console.log("No published manual catalog item found. Skipping option group seed.");
    return;
  }

  const catalogItemId = Number(itemResult.rows[0].id);

  const groupResult = await pool.query(
    `INSERT INTO option_groups (name, min, max, required)
     VALUES ('Drink Ice Preference', 1, 1, true)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`
  );

  let groupId: number;
  if (groupResult.rows[0]) {
    groupId = Number(groupResult.rows[0].id);
  } else {
    const existing = await pool.query(`SELECT id FROM option_groups WHERE name = 'Drink Ice Preference' ORDER BY id ASC LIMIT 1`);
    groupId = Number(existing.rows[0].id);
  }

  await pool.query(
    `INSERT INTO option_items (option_group_id, name, price_delta, sort_order)
     VALUES
      ($1, 'Regular Ice', 0, 0),
      ($1, 'No Ice', 0, 1)
     ON CONFLICT (option_group_id, name) DO NOTHING`,
    [groupId]
  );

  await pool.query(
    `INSERT INTO catalog_item_option_groups (catalog_item_id, option_group_id, sort_order)
     VALUES ($1, $2, 0)
     ON CONFLICT (catalog_item_id, option_group_id) DO NOTHING`,
    [catalogItemId, groupId]
  );

  console.log(`Seeded option group ${groupId} for catalog item ${catalogItemId}.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
