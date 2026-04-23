import { pool } from "../db";

export type Blocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: boolean;
};

export type AnalystLine = {
  itemName: string;
  soldCount: number;
};

export type AnalystModifierLine = {
  modifierType: string;
  item: string;
  count: number;
};

export type DailyAnalysisResult = {
  ok: true;
  date: string;
  source: {
    receipts_items: string;
    receipts_modifiers: string;
    daily_sales_stock_v2: string;
  };
  blockers: Blocker[];
  data: {
    drinks: Array<{ sku: string; soldDirect: number; soldFromModifiers: number; totalSold: number }>;
    burgers: Array<AnalystLine & { type: "Single" | "Double" | "Set" }>;
    sides: AnalystLine[];
    modifiers: AnalystModifierLine[];
  };
};

const DRINK_CODE_LABELS: Record<string, string> = {
  COKE: "Coke",
  COKE_ZERO: "Coke Zero",
  SPRITE: "Sprite",
  WATER: "Water",
  FANTA_ORANGE: "Fanta Orange",
  FANTA_STRAWBERRY: "Fanta Strawberry",
  SCHWEPPES_MANAO: "Schweppes Manao",
};

function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

function asNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function getDailyAnalysis(date: string): Promise<DailyAnalysisResult> {
  const blockers: Blocker[] = [];

  if (!pool) {
    blockers.push({
      code: "DB_UNAVAILABLE",
      message: "Database connection is unavailable; cannot read receipt_truth_daily_usage or receipt_truth_usage_rule.",
      where: "server/db",
      canonical_source: "DATABASE_URL / Postgres",
      auto_build_attempted: false,
    });

    return {
      ok: true,
      date,
      source: {
        receipts_items: "receipt_truth_daily_usage / receipt_truth_line derived",
        receipts_modifiers: "receipt_truth_daily_usage (set drink usage from modifiers)",
        daily_sales_stock_v2: "reserved for later phases",
      },
      blockers,
      data: {
        drinks: [],
        burgers: [],
        sides: [],
        modifiers: [],
      },
    };
  }

  const [usageRowsResult, usageRulesResult] = await Promise.all([
    pool.query(
      `SELECT category_name, sku, item_name, quantity_sold,
              coke_used, coke_zero_used, sprite_used, water_used,
              fanta_orange_used, fanta_strawberry_used, schweppes_manao_used,
              fries_used
       FROM receipt_truth_daily_usage
       WHERE business_date = $1::date`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT sku, item_name, direct_drink_code, requires_drink_modifier,
              fries_per_unit, beef_serves_per_unit, chicken_serves_per_unit
       FROM receipt_truth_usage_rule
       WHERE active = true`,
    ).catch(() => ({ rows: [] } as any)),
  ]);

  const usageRows = usageRowsResult.rows as any[];
  const usageRules = usageRulesResult.rows as any[];

  if (usageRows.length === 0) {
    blockers.push({
      code: "DAILY_USAGE_NOT_BUILT",
      message: `No receipt_truth_daily_usage rows found for ${date}.`,
      where: "receipt_truth_daily_usage",
      canonical_source: "Loyverse receipts + receipt modifiers",
      auto_build_attempted: false,
    });
  }

  if (usageRules.length === 0) {
    blockers.push({
      code: "USAGE_RULES_MISSING",
      message: "No active usage rules found. Set detection and drink mapping are unavailable.",
      where: "receipt_truth_usage_rule",
      canonical_source: "receipt_truth_usage_rule",
      auto_build_attempted: false,
    });
  }

  const ruleBySku = new Map<string, any>();
  const ruleByName = new Map<string, any>();
  for (const rule of usageRules) {
    if (rule.sku) ruleBySku.set(String(rule.sku), rule);
    if (rule.item_name) ruleByName.set(normalizeName(String(rule.item_name)), rule);
  }

  const directDrinkRows = usageRows.filter((row) => {
    const rule = (row.sku && ruleBySku.get(String(row.sku))) || ruleByName.get(normalizeName(String(row.item_name || "")));
    return !!rule?.direct_drink_code;
  });

  const drinkDirectBySku = new Map<string, { sku: string; soldDirect: number; code: string }>();
  for (const row of directDrinkRows) {
    const rule = (row.sku && ruleBySku.get(String(row.sku))) || ruleByName.get(normalizeName(String(row.item_name || "")));
    const sku = String(row.sku);
    const current = drinkDirectBySku.get(sku) || { sku, soldDirect: 0, code: String(rule.direct_drink_code) };
    current.soldDirect += asNum(row.quantity_sold);
    drinkDirectBySku.set(sku, current);
  }

  const setRows = usageRows.filter((row) => {
    const rule = (row.sku && ruleBySku.get(String(row.sku))) || ruleByName.get(normalizeName(String(row.item_name || "")));
    return !!rule?.requires_drink_modifier;
  });

  const modifierDrinkByCode = {
    COKE: 0,
    COKE_ZERO: 0,
    SPRITE: 0,
    WATER: 0,
    FANTA_ORANGE: 0,
    FANTA_STRAWBERRY: 0,
    SCHWEPPES_MANAO: 0,
  } as Record<string, number>;

  let friesGeneratedFromSets = 0;
  for (const row of setRows) {
    modifierDrinkByCode.COKE += asNum(row.coke_used);
    modifierDrinkByCode.COKE_ZERO += asNum(row.coke_zero_used);
    modifierDrinkByCode.SPRITE += asNum(row.sprite_used);
    modifierDrinkByCode.WATER += asNum(row.water_used);
    modifierDrinkByCode.FANTA_ORANGE += asNum(row.fanta_orange_used);
    modifierDrinkByCode.FANTA_STRAWBERRY += asNum(row.fanta_strawberry_used);
    modifierDrinkByCode.SCHWEPPES_MANAO += asNum(row.schweppes_manao_used);
    friesGeneratedFromSets += asNum(row.fries_used);
  }

  const codeToSkus = new Map<string, string[]>();
  for (const rule of usageRules) {
    if (!rule.direct_drink_code || !rule.sku) continue;
    const key = String(rule.direct_drink_code);
    const existing = codeToSkus.get(key) || [];
    if (!existing.includes(String(rule.sku))) existing.push(String(rule.sku));
    codeToSkus.set(key, existing);
  }

  const drinks = Array.from(drinkDirectBySku.values())
    .map((row) => {
      const mappedSkus = codeToSkus.get(row.code) || [];
      const soldFromModifiers = mappedSkus.length === 1 ? modifierDrinkByCode[row.code] || 0 : 0;
      return {
        sku: row.sku,
        soldDirect: row.soldDirect,
        soldFromModifiers,
        totalSold: row.soldDirect + soldFromModifiers,
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

  for (const [code, skus] of codeToSkus.entries()) {
    if (skus.length > 1 && (modifierDrinkByCode[code] || 0) > 0) {
      blockers.push({
        code: "AMBIGUOUS_DRINK_CODE_TO_SKU",
        message: `${code} has ${skus.length} SKUs (${skus.join(", ")}) so modifier drinks were not assigned to a single SKU.`,
        where: "receipt_truth_usage_rule.direct_drink_code",
        canonical_source: "receipt_truth_usage_rule",
        auto_build_attempted: false,
      });
    }
  }

  const burgers = usageRows
    .map((row) => {
      const rule = (row.sku && ruleBySku.get(String(row.sku))) || ruleByName.get(normalizeName(String(row.item_name || "")));
      if (!rule) return null;
      const beef = asNum(rule.beef_serves_per_unit);
      const chicken = asNum(rule.chicken_serves_per_unit);
      const isSet = !!rule.requires_drink_modifier;
      const isBurgerLike = isSet || beef > 0 || chicken > 0;
      if (!isBurgerLike) return null;

      let type: "Single" | "Double" | "Set" = "Single";
      if (isSet) {
        type = "Set";
      } else {
        const patties = Math.max(beef, chicken);
        type = patties >= 2 ? "Double" : "Single";
      }

      return {
        itemName: String(row.item_name),
        soldCount: asNum(row.quantity_sold),
        type,
      };
    })
    .filter(Boolean) as Array<AnalystLine & { type: "Single" | "Double" | "Set" }>;

  const sides = usageRows
    .map((row) => {
      const rule = (row.sku && ruleBySku.get(String(row.sku))) || ruleByName.get(normalizeName(String(row.item_name || "")));
      const category = String(row.category_name || "");
      if (!rule) return null;
      if (rule.requires_drink_modifier) return null;
      if (!/side/i.test(category)) return null;
      return {
        itemName: String(row.item_name),
        soldCount: asNum(row.quantity_sold),
      };
    })
    .filter(Boolean) as AnalystLine[];

  const modifiers: AnalystModifierLine[] = [];
  for (const code of Object.keys(modifierDrinkByCode)) {
    const count = modifierDrinkByCode[code] || 0;
    if (count > 0) {
      modifiers.push({
        modifierType: "Drink selection from sets",
        item: DRINK_CODE_LABELS[code] || code,
        count,
      });
    }
  }
  if (friesGeneratedFromSets > 0) {
    modifiers.push({
      modifierType: "Fries generated from sets",
      item: "Fries",
      count: friesGeneratedFromSets,
    });
  }

  return {
    ok: true,
    date,
    source: {
      receipts_items: "receipt_truth_daily_usage / receipt_truth_line derived",
      receipts_modifiers: "receipt_truth_daily_usage (set drink usage from modifiers)",
      daily_sales_stock_v2: "reserved for later phases",
    },
    blockers,
    data: {
      drinks,
      burgers,
      sides,
      modifiers,
    },
  };
}
