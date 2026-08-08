#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const ROOT = process.cwd();
const CSV = path.join(ROOT, 'server/data/historical-item-sales-2026-01-01-to-2026-08-07.csv');
const MIGRATION = path.join(ROOT, 'server/migrations/202608080001_historical_item_sales.sql');
const ORIGINAL_SOURCE_SHA = '0691d0062768a4fcf3b7f530905b716d0c370cf65d6e40ac1bb7268d5bb5c854';
const SOURCE = 'loyverse_csv';
const SOURCE_FILE = 'Item Sales 1st January to August 7th - 5pm to 3am.csv';
const PERIOD_START = '2026-01-01T17:00:00+07:00';
const PERIOD_END = '2026-08-08T03:00:00+07:00';

const EXPECTED = {
  rows: 42,
  itemsSold: 19377,
  grossSales: 3568703,
  itemsRefunded: 149,
  refunds: 23771,
  discounts: 18012,
  netSales: 3526909,
  costOfGoods: 489471,
  grossProfit: 3037424,
  taxes: 0,
};

function fail(message) { throw new Error(message); }
function parseNumber(value) {
  const valueAsNumber = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
}
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = lines.shift()?.split(',') ?? [];
  const expectedHeaders = ['Item name','SKU','Category','Items sold','Gross sales','Items refunded','Refunds','Discounts','Net sales','Cost of goods','Gross profit','Margin','Taxes'];
  if (headers.join('|') !== expectedHeaders.join('|')) fail(`Unexpected CSV headers: ${headers.join(', ')}`);
  return lines.filter(Boolean).map((line, index) => {
    const cells = line.split(',');
    if (cells.length !== expectedHeaders.length) fail(`CSV row ${index + 2} has ${cells.length} columns; expected ${expectedHeaders.length}`);
    return {
      itemName: cells[0], sku: cells[1], category: cells[2], itemsSold: parseNumber(cells[3]),
      grossSales: parseNumber(cells[4]), itemsRefunded: parseNumber(cells[5]), refunds: parseNumber(cells[6]),
      discounts: parseNumber(cells[7]), netSales: parseNumber(cells[8]), costOfGoods: parseNumber(cells[9]),
      grossProfit: parseNumber(cells[10]), marginPct: parseNumber(cells[11]), taxes: parseNumber(cells[12]),
    };
  });
}
function sum(rows, key) { return rows.reduce((total, row) => total + Number(row[key] || 0), 0); }

if (!process.env.DATABASE_URL) fail('DATABASE_URL is missing');
if (!fs.existsSync(CSV)) fail(`Historical CSV missing: ${CSV}`);
if (!fs.existsSync(MIGRATION)) fail(`Historical migration missing: ${MIGRATION}`);

const csvBuffer = fs.readFileSync(CSV);
const fixtureSha = crypto.createHash('sha256').update(csvBuffer).digest('hex');
const rows = parseCsv(csvBuffer.toString('utf8'));
const skus = new Set(rows.map((row) => row.sku));
if (rows.length !== EXPECTED.rows) fail(`Expected ${EXPECTED.rows} rows; received ${rows.length}`);
if (skus.size !== rows.length) fail('Historical CSV contains duplicate SKU values');

