import { pool } from "../../db";
import { getStockReconciliation } from "./stockReconciliation";

export type StockFlag = "Normal" | "Low Stock" | "Stock Loss" | "Unnecessary Purchase" | "High Risk" | "Needs Review";

export type HybridStockRow = {
  item: string;
  sourceType: "live" | "manual";
  unit: string;
  opening: number | null;
  purchased: number | null;
  usage: number | null;
  expectedClosing: number | null;
  actualClosing: number | null;
  purchaseRequest: number | null;
  variance: number | null;
  minimumThreshold: number;
  varianceThreshold: number;
  flag: StockFlag;
  riskScore: number;
  notes: string[];
};

export type ManualInputRow = {
  itemName: string;
  closingCount: number | null;
  openingOverride: number | null;
  purchaseCorrection: number | null;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

const LIVE_ITEMS = ["Burger Buns / Rolls", "Meat", "Coke", "Coke Zero", "Sprite", "Water", "Fanta Orange", "Fanta Strawberry", "Schweppes Manao"] as const;
const MANUAL_ITEMS = ["Bacon Short", "Bacon Long", "Sweet Potato Fries", "French Fries", "Chicken Fillets", "Karaage Chicken", "Chicken Nuggets"] as const;

const CONFIG: Record<string, { minimumThreshold: number; varianceThreshold: number; unit: string }> = {
  "Burger Buns / Rolls": { minimumThreshold: 24, varianceThreshold: 5, unit: "pcs" },
  "Meat": { minimumThreshold: 3000, varianceThreshold: 500, unit: "g" },
  "Coke": { minimumThreshold: 8, varianceThreshold: 2, unit: "pcs" },
  "Coke Zero": { minimumThreshold: 8, varianceThreshold: 2, unit: "pcs" },
  "Sprite": { minimumThreshold: 8, varianceThreshold: 2, unit: "pcs" },
  "Water": { minimumThreshold: 8, varianceThreshold: 2, unit: "pcs" },
  "Fanta Orange": { minimumThreshold: 6, varianceThreshold: 2, unit: "pcs" },
  "Fanta Strawberry": { minimumThreshold: 6, varianceThreshold: 2, unit: "pcs" },
  "Schweppes Manao": { minimumThreshold: 6, varianceThreshold: 2, unit: "pcs" },
  "Bacon Short": { minimumThreshold: 10, varianceThreshold: 3, unit: "pcs" },
  "Bacon Long": { minimumThreshold: 10, varianceThreshold: 3, unit: "pcs" },
  "Sweet Potato Fries": { minimumThreshold: 12, varianceThreshold: 4, unit: "portion" },
  "French Fries": { minimumThreshold: 12, varianceThreshold: 4, unit: "portion" },
  "Chicken Fillets": { minimumThreshold: 12, varianceThreshold: 4, unit: "pcs" },
  "Karaage Chicken": { minimumThreshold: 12, varianceThreshold: 4, unit: "portion" },
  "Chicken Nuggets": { minimumThreshold: 12, varianceThreshold: 4, unit: "portion" },
};

function normalizeDrinkName(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "coke") return "Coke";
  if (v === "coke zero") return "Coke Zero";
  if (v === "sprite") return "Sprite";
  if (["water", "bottled water", "soda water"].includes(v)) return "Water";
  if (["fanta orange", "orange fanta"].includes(v)) return "Fanta Orange";
  if (["fanta strawberry", "strawberry fanta"].includes(v)) return "Fanta Strawberry";
  if (["schweppes manow", "schweppes manao", "schweppes lime"].includes(v)) return "Schweppes Manao";
  return value;
}

