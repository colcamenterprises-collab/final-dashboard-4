import { db } from '../db';
import { sql } from 'drizzle-orm';

const SHIFT_KEY_SUFFIX = 'BKK-1700';

let tablesEnsured = false;

async function ensureTables() {
  if (tablesEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS receipt_truth_usage_rule (
      id serial PRIMARY KEY NOT NULL,
      sku varchar(255),
      item_name varchar(255),
      direct_drink_code varchar(50),
      requires_drink_modifier boolean NOT NULL DEFAULT false,
      requires_burger_modifier boolean NOT NULL DEFAULT false,
      buns_per_unit numeric(10, 4),
      beef_serves_per_unit numeric(10, 4),
      beef_grams_per_unit numeric(10, 4),
      chicken_serves_per_unit numeric(10, 4),
      chicken_grams_per_unit numeric(10, 4),
      fries_per_unit numeric(10, 4),
      bacon_per_unit numeric(10, 4),
      cheese_per_unit numeric(10, 4),
      pickles_per_unit numeric(10, 4),
      salad_per_unit numeric(10, 4),
      tomato_per_unit numeric(10, 4),
      onion_per_unit numeric(10, 4),
      burger_sauce_per_unit numeric(10, 4),
      jalapenos_per_unit numeric(10, 4),
      notes text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS receipt_truth_usage_rule_sku_unique_idx
      ON receipt_truth_usage_rule (sku) WHERE sku IS NOT NULL
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS receipt_truth_usage_rule_item_name_unique_idx
      ON receipt_truth_usage_rule (item_name) WHERE item_name IS NOT NULL
  `);

  // Add new columns if they don't exist yet (safe to run on existing tables)
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS requires_burger_modifier boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS fries_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS bacon_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS cheese_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS pickles_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS salad_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS tomato_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS onion_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS burger_sauce_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS jalapenos_per_unit numeric(10,4)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS receipt_truth_daily_usage (
      id serial PRIMARY KEY NOT NULL,
      business_date date NOT NULL,
      shift_key varchar(100) NOT NULL,
      category_name varchar(255) NOT NULL,
      sku varchar(255),
      item_name varchar(255) NOT NULL,
      quantity_sold numeric(12, 4) NOT NULL,
      buns_used numeric(12, 4),
      beef_serves_used numeric(12, 4),
      beef_grams_used numeric(12, 4),
      chicken_serves_used numeric(12, 4),
      chicken_grams_used numeric(12, 4),
      coke_used numeric(12, 4),
      coke_zero_used numeric(12, 4),
      sprite_used numeric(12, 4),
      water_used numeric(12, 4),
      fanta_orange_used numeric(12, 4),
      fanta_strawberry_used numeric(12, 4),
      schweppes_manao_used numeric(12, 4),
      fries_used numeric(12, 4),
      bacon_used numeric(12, 4),
      cheese_used numeric(12, 4),
      pickles_used numeric(12, 4),
      salad_used numeric(12, 4),
      tomato_used numeric(12, 4),
      onion_used numeric(12, 4),
      burger_sauce_used numeric(12, 4),
      jalapenos_used numeric(12, 4),
      built_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS receipt_truth_daily_usage_business_date_idx
      ON receipt_truth_daily_usage (business_date)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS receipt_truth_daily_usage_unique_row_idx
      ON receipt_truth_daily_usage (business_date, category_name, COALESCE(sku, ''), item_name)
  `);

  // Add new columns to existing daily usage table
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS fries_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS bacon_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS cheese_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS pickles_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS salad_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS tomato_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS onion_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS burger_sauce_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS jalapenos_used numeric(12,4)`);
  // Mix & Match extended fields
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS coleslaw_per_unit numeric(10,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS modifier_drinks_expected int NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE receipt_truth_usage_rule ADD COLUMN IF NOT EXISTS modifier_burgers_expected int NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS coleslaw_used numeric(12,4)`);
  await db.execute(sql`ALTER TABLE receipt_truth_daily_usage ADD COLUMN IF NOT EXISTS is_modifier_estimated boolean NOT NULL DEFAULT false`);

  tablesEnsured = true;
}

type DrinkCode = 'COKE' | 'COKE_ZERO' | 'SPRITE' | 'WATER' | 'FANTA_ORANGE' | 'FANTA_STRAWBERRY' | 'SCHWEPPES_MANAO';

interface UsageRuleSeed {
  sku?: string;
  itemName?: string;
  directDrinkCode?: DrinkCode;
  requiresDrinkModifier?: boolean;
  requiresBurgerModifier?: boolean;
  bunsPerUnit?: number;
  beefServesPerUnit?: number;
  beefGramsPerUnit?: number;
  chickenServesPerUnit?: number;
  chickenGramsPerUnit?: number;
  friesPerUnit?: number;
  baconPerUnit?: number;
  cheesePerUnit?: number;
  picklesPerUnit?: number;
  saladPerUnit?: number;
  tomatoPerUnit?: number;
  onionPerUnit?: number;
  burgerSaucePerUnit?: number;
  jalapenosPerUnit?: number;
  coleslawPerUnit?: number;
  modifierDrinksExpected?: number;
  modifierBurgersExpected?: number;
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
  friesUsed: number | null;
  baconUsed: number | null;
  cheeseUsed: number | null;
  picklesUsed: number | null;
  saladUsed: number | null;
  tomatoUsed: number | null;
  onionUsed: number | null;
  burgerSauceUsed: number | null;
  jalapenosUsed: number | null;
  coleslawUsed: number | null;
  isModifierEstimated: boolean;
}

