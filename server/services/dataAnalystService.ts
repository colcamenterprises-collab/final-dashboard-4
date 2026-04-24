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
    stock_start: string;
    purchases: string;
    stock_end: string;
  };
  blockers: Blocker[];
  data: {
    drinks: Array<{
      sku: string;
      itemName: string;
      soldDirect: number;
      soldFromModifiers: number;
      totalSold: number;
      start: number | null;
      purchased: number | null;
      end: number | null;
      expected: number | null;
      variance: number | null;
      varianceFlag: "OK" | "THRESHOLD_EXCEEDED" | null;
      notes: string[];
    }>;
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

function addUniqueNote(notes: string[], note: string) {
  if (!notes.includes(note)) notes.push(note);
}

function parseStockJsonToNameQty(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, qty] of Object.entries(raw as Record<string, unknown>)) {
    const k = normalizeName(name);
    if (!k) continue;
    out.set(k, asNum(qty));
  }
  return out;
}

function codeFromModifierName(modifierName: string): string | null {
  const n = normalizeName(modifierName).replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    coke: "COKE",
    cocacola: "COKE",
    cokezero: "COKE_ZERO",
    cocacolazero: "COKE_ZERO",
    sprite: "SPRITE",
    water: "WATER",
    bottledwater: "WATER",
    fantaorange: "FANTA_ORANGE",
    fantastrawberry: "FANTA_STRAWBERRY",
    schweppesmanao: "SCHWEPPES_MANAO",
  };
  return map[n] || null;
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
        receipts_modifiers: "receipt_truth_modifier_aggregate (raw modifier selections)",
        stock_start: "daily_stock_v2(drink_stock_json) prior shift; fallback daily_sales_v2 payload.drinkStock",
        purchases: "purchase_tally.date + purchase_tally_drink",
        stock_end: "daily_stock_v2(drink_stock_json) current shift; fallback daily_sales_v2 payload.drinkStock",
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

  const prevDate = new Date(`${date}T00:00:00Z`);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const prevDateIso = prevDate.toISOString().slice(0, 10);

  const [
    modifierAggResult,
    stockEndResult,
    stockStartResult,
    salesEndFallbackResult,
    salesStartFallbackResult,
    purchasesResult,
    purchaseUnresolvedResult,
  ] = await Promise.all([
    pool.query(
      `SELECT modifier_name, SUM(total_quantity)::numeric AS qty
       FROM receipt_truth_modifier_aggregate
       WHERE business_date = $1::date
       GROUP BY modifier_name`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT drink_stock_json
       FROM daily_stock_v2
       WHERE shift_date = $1::date
       ORDER BY created_at DESC
       LIMIT 1`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT drink_stock_json
       FROM daily_stock_v2
       WHERE shift_date = $1::date
       ORDER BY created_at DESC
       LIMIT 1`,
      [prevDateIso],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT payload->'drinkStock' AS drink_stock_json
       FROM daily_sales_v2
       WHERE "shiftDate" = $1
       ORDER BY "submittedAtISO" DESC NULLS LAST
       LIMIT 1`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT payload->'drinkStock' AS drink_stock_json
       FROM daily_sales_v2
       WHERE "shiftDate" = $1
       ORDER BY "submittedAtISO" DESC NULLS LAST
       LIMIT 1`,
      [prevDateIso],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT
         COALESCE(NULLIF(d.item_sku, ''), utr.sku)::text AS sku,
         SUM(d.qty)::numeric AS qty
       FROM purchase_tally_drink d
       JOIN purchase_tally t ON t.id = d.tally_id
       LEFT JOIN receipt_truth_usage_rule utr
         ON utr.active = true
        AND lower(trim(utr.item_name)) = lower(trim(d.item_name))
       WHERE t.date = $1::date
       GROUP BY COALESCE(NULLIF(d.item_sku, ''), utr.sku)`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT d.item_name, SUM(d.qty)::numeric AS qty
       FROM purchase_tally_drink d
       JOIN purchase_tally t ON t.id = d.tally_id
       LEFT JOIN receipt_truth_usage_rule utr
         ON utr.active = true
        AND lower(trim(utr.item_name)) = lower(trim(d.item_name))
       WHERE t.date = $1::date
         AND COALESCE(NULLIF(d.item_sku, ''), utr.sku) IS NULL
       GROUP BY d.item_name`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
  ]);

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
  const codeToSkus = new Map<string, string[]>();
  const skuToName = new Map<string, string>();
  for (const rule of usageRules) {
    if (rule.sku) ruleBySku.set(String(rule.sku), rule);
    if (rule.item_name) ruleByName.set(normalizeName(String(rule.item_name)), rule);
    if (rule.sku && rule.item_name) skuToName.set(String(rule.sku), String(rule.item_name));
    if (rule.direct_drink_code && rule.sku) {
      const code = String(rule.direct_drink_code);
      const existing = codeToSkus.get(code) || [];
      if (!existing.includes(String(rule.sku))) existing.push(String(rule.sku));
      codeToSkus.set(code, existing);
    }
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
  for (const row of setRows) friesGeneratedFromSets += asNum(row.fries_used);

  for (const row of modifierAggResult.rows as any[]) {
    const code = codeFromModifierName(String(row.modifier_name || ""));
    if (!code) {
      blockers.push({
        code: "AMBIGUOUS_MAPPING",
        message: `Modifier "${String(row.modifier_name)}" cannot be mapped deterministically to a drink code/SKU.`,
        where: "receipt_truth_modifier_aggregate.modifier_name",
        canonical_source: "receipt_truth_modifier_aggregate",
        auto_build_attempted: false,
      });
      continue;
    }
    modifierDrinkByCode[code] = (modifierDrinkByCode[code] || 0) + asNum(row.qty);
  }

  const endStockRaw = stockEndResult.rows[0]?.drink_stock_json ?? salesEndFallbackResult.rows[0]?.drink_stock_json ?? null;
  const startStockRaw = stockStartResult.rows[0]?.drink_stock_json ?? salesStartFallbackResult.rows[0]?.drink_stock_json ?? null;
  const endStockByName = parseStockJsonToNameQty(endStockRaw);
  const startStockByName = parseStockJsonToNameQty(startStockRaw);
  const purchasedBySku = new Map<string, number>();
  for (const row of purchasesResult.rows as any[]) {
    if (!row.sku) continue;
    purchasedBySku.set(String(row.sku), (purchasedBySku.get(String(row.sku)) || 0) + asNum(row.qty));
  }

  for (const row of purchaseUnresolvedResult.rows as any[]) {
    blockers.push({
      code: "AMBIGUOUS_MAPPING",
      message: `Purchased drink "${String(row.item_name)}" (${asNum(row.qty)}) has no deterministic SKU mapping.`,
      where: "purchase_tally_drink.item_name",
      canonical_source: "purchase_tally_drink + receipt_truth_usage_rule",
      auto_build_attempted: false,
    });
  }

  const modifierBySku = new Map<string, number>();
  for (const [code, qty] of Object.entries(modifierDrinkByCode)) {
    const skus = codeToSkus.get(code) || [];
    if (skus.length !== 1) {
      if (qty > 0) {
        blockers.push({
          code: "AMBIGUOUS_MAPPING",
          message: `${code} has ${skus.length} deterministic SKU mappings; modifier qty ${qty} excluded.`,
          where: "receipt_truth_usage_rule.direct_drink_code",
          canonical_source: "receipt_truth_usage_rule",
          auto_build_attempted: false,
        });
      }
      continue;
    }
    modifierBySku.set(skus[0], (modifierBySku.get(skus[0]) || 0) + qty);
  }

  const allDrinkSkus = new Set<string>();
  for (const sku of drinkDirectBySku.keys()) allDrinkSkus.add(sku);
  for (const sku of modifierBySku.keys()) allDrinkSkus.add(sku); // include modifier-only SKU rows
  for (const sku of purchasedBySku.keys()) allDrinkSkus.add(sku);
  for (const sku of skuToName.keys()) allDrinkSkus.add(sku);

  const drinks = Array.from(allDrinkSkus.values())
    .map((sku) => {
      const direct = drinkDirectBySku.get(sku);
      const itemName = skuToName.get(sku) || `SKU ${sku}`;
      const soldDirect = direct?.soldDirect || 0;
      const soldFromModifiers = modifierBySku.get(sku) || 0;
      const totalSold = soldDirect + soldFromModifiers;
      const start = startStockByName.has(normalizeName(itemName)) ? asNum(startStockByName.get(normalizeName(itemName))) : null;
      const end = endStockByName.has(normalizeName(itemName)) ? asNum(endStockByName.get(normalizeName(itemName))) : null;
      const purchased = purchasedBySku.has(sku) ? asNum(purchasedBySku.get(sku)) : 0;
      const notes: string[] = [];
      if (start === null || end === null) addUniqueNote(notes, "incomplete_component_data");
      if (soldFromModifiers === 0 && (modifierDrinkByCode[direct?.code || ""] || 0) > 0) addUniqueNote(notes, "AMBIGUOUS_MAPPING");
      const expected = start === null || end === null ? null : start + purchased - totalSold;
      const variance = expected === null ? null : end - expected;
      const varianceFlag = variance === null ? null : Math.abs(variance) > 2 ? "THRESHOLD_EXCEEDED" : "OK";
      return {
        sku,
        itemName,
        soldDirect,
        soldFromModifiers,
        totalSold,
        start,
        purchased,
        end,
        expected,
        variance,
        varianceFlag,
        notes,
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

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
      receipts_modifiers: "receipt_truth_modifier_aggregate (modifier selections only)",
      stock_start: "daily_stock_v2(drink_stock_json) previous shift; fallback daily_sales_v2 payload.drinkStock",
      purchases: "purchase_tally.date (effective date) + purchase_tally_drink aggregated by SKU",
      stock_end: "daily_stock_v2(drink_stock_json) current shift; fallback daily_sales_v2 payload.drinkStock",
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