function normalizeRequestItemName(value: string): string {
  const v = value.trim().toLowerCase();
  if (["burger buns", "rolls", "buns", "burger buns / rolls"].includes(v)) return "Burger Buns / Rolls";
  if (["meat", "beef", "minced meat", "meat (g)"].includes(v)) return "Meat";
  if (MANUAL_ITEMS.map((x) => x.toLowerCase()).includes(v)) return MANUAL_ITEMS.find((x) => x.toLowerCase() === v)!;
  return normalizeDrinkName(value);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeFlag(row: HybridStockRow): { flag: StockFlag; riskScore: number } {
  if (row.notes.length > 0 || row.usage === null || row.actualClosing === null || row.expectedClosing === null) {
    return { flag: "Needs Review", riskScore: 80 };
  }

  const stockLoss = (row.expectedClosing - row.actualClosing) > row.varianceThreshold;
  const lowStock = row.actualClosing < row.minimumThreshold;
  const unnecessary = (row.purchaseRequest || 0) > 0 && row.expectedClosing >= row.minimumThreshold;
  const highRisk = (stockLoss && (row.purchaseRequest || 0) > 0) || (stockLoss && lowStock);

  if (highRisk) return { flag: "High Risk", riskScore: 95 };
  if (stockLoss) return { flag: "Stock Loss", riskScore: 85 };
  if (unnecessary) return { flag: "Unnecessary Purchase", riskScore: 70 };
  if (lowStock) return { flag: "Low Stock", riskScore: 60 };
  return { flag: "Normal", riskScore: 20 };
}

async function ensureManualTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner_stock_control_manual (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_date date NOT NULL,
      shift_label text NOT NULL DEFAULT '',
      item_name text NOT NULL,
      closing_count numeric,
      opening_override numeric,
      purchase_correction numeric,
      note text,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (business_date, shift_label, item_name)
    )
  `);
}

export async function saveManualInputs(params: {
  date: string;
  shiftLabel: string | null;
  updatedBy: string | null;
  entries: Array<{ itemName: string; closingCount: number | null; openingOverride: number | null; purchaseCorrection: number | null; note: string | null }>;
}) {
  await ensureManualTable();

  const shiftValue = params.shiftLabel || "";
  for (const entry of params.entries) {
    if (!MANUAL_ITEMS.includes(entry.itemName as (typeof MANUAL_ITEMS)[number])) continue;
    await pool.query(
      `
      INSERT INTO owner_stock_control_manual
      (business_date, shift_label, item_name, closing_count, opening_override, purchase_correction, note, updated_by, updated_at)
      VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (business_date, shift_label, item_name)
      DO UPDATE SET
        closing_count = EXCLUDED.closing_count,
        opening_override = EXCLUDED.opening_override,
        purchase_correction = EXCLUDED.purchase_correction,
        note = EXCLUDED.note,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
      `,
      [params.date, shiftValue, entry.itemName, entry.closingCount, entry.openingOverride, entry.purchaseCorrection, entry.note, params.updatedBy],
    );
  }
}

export async function loadHybridStockControl(date: string, shiftLabel: string | null) {
  await ensureManualTable();

  const reconRows = await getStockReconciliation(date);
  const liveByItem = new Map<string, any>();
  for (const row of reconRows) {
    if (row.item_type === "buns") liveByItem.set("Burger Buns / Rolls", row);
    else if (row.item_type === "meat") liveByItem.set("Meat", row);
    else if (row.item_type === "drinks") liveByItem.set(normalizeDrinkName(String(row.item_name)), row);
  }

  const requestsResult = await pool.query(
    `
      SELECT dsv2."purchasingJson" AS purchasing_json
      FROM daily_stock_v2 dsv2
      JOIN daily_sales_v2 dsv ON dsv.id = dsv2."salesId"
      WHERE COALESCE(dsv.shift_date, CASE WHEN NULLIF(dsv."shiftDate", '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN NULLIF(dsv."shiftDate", '')::date ELSE NULL END) = $1::date
      ORDER BY dsv2."updatedAt" DESC NULLS LAST, dsv2."createdAt" DESC NULLS LAST
      LIMIT 1
    `,
    [date],
  ).catch(() => ({ rows: [] as any[] }));

  const requestMap = new Map<string, number>();
  const purchasingJson = requestsResult.rows[0]?.purchasing_json || {};
  if (purchasingJson && typeof purchasingJson === "object") {
    for (const [k, v] of Object.entries(purchasingJson)) {
      requestMap.set(normalizeRequestItemName(k), Number(v || 0));
    }
  }

  const manualResult = await pool.query(
    `
      SELECT item_name, closing_count, opening_override, purchase_correction, note, updated_at, updated_by
      FROM owner_stock_control_manual
      WHERE business_date = $1::date AND shift_label = $2
      ORDER BY item_name ASC
    `,
    [date, shiftLabel || ""],
  );

  const manualByItem = new Map<string, ManualInputRow>();
  for (const row of manualResult.rows) {
    manualByItem.set(row.item_name, {
      itemName: row.item_name,
      closingCount: toNum(row.closing_count),
      openingOverride: toNum(row.opening_override),
      purchaseCorrection: toNum(row.purchase_correction),
      note: row.note || null,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null,
    });
  }

  const usageResult = await pool.query(
    `
    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='receipt_truth_daily_usage' AND column_name='bacon_used'
      ) THEN (SELECT COALESCE(SUM(bacon_used), 0) FROM receipt_truth_daily_usage WHERE business_date = $1::date) ELSE NULL END AS bacon_used,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='receipt_truth_daily_usage' AND column_name='fries_used'
      ) THEN (SELECT COALESCE(SUM(fries_used), 0) FROM receipt_truth_daily_usage WHERE business_date = $1::date) ELSE NULL END AS fries_used,
      COALESCE((SELECT SUM(chicken_grams_used) FROM receipt_truth_daily_usage WHERE business_date = $1::date), 0) AS chicken_grams_used
    `,
    [date],
  ).catch(() => ({ rows: [{ bacon_used: null, fries_used: null, chicken_grams_used: null }] } as any));

  const usage = usageResult.rows[0] || {};
  const rows: HybridStockRow[] = [];

  for (const item of LIVE_ITEMS) {
    const cfg = CONFIG[item];
    const live = liveByItem.get(item);
    const row: HybridStockRow = {
      item,
      sourceType: "live",
      unit: cfg.unit,
      opening: live ? toNum(live.start_qty) : null,
      purchased: live ? toNum(live.purchased_qty) : null,
      usage: live ? toNum(live.number_sold_qty) : null,
      expectedClosing: live ? toNum(live.expected_end_qty) : null,
      actualClosing: live ? toNum(live.actual_end_qty) : null,
      purchaseRequest: requestMap.get(item) ?? 0,
      variance: live ? toNum(live.variance) : null,
      minimumThreshold: cfg.minimumThreshold,
      varianceThreshold: cfg.varianceThreshold,
      flag: "Needs Review",
      riskScore: 80,
      notes: live ? [] : ["Missing live reconciliation row"],
    };

    const evalFlag = computeFlag(row);
    row.flag = evalFlag.flag;
    row.riskScore = evalFlag.riskScore;
    rows.push(row);
  }

  for (const item of MANUAL_ITEMS) {
    const cfg = CONFIG[item];
    const manual = manualByItem.get(item);
    const usageValue = item.includes("Bacon") ? toNum(usage.bacon_used) : item.includes("Fries") ? toNum(usage.fries_used) : toNum(usage.chicken_grams_used);
    const opening = manual?.openingOverride ?? null;
    const purchased = manual?.purchaseCorrection ?? 0;
    const expected = opening === null || usageValue === null ? null : opening + purchased - usageValue;
    const actual = manual?.closingCount ?? null;
    const variance = expected === null || actual === null ? null : actual - expected;

    const notes: string[] = [];
    if (!manual) notes.push("Missing manual owner entry");
    if (usageValue === null) notes.push("Usage mapping unavailable");
    if (manual?.note?.trim()) notes.push(`Note: ${manual.note.trim()}`);

    const row: HybridStockRow = {
      item,
      sourceType: "manual",
      unit: cfg.unit,
      opening,
      purchased,
      usage: usageValue,
      expectedClosing: expected,
      actualClosing: actual,
      purchaseRequest: requestMap.get(item) ?? 0,
      variance,
      minimumThreshold: cfg.minimumThreshold,
      varianceThreshold: cfg.varianceThreshold,
      flag: "Needs Review",
      riskScore: 80,
      notes,
    };

    const evalFlag = computeFlag(row);
    row.flag = evalFlag.flag;
    row.riskScore = evalFlag.riskScore;
    rows.push(row);
  }

  return {
    ok: true,
    date,
    shiftLabel,
    sources: {
      liveClosing: "daily_stock_v2 via stock reconciliation",
      purchases: "purchase_tally + purchase_tally_drink",
      purchaseRequests: "daily_stock_v2.purchasingJson",
      usageTruth: "receipt_truth_daily_usage",
      manualStorage: "owner_stock_control_manual",
    },
    liveRows: rows.filter((r) => r.sourceType === "live"),
    manualInputs: Array.from(manualByItem.values()),
    rows,
    summary: {
      highRisk: rows.filter((r) => r.flag === "High Risk").map((r) => r.item),
      stockLoss: rows.filter((r) => r.flag === "Stock Loss").map((r) => r.item),
      unnecessaryPurchase: rows.filter((r) => r.flag === "Unnecessary Purchase").map((r) => r.item),
      lowStock: rows.filter((r) => r.flag === "Low Stock").map((r) => r.item),
      needsReview: rows.filter((r) => r.flag === "Needs Review").map((r) => r.item),
    },
  };
}
