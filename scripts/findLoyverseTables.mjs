// scripts/findLoyverseTables.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const like = (s) => `%${s}%`;

async function main() {
  // 1) List candidate tables
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_type='BASE TABLE'
      AND (
        table_name ILIKE ${like('loyv')}
        OR table_name ILIKE ${like('loyverse')}
        OR table_name ILIKE ${like('receipt')}
        OR table_name ILIKE ${like('shift')}
      )
    ORDER BY table_name;
  `;
  console.log('\n=== Candidate Tables ===');
  console.table(tables);

  // 2) Show columns for each candidate
  for (const { table_name } of tables) {
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${table_name}
      ORDER BY ordinal_position;
    `;
    console.log(`\n--- ${table_name} columns ---`);
    console.table(cols);

    // 3) Preview a few rows (best effort)
    // Try to sort by created_at if present, else just limit
    const hasCreatedAt = cols.some(c => c.column_name === 'created_at');
    const sql = hasCreatedAt
      ? `SELECT * FROM ${table_name} ORDER BY created_at DESC LIMIT 3`
      : `SELECT * FROM ${table_name} LIMIT 3`;
    try {
      const sample = await prisma.$queryRawUnsafe(sql);
      console.log(`Sample (${table_name}):`);
      console.dir(sample, { depth: null });
    } catch (e) {
      console.log(`(Could not preview ${table_name}: ${e.message})`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
