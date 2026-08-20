import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Client } from "pg";
import type { ResolvedReportingRange } from "./unifiedLedger";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for the isolated reporting SQL suite");
}

const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(parsedTestDatabaseUrl.hostname) || parsedTestDatabaseUrl.pathname !== "/sbb_reporting_test") {
  throw new Error("Refusing reporting SQL tests: TEST_DATABASE_URL must target local database sbb_reporting_test");
}

// Production modules read DATABASE_URL during import. Only the validated local,
// dedicated test URL is exposed to them; any ambient DATABASE_URL is ignored.
process.env.DATABASE_URL = testDatabaseUrl;

const admin = new Client({ connectionString: testDatabaseUrl });
let reporting: typeof import("./unifiedLedger");
let breakdowns: typeof import("./unifiedOverviewBreakdowns");
let applicationPool: NonNullable<typeof import("../db")["pool"]>;
let adminConnected = false;

const cutoverRange: ResolvedReportingRange = {
  fromDate: "2026-08-08",
  fromTime: "00:00",
  toDate: "2026-08-10",
  toTime: "00:00",
  timezone: "Asia/Bangkok",
  fromInstant: "2026-08-07T17:00:00.000Z",
  toInstant: "2026-08-09T17:00:00.000Z",
};

const halfOpenRange: ResolvedReportingRange = {
  fromDate: "2026-08-10",
  fromTime: "17:00",
  toDate: "2026-08-10",
  toTime: "18:00",
  timezone: "Asia/Bangkok",
  fromInstant: "2026-08-10T10:00:00.000Z",
  toInstant: "2026-08-10T11:00:00.000Z",
};

