import { db } from '../db';
import { sql } from 'drizzle-orm';

const SHIFT_KEY_SUFFIX = 'BKK-1700';

type DrinkCode = 'COKE' | 'COKE_ZERO' | 'SPRITE' | 'WATER' | 'FANTA_ORANGE' | 'FANTA_STRAWBERRY' | 'SCHWEPPES_MANAO';

interface UsageRuleSeed {
  sku?: string;
  itemName?: string;
  directDrinkCode?: DrinkCode;
  requiresDrinkModifier?: boolean;
  bunsPerUnit?: number;
  beefServesPerUnit?: number;
  beefGramsPerUnit?: number;
  chickenServesPerUnit?: number;
  chickenGramsPerUnit?: number;
  notes: string;
}

interface UsageIssue {
  type: 'UNMAPPED_ITEM' | 'SET_DRINK_MODIFIER_MISSING' | 'SET_DRINK_MODIFIER_PARTIAL';
  sku: string | null;
  itemName: string;
  details: string;
}

interface DailyUsageRowAccumulator {
  businessDate: string;
  shiftKey: string;
  categoryName: string;
  sku: string | null;
  itemName: string;
  quantitySold: number;
  bunsUsed: number | null;
  beefServesUsed: number | null;
  beefGramsUsed: number | null;
  chickenServesUsed: number | null;
  chickenGramsUsed: number | null;
  cokeUsed: number | null;
  cokeZeroUsed: number | null;
  spriteUsed: number | null;
  waterUsed: number | null;
  fantaOrangeUsed: number | null;
  fantaStrawberryUsed: number | null;
  schweppesManaoUsed: number | null;
}

export interface DailyUsageSummary {
  expectedBuns: number;
  expectedBeefGrams: number;
  expectedChickenGrams: number;
  totalDrinksUsed: number;
  cokeUsed: number;
  cokeZeroUsed: number;
  spriteUsed: number;
  waterUsed: number;
  fantaOrangeUsed: number;
  fantaStrawberryUsed: number;
  schweppesManaoUsed: number;
}

export interface DailyUsageRow {
  businessDate: string;
  shiftKey: string;
  categoryName: string;
  sku: string | null;
  itemName: string;
  quantitySold: number;
  bunsUsed: number | null;
  beefServesUsed: number | null;
  beefGramsUsed: number | null;
  chickenServesUsed: number | null;
  chickenGramsUsed: number | null;
  cokeUsed: number | null;
  cokeZeroUsed: number | null;
  spriteUsed: number | null;
  waterUsed: number | null;
  fantaOrangeUsed: number | null;
  fantaStrawberryUsed: number | null;
  schweppesManaoUsed: number | null;
}

export interface DailyUsageResponse {
  date: string;
  summary: DailyUsageSummary;
  rows: DailyUsageRow[];
  issues: UsageIssue[];
}

export interface DailyUsageRebuildResult extends DailyUsageResponse {
  ok: boolean;
  rowsStored: number;
}