const checks = {
  itemsSold: sum(rows, 'itemsSold'), grossSales: sum(rows, 'grossSales'), itemsRefunded: sum(rows, 'itemsRefunded'),
  refunds: sum(rows, 'refunds'), discounts: sum(rows, 'discounts'), netSales: sum(rows, 'netSales'),
  costOfGoods: sum(rows, 'costOfGoods'), grossProfit: sum(rows, 'grossProfit'), taxes: sum(rows, 'taxes'),
};
for (const [key, expected] of Object.entries(EXPECTED)) {
  if (key === 'rows') continue;
  if (Math.abs(checks[key] - expected) > 0.001) fail(`${key} reconciliation failed: expected ${expected}; received ${checks[key]}`);
}
console.log(`Repository fixture SHA-256 (informational): ${fixtureSha}`);
console.log('CSV semantic reconciliation: PASS');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(fs.readFileSync(MIGRATION, 'utf8'));
  for (const row of rows) {
    await client.query(
      `INSERT INTO historical_item_sales (source,source_file,source_file_sha256,period_start,period_end,item_name,sku,category,items_sold,gross_sales,items_refunded,refunds,discounts,net_sales,cost_of_goods,gross_profit,margin_pct,taxes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (source,sku,period_start,period_end) DO UPDATE SET source_file=EXCLUDED.source_file,source_file_sha256=EXCLUDED.source_file_sha256,item_name=EXCLUDED.item_name,category=EXCLUDED.category,items_sold=EXCLUDED.items_sold,gross_sales=EXCLUDED.gross_sales,items_refunded=EXCLUDED.items_refunded,refunds=EXCLUDED.refunds,discounts=EXCLUDED.discounts,net_sales=EXCLUDED.net_sales,cost_of_goods=EXCLUDED.cost_of_goods,gross_profit=EXCLUDED.gross_profit,margin_pct=EXCLUDED.margin_pct,taxes=EXCLUDED.taxes,imported_at=NOW()`,
      [SOURCE,SOURCE_FILE,ORIGINAL_SOURCE_SHA,PERIOD_START,PERIOD_END,row.itemName,row.sku,row.category,row.itemsSold,row.grossSales,row.itemsRefunded,row.refunds,row.discounts,row.netSales,row.costOfGoods,row.grossProfit,row.marginPct,row.taxes],
    );
  }
  const result = await client.query(
    `SELECT COUNT(*)::int rows,COALESCE(SUM(items_sold),0)::numeric items_sold,COALESCE(SUM(gross_sales),0)::numeric gross_sales,COALESCE(SUM(items_refunded),0)::numeric items_refunded,COALESCE(SUM(refunds),0)::numeric refunds,COALESCE(SUM(discounts),0)::numeric discounts,COALESCE(SUM(net_sales),0)::numeric net_sales,COALESCE(SUM(cost_of_goods),0)::numeric cost_of_goods,COALESCE(SUM(gross_profit),0)::numeric gross_profit,COALESCE(SUM(taxes),0)::numeric taxes FROM historical_item_sales WHERE source=$1 AND source_file_sha256=$2`,
    [SOURCE, ORIGINAL_SOURCE_SHA],
  );
  const db = result.rows[0];
  const dbChecks = { rows:Number(db.rows),itemsSold:Number(db.items_sold),grossSales:Number(db.gross_sales),itemsRefunded:Number(db.items_refunded),refunds:Number(db.refunds),discounts:Number(db.discounts),netSales:Number(db.net_sales),costOfGoods:Number(db.cost_of_goods),grossProfit:Number(db.gross_profit),taxes:Number(db.taxes) };
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (Math.abs(dbChecks[key] - expected) > 0.001) fail(`Database ${key} reconciliation failed: expected ${expected}; received ${dbChecks[key]}`);
  }
  await client.query('COMMIT');
  console.log('HISTORICAL ITEM SALES IMPORT: PASS');
  console.log(`Rows: ${dbChecks.rows}`);
  console.log(`Items sold: ${dbChecks.itemsSold}`);
  console.log(`Gross sales: ${dbChecks.grossSales}`);
  console.log(`Refunded items: ${dbChecks.itemsRefunded}`);
  console.log(`Refunds: ${dbChecks.refunds}`);
  console.log(`Discounts: ${dbChecks.discounts}`);
  console.log(`Net sales: ${dbChecks.netSales}`);
  console.log(`COGS: ${dbChecks.costOfGoods}`);
  console.log(`Gross profit: ${dbChecks.grossProfit}`);
  console.log(`Original source SHA-256 provenance: ${ORIGINAL_SOURCE_SHA}`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
