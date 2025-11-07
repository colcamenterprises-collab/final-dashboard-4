import { pool } from "../db";
import fs from "fs";
import path from "path";

async function main() {
  const sqlPath = path.join(process.cwd(), "server/scripts/bootstrap_menu_online.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  
  // Execute the entire SQL file as one query (PostgreSQL supports this)
  await pool.query(sql);
  
  console.log("✅ menu_*_online tables/columns ensured.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
