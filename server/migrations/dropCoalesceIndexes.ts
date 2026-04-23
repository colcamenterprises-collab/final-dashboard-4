/**
 * Infrastructure fix — Path A
 * Drops the two COALESCE-based functional indexes that block drizzle-kit's
 * schema pull phase. Run this ONCE before running npm run db:push.
 * drizzle-kit will recreate them from the updated shared/schema.ts definitions.
 */
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const drops = [
  `DROP INDEX IF EXISTS purchasing_items_item_supplier_brand_idx`,
  `DROP INDEX IF EXISTS receipt_truth_daily_usage_unique_row_idx`,
];

for (const stmt of drops) {
  await client.query(stmt);
  console.log("✓ Dropped:", stmt);
}

client.release();
await pool.end();
console.log("\n✅ Ready for npm run db:push");
