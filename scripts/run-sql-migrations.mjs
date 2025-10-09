import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIG_DIR = path.resolve(__dirname, '../server/migrations');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: DATABASE_URL });

const main = async () => {
  const files = fs.readdirSync(MIG_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical = chronological

  await client.connect();
  for (const f of files) {
    const fp = path.join(MIG_DIR, f);
    const sql = fs.readFileSync(fp, 'utf8');
    console.log(`>> Running ${f}`);
    await client.query(sql);
  }
  await client.end();
  console.log('All migrations applied.');
};

main().catch(async (e) => {
  console.error(e);
  try { await client.end(); } catch {}
  process.exit(1);
});
