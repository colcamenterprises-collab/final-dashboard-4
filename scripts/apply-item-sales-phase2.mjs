#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const root = process.cwd();
const migrations = [
  'server/migrations/202608080002_pos_costing_phase2.sql',
  'server/migrations/202608080003_historical_costing_unavailable.sql',
];

function fail(message) { throw new Error(message); }
if (!process.env.DATABASE_URL) fail('DATABASE_URL is missing');
for (const relative of migrations) if (!fs.existsSync(path.join(root, relative))) fail(`Missing migration: ${relative}`);

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
const databaseHost = databaseUrl.hostname || 'localhost';
const localDatabase = ['', 'localhost', '127.0.0.1', '::1'].includes(databaseHost);
const migrationSql = migrations.map((relative) => fs.readFileSync(path.join(root, relative), 'utf8')).join('\n\n');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runtimeIdentity() {
  const result = await pool.query(`SELECT current_user AS role, current_database() AS db`);
  return { role: String(result.rows[0].role), db: String(result.rows[0].db) };
}

function quotedIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function applyAsLocalPostgres(runtimeRole, dbName) {
  if (!localDatabase) {
    fail(`Phase 2 requires a schema-owner migration role. DATABASE_URL points to non-local host ${databaseHost}, so automatic local postgres escalation is disabled.`);
  }
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    fail('Phase 2 schema-owner fallback requires the deployment script to run as root on the local VPS.');
  }

  const role = quotedIdentifier(runtimeRole);
  const grants = `
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  pos_item_costing_config,
  pos_modifier_costing_config,
  ordering_order_item_cost_snapshots,
  ordering_modifier_cost_snapshots
TO ${role};
GRANT EXECUTE ON FUNCTION capture_order_item_cost_snapshot(UUID,TEXT) TO ${role};
GRANT EXECUTE ON FUNCTION capture_modifier_cost_snapshot(UUID,TEXT) TO ${role};
`;
  const temp = path.join(os.tmpdir(), `sbb-phase2-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(temp, `BEGIN;\n${migrationSql}\n${grants}\nCOMMIT;\n`, { mode: 0o644 });
  fs.chmodSync(temp, 0o644);
  try {
    console.log(`Runtime role lacks schema ownership; applying Phase 2 as local postgres owner for database ${dbName}.`);
    const result = spawnSync('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-d', dbName, '-f', temp], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.status !== 0) {
      if (result.stderr) process.stderr.write(result.stderr);
      fail(`Local postgres migration failed with exit code ${result.status ?? 'unknown'}`);
    }
    console.log('Schema-owner migration: PASS');
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

async function tryRuntimeMigration(identity) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const relative of migrations) {
      console.log(`Applying ${relative}`);
      await client.query(fs.readFileSync(path.join(root, relative), 'utf8'));
    }
    await client.query('COMMIT');
    console.log(`Schema migration applied directly by runtime role ${identity.role}.`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code !== '42501') throw error;
    console.log(`Runtime role ${identity.role} is intentionally not a schema owner (${error.code}); switching to migration-owner path.`);
    return false;
  } finally {
    client.release();
  }
}

async function verify() {
  const client = await pool.connect();
  try {
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [[
      'pos_item_costing_config',
      'pos_modifier_costing_config',
      'ordering_order_item_cost_snapshots',
      'ordering_modifier_cost_snapshots',
    ]]);
    if (tables.rowCount !== 4) fail(`Expected 4 Phase 2 tables; found ${tables.rowCount}`);

    const triggers = await client.query(`
      SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgname = ANY($1::text[])
      ORDER BY tgname
    `, [[
      'ordering_order_items_cost_snapshot_ai',
      'ordering_order_item_modifiers_cost_snapshot_ai',
    ]]);
    if (triggers.rowCount !== 2) fail(`Expected 2 Phase 2 triggers; found ${triggers.rowCount}`);

    const historical = await client.query(`
      SELECT COUNT(*)::int rows,
             COUNT(cost_of_goods)::int cogs_rows,
             COUNT(gross_profit)::int profit_rows,
             COUNT(margin_pct)::int margin_rows
      FROM historical_item_sales
      WHERE source='loyverse_csv'
    `);
    const h = historical.rows[0];
    if (Number(h.rows) !== 42) fail(`Expected 42 Loyverse historical rows; found ${h.rows}`);
    if (Number(h.cogs_rows) || Number(h.profit_rows) || Number(h.margin_rows)) fail('Historical cost-derived fields are not fully NULL');

    const activeItems = await client.query(`
      SELECT COUNT(*)::int total
      FROM ordering_menu_items i
      JOIN ordering_menu_categories c ON c.id=i.category_id
      WHERE i.is_active AND i.pos_enabled AND lower(c.name_en)<>lower('Phase 1 Test Menu')
    `);
    const configuredItems = await client.query(`
      SELECT COUNT(*)::int total FROM pos_item_costing_config WHERE costing_mode IN ('recipe','direct')
    `);
    const activeModifiers = await client.query(`
      SELECT COUNT(*)::int total
      FROM ordering_item_modifiers m JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
      WHERE m.is_active AND g.is_active
    `);
    const configuredModifiers = await client.query(`
      SELECT COUNT(*)::int total FROM pos_modifier_costing_config WHERE costing_mode IN ('recipe','direct')
    `);

    console.log('ITEM SALES PHASE 2 MIGRATION: PASS');
    console.log(`Active POS menu items: ${activeItems.rows[0].total}`);
    console.log(`Configured item costing: ${configuredItems.rows[0].total}`);
    console.log(`Active modifiers/options: ${activeModifiers.rows[0].total}`);
    console.log(`Configured modifier costing: ${configuredModifiers.rows[0].total}`);
    console.log('Historical COGS / Gross Profit / Margin: UNAVAILABLE (NULL)');
    console.log('Sale-time snapshot triggers: INSTALLED');
    console.log('Existing historical/live sales were NOT repriced or backfilled.');
  } finally {
    client.release();
  }
}

try {
  const identity = await runtimeIdentity();
  console.log(`Database runtime role: ${identity.role}`);
  console.log(`Database: ${identity.db}`);
  const applied = await tryRuntimeMigration(identity);
  if (!applied) applyAsLocalPostgres(identity.role, identity.db);
  await verify();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
