/**
 * Usage Reconciliation Service
 * GET /api/analysis/usage-reconciliation?date=YYYY-MM-DD
 *
 * Compares POS-receipt-derived expected stock usage (from receipt_truth_daily_usage)
 * against physical stock counts from Form 2 (daily_stock_v2) and received stock
 * (stock_received_log), producing variance data with severity thresholds.
 *
 * Physical usage formula:  opening + received - closing = physical_used
 * Variance:                physical_used - expected_used  (positive = unexplained usage)
 *
 * Severity thresholds:
 *   buns        warn > 5,   critical > 10
 *   meat (g)    warn > 500, critical > 1000
 *   drinks/type warn > 2,   critical > 4
 */

import { pool } from "../../db";

// ─── Drink name → engine field mapping ───────────────────────────────────────

const DRINK_NAME_MAP: Record<string, string> = {
  "coke":                "coke",
  "coke zero":           "cokeZero",
  "sprite":              "sprite",
  "bottled water":       "water",
  "bottle water":        "water",
  "soda water":          "water",
  "water":               "water",
  "fanta orange":        "fantaOrange",
  "orange fanta":        "fantaOrange",
  "fanta strawberry":    "fantaStrawberry",
  "strawberry fanta":    "fantaStrawberry",
  "schweppes manow":     "schweppesManao",
  "schweppes manao":     "schweppesManao",
  "schweppes lime":      "schweppesManao",
};

