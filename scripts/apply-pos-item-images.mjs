import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env scripts/apply-pos-item-images.mjs");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const mappings = [
  ["French Fries", "/images/menu/french-fries.webp"],
  ["Cajun Shaker Fries", "/images/menu/cajun-fries.webp"],
  ["Cheesy Bacon Fries", "/images/menu/cheesy-bacon-fries.webp"],
  ["Loaded Fries", "/images/menu/loaded-fries.webp"],
  ["Dirty Fries", "/images/menu/loaded-fries.webp"],
  ["Chicken Nuggets (6)", "/images/menu/chicken-nuggets.webp"],
  ["Coleslaw with Bacon", "/images/menu/coleslaw.webp"],
];

try {
  await pool.query("BEGIN");
  for (const [name, imageUrl] of mappings) {
    const result = await pool.query(
      `UPDATE ordering_menu_items
       SET image_url = $2, updated_at = NOW()
       WHERE lower(name_en) = lower($1)
       RETURNING name_en, image_url`,
      [name, imageUrl],
    );
    if (result.rowCount) {
      console.log(`Updated ${result.rows[0].name_en} -> ${result.rows[0].image_url}`);
    } else {
      console.log(`Skipped: menu item not found: ${name}`);
    }
  }
  await pool.query("COMMIT");
  console.log("POS item images are now linked.");
} catch (error) {
  await pool.query("ROLLBACK");
  console.error("Could not link POS item images:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
