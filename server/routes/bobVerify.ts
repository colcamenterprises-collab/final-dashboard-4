import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { DateTime } from "luxon";
import { bobAuth } from "../middleware/bobAuth";

const router = express.Router();

const BKK_ZONE = "Asia/Bangkok";

type VerifyStatus = "PASS" | "FAIL" | "BLOCKED";

type SourceState = {
  ok: boolean;
  path: string;
  reason?: string;
};

type ComparisonRow = {
  key: string;
  sourceA?: number | string | null;
  sourceB?: number | string | null;
  sourceBOrigin?: "v2_canonical" | "legacy_fallback";
  variance?: number | null;
  threshold?: number | null;
  withinThreshold?: boolean | null;
  note?: string;
  start?: number | null;
  purchased?: number | null;
  sold?: number | null;
  end?: number | null;
  expected?: number | null;
};

type MissingDataCode =
  | "missing_loyverse_shift_report"
  | "missing_daily_sales_form"
  | "missing_daily_stock_form"
  | "missing_purchase_data";

type MissingDataDetail = {
  flag: MissingDataCode;
  owner: string;
  cause:
    | "no_row_in_db"
    | "query_bug"
    | "not_submitted_or_save_missing"
    | "missing_purchase_rows"
    | "unknown";
  message: string;
  where: string;
  canonical_source: string;
};

async function internalGet(path: string) {
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  const request = fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-bob-token": process.env.BOB_READONLY_TOKEN || process.env.BOB_API_TOKEN || "",
    },
  });

  const response = (await Promise.race([
    request,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`GET ${path} timed out after 8000ms`)), 8000);
    }),
  ])) as Awaited<typeof request>;

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }

  return response.json();
}

async function internalGetSafe(path: string) {
  try {
    const payload = await internalGet(path);
    return { ok: true as const, payload, error: null as string | null };
  } catch (error: any) {
    return {
      ok: false as const,
      payload: null,
      error: error?.message || "Unknown load failure",
    };
  }
}


function getLatestCompletedShiftWindow(now = DateTime.now().setZone(BKK_ZONE)) {
  const today1700 = now.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const today0300 = now.set({ hour: 3, minute: 0, second: 0, millisecond: 0 });

  let shiftStart: DateTime;
  let shiftEnd: DateTime;

  if (now >= today1700) {
    shiftStart = today1700.minus({ days: 1 });
    shiftEnd = shiftStart.plus({ hours: 10 });
  } else if (now < today0300) {
    shiftStart = today1700.minus({ days: 2 });
    shiftEnd = shiftStart.plus({ hours: 10 });
  } else {
    shiftStart = today1700.minus({ days: 1 });
    shiftEnd = shiftStart.plus({ hours: 10 });
  }

  return {
    shiftDate: shiftStart.toFormat("yyyy-LL-dd"),
    shiftStartIso: shiftStart.toISO(),
    shiftEndIso: shiftEnd.toISO(),
    shiftStartLocal: shiftStart.toFormat("yyyy-LL-dd HH:mm"),
    shiftEndLocal: shiftEnd.toFormat("yyyy-LL-dd HH:mm"),
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickShiftDateRows(payload: any, shiftDate: string): any[] {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.filter((row: any) => {
    const raw = String(row?.shiftDate ?? row?.shift_date ?? row?.date ?? "").slice(0, 10);
    return raw === shiftDate;
  });
}

function pickCanonicalRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.forms)) return payload.forms;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.forms)) return payload.data.forms;
  return [];
}

function getEffectiveBobReadToken(): string {
  return (
    process.env.BOB_READONLY_TOKEN ||
    process.env.BOB_API_TOKEN ||
    process.env.BOBS_LOYVERSE_TOKEN ||
    ""
  );
}

function buildThresholdCheck(
  key: string,
  sourceA: number | null,
  sourceB: number | null,
  threshold: number
): ComparisonRow {
  if (sourceA === null || sourceB === null) {
    return {
      key,
      sourceA,
      sourceB,
      variance: null,
      threshold,
      withinThreshold: null,
      note: "Missing numeric data",
    };
  }

  const variance = sourceA - sourceB;
  const withinThreshold = Math.abs(variance) <= threshold;

  return {
    key,
    sourceA,
    sourceB,
    variance,
    threshold,
    withinThreshold,
  };
}

