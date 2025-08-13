// scripts/lockdown.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// CHANGE THIS ONCE (use a strong secret)
const RO_USER = 'app_ro';
const RO_PASS = 'REDACTED_STRONG_PASSWORD';

async function run() {
  const [{ db }] = await prisma.$queryRawUnsafe(`SELECT current_database() AS db;`);
  console.log('Connected DB:', db);

  // step-by-step to avoid multi-statement issues
  const cmds = [
    // create role if missing
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${RO_USER}') THEN
         CREATE USER ${RO_USER} WITH PASSWORD '${RO_PASS}';
       END IF;
     END $$;`,

    // baseline RO privileges
    `GRANT CONNECT ON DATABASE "${db}" TO ${RO_USER};`,
    `GRANT USAGE ON SCHEMA public TO ${RO_USER};`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${RO_USER};`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${RO_USER};`,

    // belts & suspenders: explicitly revoke writes
    `REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM ${RO_USER};`,
    `REVOKE CREATE ON SCHEMA public FROM ${RO_USER};`,
    `GRANT USAGE ON SCHEMA public TO ${RO_USER};`
  ];

  for (const sql of cmds) {
    console.log('> ', sql.replace(/\s+/g,' ').trim().slice(0,140)+'...');
    await 
      prisma.$executeRawUnsafe(sql);
  }

  // verification
  const grants = await prisma.$queryRawUnsafe(`
    SELECT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee='${RO_USER}'
    ORDER BY table_name, privilege_type;
  `);
  console.log('Grants for', RO_USER, grants);
}
run().finally(() => prisma.$disconnect());