// Engine drink fields and their human labels
const DRINK_FIELDS: { field: string; label: string }[] = [
  { field: "coke",           label: "Coke" },
  { field: "cokeZero",       label: "Coke Zero" },
  { field: "sprite",         label: "Sprite" },
  { field: "water",          label: "Water" },
  { field: "fantaOrange",    label: "Fanta Orange" },
  { field: "fantaStrawberry",label: "Fanta Strawberry" },
  { field: "schweppesManao", label: "Schweppes Manao" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severity(variance: number | null, warnAt: number, criticalAt: number): "ok" | "warn" | "critical" | "unknown" {
  if (variance === null) return "unknown";
  const abs = Math.abs(variance);
  if (abs > criticalAt) return "critical";
  if (abs > warnAt) return "warn";
  return "ok";
}

function prevDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function normDrinkKey(key: string): string {
  return DRINK_NAME_MAP[key.toLowerCase().trim()] ?? null;
}

/** Collapse a drinksJson object from Form 2 into the engine field buckets. */
function collapseDrinksJson(drinksJson: Record<string, number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!drinksJson) return out;
  for (const [raw, qty] of Object.entries(drinksJson)) {
    const field = normDrinkKey(raw);
    if (field) out[field] = (out[field] ?? 0) + Number(qty);
  }
  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getUsageReconciliation(date: string) {
  if (!pool) throw new Error("Database unavailable");

  const prev = prevDate(date);

  // 1. Engine expected usage for this date
  const engineResult = await pool.query(
    `SELECT
       SUM(COALESCE(buns_used, 0))              AS buns_expected,
       SUM(COALESCE(beef_serves_used, 0))        AS patties_expected,
       SUM(COALESCE(beef_grams_used, 0))         AS beef_g_expected,
       SUM(COALESCE(chicken_grams_used, 0))      AS chicken_g_expected,
       SUM(COALESCE(fries_used, 0))              AS fries_expected,
       SUM(COALESCE(coleslaw_used, 0))           AS coleslaw_expected,
       SUM(COALESCE(coke_used, 0))               AS coke_expected,
       SUM(COALESCE(coke_zero_used, 0))          AS coke_zero_expected,
       SUM(COALESCE(sprite_used, 0))             AS sprite_expected,
       SUM(COALESCE(water_used, 0))              AS water_expected,
       SUM(COALESCE(fanta_orange_used, 0))       AS fanta_orange_expected,
       SUM(COALESCE(fanta_strawberry_used, 0))   AS fanta_strawberry_expected,
       SUM(COALESCE(schweppes_manao_used, 0))    AS schweppes_manao_expected,
       COUNT(*)                                  AS row_count,
       COUNT(*) FILTER (WHERE buns_used IS NULL AND beef_grams_used IS NULL
                          AND chicken_grams_used IS NULL AND coke_used IS NULL
                          AND fries_used IS NULL)  AS unmapped_count,
       COUNT(*) FILTER (WHERE COALESCE(is_modifier_estimated, false))
                                                 AS estimated_count
     FROM receipt_truth_daily_usage
     WHERE business_date = $1::date`,
    [date]
  );

  const eng = engineResult.rows[0];
  const engineBuilt = eng && Number(eng.row_count) > 0;

  // 2. Current shift Form 2 closing counts
  const currentForm2 = await pool.query(
    `SELECT dsv2."burgerBuns" AS buns, dsv2."meatWeightG" AS meat_g, dsv2."drinksJson",
            dsv2."createdAt"::text AS submitted_at
     FROM daily_stock_v2 dsv2
     JOIN daily_sales_v2 ds ON ds.id = dsv2."salesId"
     WHERE ds.shift_date = $1::date
       AND dsv2."deletedAt" IS NULL
     ORDER BY dsv2."createdAt" DESC
     LIMIT 1`,
    [date]
  );

  // 3. Previous shift Form 2 closing counts (= opening for this shift)
  const prevForm2 = await pool.query(
    `SELECT dsv2."burgerBuns" AS buns, dsv2."meatWeightG" AS meat_g, dsv2."drinksJson"
     FROM daily_stock_v2 dsv2
     JOIN daily_sales_v2 ds ON ds.id = dsv2."salesId"
     WHERE ds.shift_date = $1::date
       AND dsv2."deletedAt" IS NULL
     ORDER BY dsv2."createdAt" DESC
     LIMIT 1`,
    [prev]
  );

  // 4. Received stock — canonical source: purchase_tally + purchase_tally_drink
  //    (same source as Stock Reconciliation — this is the ONE purchase truth)
  const receivedTallyResult = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN rolls_pcs > 0 THEN rolls_pcs ELSE 0 END), 0)  AS received_buns,
       COALESCE(SUM(CASE WHEN meat_grams > 0 THEN meat_grams ELSE 0 END), 0) AS received_meat_g
     FROM purchase_tally
     WHERE date::date = $1::date`,
    [date]
  );

  const receivedDrinksResult = await pool.query(
    `SELECT ptd.item_name, SUM(ptd.qty) AS qty
     FROM purchase_tally_drink ptd
     JOIN purchase_tally pt ON pt.id = ptd.tally_id
     WHERE pt.date::date = $1::date
     GROUP BY ptd.item_name`,
    [date]
  );

  const form2Available = currentForm2.rows.length > 0;
  const prevForm2Available = prevForm2.rows.length > 0;

  const curr = form2Available ? currentForm2.rows[0] : null;
  const opening = prevForm2Available ? prevForm2.rows[0] : null;

  // Received buns (rolls) and meat from canonical purchase_tally
  const tallyRow = receivedTallyResult.rows[0];
  const receivedBuns = Number(tallyRow?.received_buns ?? 0);
  const receivedMeatG = Number(tallyRow?.received_meat_g ?? 0);

  // Received drinks from purchase_tally_drink — normalize names via DRINK_NAME_MAP
  const receivedDrinks: Record<string, number> = {};
  for (const r of receivedDrinksResult.rows) {
    if (!r.item_name) continue;
    const field = normDrinkKey(r.item_name);
    if (field) receivedDrinks[field] = (receivedDrinks[field] ?? 0) + Number(r.qty ?? 0);
  }

  // ─── Buns ─────────────────────────────────────────────────────────────────
  const bunsExpected = engineBuilt ? Number(eng.buns_expected) : null;
  const bunsOpening = prevForm2Available ? Number(opening!.buns) : null;
  const bunsClosing = form2Available ? Number(curr!.buns) : null;

  let bunsPhysicalUsed: number | null = null;
  let bunsVariance: number | null = null;
  if (bunsOpening !== null && bunsClosing !== null) {
    bunsPhysicalUsed = bunsOpening + receivedBuns - bunsClosing;
    if (bunsExpected !== null) bunsVariance = bunsPhysicalUsed - bunsExpected;
  }

  // ─── Meat ─────────────────────────────────────────────────────────────────
  const meatGExpected = engineBuilt ? Number(eng.beef_g_expected) : null;
  const meatGOpening = prevForm2Available ? Number(opening!.meat_g) : null;
  const meatGClosing = form2Available ? Number(curr!.meat_g) : null;

  let meatGPhysicalUsed: number | null = null;
  let meatGVariance: number | null = null;
  if (meatGOpening !== null && meatGClosing !== null) {
    meatGPhysicalUsed = meatGOpening + receivedMeatG - meatGClosing;
    if (meatGExpected !== null) meatGVariance = meatGPhysicalUsed - meatGExpected;
  }

  // ─── Drinks ───────────────────────────────────────────────────────────────
  const currDrinks = curr ? collapseDrinksJson(curr.drinksJson) : {};
  const openingDrinks = opening ? collapseDrinksJson(opening.drinksJson) : {};

  const drinkRows: {
    field: string; label: string;
    expected: number | null; opening: number | null; received: number;
    closing: number | null; physicalUsed: number | null;
    variance: number | null; severity: "ok" | "warn" | "critical" | "unknown";
  }[] = [];

  let totalDrinksExpected = 0;
  let totalDrinksPhysical = 0;
  let totalDrinksVariance: number | null = null;
  let totalDrinksKnown = true;

  for (const { field, label } of DRINK_FIELDS) {
    const expKey = `${field.replace(/([A-Z])/g, '_$1').toLowerCase()}_expected`.replace("schweppes_manao", "schweppes_manao");
    // Map field names to SQL column aliases
    const expMap: Record<string, string> = {
      coke: "coke_expected",
      cokeZero: "coke_zero_expected",
      sprite: "sprite_expected",
      water: "water_expected",
      fantaOrange: "fanta_orange_expected",
      fantaStrawberry: "fanta_strawberry_expected",
      schweppesManao: "schweppes_manao_expected",
    };

    const expected = engineBuilt ? Number(eng[expMap[field]] ?? 0) : null;
    const openingQty = openingDrinks[field] ?? null;
    const received = receivedDrinks[field] ?? 0;
    const closing = form2Available ? (currDrinks[field] ?? 0) : null;

    let physicalUsed: number | null = null;
    let variance: number | null = null;
    if (openingQty !== null && closing !== null) {
      physicalUsed = openingQty + received - closing;
      if (expected !== null) variance = physicalUsed - expected;
    } else {
      totalDrinksKnown = false;
    }

    if (expected !== null) totalDrinksExpected += expected;
    if (physicalUsed !== null) totalDrinksPhysical += physicalUsed;

    drinkRows.push({
      field, label,
      expected,
      opening: openingQty,
      received,
      closing,
      physicalUsed,
      variance,
      severity: severity(variance, 2, 4),
    });
  }

  if (totalDrinksKnown && engineBuilt) {
    totalDrinksVariance = totalDrinksPhysical - totalDrinksExpected;
  }

  // ─── Severity ─────────────────────────────────────────────────────────────
  const bunsSeverity = severity(bunsVariance, 5, 10);
  const meatSeverity = severity(meatGVariance, 500, 1000);
  const drinkSeverities = drinkRows.map(d => d.severity);
  const hasWarning = [bunsSeverity, meatSeverity, ...drinkSeverities].some(s => s === "warn");
  const hasCritical = [bunsSeverity, meatSeverity, ...drinkSeverities].some(s => s === "critical");
  const overallSeverity = hasCritical ? "critical" : hasWarning ? "warn" : engineBuilt && form2Available ? "ok" : "unknown";

  return {
    ok: true,
    date,
    prevDate: prev,
    engineBuilt,
    form2Available,
    prevForm2Available,
    overallSeverity,
    receivedStock: { buns: receivedBuns, meatG: receivedMeatG, drinks: receivedDrinks },
    buns: {
      expected: bunsExpected,
      opening: bunsOpening,
      received: receivedBuns,
      closing: bunsClosing,
      physicalUsed: bunsPhysicalUsed,
      variance: bunsVariance,
      severity: bunsSeverity,
      thresholds: { warn: 5, critical: 10 },
    },
    meat: {
      expectedGrams: meatGExpected,
      openingGrams: meatGOpening,
      receivedGrams: receivedMeatG,
      closingGrams: meatGClosing,
      physicalUsedGrams: meatGPhysicalUsed,
      varianceGrams: meatGVariance,
      severity: meatSeverity,
      thresholds: { warn: 500, critical: 1000 },
    },
    drinks: {
      totalExpected: totalDrinksExpected,
      totalPhysicalUsed: totalDrinksKnown ? totalDrinksPhysical : null,
      totalVariance: totalDrinksVariance,
      rows: drinkRows,
      thresholds: { warn: 2, critical: 4 },
    },
    confidence: {
      engineRowCount: engineBuilt ? Number(eng.row_count) : 0,
      unmappedItems: engineBuilt ? Number(eng.unmapped_count) : 0,
      estimatedModifiers: engineBuilt ? Number(eng.estimated_count) : 0,
    },
  };
}
