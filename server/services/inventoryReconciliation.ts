import { pool } from '../db';
import { shiftWindow } from './time/shiftWindow.js';

export type ReconciliationStatus = 'OK' | 'FLAG' | 'Missing Data';

type Blocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: false;
};

type SourceValue = {
  value: number | null;
  source: string;
  blockers: Blocker[];
};

export type InventoryReconciliationRow = {
  item: string;
  previous: number | null;
  purchased: number | null;
  used: number | null;
  expected: number | null;
  actual: number | null;
  variance: number | null;
  status: ReconciliationStatus;
  blockers: Blocker[];
};

export type InventoryReconciliationReport = {
  ok: true;
  source: string[];
  missingSources: string[];
  scope: { date: string };
  status: 'complete' | 'partial';
  data: InventoryReconciliationRow[];
  warnings: string[];
  blockers: Blocker[];
  last_updated: string;
};

type InventoryItemConfig = {
  label: string;
  previous: (date: string) => Promise<SourceValue>;
  purchased: (date: string) => Promise<SourceValue>;
  used: (date: string) => Promise<SourceValue>;
  actual: (date: string) => Promise<SourceValue>;
};

const SOURCES = {
  dailySalesV2: 'Daily Sales & Stock V2',
  purchaseTally: 'purchase_tally',
  purchaseTallyDrinks: 'purchase_tally + purchase_tally_drink',
  posReceipts: 'lv_receipt + lv_line_item',
  recipeMapping: 'recipe mapping',
};

const DAILY_SALES_DATE_EXPR = `COALESCE(
  NULLIF("shiftDate", '')::date,
  shift_date,
  "createdAt"::date
)`;

const DAILY_SALES_CURRENT_WHERE = `${DAILY_SALES_DATE_EXPR} = $1::date`;
const DAILY_SALES_PREVIOUS_WHERE = `${DAILY_SALES_DATE_EXPR} < $1::date`;
const DAILY_SALES_ORDER = `${DAILY_SALES_DATE_EXPR} DESC, "createdAt" DESC`;

const POS_USAGE_ITEM_RULES: Record<string, { rolls: number; meatGrams: number }> = {
  'single burger': { rolls: 1, meatGrams: 90 },
  'single smash burger': { rolls: 1, meatGrams: 90 },
  'double burger': { rolls: 1, meatGrams: 180 },
  'ultimate double': { rolls: 1, meatGrams: 180 },
  'triple burger': { rolls: 1, meatGrams: 270 },
  'super double bacon and cheese': { rolls: 1, meatGrams: 180 },
  'super double bacon and cheese set': { rolls: 1, meatGrams: 180 },
  'single set': { rolls: 1, meatGrams: 90 },
  'single meal set': { rolls: 1, meatGrams: 90 },
  'double set': { rolls: 1, meatGrams: 180 },
  'double meal set': { rolls: 1, meatGrams: 180 },
  'triple set': { rolls: 1, meatGrams: 270 },
  'triple meal set': { rolls: 1, meatGrams: 270 },
};

const TRACKED_DRINK_NAMES = new Set([
  'bottled water',
  'bottle water',
  'coke',
  'coke can',
  'coke zero',
  'fanta orange',
  'fanta strawberry',
  'kids juice apple',
  'kids juice orange',
  'schweppes manow',
  'schweppes manao',
  'schweppes lime',
  'soda water',
  'sprite',
]);

function blocker(code: string, message: string, where: string, canonical_source: string): Blocker {
  return { code, message, where, canonical_source, auto_build_attempted: false };
}