const DRINK_NAME_ALIASES: Record<string, string> = {
  coke: "Coke",
  "cokezero": "Coke Zero",
  "coke-zero": "Coke Zero",
  sprite: "Sprite",
  water: "Water",
  bottledwater: "Water",
  bottlewater: "Water",
  sodawater: "Water",
  "น้ำเปล่า": "Water",
  fantaorange: "Fanta Orange",
  orangefanta: "Fanta Orange",
  fantastrawberry: "Fanta Strawberry",
  strawberryfanta: "Fanta Strawberry",
  schweppesmanao: "Schweppes Manao",
  schweppesmanow: "Schweppes Manao",
  schweppeslime: "Schweppes Manao",
};

function normalizeDrinkKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9\u0E00-\u0E7F]/g, "");
}

function canonicalDrinkName(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const nk = normalizeDrinkKey(raw);
  if (!nk) return null;
  return DRINK_NAME_ALIASES[nk] || null;
}

router.get("/latest-shift", bobAuth, async (_req: Request, res: Response) => {
  try {
    const shift = getLatestCompletedShiftWindow();
    const prevShiftDate = DateTime.fromISO(shift.shiftDate, { zone: BKK_ZONE })
      .minus({ days: 1 })
      .toFormat("yyyy-LL-dd");
    const purchaseWindow = {
      from: prevShiftDate,
      to: shift.shiftDate,
      inclusive: true as const,
      effectiveDateField: "purchase_tally.date",
    };

  const sourceState: Record<string, SourceState> = {
    shiftReport: { ok: false, path: "/api/bob/read/shift-report/latest" },
    dailySales: { ok: false, path: `/api/bob/read/daily-sales?date=${shift.shiftDate}` },
    dailyStock: { ok: false, path: `/api/bob/read/daily-stock?date=${shift.shiftDate}` },
    stockUsage: { ok: false, path: `/api/bob/read/stock-usage?date=${shift.shiftDate}` },
    purchaseHistory: { ok: false, path: `/api/bob/read/purchase-history?from=${purchaseWindow.from}&to=${purchaseWindow.to}` },
    previousDailyStockCanonical: { ok: false, path: `/api/ai-ops/bob/proxy-read?path=forms/daily-stock&date=${prevShiftDate}&token=<redacted>` },
  };

  let shiftReport: any = null;
  let dailySales: any = null;
  let dailyStock: any = null;
  let stockUsage: any = null;
  let purchaseHistory: any = null;

  const blockers: string[] = [];
  const missingData: MissingDataCode[] = [];

  async function loadSource<T = any>(key: keyof typeof sourceState, path: string): Promise<T | null> {
    try {
      const data = await Promise.race([
        internalGet(path),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`GET ${path} timed out after 8000ms`)), 8000);
        }),
      ]);
      sourceState[key].ok = true;
      return data as T;
    } catch (error: any) {
      sourceState[key].ok = false;
      sourceState[key].reason = error?.message || "Unknown load failure";
      blockers.push(`${key}: ${sourceState[key].reason}`);
      return null;
    }
  }

  shiftReport = await loadSource("shiftReport", sourceState.shiftReport.path);
  dailySales = await loadSource("dailySales", sourceState.dailySales.path);
  dailyStock = await loadSource("dailyStock", sourceState.dailyStock.path);
  stockUsage = await loadSource("stockUsage", sourceState.stockUsage.path);
  purchaseHistory = await loadSource("purchaseHistory", sourceState.purchaseHistory.path);

  const legacySalesRowsForShift = pickShiftDateRows(dailySales, shift.shiftDate);
  const legacyStockRowsForShift = pickShiftDateRows(dailyStock, shift.shiftDate);

  const bobReadToken = getEffectiveBobReadToken();

  const canonicalSalesProbe = await internalGetSafe(
    `/api/ai-ops/bob/proxy-read?path=forms/daily-sales&date=${shift.shiftDate}&token=${encodeURIComponent(bobReadToken)}`
  );
  const canonicalStockProbe = await internalGetSafe(
    `/api/ai-ops/bob/proxy-read?path=forms/daily-stock&date=${shift.shiftDate}&token=${encodeURIComponent(bobReadToken)}`
  );
  const prevCanonicalStockProbe = await internalGetSafe(
    `/api/ai-ops/bob/proxy-read?path=forms/daily-stock&date=${prevShiftDate}&token=${encodeURIComponent(bobReadToken)}`
  );
  sourceState.previousDailyStockCanonical.ok = prevCanonicalStockProbe.ok;
  if (!prevCanonicalStockProbe.ok) {
    sourceState.previousDailyStockCanonical.reason = prevCanonicalStockProbe.error || "Unknown load failure";
  }

  const canonicalSalesRows = pickCanonicalRows(canonicalSalesProbe.payload);
  const canonicalStockRows = pickCanonicalRows(canonicalStockProbe.payload);
  const prevCanonicalStockRows = pickCanonicalRows(prevCanonicalStockProbe.payload);

  const mappedDailySales = legacySalesRowsForShift[0] ?? null;
  const mappedDailyStock = legacyStockRowsForShift[0] ?? null;
  const canonicalDailyStock = canonicalStockRows[0] ?? null;
  const stockComparisonSource: "v2_canonical" | "legacy_fallback" =
    canonicalDailyStock ? "v2_canonical" : "legacy_fallback";
  const stockComparisonRow = stockComparisonSource === "v2_canonical" ? canonicalDailyStock : mappedDailyStock;

  if (!shiftReport) missingData.push("missing_loyverse_shift_report");
  if (!mappedDailySales && canonicalSalesRows.length === 0) missingData.push("missing_daily_sales_form");
  if (!mappedDailyStock && canonicalStockRows.length === 0) missingData.push("missing_daily_stock_form");

  const purchaseRollCount = Array.isArray(purchaseHistory?.rolls) ? purchaseHistory.rolls.length : 0;
  const purchaseMeatCount = Array.isArray(purchaseHistory?.meat) ? purchaseHistory.meat.length : 0;
  const purchaseDrinkCount = Array.isArray(purchaseHistory?.drinks) ? purchaseHistory.drinks.length : 0;
  if (sourceState.purchaseHistory.ok && purchaseRollCount + purchaseMeatCount + purchaseDrinkCount === 0) {
    missingData.push("missing_purchase_data");
  }

  const comparisons: ComparisonRow[] = [];

  const shiftTotalSales =
    toNumber(shiftReport?.totalSales) ??
    toNumber(shiftReport?.grossSales) ??
    toNumber(shiftReport?.salesSummary?.totalSales) ??
    toNumber(shiftReport?.totals?.sales);

  const formTotalSales =
    toNumber(mappedDailySales?.totalSales) ??
    toNumber(mappedDailySales?.sales?.totalSales) ??
    toNumber(mappedDailySales?.summary?.totalSales) ??
    toNumber(mappedDailySales?.netSales) ??
    toNumber(canonicalSalesRows[0]?.total_sales) ??
    toNumber(canonicalSalesRows[0]?.totalSales);

  comparisons.push(buildThresholdCheck("total_sales", shiftTotalSales, formTotalSales, 5));

  const shiftCash =
    toNumber(shiftReport?.cashSales) ??
    toNumber(shiftReport?.salesSummary?.cashSales) ??
    toNumber(shiftReport?.payments?.cash);
  const formCash =
    toNumber(mappedDailySales?.cashSales) ??
    toNumber(mappedDailySales?.sales?.cashSales) ??
    toNumber(mappedDailySales?.summary?.cashSales) ??
    toNumber(canonicalSalesRows[0]?.cash_sales) ??
    toNumber(canonicalSalesRows[0]?.cashSales);
  comparisons.push(buildThresholdCheck("sales_cash", shiftCash, formCash, 5));

  const shiftQr =
    toNumber(shiftReport?.qrSales) ??
    toNumber(shiftReport?.salesSummary?.qrSales) ??
    toNumber(shiftReport?.payments?.qr);
  const formQr =
    toNumber(mappedDailySales?.qrSales) ??
    toNumber(mappedDailySales?.sales?.qrSales) ??
    toNumber(mappedDailySales?.summary?.qrSales) ??
    toNumber(canonicalSalesRows[0]?.qr_sales) ??
    toNumber(canonicalSalesRows[0]?.qrSales);
  comparisons.push(buildThresholdCheck("sales_qr", shiftQr, formQr, 5));

  const shiftDelivery =
    toNumber(shiftReport?.deliverySales) ??
    toNumber(shiftReport?.salesSummary?.deliverySales) ??
    toNumber(shiftReport?.payments?.delivery);
  const formDelivery =
    toNumber(mappedDailySales?.deliverySales) ??
    toNumber(mappedDailySales?.sales?.deliverySales) ??
    toNumber(mappedDailySales?.summary?.deliverySales) ??
    toNumber(canonicalSalesRows[0]?.grab_sales) ??
    toNumber(canonicalSalesRows[0]?.grabSales);
  comparisons.push(buildThresholdCheck("sales_delivery", shiftDelivery, formDelivery, 5));

  const burgersSold =
    toNumber(stockUsage?.burgersSold) ??
    toNumber(stockUsage?.summary?.burgersSold) ??
    toNumber(stockUsage?.totals?.burgers);

  const rollsOpening =
    stockComparisonSource === "v2_canonical"
      ? toNumber(stockComparisonRow?.rolls_start) ??
        toNumber(stockComparisonRow?.rollsOpening)
      : toNumber(stockComparisonRow?.burgerBunsOpening) ??
        toNumber(stockComparisonRow?.rollsOpening) ??
        toNumber(stockComparisonRow?.opening?.burgerBuns);

  const rollsClosing =
    stockComparisonSource === "v2_canonical"
      ? toNumber(stockComparisonRow?.rolls_end) ??
        toNumber(stockComparisonRow?.rollsClosing)
      : toNumber(stockComparisonRow?.burgerBunsStock) ??
        toNumber(stockComparisonRow?.rollsClosing) ??
        toNumber(stockComparisonRow?.closing?.burgerBuns);

  let rollsPurchased: number | null = null;
  const purchaseRollRows = purchaseHistory?.rolls;
  if (Array.isArray(purchaseRollRows)) {
    rollsPurchased = purchaseRollRows
      .map((row: any) => toNumber(row?.quantity) ?? toNumber(row?.rolls) ?? toNumber(row?.burgerBuns))
      .filter((n: number | null) => n !== null)
      .reduce((sum: number, n: number | null) => sum + (n || 0), 0);
  } else if (Array.isArray(purchaseHistory)) {
    rollsPurchased = purchaseHistory
      .map((row: any) =>
        toNumber(row?.burgerBuns) ??
        toNumber(row?.rolls) ??
        (String(row?.category || "").toLowerCase().includes("roll") ? toNumber(row?.quantity) : null)
      )
      .filter((n: number | null) => n !== null)
      .reduce((sum: number, n: number | null) => sum + (n || 0), 0);
  }

  const expectedRolls =
    rollsOpening !== null && rollsPurchased !== null && burgersSold !== null
      ? rollsOpening + rollsPurchased - burgersSold
      : null;

  comparisons.push({
    ...buildThresholdCheck("rolls_expected_vs_closing", expectedRolls, rollsClosing, 5),
    sourceBOrigin: stockComparisonSource,
  });

  const closingMeat =
    stockComparisonSource === "v2_canonical"
      ? toNumber(stockComparisonRow?.meat_end_g) ??
        toNumber(stockComparisonRow?.meatWeightG)
      : toNumber(stockComparisonRow?.meatWeight) ??
        toNumber(stockComparisonRow?.meatClosing) ??
        toNumber(stockComparisonRow?.closing?.meatWeight);

  const openingMeat =
    stockComparisonSource === "v2_canonical"
      ? toNumber(stockComparisonRow?.meat_start_g) ??
        toNumber(stockComparisonRow?.meatOpening)
      : toNumber(stockComparisonRow?.meatOpening) ??
        toNumber(stockComparisonRow?.opening?.meatWeight);

  let purchasedMeat: number | null = null;
  const purchaseMeatRows = purchaseHistory?.meat;
  if (Array.isArray(purchaseMeatRows)) {
    purchasedMeat = purchaseMeatRows
      .map((row: any) => toNumber(row?.grams) ?? toNumber(row?.meatGrams) ?? toNumber(row?.meatWeight))
      .filter((n: number | null) => n !== null)
      .reduce((sum: number, n: number | null) => sum + (n || 0), 0);
  } else if (Array.isArray(purchaseHistory)) {
    purchasedMeat = purchaseHistory
      .map((row: any) =>
        toNumber(row?.meatWeight) ??
        toNumber(row?.meatGrams) ??
        (String(row?.category || "").toLowerCase().includes("meat") ? toNumber(row?.quantity) : null)
      )
      .filter((n: number | null) => n !== null)
      .reduce((sum: number, n: number | null) => sum + (n || 0), 0);
  }

  const expectedMeatUsage = burgersSold !== null ? burgersSold * 90 : null;
  const expectedClosingMeat =
    openingMeat !== null && purchasedMeat !== null && expectedMeatUsage !== null
      ? openingMeat + purchasedMeat - expectedMeatUsage
      : null;

  comparisons.push({
    ...buildThresholdCheck("meat_expected_vs_closing_g", expectedClosingMeat, closingMeat, 500),
    sourceBOrigin: stockComparisonSource,
  });

  const stockUsageDrinkSoldByCanonical: Record<string, number | null> = {
    Coke: toNumber(stockUsage?.summary?.coke),
    "Coke Zero": toNumber(stockUsage?.summary?.cokeZero),
    Sprite: toNumber(stockUsage?.summary?.sprite),
    Water: toNumber(stockUsage?.summary?.water),
    "Fanta Orange": toNumber(stockUsage?.summary?.fantaOrange),
    "Fanta Strawberry": toNumber(stockUsage?.summary?.fantaStrawberry),
    "Schweppes Manao": toNumber(stockUsage?.summary?.schweppesManao),
  };

  const currentDrinksRaw = stockComparisonSource === "v2_canonical"
    ? stockComparisonRow?.drinksJson
    : stockComparisonRow?.drinkStock;
  const prevDrinksRaw = prevCanonicalStockRows[0]?.drinksJson;

  const drinksEndMap = new Map<string, number>();
  const drinksStartMap = new Map<string, number>();
  const drinksPurchasedMap = new Map<string, number>();

  const drinksAmbiguities: string[] = [];
  const drinksMissingComponents: string[] = [];
  const drinksUnknownMappings: string[] = [];

  const endMapByCanonical = new Map<string, string[]>();
  if (currentDrinksRaw && typeof currentDrinksRaw === "object" && !Array.isArray(currentDrinksRaw)) {
    for (const [rawKey, rawValue] of Object.entries(currentDrinksRaw)) {
      const canonical = canonicalDrinkName(rawKey);
      const qty = toNumber(rawValue);
      if (!canonical) {
        drinksUnknownMappings.push(`end_stock:${String(rawKey)}`);
        continue;
      }
      if (qty === null) {
        drinksMissingComponents.push(`end_stock_qty_not_numeric:${canonical}`);
        continue;
      }
      drinksEndMap.set(canonical, (drinksEndMap.get(canonical) ?? 0) + qty);
      endMapByCanonical.set(canonical, [...(endMapByCanonical.get(canonical) ?? []), rawKey]);
    }
  }
  for (const [canonical, rawKeys] of endMapByCanonical.entries()) {
    if (rawKeys.length > 1) {
      drinksAmbiguities.push(`end_stock_duplicate_keys:${canonical}<=${rawKeys.join("|")}`);
    }
  }

  const startMapByCanonical = new Map<string, string[]>();
  if (prevDrinksRaw && typeof prevDrinksRaw === "object" && !Array.isArray(prevDrinksRaw)) {
    for (const [rawKey, rawValue] of Object.entries(prevDrinksRaw)) {
      const canonical = canonicalDrinkName(rawKey);
      const qty = toNumber(rawValue);
      if (!canonical) {
        drinksUnknownMappings.push(`start_stock:${String(rawKey)}`);
        continue;
      }
      if (qty === null) {
        drinksMissingComponents.push(`start_stock_qty_not_numeric:${canonical}`);
        continue;
      }
      drinksStartMap.set(canonical, (drinksStartMap.get(canonical) ?? 0) + qty);
      startMapByCanonical.set(canonical, [...(startMapByCanonical.get(canonical) ?? []), rawKey]);
    }
  }
  for (const [canonical, rawKeys] of startMapByCanonical.entries()) {
    if (rawKeys.length > 1) {
      drinksAmbiguities.push(`start_stock_duplicate_keys:${canonical}<=${rawKeys.join("|")}`);
    }
  }

  const purchaseRowsFromStructuredDrinks = Array.isArray(purchaseHistory?.drinks)
    ? purchaseHistory.drinks.flatMap((row: any) => {
        const items = Array.isArray(row?.items) ? row.items : [];
        return items.map((item: any) => ({
          category: "drinks",
          item: item?.itemName,
          qty: item?.quantity,
          effectiveDate: row?.date ?? null,
        }));
      })
    : [];
  const purchaseRowsFromLegacy = Array.isArray(purchaseHistory?.purchases) ? purchaseHistory.purchases : [];
  const purchaseRows = purchaseRowsFromStructuredDrinks.length > 0 ? purchaseRowsFromStructuredDrinks : purchaseRowsFromLegacy;
  for (const row of purchaseRows) {
    const category = String(row?.category || "").trim().toLowerCase();
    if (category !== "drinks") continue;
    const canonical = canonicalDrinkName(row?.item);
    const qty = toNumber(row?.qty);
    if (!canonical) {
      drinksUnknownMappings.push(`purchase_item:${String(row?.item ?? "")}`);
      continue;
    }
    if (qty === null) {
      drinksMissingComponents.push(`purchase_qty_not_numeric:${canonical}`);
      continue;
    }
    drinksPurchasedMap.set(canonical, (drinksPurchasedMap.get(canonical) ?? 0) + qty);
  }

  const canonicalDrinkSet = new Set<string>([
    ...Object.keys(stockUsageDrinkSoldByCanonical),
    ...Array.from(drinksStartMap.keys()),
    ...Array.from(drinksEndMap.keys()),
    ...Array.from(drinksPurchasedMap.keys()),
  ]);

  for (const canonicalDrink of Array.from(canonicalDrinkSet).sort()) {
    const start = drinksStartMap.has(canonicalDrink) ? (drinksStartMap.get(canonicalDrink) ?? null) : null;
    const purchased = drinksPurchasedMap.has(canonicalDrink) ? (drinksPurchasedMap.get(canonicalDrink) ?? null) : null;
    const sold = stockUsageDrinkSoldByCanonical[canonicalDrink];
    const end = drinksEndMap.has(canonicalDrink) ? (drinksEndMap.get(canonicalDrink) ?? null) : null;

    const hasMissingComponent = start === null || purchased === null || sold === null || end === null;
    const expected = hasMissingComponent ? null : (start + purchased - sold);
    const variance = hasMissingComponent || expected === null ? null : (end - expected);
    const withinThreshold = variance === null ? null : Math.abs(variance) <= 2;

    comparisons.push({
      key: `drinks_stock_${canonicalDrink.toLowerCase().replace(/\s+/g, "_")}`,
      sourceA: expected,
      sourceB: end,
      sourceBOrigin: stockComparisonSource,
      variance,
      threshold: 2,
      withinThreshold,
      start,
      purchased,
      sold,
      end,
      expected,
      note: hasMissingComponent ? "incomplete_component_data" : undefined,
    });
  }

  const failedChecks = comparisons.filter((row) => row.withinThreshold === false);
  const blockedChecks = comparisons.filter((row) => row.withinThreshold === null);

  let status: VerifyStatus = "PASS";

  const requiredSourcesOk =
    sourceState.shiftReport.ok &&
    sourceState.dailySales.ok &&
    sourceState.dailyStock.ok &&
    sourceState.stockUsage.ok;

  if (!requiredSourcesOk) {
    status = "BLOCKED";
  } else if (failedChecks.length > 0) {
    status = "FAIL";
  } else if (blockedChecks.length > 0) {
    status = "BLOCKED";
  }

  const summary =
    status === "PASS"
      ? "Latest completed shift verified successfully within current thresholds."
      : status === "FAIL"
      ? "Latest completed shift loaded, but one or more core metrics exceeded allowed thresholds."
      : "Latest completed shift could not be fully verified because required canonical data was missing or incomplete.";

  const shiftReportTruth =
    !shiftReport
      ? {
          cause: "no_db_record",
          detail: "GET /api/shift-report/latest returned null; no shift_report_v2 row is currently available for latest retrieval.",
          where: "shift_report_v2",
        }
      : {
          cause: String(shiftReport?.shiftDate ?? "").slice(0, 10) !== shift.shiftDate ? "wrong_shift_resolution" : "ok",
          detail:
            String(shiftReport?.shiftDate ?? "").slice(0, 10) !== shift.shiftDate
              ? `latest shift_report_v2 is for ${String(shiftReport?.shiftDate).slice(0, 10)}, while verifier target shiftDate is ${shift.shiftDate}.`
              : "Latest shift report exists and aligns with verifier shift date.",
          where: "shift_report_v2.shiftDate",
        };

  const dailySalesCause =
    legacySalesRowsForShift.length === 0 && canonicalSalesRows.length > 0
      ? "query_bug"
      : legacySalesRowsForShift.length === 0 && canonicalSalesRows.length === 0
      ? "not_submitted_or_save_missing"
      : "ok";

  const dailyStockCause =
    legacyStockRowsForShift.length === 0 && canonicalStockRows.length > 0
      ? "query_bug"
      : legacyStockRowsForShift.length === 0 && canonicalStockRows.length === 0
      ? "not_submitted_or_save_missing"
      : "ok";

  const formTruth = {
    dailySales: {
      cause: dailySalesCause,
      detail:
        legacySalesRowsForShift.length === 0 && canonicalSalesRows.length > 0
          ? "Bob verify reads /api/bob/read/daily-sales -> /api/daily-stock-sales (legacy table) while canonical forms endpoint has rows."
          : legacySalesRowsForShift.length === 0 && canonicalSalesRows.length === 0
          ? "No row found in either legacy mapped read or canonical forms read for the shift date."
          : "Sales form row found for target shift date.",
    },
    dailyStock: {
      cause: dailyStockCause,
      detail:
        legacyStockRowsForShift.length === 0 && canonicalStockRows.length > 0
          ? "Bob verify reads /api/bob/read/daily-stock -> /api/daily-stock-sales (legacy table) while canonical stock forms endpoint has rows."
          : legacyStockRowsForShift.length === 0 && canonicalStockRows.length === 0
          ? "No row found in either legacy mapped read or canonical forms read for the shift date."
          : "Stock form row found for target shift date.",
    },
  };

  const drinksTruth = {
    interpretation: "stock_equation_per_sku",
    detail:
      "Drinks verification now uses stock equation per canonical SKU: start + purchased - sold = expected end, then compares expected vs form2 end.",
    equation: {
      start: "previous_shift_closing_stock",
      purchased: "purchase_history(category=Drinks, effective_purchase_date in window)",
      sold: "receipt_truth_daily_usage (includes modifier-driven selections in canonical rebuild)",
      end: "forms/daily-stock V2 drinksJson for target shift",
      expected: "start + purchased - sold",
      variance: "end - expected",
    },
    purchaseWindow,
    ambiguity: {
      unresolvedMappings: drinksUnknownMappings,
      duplicateCanonicalMappings: drinksAmbiguities,
      missingComponents: drinksMissingComponents,
      surfacedAs: "comparison.note=incomplete_component_data and null expected/variance",
    },
    previousShift: {
      shiftDate: prevShiftDate,
      canonicalRowFound: prevCanonicalStockRows.length > 0,
    },
  };

  const missingDataFlags: Record<MissingDataCode, boolean> = {
    missing_loyverse_shift_report: missingData.includes("missing_loyverse_shift_report"),
    missing_daily_sales_form: missingData.includes("missing_daily_sales_form"),
    missing_daily_stock_form: missingData.includes("missing_daily_stock_form"),
    missing_purchase_data: missingData.includes("missing_purchase_data"),
  };

  const missingDataDetails: MissingDataDetail[] = [];
  if (missingDataFlags.missing_loyverse_shift_report) {
    missingDataDetails.push({
      flag: "missing_loyverse_shift_report",
      owner: "shift-report pipeline",
      cause: "no_row_in_db",
      message: "No row available from /api/shift-report/latest for latest retrieval.",
      where: "shift_report_v2",
      canonical_source: "/api/shift-report/latest",
    });
  }
  if (missingDataFlags.missing_daily_sales_form) {
    missingDataDetails.push({
      flag: "missing_daily_sales_form",
      owner: "forms/daily-sales read mapping",
      cause: canonicalSalesRows.length > 0 ? "query_bug" : "not_submitted_or_save_missing",
      message:
        canonicalSalesRows.length > 0
          ? "Canonical sales forms exist but Bob mapped legacy read returned no shift-date row."
          : "No sales form row found in either Bob mapped read or canonical forms read.",
      where: "bobVerify -> /api/bob/read/daily-sales and forms/daily-sales probe",
      canonical_source: "/api/ai-ops/bob/proxy-read?path=forms/daily-sales",
    });
  }
  if (missingDataFlags.missing_daily_stock_form) {
    missingDataDetails.push({
      flag: "missing_daily_stock_form",
      owner: "forms/daily-stock read mapping",
      cause: canonicalStockRows.length > 0 ? "query_bug" : "not_submitted_or_save_missing",
      message:
        canonicalStockRows.length > 0
          ? "Canonical stock forms exist but Bob mapped legacy read returned no shift-date row."
          : "No stock form row found in either Bob mapped read or canonical forms read.",
      where: "bobVerify -> /api/bob/read/daily-stock and forms/daily-stock probe",
      canonical_source: "/api/ai-ops/bob/proxy-read?path=forms/daily-stock",
    });
  }
  if (missingDataFlags.missing_purchase_data) {
    missingDataDetails.push({
      flag: "missing_purchase_data",
      owner: "purchase ingest / read",
      cause: "missing_purchase_rows",
      message: "Purchase history endpoint returned no rolls, meat, or drinks rows for target shift date.",
      where: "/api/analysis/stock-review/purchase-history",
      canonical_source: "/api/bob/read/purchase-history",
    });
  }

  return res.json({
    status,
    shift,
    thresholds: {
      rolls: 5,
      meatGrams: 500,
      drinksPerSku: 2,
      salesTolerance: 5,
    },
    sourceState,
    blockers,
    missingData,
    missingDataFlags,
    missingDataDetails,
    comparisons,
    truthChecks: {
      shiftReport: shiftReportTruth,
      forms: formTruth,
      drinks: drinksTruth,
      stockComparisonSource,
      probes: {
        canonicalSalesProbeOk: canonicalSalesProbe.ok,
        canonicalStockProbeOk: canonicalStockProbe.ok,
        canonicalSalesProbeError: canonicalSalesProbe.error,
        canonicalStockProbeError: canonicalStockProbe.error,
        canonicalSalesRowCount: canonicalSalesRows.length,
        canonicalStockRowCount: canonicalStockRows.length,
      },
    },
    summary,
  });
  } catch (error: any) {
    return res.status(500).json({
      status: "BLOCKED",
      shift: getLatestCompletedShiftWindow(),
      thresholds: {
        rolls: 5,
        meatGrams: 500,
        drinksPerSku: 2,
        salesTolerance: 5,
      },
      sourceState: {},
      blockers: [error?.message || "Unknown verification error"],
      comparisons: [],
      summary: "Latest completed shift could not be fully verified because required canonical data was missing or incomplete.",
    });
  }
});

export default router;
