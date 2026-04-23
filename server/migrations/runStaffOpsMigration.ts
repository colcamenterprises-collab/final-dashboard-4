/**
 * Staff Operations Phase 1 — SQL migration runner.
 * Uses the app's existing pg Pool directly.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const sqlPath = join(__dirname, "staffOps_phase1.sql");
  const rawSql = readFileSync(sqlPath, "utf-8");

  // Split SQL into individual statements, handling $$ blocks
  const statements: string[] = [];
  let current = "";
  let inDollarBlock = false;

  for (const line of rawSql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("--")) continue;

    current += line + "\n";

    // Track $$ block entry/exit
    if (trimmed.includes("$$")) {
      inDollarBlock = !inDollarBlock;
    }

    if (!inDollarBlock && trimmed.endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());

  let ok = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      console.log("✓", stmt.split("\n")[0].slice(0, 80));
      ok++;
    } catch (err: any) {
      if (err.message.includes("already exists")) {
        console.log("↩ skip (exists):", stmt.split("\n")[0].slice(0, 80));
        ok++;
      } else {
        console.error("✗ FAILED:", stmt.split("\n")[0].slice(0, 80));
        console.error("  →", err.message);
        failed++;
      }
    }
  }

  client.release();
  await pool.end();
  console.log(`\n✅ Done: ${ok} ok, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