function numeric(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sourceValue(value: unknown, source: string, where: string, label: string): SourceValue {
  const parsed = numeric(value);
  return {
    value: parsed,
    source,
    blockers: parsed === null ? [blocker('MISSING_SOURCE_VALUE', `${label} is unavailable.`, where, source)] : [],
  };
}

async function currentPayloadValue(date: string, paths: string[][], where: string, label: string): Promise<SourceValue> {
  const textExpressions = paths.map((path) => `payload${path.slice(0, -1).map((part) => `->'${part}'`).join('')}->>'${path[path.length - 1]}'`);
  const res = await pool.query(
    `SELECT ${textExpressions.map((expr, index) => `${expr} AS v${index}`).join(', ')}
     FROM daily_sales_v2
     WHERE ${DAILY_SALES_CURRENT_WHERE}
       AND "deletedAt" IS NULL
     ORDER BY ${DAILY_SALES_ORDER}
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  const found = paths.map((_, index) => row[`v${index}`]).find((value) => numeric(value) !== null);
  return sourceValue(found, SOURCES.dailySalesV2, where, label);
}

async function previousPayloadValue(date: string, paths: string[][], where: string, label: string): Promise<SourceValue> {
  const textExpressions = paths.map((path) => `payload${path.slice(0, -1).map((part) => `->'${part}'`).join('')}->>'${path[path.length - 1]}'`);
  const nonNull = textExpressions.map((expr) => `${expr} IS NOT NULL`).join(' OR ');
  const res = await pool.query(
    `SELECT ${textExpressions.map((expr, index) => `${expr} AS v${index}`).join(', ')}
     FROM daily_sales_v2
     WHERE ${DAILY_SALES_PREVIOUS_WHERE}
       AND "deletedAt" IS NULL
       AND (${nonNull})
     ORDER BY ${DAILY_SALES_ORDER}
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  const found = paths.map((_, index) => row[`v${index}`]).find((value) => numeric(value) !== null);
  return sourceValue(found, SOURCES.dailySalesV2, where, label);
}

async function currentPayloadJsonObjectSum(date: string, paths: string[][], where: string, label: string): Promise<SourceValue> {
  const textExpressions = paths.map((path) => `payload${path.map((part) => `->'${part}'`).join('')}`);
  const res = await pool.query(
    `SELECT ${textExpressions.map((expr, index) => `${expr} AS v${index}`).join(', ')}
     FROM daily_sales_v2
     WHERE ${DAILY_SALES_CURRENT_WHERE}
       AND "deletedAt" IS NULL
     ORDER BY ${DAILY_SALES_ORDER}
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  for (const [index] of paths.entries()) {
    const value = row[`v${index}`];
    if (Array.isArray(value)) {
      const total = value.reduce((sum, current) => sum + (numeric(current?.quantity ?? current?.qty ?? current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
    if (value && typeof value === 'object') {
      const total = Object.values(value).reduce((sum, current: any) => sum + (numeric(current?.quantity ?? current?.qty ?? current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
  }
  return sourceValue(null, SOURCES.dailySalesV2, where, label);
}

async function previousPayloadJsonObjectSum(date: string, paths: string[][], where: string, label: string): Promise<SourceValue> {
  const textExpressions = paths.map((path) => `payload${path.map((part) => `->'${part}'`).join('')}`);
  const hasObject = textExpressions.map((expr) => `jsonb_typeof(${expr}) IN ('object', 'array')`).join(' OR ');
  const res = await pool.query(
    `SELECT ${textExpressions.map((expr, index) => `${expr} AS v${index}`).join(', ')}
     FROM daily_sales_v2
     WHERE ${DAILY_SALES_PREVIOUS_WHERE}
       AND "deletedAt" IS NULL
       AND (${hasObject})
     ORDER BY ${DAILY_SALES_ORDER}
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  for (const [index] of paths.entries()) {
    const value = row[`v${index}`];
    if (Array.isArray(value)) {
      const total = value.reduce((sum, current) => sum + (numeric(current?.quantity ?? current?.qty ?? current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
    if (value && typeof value === 'object') {
      const total = Object.values(value).reduce((sum, current: any) => sum + (numeric(current?.quantity ?? current?.qty ?? current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
  }
  return sourceValue(null, SOURCES.dailySalesV2, where, label);
}

async function purchaseTallySum(date: string, column: string, label: string): Promise<SourceValue> {
  const res = await pool.query(`SELECT COALESCE(SUM(${column}), 0) AS total, COUNT(*)::int AS row_count FROM purchase_tally WHERE date = $1`, [date]);
  return Number(res.rows[0]?.row_count ?? 0) > 0
    ? sourceValue(res.rows[0]?.total, SOURCES.purchaseTally, `purchase_tally.${column}`, label)
    : sourceValue(null, SOURCES.purchaseTally, `purchase_tally.${column}`, label);
}

function normalizePosItemName(name: unknown): string {
  return String(name ?? '')
    .replace(/\([^)]*\)/g, '')
    .replace(/&/g, 'and')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function receiptLineItemsForShift(date: string): Promise<Array<{ name: string; qty: number }>> {
  const { fromISO, toISO } = shiftWindow(date);
  const res = await pool.query(
    `SELECT li.name, SUM(li.qty)::numeric AS qty
     FROM lv_line_item li
     JOIN lv_receipt r ON r.receipt_id = li.receipt_id
     WHERE r.datetime_bkk >= $1::timestamptz
       AND r.datetime_bkk < $2::timestamptz
       AND COALESCE(r.raw_json->>'receipt_type', '') <> 'REFUND'
     GROUP BY li.name`,
    [fromISO, toISO],
  );
  return res.rows.map((row) => ({ name: String(row.name ?? ''), qty: numeric(row.qty) ?? 0 }));
}

async function mappedReceiptUsage(date: string, usage: 'rolls' | 'meat' | 'drinks'): Promise<SourceValue> {
  const rows = await receiptLineItemsForShift(date);
  let total = 0;

  for (const row of rows) {
    const normalizedName = normalizePosItemName(row.name);
    const qty = row.qty;
    const burgerRule = POS_USAGE_ITEM_RULES[normalizedName];

    if (usage === 'rolls' && burgerRule) total += qty * burgerRule.rolls;
    if (usage === 'meat' && burgerRule) total += qty * burgerRule.meatGrams;
    if (usage === 'drinks' && TRACKED_DRINK_NAMES.has(normalizedName)) total += qty;
  }

  if (rows.length === 0) {
    return sourceValue(null, SOURCES.posReceipts, 'lv_receipt/lv_line_item shift window', usage === 'rolls' ? 'Rolls used' : usage === 'meat' ? 'Meat used' : 'Drinks used');
  }

  return sourceValue(
    total,
    SOURCES.posReceipts,
    usage === 'rolls'
      ? 'lv_line_item.name hard-coded burger/set mapping'
      : usage === 'meat'
        ? 'lv_line_item.name hard-coded 90g patty mapping'
        : 'lv_line_item.name hard-coded tracked drinks mapping',
    usage === 'rolls' ? 'Rolls used' : usage === 'meat' ? 'Meat used' : 'Drinks used',
  );
}

function missingRecipeMappedUsage(item: string): () => Promise<SourceValue> {
  return async () => ({
    value: null,
    source: SOURCES.recipeMapping,
    blockers: [blocker('RECIPE_MAPPING_REQUIRED', `${item} requires recipe mapping before usage can be reconciled.`, 'recipe mapping for POS sold items', SOURCES.recipeMapping)],
  });
}

const itemConfigs: InventoryItemConfig[] = [
  {
    label: 'Burger Buns / Rolls',
    previous: (date) => previousPayloadValue(date, [['rollsEnd'], ['burgerBunsStock']], 'previous completed Daily Sales & Stock V2 closing rolls', 'Previous rolls'),
    purchased: (date) => currentPayloadValue(date, [['shiftPurchases', 'rollsPcs'], ['rollsOrderedCount']], 'current Daily Sales & Stock V2 purchases rolls', 'Purchased rolls'),
    used: (date) => mappedReceiptUsage(date, 'rolls'),
    actual: (date) => currentPayloadValue(date, [['rollsEnd'], ['burgerBunsStock']], 'current Daily Sales & Stock V2 closing rolls', 'Actual rolls'),
  },
  {
    label: 'Meat',
    previous: (date) => previousPayloadValue(date, [['meatEndGrams'], ['meatWeightG'], ['meatEnd']], 'previous completed Daily Sales & Stock V2 closing meat grams', 'Previous meat'),
    purchased: (date) => currentPayloadValue(date, [['shiftPurchases', 'meatGrams'] ], 'current Daily Sales & Stock V2 purchases meat grams', 'Purchased meat'),
    used: (date) => mappedReceiptUsage(date, 'meat'),
    actual: (date) => currentPayloadValue(date, [['meatEndGrams'], ['meatWeightG'], ['meatEnd']], 'current Daily Sales & Stock V2 closing meat grams', 'Actual meat'),
  },
  {
    label: 'Drinks',
    previous: (date) => previousPayloadValue(date, [['drinksTotal'], ['drinkStockTotal']], 'previous completed Daily Sales & Stock V2 closing drinks total', 'Previous drinks').then((value) => value.value === null ? previousPayloadJsonObjectSum(date, [['drinkStock'], ['drinksJson']], 'previous completed Daily Sales & Stock V2 closing drinks object', 'Previous drinks') : value),
    purchased: (date) => pool.query(
      `SELECT COALESCE(SUM(ptd.qty), 0) AS total, COUNT(*)::int AS row_count
       FROM purchase_tally pt
       JOIN purchase_tally_drink ptd ON ptd.tally_id = pt.id
       WHERE pt.date = $1`,
      [date],
    ).then((res) => Number(res.rows[0]?.row_count ?? 0) > 0
      ? sourceValue(res.rows[0]?.total, SOURCES.purchaseTallyDrinks, 'purchase_tally_drink.qty', 'Purchased drinks')
      : sourceValue(null, SOURCES.purchaseTallyDrinks, 'purchase_tally_drink.qty', 'Purchased drinks')),
    used: (date) => mappedReceiptUsage(date, 'drinks'),
    actual: (date) => currentPayloadValue(date, [['drinksTotal'], ['drinkStockTotal']], 'current Daily Sales & Stock V2 closing drinks total', 'Actual drinks').then((value) => value.value === null ? currentPayloadJsonObjectSum(date, [['drinkStock'], ['drinksJson']], 'current Daily Sales & Stock V2 closing drinks object', 'Actual drinks') : value),
  },
  {
    label: 'French Fries',
    previous: (date) => previousPayloadValue(date, [['friesEndGrams'], ['friesEnd']], 'previous completed Daily Sales & Stock V2 closing fries grams', 'Previous fries'),
    purchased: (date) => purchaseTallySum(date, 'fries_grams', 'Purchased fries'),
    used: missingRecipeMappedUsage('French Fries'),
    actual: (date) => currentPayloadValue(date, [['friesEndGrams'], ['friesEnd']], 'current Daily Sales & Stock V2 closing fries grams', 'Actual fries'),
  },
  {
    label: 'Sweet Potato Fries',
    previous: (date) => previousPayloadValue(date, [['sweetPotatoEndGrams'], ['sweetPotatoEnd']], 'previous completed Daily Sales & Stock V2 closing sweet potato fries grams', 'Previous sweet potato fries'),
    purchased: (date) => purchaseTallySum(date, 'sweet_potato_grams', 'Purchased sweet potato fries'),
    used: missingRecipeMappedUsage('Sweet Potato Fries'),
    actual: (date) => currentPayloadValue(date, [['sweetPotatoEndGrams'], ['sweetPotatoEnd']], 'current Daily Sales & Stock V2 closing sweet potato fries grams', 'Actual sweet potato fries'),
  },
  {
    label: 'Bacon',
    previous: (date) => previousPayloadValue(date, [['baconEnd']], 'previous completed Daily Sales & Stock V2 closing bacon', 'Previous bacon'),
    purchased: (date) => currentPayloadValue(date, [['shiftPurchases', 'bacon']], 'current Daily Sales & Stock V2 purchases bacon', 'Purchased bacon'),
    used: missingRecipeMappedUsage('Bacon'),
    actual: (date) => currentPayloadValue(date, [['baconEnd']], 'current Daily Sales & Stock V2 closing bacon', 'Actual bacon'),
  },
];

async function safeRead(read: (date: string) => Promise<SourceValue>, date: string, where: string, label: string): Promise<SourceValue> {
  try {
    return await read(date);
  } catch (error: any) {
    return {
      value: null,
      source: 'inventory reconciliation source',
      blockers: [blocker('SOURCE_READ_FAILED', `${label} could not be read: ${error?.message || String(error)}`, where, 'inventory reconciliation source')],
    };
  }
}

async function buildItemRow(config: InventoryItemConfig, date: string): Promise<InventoryReconciliationRow> {
  const [previous, purchased, used, actual] = await Promise.all([
    safeRead(config.previous, date, config.label, 'Previous'),
    safeRead(config.purchased, date, config.label, 'Purchased'),
    safeRead(config.used, date, config.label, 'Used'),
    safeRead(config.actual, date, config.label, 'Actual'),
  ]);
  const blockers = [...previous.blockers, ...purchased.blockers, ...used.blockers, ...actual.blockers];
  const complete = blockers.length === 0;
  const expected = complete ? Number(previous.value) + Number(purchased.value) - Number(used.value) : null;
  const variance = complete ? Number(actual.value) - Number(expected) : null;
  return {
    item: config.label,
    previous: previous.value,
    purchased: purchased.value,
    used: used.value,
    expected,
    actual: actual.value,
    variance,
    status: !complete ? 'Missing Data' : variance === 0 ? 'OK' : 'FLAG',
    blockers,
  };
}

export async function getInventoryReconciliationReport(date: string): Promise<InventoryReconciliationReport> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date query param required (YYYY-MM-DD)');
  }

  const data = await Promise.all(itemConfigs.map((config) => buildItemRow(config, date)));
  const blockers = data.flatMap((row) => row.blockers);
  return {
    ok: true,
    source: Array.from(new Set(Object.values(SOURCES))),
    missingSources: Array.from(new Set(blockers.map((entry) => entry.canonical_source))),
    scope: { date },
    status: blockers.length === 0 ? 'complete' : 'partial',
    data,
    warnings: [],
    blockers,
    last_updated: new Date().toISOString(),
  };
}