const RULE_SEEDS: UsageRuleSeed[] = [
  { sku: '10004', itemName: 'Single Smash Burger (ซิงเกิ้ล)', bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95, notes: 'Single beef burger' },
  { sku: '10006', itemName: 'Ultimate Double (คู่)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, notes: 'Double beef burger' },
  { sku: '10009', itemName: 'Triple Smash Burger (สาม)', bunsPerUnit: 1, beefServesPerUnit: 3, beefGramsPerUnit: 285, notes: 'Triple beef burger' },
  { sku: '10019', itemName: 'Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, notes: 'Double beef burger with bacon' },
  { sku: '10033', itemName: 'Single Meal Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95, requiresDrinkModifier: true, notes: 'Single meal set with drink modifier' },
  { sku: '10032', itemName: 'Double Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, requiresDrinkModifier: true, notes: 'Double meal set with drink modifier' },
  { sku: '10036', itemName: 'Super Double Bacon & Cheese Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, requiresDrinkModifier: true, notes: 'Super double set with drink modifier' },
  { sku: '10034', itemName: 'Triple Smash Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 3, beefGramsPerUnit: 285, requiresDrinkModifier: true, notes: 'Triple meal set with drink modifier' },
  { sku: '10066', itemName: 'Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10068', itemName: '🐔 Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10070', itemName: 'Karaage Chicken Burger', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10071', itemName: 'Karaage Chicken (Meal Deal)', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, requiresDrinkModifier: true, notes: 'Chicken meal set with drink modifier' },
  { sku: '10037', itemName: 'El Smasho Grande Chicken Burger', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10012', itemName: 'Coke Can', directDrinkCode: 'COKE', notes: 'Standalone Coke can' },
  { sku: '10013', itemName: 'Coke Zero', directDrinkCode: 'COKE_ZERO', notes: 'Standalone Coke Zero' },
  { sku: '10026', itemName: 'Sprite', directDrinkCode: 'SPRITE', notes: 'Standalone Sprite' },
  { sku: '10031', itemName: 'Bottle Water', directDrinkCode: 'WATER', notes: 'Standalone bottled water' },
  { sku: '10027', itemName: 'Fanta Orange', directDrinkCode: 'FANTA_ORANGE', notes: 'Standalone Fanta Orange' },
  { sku: '10028', itemName: 'Fanta Strawberry', directDrinkCode: 'FANTA_STRAWBERRY', notes: 'Standalone Fanta Strawberry' },
  { sku: '10021', itemName: 'Schweppes Lime', directDrinkCode: 'SCHWEPPES_MANAO', notes: 'Schweppes lime/manao treated as same stock item' },
];

const MODIFIER_TO_DRINK: Array<{ pattern: RegExp; code: DrinkCode }> = [
  { pattern: /^coke$/i, code: 'COKE' },
  { pattern: /^coke zero$/i, code: 'COKE_ZERO' },
  { pattern: /^sprite$/i, code: 'SPRITE' },
  { pattern: /^bottle water$/i, code: 'WATER' },
  { pattern: /^water$/i, code: 'WATER' },
  { pattern: /^fanta orange$/i, code: 'FANTA_ORANGE' },
  { pattern: /^fanta strawberry$/i, code: 'FANTA_STRAWBERRY' },
  { pattern: /^schweppes (lime|manow|manao)$/i, code: 'SCHWEPPES_MANAO' },
  { pattern: /^soda water$/i, code: 'WATER' },
];

function toShiftKey(businessDate: string): string {
  return `${businessDate}-${SHIFT_KEY_SUFFIX}`;
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function round4(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return Math.round(value * 10000) / 10000;
}

function zeroable(value: number | null): number {
  return value === null ? 0 : value;
}

function createEmptyAccumulator(businessDate: string, categoryName: string, sku: string | null, itemName: string): DailyUsageRowAccumulator {
  return {
    businessDate,
    shiftKey: toShiftKey(businessDate),
    categoryName,
    sku,
    itemName,
    quantitySold: 0,
    bunsUsed: 0,
    beefServesUsed: 0,
    beefGramsUsed: 0,
    chickenServesUsed: 0,
    chickenGramsUsed: 0,
    cokeUsed: 0,
    cokeZeroUsed: 0,
    spriteUsed: 0,
    waterUsed: 0,
    fantaOrangeUsed: 0,
    fantaStrawberryUsed: 0,
    schweppesManaoUsed: 0,
  };
}

function addDrink(acc: DailyUsageRowAccumulator, code: DrinkCode, qty: number) {
  switch (code) {
    case 'COKE':
      acc.cokeUsed = zeroable(acc.cokeUsed) + qty;
      return;
    case 'COKE_ZERO':
      acc.cokeZeroUsed = zeroable(acc.cokeZeroUsed) + qty;
      return;
    case 'SPRITE':
      acc.spriteUsed = zeroable(acc.spriteUsed) + qty;
      return;
    case 'WATER':
      acc.waterUsed = zeroable(acc.waterUsed) + qty;
      return;
    case 'FANTA_ORANGE':
      acc.fantaOrangeUsed = zeroable(acc.fantaOrangeUsed) + qty;
      return;
    case 'FANTA_STRAWBERRY':
      acc.fantaStrawberryUsed = zeroable(acc.fantaStrawberryUsed) + qty;
      return;
    case 'SCHWEPPES_MANAO':
      acc.schweppesManaoUsed = zeroable(acc.schweppesManaoUsed) + qty;
      return;
  }
}

function summarize(rows: DailyUsageRow[]): DailyUsageSummary {
  return rows.reduce<DailyUsageSummary>((acc, row) => {
    acc.expectedBuns += Number(row.bunsUsed || 0);
    acc.expectedBeefGrams += Number(row.beefGramsUsed || 0);
    acc.expectedChickenGrams += Number(row.chickenGramsUsed || 0);
    acc.cokeUsed += Number(row.cokeUsed || 0);
    acc.cokeZeroUsed += Number(row.cokeZeroUsed || 0);
    acc.spriteUsed += Number(row.spriteUsed || 0);
    acc.waterUsed += Number(row.waterUsed || 0);
    acc.fantaOrangeUsed += Number(row.fantaOrangeUsed || 0);
    acc.fantaStrawberryUsed += Number(row.fantaStrawberryUsed || 0);
    acc.schweppesManaoUsed += Number(row.schweppesManaoUsed || 0);
    return acc;
  }, {
    expectedBuns: 0,
    expectedBeefGrams: 0,
    expectedChickenGrams: 0,
    totalDrinksUsed: 0,
    cokeUsed: 0,
    cokeZeroUsed: 0,
    spriteUsed: 0,
    waterUsed: 0,
    fantaOrangeUsed: 0,
    fantaStrawberryUsed: 0,
    schweppesManaoUsed: 0,
  });
}

async function ensureUsageRulesSeeded() {
  for (const rule of RULE_SEEDS) {
    if (rule.sku) {
      await db.execute(sql`DELETE FROM receipt_truth_usage_rule WHERE sku = ${rule.sku}`);
      await db.execute(sql`
        INSERT INTO receipt_truth_usage_rule
          (sku, item_name, direct_drink_code, requires_drink_modifier, buns_per_unit, beef_serves_per_unit, beef_grams_per_unit, chicken_serves_per_unit, chicken_grams_per_unit, notes, active)
        VALUES
          (${rule.sku}, ${rule.itemName ?? null}, ${rule.directDrinkCode ?? null}, ${Boolean(rule.requiresDrinkModifier)}, ${rule.bunsPerUnit ?? null}, ${rule.beefServesPerUnit ?? null}, ${rule.beefGramsPerUnit ?? null}, ${rule.chickenServesPerUnit ?? null}, ${rule.chickenGramsPerUnit ?? null}, ${rule.notes}, true)
      `);
      continue;
    }

    if (rule.itemName) {
      await db.execute(sql`DELETE FROM receipt_truth_usage_rule WHERE item_name = ${rule.itemName}`);
      await db.execute(sql`
        INSERT INTO receipt_truth_usage_rule
          (sku, item_name, direct_drink_code, requires_drink_modifier, buns_per_unit, beef_serves_per_unit, beef_grams_per_unit, chicken_serves_per_unit, chicken_grams_per_unit, notes, active)
        VALUES
          (NULL, ${rule.itemName}, ${rule.directDrinkCode ?? null}, ${Boolean(rule.requiresDrinkModifier)}, ${rule.bunsPerUnit ?? null}, ${rule.beefServesPerUnit ?? null}, ${rule.beefGramsPerUnit ?? null}, ${rule.chickenServesPerUnit ?? null}, ${rule.chickenGramsPerUnit ?? null}, ${rule.notes}, true)
      `);
    }
  }
}

async function loadUsageRules() {
  const result = await db.execute(sql`
    SELECT sku, item_name, direct_drink_code, requires_drink_modifier,
           buns_per_unit, beef_serves_per_unit, beef_grams_per_unit,
           chicken_serves_per_unit, chicken_grams_per_unit
    FROM receipt_truth_usage_rule
    WHERE active = true
  `);

  const bySku = new Map<string, any>();
  const byName = new Map<string, any>();

  for (const row of result.rows as any[]) {
    const parsed = {
      sku: row.sku as string | null,
      itemName: row.item_name as string | null,
      directDrinkCode: row.direct_drink_code as DrinkCode | null,
      requiresDrinkModifier: Boolean(row.requires_drink_modifier),
      bunsPerUnit: row.buns_per_unit === null ? null : Number(row.buns_per_unit),
      beefServesPerUnit: row.beef_serves_per_unit === null ? null : Number(row.beef_serves_per_unit),
      beefGramsPerUnit: row.beef_grams_per_unit === null ? null : Number(row.beef_grams_per_unit),
      chickenServesPerUnit: row.chicken_serves_per_unit === null ? null : Number(row.chicken_serves_per_unit),
      chickenGramsPerUnit: row.chicken_grams_per_unit === null ? null : Number(row.chicken_grams_per_unit),
    };

    if (parsed.sku) bySku.set(parsed.sku, parsed);
    if (parsed.itemName) byName.set(normalizeName(parsed.itemName), parsed);
  }

  return { bySku, byName };
}

function mapModifierToDrinkCode(modifierName: string): DrinkCode | null {
  const normalized = modifierName.trim();
  for (const mapping of MODIFIER_TO_DRINK) {
    if (mapping.pattern.test(normalized)) {
      return mapping.code;
    }
  }
  return null;
}

async function buildDailyUsage(businessDate: string): Promise<DailyUsageResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[DAILY_USAGE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  await ensureUsageRulesSeeded();

  const summaryCheck = await db.execute(sql`
    SELECT all_receipts FROM receipt_truth_summary WHERE business_date = ${businessDate}::date
  `);
  if (!summaryCheck.rows || summaryCheck.rows.length === 0) {
    throw new Error(`[DAILY_USAGE_FAIL] No receipt truth found for ${businessDate}. Run receipts-truth/rebuild first.`);
  }

  const linesResult = await db.execute(sql`
    SELECT receipt_id, sku, item_name, pos_category_name, quantity
    FROM receipt_truth_line
    WHERE receipt_date = ${businessDate}::date
      AND receipt_type = 'SALE'
    ORDER BY pos_category_name, sku, item_name, receipt_id
  `);

  const effectiveCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM receipt_truth_modifier_effective
    WHERE shift_date = ${businessDate}::date
  `);
  const hasEffective = Number((effectiveCheck.rows[0] as any)?.count || 0) > 0;

  const modifiersResult = hasEffective
    ? await db.execute(sql`
        SELECT receipt_id, NULL::text AS line_sku, modifier_name, COUNT(*)::numeric AS quantity
        FROM receipt_truth_modifier_effective
        WHERE shift_date = ${businessDate}::date
        GROUP BY receipt_id, modifier_name
      `)
    : await db.execute(sql`
        SELECT m.receipt_id, m.line_sku, m.modifier_name, SUM(m.quantity)::numeric AS quantity
        FROM receipt_truth_modifier m
        WHERE m.receipt_id IN (
          SELECT DISTINCT receipt_id
          FROM receipt_truth_line
          WHERE receipt_date = ${businessDate}::date AND receipt_type = 'SALE'
        )
        GROUP BY m.receipt_id, m.line_sku, m.modifier_name
      `);

  const { bySku, byName } = await loadUsageRules();

  const modifiersByReceiptSku = new Map<string, Map<DrinkCode, number>>();
  const modifiersByReceiptAny = new Map<string, Map<DrinkCode, number>>();

  for (const row of modifiersResult.rows as any[]) {
    const code = mapModifierToDrinkCode(String(row.modifier_name || ''));
    if (!code) continue;

    const qty = Number(row.quantity || 0);
    const receiptId = String(row.receipt_id);
    const lineSku = row.line_sku ? String(row.line_sku) : null;

    const anyMap = modifiersByReceiptAny.get(receiptId) || new Map<DrinkCode, number>();
    anyMap.set(code, (anyMap.get(code) || 0) + qty);
    modifiersByReceiptAny.set(receiptId, anyMap);

    if (lineSku) {
      const key = `${receiptId}::${lineSku}`;
      const skuMap = modifiersByReceiptSku.get(key) || new Map<DrinkCode, number>();
      skuMap.set(code, (skuMap.get(code) || 0) + qty);
      modifiersByReceiptSku.set(key, skuMap);
    }
  }

  const receiptItemGroups = new Map<string, { receiptId: string; sku: string | null; itemName: string; categoryName: string; quantitySold: number }>();
  for (const row of linesResult.rows as any[]) {
    const receiptId = String(row.receipt_id);
    const sku = row.sku ? String(row.sku) : null;
    const itemName = String(row.item_name);
    const categoryName = String(row.pos_category_name || 'UNCATEGORIZED (POS)');
    const key = `${receiptId}::${sku || normalizeName(itemName)}::${categoryName}::${itemName}`;
    const existing = receiptItemGroups.get(key) || { receiptId, sku, itemName, categoryName, quantitySold: 0 };
    existing.quantitySold += Number(row.quantity || 0);
    receiptItemGroups.set(key, existing);
  }

  const dayRows = new Map<string, DailyUsageRowAccumulator>();
  const issues: UsageIssue[] = [];

  for (const group of receiptItemGroups.values()) {
    const lookupRule = group.sku ? bySku.get(group.sku) : byName.get(normalizeName(group.itemName));
    const fallbackRule = lookupRule || byName.get(normalizeName(group.itemName));
    const rule = fallbackRule;

    const rowKey = `${group.categoryName}::${group.sku || ''}::${group.itemName}`;
    const acc = dayRows.get(rowKey) || createEmptyAccumulator(businessDate, group.categoryName, group.sku, group.itemName);
    acc.quantitySold += group.quantitySold;

    if (!rule) {
      acc.bunsUsed = null;
      acc.beefServesUsed = null;
      acc.beefGramsUsed = null;
      acc.chickenServesUsed = null;
      acc.chickenGramsUsed = null;
      acc.cokeUsed = null;
      acc.cokeZeroUsed = null;
      acc.spriteUsed = null;
      acc.waterUsed = null;
      acc.fantaOrangeUsed = null;
      acc.fantaStrawberryUsed = null;
      acc.schweppesManaoUsed = null;
      issues.push({
        type: 'UNMAPPED_ITEM',
        sku: group.sku,
        itemName: group.itemName,
        details: `No daily usage rule for SKU=${group.sku || 'NULL'} item=${group.itemName}`,
      });
      dayRows.set(rowKey, acc);
      continue;
    }

    acc.bunsUsed = zeroable(acc.bunsUsed) + (Number(rule.bunsPerUnit || 0) * group.quantitySold);
    acc.beefServesUsed = zeroable(acc.beefServesUsed) + (Number(rule.beefServesPerUnit || 0) * group.quantitySold);
    acc.beefGramsUsed = zeroable(acc.beefGramsUsed) + (Number(rule.beefGramsPerUnit || 0) * group.quantitySold);
    acc.chickenServesUsed = zeroable(acc.chickenServesUsed) + (Number(rule.chickenServesPerUnit || 0) * group.quantitySold);
    acc.chickenGramsUsed = zeroable(acc.chickenGramsUsed) + (Number(rule.chickenGramsPerUnit || 0) * group.quantitySold);

    if (rule.directDrinkCode) {
      addDrink(acc, rule.directDrinkCode, group.quantitySold);
    }

    if (rule.requiresDrinkModifier) {
      const scopedMods = group.sku ? modifiersByReceiptSku.get(`${group.receiptId}::${group.sku}`) : undefined;
      const modMap = scopedMods || modifiersByReceiptAny.get(group.receiptId);
      let matchedDrinkCount = 0;
      if (modMap) {
        for (const [drinkCode, qty] of modMap.entries()) {
          addDrink(acc, drinkCode, qty);
          matchedDrinkCount += qty;
        }
      }

      if (!modMap || matchedDrinkCount === 0) {
        issues.push({
          type: 'SET_DRINK_MODIFIER_MISSING',
          sku: group.sku,
          itemName: group.itemName,
          details: `Meal-set drinks missing for receipt ${group.receiptId} SKU=${group.sku || 'NULL'}`,
        });
      } else if (matchedDrinkCount < group.quantitySold) {
        issues.push({
          type: 'SET_DRINK_MODIFIER_PARTIAL',
          sku: group.sku,
          itemName: group.itemName,
          details: `Meal-set drinks partial for receipt ${group.receiptId}: expected ${group.quantitySold}, found ${matchedDrinkCount}`,
        });
      }
    }

    dayRows.set(rowKey, acc);
  }

  const rows = Array.from(dayRows.values())
    .map((row) => ({
      businessDate: row.businessDate,
      shiftKey: row.shiftKey,
      categoryName: row.categoryName,
      sku: row.sku,
      itemName: row.itemName,
      quantitySold: round4(row.quantitySold) || 0,
      bunsUsed: round4(row.bunsUsed),
      beefServesUsed: round4(row.beefServesUsed),
      beefGramsUsed: round4(row.beefGramsUsed),
      chickenServesUsed: round4(row.chickenServesUsed),
      chickenGramsUsed: round4(row.chickenGramsUsed),
      cokeUsed: round4(row.cokeUsed),
      cokeZeroUsed: round4(row.cokeZeroUsed),
      spriteUsed: round4(row.spriteUsed),
      waterUsed: round4(row.waterUsed),
      fantaOrangeUsed: round4(row.fantaOrangeUsed),
      fantaStrawberryUsed: round4(row.fantaStrawberryUsed),
      schweppesManaoUsed: round4(row.schweppesManaoUsed),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || (a.sku || '').localeCompare(b.sku || '') || a.itemName.localeCompare(b.itemName));

  const summary = summarize(rows);
  summary.totalDrinksUsed =
    summary.cokeUsed +
    summary.cokeZeroUsed +
    summary.spriteUsed +
    summary.waterUsed +
    summary.fantaOrangeUsed +
    summary.fantaStrawberryUsed +
    summary.schweppesManaoUsed;

  return { date: businessDate, summary, rows, issues };
}

export async function rebuildReceiptTruthDailyUsage(businessDate: string): Promise<DailyUsageRebuildResult> {
  const built = await buildDailyUsage(businessDate);

  await db.execute(sql`DELETE FROM receipt_truth_daily_usage WHERE business_date = ${businessDate}::date`);

  for (const row of built.rows) {
    await db.execute(sql`
      INSERT INTO receipt_truth_daily_usage
        (business_date, shift_key, category_name, sku, item_name, quantity_sold, buns_used, beef_serves_used, beef_grams_used, chicken_serves_used, chicken_grams_used, coke_used, coke_zero_used, sprite_used, water_used, fanta_orange_used, fanta_strawberry_used, schweppes_manao_used, built_at)
      VALUES
        (${row.businessDate}::date, ${row.shiftKey}, ${row.categoryName}, ${row.sku}, ${row.itemName}, ${row.quantitySold}, ${row.bunsUsed}, ${row.beefServesUsed}, ${row.beefGramsUsed}, ${row.chickenServesUsed}, ${row.chickenGramsUsed}, ${row.cokeUsed}, ${row.cokeZeroUsed}, ${row.spriteUsed}, ${row.waterUsed}, ${row.fantaOrangeUsed}, ${row.fantaStrawberryUsed}, ${row.schweppesManaoUsed}, NOW())
    `);
  }

  return {
    ok: true,
    ...built,
    rowsStored: built.rows.length,
  };
}

export async function getReceiptTruthDailyUsage(businessDate: string): Promise<DailyUsageResponse | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[DAILY_USAGE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const result = await db.execute(sql`
    SELECT business_date, shift_key, category_name, sku, item_name, quantity_sold,
           buns_used, beef_serves_used, beef_grams_used,
           chicken_serves_used, chicken_grams_used,
           coke_used, coke_zero_used, sprite_used, water_used,
           fanta_orange_used, fanta_strawberry_used, schweppes_manao_used
    FROM receipt_truth_daily_usage
    WHERE business_date = ${businessDate}::date
    ORDER BY category_name, sku, item_name
  `);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const rows: DailyUsageRow[] = (result.rows as any[]).map((row) => ({
    businessDate: String(row.business_date),
    shiftKey: String(row.shift_key),
    categoryName: String(row.category_name),
    sku: row.sku ? String(row.sku) : null,
    itemName: String(row.item_name),
    quantitySold: Number(row.quantity_sold),
    bunsUsed: row.buns_used === null ? null : Number(row.buns_used),
    beefServesUsed: row.beef_serves_used === null ? null : Number(row.beef_serves_used),
    beefGramsUsed: row.beef_grams_used === null ? null : Number(row.beef_grams_used),
    chickenServesUsed: row.chicken_serves_used === null ? null : Number(row.chicken_serves_used),
    chickenGramsUsed: row.chicken_grams_used === null ? null : Number(row.chicken_grams_used),
    cokeUsed: row.coke_used === null ? null : Number(row.coke_used),
    cokeZeroUsed: row.coke_zero_used === null ? null : Number(row.coke_zero_used),
    spriteUsed: row.sprite_used === null ? null : Number(row.sprite_used),
    waterUsed: row.water_used === null ? null : Number(row.water_used),
    fantaOrangeUsed: row.fanta_orange_used === null ? null : Number(row.fanta_orange_used),
    fantaStrawberryUsed: row.fanta_strawberry_used === null ? null : Number(row.fanta_strawberry_used),
    schweppesManaoUsed: row.schweppes_manao_used === null ? null : Number(row.schweppes_manao_used),
  }));

  const summary = summarize(rows);
  summary.totalDrinksUsed =
    summary.cokeUsed +
    summary.cokeZeroUsed +
    summary.spriteUsed +
    summary.waterUsed +
    summary.fantaOrangeUsed +
    summary.fantaStrawberryUsed +
    summary.schweppesManaoUsed;

  const issues: UsageIssue[] = rows
    .filter((row) => row.bunsUsed === null && row.beefGramsUsed === null && row.chickenGramsUsed === null && row.cokeUsed === null)
    .map((row) => ({
      type: 'UNMAPPED_ITEM',
      sku: row.sku,
      itemName: row.itemName,
      details: `Stored daily usage row contains NULL usage columns for ${row.itemName}`,
    }));

  return { date: businessDate, summary, rows, issues };
}
