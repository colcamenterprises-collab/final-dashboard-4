import { pool } from '../db';

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
  dailySalesV2: 'daily_sales_v2.payload',
  purchaseTally: 'purchase_tally',
  purchaseTallyDrinks: 'purchase_tally + purchase_tally_drink',
  receiptTruth: 'receipt_truth_daily_usage',
  recipeMapping: 'recipe mapping',
};

const BURGER_CATEGORIES = [
  'Burgers',
  'Smash Burgers',
  'Burger Sets',
  'Burger Sets (Meal Deals)',
  'Smash Burger Sets (Meal Deals)',
  'Kids',
  'Kids Will Love This',
];

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
     WHERE COALESCE("shiftDate", shift_date::text) = $1
       AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC
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
     WHERE COALESCE("shiftDate", shift_date::text) < $1
       AND "deletedAt" IS NULL
       AND (${nonNull})
     ORDER BY COALESCE("shiftDate", shift_date::text) DESC, "createdAt" DESC
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
     WHERE COALESCE("shiftDate", shift_date::text) = $1
       AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  for (const [index] of paths.entries()) {
    const value = row[`v${index}`];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const total = Object.values(value).reduce((sum, current) => sum + (numeric(current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
  }
  return sourceValue(null, SOURCES.dailySalesV2, where, label);
}

async function previousPayloadJsonObjectSum(date: string, paths: string[][], where: string, label: string): Promise<SourceValue> {
  const textExpressions = paths.map((path) => `payload${path.map((part) => `->'${part}'`).join('')}`);
  const hasObject = textExpressions.map((expr) => `jsonb_typeof(${expr}) = 'object'`).join(' OR ');
  const res = await pool.query(
    `SELECT ${textExpressions.map((expr, index) => `${expr} AS v${index}`).join(', ')}
     FROM daily_sales_v2
     WHERE COALESCE("shiftDate", shift_date::text) < $1
       AND "deletedAt" IS NULL
       AND (${hasObject})
     ORDER BY COALESCE("shiftDate", shift_date::text) DESC, "createdAt" DESC
     LIMIT 1`,
    [date],
  );
  const row = res.rows[0];
  if (!row) return sourceValue(null, SOURCES.dailySalesV2, where, label);
  for (const [index] of paths.entries()) {
    const value = row[`v${index}`];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const total = Object.values(value).reduce((sum, current) => sum + (numeric(current) ?? 0), 0);
      return sourceValue(total, SOURCES.dailySalesV2, where, label);
    }
  }
  return sourceValue(null, SOURCES.dailySalesV2, where, label);
}

async function purchaseTallySum(date: string, column: string, label: string): Promise<SourceValue> {
  const res = await pool.query(`SELECT COALESCE(SUM(${column}), 0) AS total FROM purchase_tally WHERE date = $1`, [date]);
  return sourceValue(res.rows[0]?.total, SOURCES.purchaseTally, `purchase_tally.${column}`, label);
}

async function rollsUsed(date: string): Promise<SourceValue> {
  const res = await pool.query(
    `SELECT COALESCE(SUM(quantity_sold), 0) AS total, COUNT(*)::int AS row_count
     FROM receipt_truth_daily_usage
     WHERE business_date = $1
       AND category_name = ANY($2::text[])
       AND item_name NOT LIKE 'Add-ons%'`,
    [date, BURGER_CATEGORIES],
  );
  return Number(res.rows[0]?.row_count ?? 0) > 0
    ? sourceValue(res.rows[0]?.total, SOURCES.receiptTruth, 'receipt_truth_daily_usage.quantity_sold', 'Rolls used')
    : sourceValue(null, SOURCES.receiptTruth, 'receipt_truth_daily_usage burger/set rows', 'Rolls used');
}

async function receiptUsageSum(date: string, expression: string, where: string, label: string): Promise<SourceValue> {
  const res = await pool.query(
    `SELECT ${expression} AS total, COUNT(*)::int AS row_count FROM receipt_truth_daily_usage WHERE business_date = $1`,
    [date],
  );
  return Number(res.rows[0]?.row_count ?? 0) > 0
    ? sourceValue(res.rows[0]?.total, SOURCES.receiptTruth, where, label)
    : sourceValue(null, SOURCES.receiptTruth, 'receipt_truth_daily_usage rows', label);
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
    used: rollsUsed,
    actual: (date) => currentPayloadValue(date, [['rollsEnd'], ['burgerBunsStock']], 'current Daily Sales & Stock V2 closing rolls', 'Actual rolls'),
  },
  {
    label: 'Meat',
    previous: (date) => previousPayloadValue(date, [['meatEndGrams'], ['meatWeightG']], 'previous completed Daily Sales & Stock V2 closing meat grams', 'Previous meat'),
    purchased: (date) => currentPayloadValue(date, [['shiftPurchases', 'meatGrams'] ], 'current Daily Sales & Stock V2 purchases meat grams', 'Purchased meat'),
    used: (date) => receiptUsageSum(date, 'COALESCE(SUM(beef_grams_used), 0)', 'receipt_truth_daily_usage.beef_grams_used', 'Meat used'),
    actual: (date) => currentPayloadValue(date, [['meatEndGrams'], ['meatWeightG']], 'current Daily Sales & Stock V2 closing meat grams', 'Actual meat'),
  },
  {
    label: 'Drinks',
    previous: (date) => previousPayloadValue(date, [['drinksTotal'], ['drinkStockTotal']], 'previous completed Daily Sales & Stock V2 closing drinks total', 'Previous drinks').then((value) => value.value === null ? previousPayloadJsonObjectSum(date, [['drinkStock'], ['drinksJson']], 'previous completed Daily Sales & Stock V2 closing drinks object', 'Previous drinks') : value),
    purchased: (date) => pool.query(
      `SELECT COALESCE(SUM(ptd.qty), 0) AS total
       FROM purchase_tally pt
       JOIN purchase_tally_drink ptd ON ptd.tally_id = pt.id
       WHERE pt.date = $1`,
      [date],
    ).then((res) => sourceValue(res.rows[0]?.total, SOURCES.purchaseTallyDrinks, 'purchase_tally_drink.qty', 'Purchased drinks')),
    used: (date) => receiptUsageSum(date, 'COALESCE(SUM(COALESCE(coke_used,0)+COALESCE(coke_zero_used,0)+COALESCE(sprite_used,0)+COALESCE(water_used,0)+COALESCE(fanta_orange_used,0)+COALESCE(fanta_strawberry_used,0)+COALESCE(schweppes_manao_used,0)), 0)', 'receipt_truth_daily_usage drink usage columns', 'Drinks used'),
    actual: (date) => currentPayloadValue(date, [['drinksTotal'], ['drinkStockTotal']], 'current Daily Sales & Stock V2 closing drinks total', 'Actual drinks').then((value) => value.value === null ? currentPayloadJsonObjectSum(date, [['drinkStock'], ['drinksJson']], 'current Daily Sales & Stock V2 closing drinks object', 'Actual drinks') : value),
  },
  {
    label: 'French Fries',
    previous: (date) => previousPayloadValue(date, [['friesEndGrams']], 'previous completed Daily Sales & Stock V2 closing fries grams', 'Previous fries'),
    purchased: (date) => purchaseTallySum(date, 'fries_grams', 'Purchased fries'),
    used: missingRecipeMappedUsage('French Fries'),
    actual: (date) => currentPayloadValue(date, [['friesEndGrams']], 'current Daily Sales & Stock V2 closing fries grams', 'Actual fries'),
  },
  {
    label: 'Sweet Potato Fries',
    previous: (date) => previousPayloadValue(date, [['sweetPotatoEndGrams']], 'previous completed Daily Sales & Stock V2 closing sweet potato fries grams', 'Previous sweet potato fries'),
    purchased: (date) => purchaseTallySum(date, 'sweet_potato_grams', 'Purchased sweet potato fries'),
    used: missingRecipeMappedUsage('Sweet Potato Fries'),
    actual: (date) => currentPayloadValue(date, [['sweetPotatoEndGrams']], 'current Daily Sales & Stock V2 closing sweet potato fries grams', 'Actual sweet potato fries'),
  },
  {
    label: 'Bacon',
    previous: (date) => previousPayloadValue(date, [['baconEnd']], 'previous completed Daily Sales & Stock V2 closing bacon', 'Previous bacon'),
    purchased: (date) => currentPayloadValue(date, [['shiftPurchases', 'bacon']], 'current Daily Sales & Stock V2 purchases bacon', 'Purchased bacon'),
    used: missingRecipeMappedUsage('Bacon'),
    actual: (date) => currentPayloadValue(date, [['baconEnd']], 'current Daily Sales & Stock V2 closing bacon', 'Actual bacon'),
  },
];

async function buildItemRow(config: InventoryItemConfig, date: string): Promise<InventoryReconciliationRow> {
  const [previous, purchased, used, actual] = await Promise.all([
    config.previous(date),
    config.purchased(date),
    config.used(date),
    config.actual(date),
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
    scope: { date },
    status: blockers.length === 0 ? 'complete' : 'partial',
    data,
    warnings: [],
    blockers,
    last_updated: new Date().toISOString(),
  };
}
