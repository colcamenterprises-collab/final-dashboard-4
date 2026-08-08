#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const relative of migrations) {
    console.log(`Applying ${relative}`);
    await client.query(fs.readFileSync(path.join(root, relative), 'utf8'));
  }

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

  await client.query('COMMIT');
  console.log('ITEM SALES PHASE 2 MIGRATION: PASS');
  console.log(`Active POS menu items: ${activeItems.rows[0].total}`);
  console.log(`Configured item costing: ${configuredItems.rows[0].total}`);
  console.log(`Active modifiers/options: ${activeModifiers.rows[0].total}`);
  console.log(`Configured modifier costing: ${configuredModifiers.rows[0].total}`);
  console.log('Historical COGS / Gross Profit / Margin: UNAVAILABLE (NULL)');
  console.log('Sale-time snapshot triggers: INSTALLED');
  console.log('Existing historical/live sales were NOT repriced or backfilled.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