async function createDisposableSchema() {
  await admin.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;

    CREATE TABLE reporting_import_batches (
      id text PRIMARY KEY,
      validation_status text NOT NULL
    );
    CREATE TABLE reporting_historical_transactions (
      id text PRIMARY KEY,
      source_import_batch_id text NOT NULL,
      venue_key text NOT NULL,
      occurred_at timestamptz NOT NULL,
      source_receipt_number text,
      channel text,
      order_mode text,
      payment_status text,
      subtotal numeric,
      discount_total numeric,
      refund_total numeric,
      net_sales numeric,
      total numeric,
      staff_name text
    );
    CREATE TABLE reporting_historical_payments (
      id text PRIMARY KEY,
      transaction_id text NOT NULL,
      payment_method text,
      paid_at timestamptz
    );
    CREATE TABLE reporting_historical_transaction_items (
      id text PRIMARY KEY,
      transaction_id text NOT NULL,
      item_name text,
      sku text,
      category text,
      quantity numeric,
      gross_sales numeric,
      discount_total numeric,
      refund_total numeric,
      net_sales numeric,
      cost_of_goods numeric,
      gross_profit numeric
    );
    CREATE TABLE ordering_orders (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL,
      ticket_number text,
      order_number integer,
      channel text,
      order_mode text,
      subtotal numeric,
      discount_amount numeric,
      total numeric,
      payment_method text,
      payment_status text,
      status text
    );
    CREATE TABLE ordering_menu_categories (id text PRIMARY KEY, name_en text);
    CREATE TABLE ordering_menu_items (id text PRIMARY KEY, category_id text);
    CREATE TABLE ordering_order_items (
      id text PRIMARY KEY,
      order_id text NOT NULL,
      menu_item_id text,
      source_sku text,
      item_name_en text,
      quantity numeric,
      line_total numeric,
      is_set_component boolean
    );
    CREATE TABLE ordering_menu_item_recipe_links (menu_item_id text, recipe_id integer);
    CREATE TABLE pos_item_costing_config (
      menu_item_id text,
      costing_mode text,
      direct_unit_cost numeric,
      recipe_id integer
    );
    CREATE TABLE recipes (id integer PRIMARY KEY, cost_per_serving numeric);
  `);
}

async function insertTransactionPair(id: string, occurredAt: string) {
  await admin.query(
    `INSERT INTO reporting_historical_transactions
       (id,source_import_batch_id,venue_key,occurred_at,source_receipt_number,channel,order_mode,payment_status,subtotal,discount_total,refund_total,net_sales,total,staff_name)
     VALUES ($1,'batch','sbb-rawai',$2,$3,'Direct','Dine in','paid',100,0,0,100,100,'Fixture')`,
    [`h-${id}`, occurredAt, `logical-${id}`],
  );
  await admin.query(
    `INSERT INTO reporting_historical_payments (id,transaction_id,payment_method,paid_at)
     VALUES ($1,$2,'Cash',$3)`,
    [`hp-${id}`, `h-${id}`, occurredAt],
  );
  await admin.query(
    `INSERT INTO reporting_historical_transaction_items
       (id,transaction_id,item_name,sku,category,quantity,gross_sales,discount_total,refund_total,net_sales,cost_of_goods,gross_profit)
     VALUES ($1,$2,$3,$4,'Burgers',1,100,0,0,100,40,60)`,
    [`hi-${id}`, `h-${id}`, `Item ${id}`, `sku-${id}`],
  );
  await admin.query(
    `INSERT INTO ordering_orders
       (id,created_at,ticket_number,order_number,channel,order_mode,subtotal,discount_amount,total,payment_method,payment_status,status)
     VALUES ($1,$2,$3,1,'Direct','Dine in',100,0,100,'Cash','paid','completed')`,
    [`o-${id}`, occurredAt, `logical-${id}`],
  );
  await admin.query(
    `INSERT INTO ordering_order_items
       (id,order_id,source_sku,item_name_en,quantity,line_total,is_set_component)
     VALUES ($1,$2,$3,$4,1,100,false)`,
    [`oi-${id}`, `o-${id}`, `sku-${id}`, `Item ${id}`],
  );
}

async function assertAllProductionPaths(range: ResolvedReportingRange, expectedIds: string[]) {
  const [overview, receipts, items, overviewBreakdowns] = await Promise.all([
    reporting.queryUnifiedOverview(range),
    reporting.queryUnifiedReceipts(range),
    reporting.queryUnifiedItemSales(range),
    breakdowns.queryUnifiedOverviewBreakdowns(range),
  ]);
  const receiptIds = receipts.map(row => String(row.receipt_number)).sort();
  const itemIds = items.map(row => String(row.item_key).replace("sku-", "logical-")).sort();

  assert.deepEqual(receiptIds, expectedIds);
  assert.deepEqual(itemIds, expectedIds);
  assert.equal(overview.receiptCount, expectedIds.length);
  assert.equal(overview.historicalReceipts + overview.liveReceipts, expectedIds.length);
  assert.equal(overviewBreakdowns.daily.reduce((sum, row) => sum + row.orders, 0), expectedIds.length);
  assert.equal(overviewBreakdowns.hourlyItems.reduce((sum, row) => sum + row.quantity, 0), expectedIds.length);

  return { overview, receipts, items };
}

before(async () => {
  await admin.connect();
  adminConnected = true;
  await createDisposableSchema();
  await admin.query("INSERT INTO reporting_import_batches (id,validation_status) VALUES ('batch','validated')");

  await insertTransactionPair("before", "2026-08-08T19:59:59.999Z");
  await insertTransactionPair("at", "2026-08-08T20:00:00.000Z");
  await insertTransactionPair("after", "2026-08-08T20:00:00.001Z");

  for (const [id, occurredAt] of [
    ["range-before", "2026-08-10T09:59:59.999Z"],
    ["range-from", "2026-08-10T10:00:00.000Z"],
    ["range-inside", "2026-08-10T10:30:00.000Z"],
    ["range-before-to", "2026-08-10T10:59:59.999Z"],
    ["range-to", "2026-08-10T11:00:00.000Z"],
    ["range-after", "2026-08-10T11:00:00.001Z"],
  ] as const) {
    await insertTransactionPair(id, occurredAt);
  }

  reporting = await import("./unifiedLedger");
  breakdowns = await import("./unifiedOverviewBreakdowns");
  ({ pool: applicationPool } = await import("../db") as { pool: NonNullable<typeof applicationPool> });
});

after(async () => {
  await applicationPool?.end();
  if (adminConnected) {
    await admin.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.end();
  }
});

test("production reporting SQL applies exclusive ownership before, at, and after cutover", async () => {
  const { overview, receipts, items } = await assertAllProductionPaths(
    cutoverRange,
    ["logical-after", "logical-at", "logical-before"],
  );

  assert.equal(overview.historicalReceipts, 1);
  assert.equal(overview.liveReceipts, 2);
  assert.deepEqual(receipts.map(row => `${row.receipt_number}:${row.source_system}`).sort(), [
    "logical-after:sbb_pos",
    "logical-at:sbb_pos",
    "logical-before:loyverse",
  ]);
  assert.deepEqual(
    Object.fromEntries(items.map(row => [row.item_key, row.sources])),
    {
      "sku-before": ["loyverse"],
      "sku-at": ["sbb_pos"],
      "sku-after": ["sbb_pos"],
    },
  );
});

test("production reporting SQL applies half-open range membership at both boundaries", async () => {
  const { overview } = await assertAllProductionPaths(halfOpenRange, [
    "logical-range-before-to",
    "logical-range-from",
    "logical-range-inside",
  ]);

  assert.equal(overview.historicalReceipts, 0);
  assert.equal(overview.liveReceipts, 3);
});