export interface DailyUsageSummary {
  expectedBuns: number;
  expectedBeefPatties: number;
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
  friesUsed: number;
  baconUsed: number;
  cheeseUsed: number;
  picklesUsed: number;
  saladUsed: number;
  tomatoUsed: number;
  onionUsed: number;
  burgerSauceUsed: number;
  jalapenosUsed: number;
  coleslawUsed: number;
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
  friesUsed: number | null;
  baconUsed: number | null;
  cheeseUsed: number | null;
  picklesUsed: number | null;
  saladUsed: number | null;
  tomatoUsed: number | null;
  onionUsed: number | null;
  burgerSauceUsed: number | null;
  jalapenosUsed: number | null;
  coleslawUsed: number | null;
  isModifierEstimated: boolean;
}

export interface DailyUsageResponse {
  date: string;
  summary: DailyUsageSummary;
  rows: DailyUsageRow[];
  issues: UsageIssue[];
  receiptTruthBuiltAt: string | null;
  dailyUsageBuiltAt: string | null;
}

export interface DailyUsageRebuildResult extends DailyUsageResponse {
  ok: boolean;
  rowsStored: number;
}

// ─── RULE SEEDS ────────────────────────────────────────────────────────────────
const RULE_SEEDS: UsageRuleSeed[] = [
  // Standalone burgers
  { sku: '10004', itemName: 'Single Smash Burger (ซิงเกิ้ล)', bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95, notes: 'Single beef burger' },
  { sku: '10006', itemName: 'Ultimate Double (คู่)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, notes: 'Double beef burger' },
  { sku: '10009', itemName: 'Triple Smash Burger (สาม)', bunsPerUnit: 1, beefServesPerUnit: 3, beefGramsPerUnit: 285, notes: 'Triple beef burger' },
  { sku: '10019', itemName: 'Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, baconPerUnit: 1, notes: 'Double beef burger with bacon' },

  // Meal Sets — each includes 1 fries + drink via modifier
  { sku: '10033', itemName: 'Single Meal Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95, friesPerUnit: 1, requiresDrinkModifier: true, notes: 'Single meal set with fries and drink modifier' },
  { sku: '10032', itemName: 'Double Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, friesPerUnit: 1, requiresDrinkModifier: true, notes: 'Double meal set with fries and drink modifier' },
  { sku: '10036', itemName: 'Super Double Bacon & Cheese Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, friesPerUnit: 1, baconPerUnit: 1, requiresDrinkModifier: true, notes: 'Super double set with bacon, fries and drink modifier' },
  { sku: '10034', itemName: 'Triple Smash Set (Meal Deal)', bunsPerUnit: 1, beefServesPerUnit: 3, beefGramsPerUnit: 285, friesPerUnit: 1, requiresDrinkModifier: true, notes: 'Triple meal set with fries and drink modifier' },

  // Mix & Match — 2 burgers, 2 fries, 1 coleslaw, 2 drinks per deal; burger/drink types from modifiers
  { sku: '10069', itemName: 'Mix and Match Meal Deal', friesPerUnit: 2, coleslawPerUnit: 1, requiresDrinkModifier: true, requiresBurgerModifier: true, modifierDrinksExpected: 2, modifierBurgersExpected: 2, notes: 'Mix and match: 2 burgers, 2 fries, 1 coleslaw, 2 drinks - types estimated from modifiers' },

  // Kids sets
  { sku: '10003', itemName: 'Kids Single Meal Set (Burger Fries Drink)', bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95, friesPerUnit: 1, requiresDrinkModifier: true, notes: 'Kids single meal set with fries and drink modifier' },

  // Chicken burgers
  { sku: '10066', itemName: 'Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10068', itemName: '🐔 Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10070', itemName: 'Karaage Chicken Burger', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },
  { sku: '10071', itemName: 'Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ -', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, friesPerUnit: 1, requiresDrinkModifier: true, notes: 'Karaage chicken meal set with fries and drink modifier' },
  { sku: '10037', itemName: 'El Smasho Grande Chicken Burger', bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100, notes: 'Chicken burger' },

  // Sides — fries items
  { sku: '10030', itemName: 'French Fries', friesPerUnit: 1, notes: 'Standalone fries' },
  { sku: '10018', itemName: 'Cajun Fries', friesPerUnit: 1, notes: 'Cajun-seasoned fries' },
  { sku: '10022', itemName: 'Sweet Potato Fries', friesPerUnit: 1, notes: 'Sweet potato fries' },
  { sku: '10035', itemName: 'Loaded Fries (Original)', friesPerUnit: 1, notes: 'Loaded fries — toppings safe-zero default' },
  { sku: '10045', itemName: 'Dirty Fries (เดอร์ตี้ เฟรนช์ฟรายส์)', friesPerUnit: 1, beefGramsPerUnit: 95, notes: 'Dirty fries with beef — 95g safe default pending precise weight' },
  { sku: '10010', itemName: 'Cheesy Bacon Fries', friesPerUnit: 1, baconPerUnit: 1, notes: 'Cheesy bacon fries' },

  // Sides — coleslaw
  { sku: '10025', itemName: 'Coleslaw with Bacon', coleslawPerUnit: 1, baconPerUnit: 1, notes: 'Standalone coleslaw side with bacon portion' },

  // Pre-packaged juice boxes — no tracked ingredient impact, zero-mapped so not flagged unmapped
  { sku: '10039', itemName: 'Juice Box (Orange)', notes: 'Pre-packaged juice box — no ingredient stock column, zero-mapped' },
  { sku: '10040', itemName: 'Juice Box (Apple)', notes: 'Pre-packaged juice box — no ingredient stock column, zero-mapped' },

  // Standalone drinks
  { sku: '10012', itemName: 'Coke Can', directDrinkCode: 'COKE', notes: 'Standalone Coke can' },
  { sku: '10013', itemName: 'Coke Zero', directDrinkCode: 'COKE_ZERO', notes: 'Standalone Coke Zero' },
  { sku: '10026', itemName: 'Sprite', directDrinkCode: 'SPRITE', notes: 'Standalone Sprite' },
  { sku: '10031', itemName: 'Bottle Water', directDrinkCode: 'WATER', notes: 'Standalone bottled water' },
  { sku: '10027', itemName: 'Fanta Orange', directDrinkCode: 'FANTA_ORANGE', notes: 'Standalone Fanta Orange' },
  { sku: '10028', itemName: 'Fanta Strawberry', directDrinkCode: 'FANTA_STRAWBERRY', notes: 'Standalone Fanta Strawberry' },
  { sku: '10021', itemName: 'Schweppes Lime', directDrinkCode: 'SCHWEPPES_MANAO', notes: 'Schweppes lime/manao treated as same stock item' },
  { sku: '10029', itemName: 'Soda Water', directDrinkCode: 'WATER', notes: 'Standalone soda water — mapped to water stock column' },
];

// ─── MODIFIER → DRINK MAP ────────────────────────────────────────────────────
const MODIFIER_TO_DRINK: Array<{ pattern: RegExp; code: DrinkCode }> = [
  { pattern: /^coke$/i, code: 'COKE' },
  { pattern: /^coke zero$/i, code: 'COKE_ZERO' },
  { pattern: /^sprite$/i, code: 'SPRITE' },
  { pattern: /^bottle water$/i, code: 'WATER' },
  { pattern: /^water$/i, code: 'WATER' },
  { pattern: /^soda water$/i, code: 'WATER' },
  { pattern: /^fanta orange$/i, code: 'FANTA_ORANGE' },
  { pattern: /^orange fanta$/i, code: 'FANTA_ORANGE' },
  { pattern: /^fanta strawberry$/i, code: 'FANTA_STRAWBERRY' },
  { pattern: /^strawberry fanta$/i, code: 'FANTA_STRAWBERRY' },
  { pattern: /^schweppes (lime|manow|manao)$/i, code: 'SCHWEPPES_MANAO' },
];

// ─── MODIFIER → ADD-ON MAP ───────────────────────────────────────────────────
type AddonCode = 'BACON' | 'CHEESE' | 'JALAPENOS';
const MODIFIER_TO_ADDON: Array<{ pattern: RegExp; code: AddonCode }> = [
  { pattern: /crispy bacon/i, code: 'BACON' },
  { pattern: /🥓/u, code: 'BACON' },
  { pattern: /jalapenos?/i, code: 'JALAPENOS' },
  { pattern: /🌶️/u, code: 'JALAPENOS' },
  { pattern: /ฮาลาปิโน/u, code: 'JALAPENOS' },
  { pattern: /double cheese/i, code: 'CHEESE' },
  { pattern: /🧀/u, code: 'CHEESE' },
];

// ─── MODIFIER → BURGER MAP (for Mix & Match) ─────────────────────────────────
interface BurgerUsage {
  bunsPerUnit: number;
  beefServesPerUnit?: number;
  beefGramsPerUnit?: number;
  chickenServesPerUnit?: number;
  chickenGramsPerUnit?: number;
  baconPerUnit?: number;
}
const MODIFIER_TO_BURGER: Array<{ pattern: RegExp; usage: BurgerUsage }> = [
  { pattern: /^single smash burger/i, usage: { bunsPerUnit: 1, beefServesPerUnit: 1, beefGramsPerUnit: 95 } },
  { pattern: /^double smash burger/i, usage: { bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190 } },
  { pattern: /^triple smash burger/i, usage: { bunsPerUnit: 1, beefServesPerUnit: 3, beefGramsPerUnit: 285 } },
  { pattern: /^ultimate double/i, usage: { bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190 } },
  { pattern: /^super double bacon/i, usage: { bunsPerUnit: 1, beefServesPerUnit: 2, beefGramsPerUnit: 190, baconPerUnit: 1 } },
  { pattern: /crispy chicken/i, usage: { bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100 } },
  { pattern: /el smasho/i, usage: { bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100 } },
  { pattern: /karaage/i, usage: { bunsPerUnit: 1, chickenServesPerUnit: 1, chickenGramsPerUnit: 100 } },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
    friesUsed: 0,
    baconUsed: 0,
    cheeseUsed: 0,
    picklesUsed: 0,
    saladUsed: 0,
    tomatoUsed: 0,
    onionUsed: 0,
    burgerSauceUsed: 0,
    jalapenosUsed: 0,
    coleslawUsed: 0,
    isModifierEstimated: false,
  };
}

function addDrink(acc: DailyUsageRowAccumulator, code: DrinkCode, qty: number) {
  switch (code) {
    case 'COKE': acc.cokeUsed = zeroable(acc.cokeUsed) + qty; return;
    case 'COKE_ZERO': acc.cokeZeroUsed = zeroable(acc.cokeZeroUsed) + qty; return;
    case 'SPRITE': acc.spriteUsed = zeroable(acc.spriteUsed) + qty; return;
    case 'WATER': acc.waterUsed = zeroable(acc.waterUsed) + qty; return;
    case 'FANTA_ORANGE': acc.fantaOrangeUsed = zeroable(acc.fantaOrangeUsed) + qty; return;
    case 'FANTA_STRAWBERRY': acc.fantaStrawberryUsed = zeroable(acc.fantaStrawberryUsed) + qty; return;
    case 'SCHWEPPES_MANAO': acc.schweppesManaoUsed = zeroable(acc.schweppesManaoUsed) + qty; return;
  }
}

function addAddon(acc: DailyUsageRowAccumulator, code: AddonCode, qty: number) {
  switch (code) {
    case 'BACON': acc.baconUsed = zeroable(acc.baconUsed) + qty; return;
    case 'CHEESE': acc.cheeseUsed = zeroable(acc.cheeseUsed) + qty; return;
    case 'JALAPENOS': acc.jalapenosUsed = zeroable(acc.jalapenosUsed) + qty; return;
  }
}

function summarize(rows: DailyUsageRow[]): DailyUsageSummary {
  return rows.reduce<DailyUsageSummary>((acc, row) => {
    acc.expectedBuns += Number(row.bunsUsed || 0);
    acc.expectedBeefPatties += Number(row.beefServesUsed || 0);
    acc.expectedBeefGrams += Number(row.beefGramsUsed || 0);
    acc.expectedChickenGrams += Number(row.chickenGramsUsed || 0);
    acc.cokeUsed += Number(row.cokeUsed || 0);
    acc.cokeZeroUsed += Number(row.cokeZeroUsed || 0);
    acc.spriteUsed += Number(row.spriteUsed || 0);
    acc.waterUsed += Number(row.waterUsed || 0);
    acc.fantaOrangeUsed += Number(row.fantaOrangeUsed || 0);
    acc.fantaStrawberryUsed += Number(row.fantaStrawberryUsed || 0);
    acc.schweppesManaoUsed += Number(row.schweppesManaoUsed || 0);
    acc.friesUsed += Number(row.friesUsed || 0);
    acc.baconUsed += Number(row.baconUsed || 0);
    acc.cheeseUsed += Number(row.cheeseUsed || 0);
    acc.picklesUsed += Number(row.picklesUsed || 0);
    acc.saladUsed += Number(row.saladUsed || 0);
    acc.tomatoUsed += Number(row.tomatoUsed || 0);
    acc.onionUsed += Number(row.onionUsed || 0);
    acc.burgerSauceUsed += Number(row.burgerSauceUsed || 0);
    acc.jalapenosUsed += Number(row.jalapenosUsed || 0);
    acc.coleslawUsed += Number(row.coleslawUsed || 0);
    return acc;
  }, {
    expectedBuns: 0,
    expectedBeefPatties: 0,
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
    friesUsed: 0,
    baconUsed: 0,
    cheeseUsed: 0,
    picklesUsed: 0,
    saladUsed: 0,
    tomatoUsed: 0,
    onionUsed: 0,
    burgerSauceUsed: 0,
    jalapenosUsed: 0,
    coleslawUsed: 0,
  });
}

// ─── SEED & LOAD RULES ───────────────────────────────────────────────────────
async function ensureUsageRulesSeeded() {
  for (const rule of RULE_SEEDS) {
    if (rule.sku) {
      await db.execute(sql`DELETE FROM receipt_truth_usage_rule WHERE sku = ${rule.sku}`);
      await db.execute(sql`
        INSERT INTO receipt_truth_usage_rule
          (sku, item_name, direct_drink_code, requires_drink_modifier, requires_burger_modifier,
           buns_per_unit, beef_serves_per_unit, beef_grams_per_unit,
           chicken_serves_per_unit, chicken_grams_per_unit,
           fries_per_unit, bacon_per_unit, cheese_per_unit, pickles_per_unit,
           salad_per_unit, tomato_per_unit, onion_per_unit, burger_sauce_per_unit, jalapenos_per_unit,
           coleslaw_per_unit, modifier_drinks_expected, modifier_burgers_expected,
           notes, active)
        VALUES
          (${rule.sku}, ${rule.itemName ?? null}, ${rule.directDrinkCode ?? null},
           ${Boolean(rule.requiresDrinkModifier)}, ${Boolean(rule.requiresBurgerModifier)},
           ${rule.bunsPerUnit ?? null}, ${rule.beefServesPerUnit ?? null}, ${rule.beefGramsPerUnit ?? null},
           ${rule.chickenServesPerUnit ?? null}, ${rule.chickenGramsPerUnit ?? null},
           ${rule.friesPerUnit ?? null}, ${rule.baconPerUnit ?? null}, ${rule.cheesePerUnit ?? null},
           ${rule.picklesPerUnit ?? null}, ${rule.saladPerUnit ?? null}, ${rule.tomatoPerUnit ?? null},
           ${rule.onionPerUnit ?? null}, ${rule.burgerSaucePerUnit ?? null}, ${rule.jalapenosPerUnit ?? null},
           ${rule.coleslawPerUnit ?? null}, ${rule.modifierDrinksExpected ?? 1}, ${rule.modifierBurgersExpected ?? 1},
           ${rule.notes}, true)
      `);
      continue;
    }

    if (rule.itemName) {
      await db.execute(sql`DELETE FROM receipt_truth_usage_rule WHERE item_name = ${rule.itemName}`);
      await db.execute(sql`
        INSERT INTO receipt_truth_usage_rule
          (sku, item_name, direct_drink_code, requires_drink_modifier, requires_burger_modifier,
           buns_per_unit, beef_serves_per_unit, beef_grams_per_unit,
           chicken_serves_per_unit, chicken_grams_per_unit,
           fries_per_unit, bacon_per_unit, cheese_per_unit, pickles_per_unit,
           salad_per_unit, tomato_per_unit, onion_per_unit, burger_sauce_per_unit, jalapenos_per_unit,
           coleslaw_per_unit, modifier_drinks_expected, modifier_burgers_expected,
           notes, active)
        VALUES
          (NULL, ${rule.itemName}, ${rule.directDrinkCode ?? null},
           ${Boolean(rule.requiresDrinkModifier)}, ${Boolean(rule.requiresBurgerModifier)},
           ${rule.bunsPerUnit ?? null}, ${rule.beefServesPerUnit ?? null}, ${rule.beefGramsPerUnit ?? null},
           ${rule.chickenServesPerUnit ?? null}, ${rule.chickenGramsPerUnit ?? null},
           ${rule.friesPerUnit ?? null}, ${rule.baconPerUnit ?? null}, ${rule.cheesePerUnit ?? null},
           ${rule.picklesPerUnit ?? null}, ${rule.saladPerUnit ?? null}, ${rule.tomatoPerUnit ?? null},
           ${rule.onionPerUnit ?? null}, ${rule.burgerSaucePerUnit ?? null}, ${rule.jalapenosPerUnit ?? null},
           ${rule.coleslawPerUnit ?? null}, ${rule.modifierDrinksExpected ?? 1}, ${rule.modifierBurgersExpected ?? 1},
           ${rule.notes}, true)
      `);
    }
  }
}

async function loadUsageRules() {
  const result = await db.execute(sql`
    SELECT sku, item_name, direct_drink_code, requires_drink_modifier, requires_burger_modifier,
           buns_per_unit, beef_serves_per_unit, beef_grams_per_unit,
           chicken_serves_per_unit, chicken_grams_per_unit,
           fries_per_unit, bacon_per_unit, cheese_per_unit, pickles_per_unit,
           salad_per_unit, tomato_per_unit, onion_per_unit, burger_sauce_per_unit, jalapenos_per_unit,
           coleslaw_per_unit, COALESCE(modifier_drinks_expected, 1) AS modifier_drinks_expected,
           COALESCE(modifier_burgers_expected, 1) AS modifier_burgers_expected
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
      requiresBurgerModifier: Boolean(row.requires_burger_modifier),
      bunsPerUnit: row.buns_per_unit === null ? null : Number(row.buns_per_unit),
      beefServesPerUnit: row.beef_serves_per_unit === null ? null : Number(row.beef_serves_per_unit),
      beefGramsPerUnit: row.beef_grams_per_unit === null ? null : Number(row.beef_grams_per_unit),
      chickenServesPerUnit: row.chicken_serves_per_unit === null ? null : Number(row.chicken_serves_per_unit),
      chickenGramsPerUnit: row.chicken_grams_per_unit === null ? null : Number(row.chicken_grams_per_unit),
      friesPerUnit: row.fries_per_unit === null ? null : Number(row.fries_per_unit),
      baconPerUnit: row.bacon_per_unit === null ? null : Number(row.bacon_per_unit),
      cheesePerUnit: row.cheese_per_unit === null ? null : Number(row.cheese_per_unit),
      picklesPerUnit: row.pickles_per_unit === null ? null : Number(row.pickles_per_unit),
      saladPerUnit: row.salad_per_unit === null ? null : Number(row.salad_per_unit),
      tomatoPerUnit: row.tomato_per_unit === null ? null : Number(row.tomato_per_unit),
      onionPerUnit: row.onion_per_unit === null ? null : Number(row.onion_per_unit),
      burgerSaucePerUnit: row.burger_sauce_per_unit === null ? null : Number(row.burger_sauce_per_unit),
      jalapenosPerUnit: row.jalapenos_per_unit === null ? null : Number(row.jalapenos_per_unit),
      coleslawPerUnit: row.coleslaw_per_unit === null ? null : Number(row.coleslaw_per_unit),
      modifierDrinksExpected: Number(row.modifier_drinks_expected || 1),
      modifierBurgersExpected: Number(row.modifier_burgers_expected || 1),
    };

    if (parsed.sku) bySku.set(parsed.sku, parsed);
    if (parsed.itemName) byName.set(normalizeName(parsed.itemName), parsed);
  }

  return { bySku, byName };
}

function mapModifierToDrinkCode(modifierName: string): DrinkCode | null {
  const normalized = modifierName.trim();
  for (const mapping of MODIFIER_TO_DRINK) {
    if (mapping.pattern.test(normalized)) return mapping.code;
  }
  return null;
}

function mapModifierToAddonCode(modifierName: string): AddonCode | null {
  const normalized = modifierName.trim();
  for (const mapping of MODIFIER_TO_ADDON) {
    if (mapping.pattern.test(normalized)) return mapping.code;
  }
  return null;
}

function mapModifierToBurgerUsage(modifierName: string): BurgerUsage | null {
  const normalized = modifierName.trim();
  for (const mapping of MODIFIER_TO_BURGER) {
    if (mapping.pattern.test(normalized)) return mapping.usage;
  }
  return null;
}

// ─── BUILD ENGINE ─────────────────────────────────────────────────────────────
async function buildDailyUsage(businessDate: string): Promise<DailyUsageResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[DAILY_USAGE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  await ensureUsageRulesSeeded();

  const summaryCheck = await db.execute(sql`
    SELECT all_receipts, built_at FROM receipt_truth_summary WHERE business_date = ${businessDate}::date
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

  // Build modifier lookup maps
  const modifiersByReceiptSku = new Map<string, Map<DrinkCode, number>>();
  const modifiersByReceiptAny = new Map<string, Map<DrinkCode, number>>();
  // Addon modifiers keyed by receiptId
  const addonsByReceipt = new Map<string, Map<AddonCode, number>>();
  // Burger modifiers keyed by receiptId (for Mix & Match)
  const burgerModByReceipt = new Map<string, BurgerUsage[]>();

  for (const row of modifiersResult.rows as any[]) {
    const modName = String(row.modifier_name || '');
    const qty = Number(row.quantity || 0);
    const receiptId = String(row.receipt_id);
    const lineSku = row.line_sku ? String(row.line_sku) : null;

    // Drink modifiers
    const drinkCode = mapModifierToDrinkCode(modName);
    if (drinkCode) {
      const anyMap = modifiersByReceiptAny.get(receiptId) || new Map<DrinkCode, number>();
      anyMap.set(drinkCode, (anyMap.get(drinkCode) || 0) + qty);
      modifiersByReceiptAny.set(receiptId, anyMap);

      if (lineSku) {
        const key = `${receiptId}::${lineSku}`;
        const skuMap = modifiersByReceiptSku.get(key) || new Map<DrinkCode, number>();
        skuMap.set(drinkCode, (skuMap.get(drinkCode) || 0) + qty);
        modifiersByReceiptSku.set(key, skuMap);
      }
      continue;
    }

    // Add-on modifiers (bacon, cheese, jalapeños)
    const addonCode = mapModifierToAddonCode(modName);
    if (addonCode) {
      const aMap = addonsByReceipt.get(receiptId) || new Map<AddonCode, number>();
      aMap.set(addonCode, (aMap.get(addonCode) || 0) + qty);
      addonsByReceipt.set(receiptId, aMap);
      continue;
    }

    // Burger modifiers (Mix & Match)
    const burgerUsage = mapModifierToBurgerUsage(modName);
    if (burgerUsage) {
      const bList = burgerModByReceipt.get(receiptId) || [];
      for (let i = 0; i < qty; i++) bList.push(burgerUsage);
      burgerModByReceipt.set(receiptId, bList);
    }
  }

  // Group receipt lines
  const receiptItemGroups = new Map<string, {
    receiptId: string; sku: string | null; itemName: string; categoryName: string; quantitySold: number;
  }>();
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
    const rule = lookupRule || byName.get(normalizeName(group.itemName));

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
      acc.friesUsed = null;
      acc.baconUsed = null;
      acc.cheeseUsed = null;
      acc.picklesUsed = null;
      acc.saladUsed = null;
      acc.tomatoUsed = null;
      acc.onionUsed = null;
      acc.burgerSauceUsed = null;
      acc.jalapenosUsed = null;
      issues.push({
        type: 'UNMAPPED_ITEM',
        sku: group.sku,
        itemName: group.itemName,
        details: `No daily usage rule for SKU=${group.sku || 'NULL'} item=${group.itemName}`,
      });
      dayRows.set(rowKey, acc);
      continue;
    }

    // Apply rule-based fixed quantities
    acc.bunsUsed = zeroable(acc.bunsUsed) + (Number(rule.bunsPerUnit || 0) * group.quantitySold);
    acc.beefServesUsed = zeroable(acc.beefServesUsed) + (Number(rule.beefServesPerUnit || 0) * group.quantitySold);
    acc.beefGramsUsed = zeroable(acc.beefGramsUsed) + (Number(rule.beefGramsPerUnit || 0) * group.quantitySold);
    acc.chickenServesUsed = zeroable(acc.chickenServesUsed) + (Number(rule.chickenServesPerUnit || 0) * group.quantitySold);
    acc.chickenGramsUsed = zeroable(acc.chickenGramsUsed) + (Number(rule.chickenGramsPerUnit || 0) * group.quantitySold);
    acc.friesUsed = zeroable(acc.friesUsed) + (Number(rule.friesPerUnit || 0) * group.quantitySold);
    acc.baconUsed = zeroable(acc.baconUsed) + (Number(rule.baconPerUnit || 0) * group.quantitySold);
    acc.cheeseUsed = zeroable(acc.cheeseUsed) + (Number(rule.cheesePerUnit || 0) * group.quantitySold);
    acc.picklesUsed = zeroable(acc.picklesUsed) + (Number(rule.picklesPerUnit || 0) * group.quantitySold);
    acc.saladUsed = zeroable(acc.saladUsed) + (Number(rule.saladPerUnit || 0) * group.quantitySold);
    acc.tomatoUsed = zeroable(acc.tomatoUsed) + (Number(rule.tomatoPerUnit || 0) * group.quantitySold);
    acc.onionUsed = zeroable(acc.onionUsed) + (Number(rule.onionPerUnit || 0) * group.quantitySold);
    acc.burgerSauceUsed = zeroable(acc.burgerSauceUsed) + (Number(rule.burgerSaucePerUnit || 0) * group.quantitySold);
    acc.jalapenosUsed = zeroable(acc.jalapenosUsed) + (Number(rule.jalapenosPerUnit || 0) * group.quantitySold);
    acc.coleslawUsed = zeroable(acc.coleslawUsed) + (Number(rule.coleslawPerUnit || 0) * group.quantitySold);

    // Direct drink (standalone drink items)
    if (rule.directDrinkCode) {
      addDrink(acc, rule.directDrinkCode, group.quantitySold);
    }

    // Drink modifiers for sets
    // Loyverse returns ALL options in a modifier group (not just the selected one).
    // When totalDrinkInstances > quantitySold, this receipt shows the full modifier group.
    // Scale each drink's contribution proportionally so the total equals quantitySold.
    if (rule.requiresDrinkModifier) {
      const scopedMods = group.sku ? modifiersByReceiptSku.get(`${group.receiptId}::${group.sku}`) : undefined;
      const modMap = scopedMods || modifiersByReceiptAny.get(group.receiptId);

      if (!modMap || modMap.size === 0) {
        issues.push({ type: 'SET_DRINK_MODIFIER_MISSING', sku: group.sku, itemName: group.itemName, details: `Meal-set drinks missing for receipt ${group.receiptId} SKU=${group.sku || 'NULL'}` });
      } else {
        // Total raw drink instances on this receipt
        let totalDrinkInstances = 0;
        for (const qty of modMap.values()) totalDrinkInstances += qty;

        // modifierDrinksExpected: how many drinks per unit sold (default 1, Mix&Match = 2)
        // Loyverse may return ALL modifier-group options — scale to match expected total.
        const expectedDrinkTotal = (rule.modifierDrinksExpected || 1) * group.quantitySold;
        const drinkScale = totalDrinkInstances > expectedDrinkTotal
          ? expectedDrinkTotal / totalDrinkInstances
          : 1;
        // Mark as estimated when Loyverse returned more options than expected drinks
        // (full-group display) — type split cannot be verified from receipt data
        if (totalDrinkInstances !== expectedDrinkTotal) acc.isModifierEstimated = true;

        let scaledDrinkTotal = 0;
        for (const [drinkCode, qty] of modMap.entries()) {
          const scaledQty = qty * drinkScale;
          addDrink(acc, drinkCode, scaledQty);
          scaledDrinkTotal += scaledQty;
        }

        if (scaledDrinkTotal < expectedDrinkTotal - 0.01) {
          issues.push({ type: 'SET_DRINK_MODIFIER_PARTIAL', sku: group.sku, itemName: group.itemName, details: `Meal-set drinks partial for receipt ${group.receiptId}: expected ${expectedDrinkTotal}, found ${scaledDrinkTotal.toFixed(2)}` });
        }
      }
    }

    // Burger modifiers for Mix & Match
    // modifierBurgersExpected: how many burgers per unit sold (default 1, Mix&Match = 2)
    // Loyverse may return ALL options in the "Burger Option" modifier group — scale to match expected.
    // isModifierEstimated = true only when Loyverse returned more options than expected (full-group
    // display), meaning the type-level split was spread proportionally and cannot be verified.
    // When modifier count exactly equals expected total, the split is treated as exact.
    if (rule.requiresBurgerModifier) {
      const burgerMods = burgerModByReceipt.get(group.receiptId);
      if (burgerMods && burgerMods.length > 0) {
        const expectedBurgerTotal = (rule.modifierBurgersExpected || 1) * group.quantitySold;
        const burgerScale = burgerMods.length > expectedBurgerTotal
          ? expectedBurgerTotal / burgerMods.length
          : 1;
        // Only mark estimated when Loyverse returned more modifier rows than expected (scaled down)
        if (burgerMods.length > expectedBurgerTotal) acc.isModifierEstimated = true;
        for (const bu of burgerMods) {
          acc.bunsUsed = zeroable(acc.bunsUsed) + (bu.bunsPerUnit || 0) * burgerScale;
          acc.beefServesUsed = zeroable(acc.beefServesUsed) + (bu.beefServesPerUnit || 0) * burgerScale;
          acc.beefGramsUsed = zeroable(acc.beefGramsUsed) + (bu.beefGramsPerUnit || 0) * burgerScale;
          acc.chickenServesUsed = zeroable(acc.chickenServesUsed) + (bu.chickenServesPerUnit || 0) * burgerScale;
          acc.chickenGramsUsed = zeroable(acc.chickenGramsUsed) + (bu.chickenGramsPerUnit || 0) * burgerScale;
          if (bu.baconPerUnit) acc.baconUsed = zeroable(acc.baconUsed) + bu.baconPerUnit * burgerScale;
        }
      }
    }

    dayRows.set(rowKey, acc);
  }

  // Addon modifiers (bacon, cheese, jalapeños) are attached to individual line items in Loyverse
  // but the modifier_effective table groups by receipt_id only (losing line_sku).
  // To avoid over-counting (applying once per every item on a receipt), we aggregate the
  // add-on modifier totals across the entire shift and store them in a single synthetic row.
  let shiftAddonBacon = 0;
  let shiftAddonCheese = 0;
  let shiftAddonJalapenos = 0;
  for (const addonMap of addonsByReceipt.values()) {
    shiftAddonBacon += addonMap.get('BACON') || 0;
    shiftAddonCheese += addonMap.get('CHEESE') || 0;
    shiftAddonJalapenos += addonMap.get('JALAPENOS') || 0;
  }
  if (shiftAddonBacon > 0 || shiftAddonCheese > 0 || shiftAddonJalapenos > 0) {
    const addonKey = 'MODIFIER ADD-ONS::null::Add-ons via Modifier (shift total)';
    const addonAcc = createEmptyAccumulator(businessDate, 'MODIFIER ADD-ONS', null, 'Add-ons via Modifier (shift total)');
    addonAcc.quantitySold = shiftAddonBacon + shiftAddonCheese + shiftAddonJalapenos;
    addonAcc.baconUsed = shiftAddonBacon;
    addonAcc.cheeseUsed = shiftAddonCheese;
    addonAcc.jalapenosUsed = shiftAddonJalapenos;
    dayRows.set(addonKey, addonAcc);
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
      friesUsed: round4(row.friesUsed),
      baconUsed: round4(row.baconUsed),
      cheeseUsed: round4(row.cheeseUsed),
      picklesUsed: round4(row.picklesUsed),
      saladUsed: round4(row.saladUsed),
      tomatoUsed: round4(row.tomatoUsed),
      onionUsed: round4(row.onionUsed),
      burgerSauceUsed: round4(row.burgerSauceUsed),
      jalapenosUsed: round4(row.jalapenosUsed),
      coleslawUsed: round4(row.coleslawUsed),
      isModifierEstimated: row.isModifierEstimated,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || (a.sku || '').localeCompare(b.sku || '') || a.itemName.localeCompare(b.itemName));

  const summary = summarize(rows);
  summary.totalDrinksUsed =
    summary.cokeUsed + summary.cokeZeroUsed + summary.spriteUsed + summary.waterUsed +
    summary.fantaOrangeUsed + summary.fantaStrawberryUsed + summary.schweppesManaoUsed;

  const receiptTruthBuiltAt = (summaryCheck.rows[0] as any)?.built_at
    ? new Date((summaryCheck.rows[0] as any).built_at).toISOString()
    : null;

  return { date: businessDate, summary, rows, issues, receiptTruthBuiltAt, dailyUsageBuiltAt: null };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export async function rebuildReceiptTruthDailyUsage(businessDate: string): Promise<DailyUsageRebuildResult> {
  await ensureTables();
  const built = await buildDailyUsage(businessDate);

  await db.execute(sql`DELETE FROM receipt_truth_daily_usage WHERE business_date = ${businessDate}::date`);

  for (const row of built.rows) {
    await db.execute(sql`
      INSERT INTO receipt_truth_daily_usage
        (business_date, shift_key, category_name, sku, item_name, quantity_sold,
         buns_used, beef_serves_used, beef_grams_used, chicken_serves_used, chicken_grams_used,
         coke_used, coke_zero_used, sprite_used, water_used, fanta_orange_used, fanta_strawberry_used, schweppes_manao_used,
         fries_used, bacon_used, cheese_used, pickles_used, salad_used, tomato_used, onion_used, burger_sauce_used, jalapenos_used,
         coleslaw_used, is_modifier_estimated, built_at)
      VALUES
        (${row.businessDate}::date, ${row.shiftKey}, ${row.categoryName}, ${row.sku}, ${row.itemName}, ${row.quantitySold},
         ${row.bunsUsed}, ${row.beefServesUsed}, ${row.beefGramsUsed}, ${row.chickenServesUsed}, ${row.chickenGramsUsed},
         ${row.cokeUsed}, ${row.cokeZeroUsed}, ${row.spriteUsed}, ${row.waterUsed}, ${row.fantaOrangeUsed}, ${row.fantaStrawberryUsed}, ${row.schweppesManaoUsed},
         ${row.friesUsed}, ${row.baconUsed}, ${row.cheeseUsed}, ${row.picklesUsed}, ${row.saladUsed}, ${row.tomatoUsed}, ${row.onionUsed}, ${row.burgerSauceUsed}, ${row.jalapenosUsed},
         ${row.coleslawUsed}, ${row.isModifierEstimated}, NOW())
    `);
  }

  const nowIso = new Date().toISOString();
  return { ok: true, ...built, dailyUsageBuiltAt: nowIso, rowsStored: built.rows.length };
}

export async function getReceiptTruthDailyUsage(businessDate: string): Promise<DailyUsageResponse | null> {
  await ensureTables();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[DAILY_USAGE_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const result = await db.execute(sql`
    SELECT business_date, shift_key, category_name, sku, item_name, quantity_sold,
           buns_used, beef_serves_used, beef_grams_used,
           chicken_serves_used, chicken_grams_used,
           coke_used, coke_zero_used, sprite_used, water_used,
           fanta_orange_used, fanta_strawberry_used, schweppes_manao_used,
           fries_used, bacon_used, cheese_used, pickles_used, salad_used, tomato_used,
           onion_used, burger_sauce_used, jalapenos_used,
           coleslaw_used, COALESCE(is_modifier_estimated, false) AS is_modifier_estimated,
           built_at
    FROM receipt_truth_daily_usage
    WHERE business_date = ${businessDate}::date
    ORDER BY category_name, sku, item_name
  `);

  if (!result.rows || result.rows.length === 0) return null;

  const dailyUsageBuiltAt = (result.rows[0] as any)?.built_at
    ? new Date((result.rows[0] as any).built_at).toISOString()
    : null;

  const truthCheck = await db.execute(sql`
    SELECT built_at FROM receipt_truth_summary WHERE business_date = ${businessDate}::date LIMIT 1
  `);
  const receiptTruthBuiltAt = (truthCheck.rows[0] as any)?.built_at
    ? new Date((truthCheck.rows[0] as any).built_at).toISOString()
    : null;

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
    friesUsed: row.fries_used === null ? null : Number(row.fries_used),
    baconUsed: row.bacon_used === null ? null : Number(row.bacon_used),
    cheeseUsed: row.cheese_used === null ? null : Number(row.cheese_used),
    picklesUsed: row.pickles_used === null ? null : Number(row.pickles_used),
    saladUsed: row.salad_used === null ? null : Number(row.salad_used),
    tomatoUsed: row.tomato_used === null ? null : Number(row.tomato_used),
    onionUsed: row.onion_used === null ? null : Number(row.onion_used),
    burgerSauceUsed: row.burger_sauce_used === null ? null : Number(row.burger_sauce_used),
    jalapenosUsed: row.jalapenos_used === null ? null : Number(row.jalapenos_used),
    coleslawUsed: row.coleslaw_used === null ? null : Number(row.coleslaw_used),
    isModifierEstimated: Boolean(row.is_modifier_estimated),
  }));

  const summary = summarize(rows);
  summary.totalDrinksUsed =
    summary.cokeUsed + summary.cokeZeroUsed + summary.spriteUsed + summary.waterUsed +
    summary.fantaOrangeUsed + summary.fantaStrawberryUsed + summary.schweppesManaoUsed;

  const issues: UsageIssue[] = rows
    .filter((row) => row.bunsUsed === null && row.beefGramsUsed === null && row.chickenGramsUsed === null && row.cokeUsed === null)
    .map((row) => ({
      type: 'UNMAPPED_ITEM' as const,
      sku: row.sku,
      itemName: row.itemName,
      details: `Stored daily usage row contains NULL usage columns for ${row.itemName}`,
    }));

  return { date: businessDate, summary, rows, issues, receiptTruthBuiltAt, dailyUsageBuiltAt };
}
