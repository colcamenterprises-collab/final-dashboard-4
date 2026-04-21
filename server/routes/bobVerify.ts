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
  variance?: number | null;
  threshold?: number | null;
  withinThreshold?: boolean | null;
  note?: string;
};

type MissingDataCode =
  | "missing_loyverse_shift_report"
  | "missing_daily_sales_form"
  | "missing_daily_stock_form"
  | "missing_purchase_data";

async function internalGet(path: string) {
  const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
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
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.forms)) return payload.forms;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.forms)) return payload.data.forms;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data)) return payload.data;
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

router.get("/latest-shift", bobAuth, async (_req: Request, res: Response) => {
  try {
    const shift = getLatestCompletedShiftWindow();

  const sourceState: Record<string, SourceState> = {
    shiftReport: { ok: false, path: "/api/bob/read/shift-report/latest" },
    dailySales: { ok: false, path: `/api/bob/read/daily-sales?date=${shift.shiftDate}` },
    dailyStock: { ok: false, path: `/api/bob/read/daily-stock?date=${shift.shiftDate}` },
    stockUsage: { ok: false, path: `/api/bob/read/stock-usage?date=${shift.shiftDate}` },
    purchaseHistory: { ok: false, path: `/api/bob/read/purchase-history?from=${shift.shiftDate}&to=${shift.shiftDate}` },
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

  const canonicalSalesRows = pickCanonicalRows(canonicalSalesProbe.payload);
  const canonicalStockRows = pickCanonicalRows(canonicalStockProbe.payload);

  const mappedDailySales = legacySalesRowsForShift[0] ?? null;
  const mappedDailyStock = legacyStockRowsForShift[0] ?? null;

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
    toNumber(mappedDailyStock?.burgerBunsOpening) ??
    toNumber(mappedDailyStock?.rollsOpening) ??
    toNumber(mappedDailyStock?.opening?.burgerBuns) ??
    toNumber(canonicalStockRows[0]?.rolls_start) ??
    toNumber(canonicalStockRows[0]?.rollsOpening);

  const rollsClosing =
    toNumber(mappedDailyStock?.burgerBunsStock) ??
    toNumber(mappedDailyStock?.rollsClosing) ??
    toNumber(mappedDailyStock?.closing?.burgerBuns) ??
    toNumber(canonicalStockRows[0]?.rolls_end) ??
    toNumber(canonicalStockRows[0]?.rollsClosing);

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

  comparisons.push(buildThresholdCheck("rolls_expected_vs_closing", expectedRolls, rollsClosing, 5));

  const closingMeat =
    toNumber(mappedDailyStock?.meatWeight) ??
    toNumber(mappedDailyStock?.meatClosing) ??
    toNumber(mappedDailyStock?.closing?.meatWeight) ??
    toNumber(canonicalStockRows[0]?.meat_end_g) ??
    toNumber(canonicalStockRows[0]?.meatWeightG);

  const openingMeat =
    toNumber(mappedDailyStock?.meatOpening) ??
    toNumber(mappedDailyStock?.opening?.meatWeight) ??
    toNumber(canonicalStockRows[0]?.meat_start_g) ??
    toNumber(canonicalStockRows[0]?.meatOpening);

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

  comparisons.push(buildThresholdCheck("meat_expected_vs_closing_g", expectedClosingMeat, closingMeat, 500));

  const stockUsageDrinks = toNumber(stockUsage?.summary?.drinksTotal) ?? toNumber(stockUsage?.totals?.drinks);
  const purchasedDrinkCount = Array.isArray(purchaseHistory?.drinks)
    ? purchaseHistory.drinks.reduce((sum: number, row: any) => {
        const items = Array.isArray(row?.items) ? row.items : [];
        const rowQty = items
          .map((item: any) => toNumber(item?.quantity))
          .filter((n: number | null) => n !== null)
          .reduce((itemSum: number, n: number | null) => itemSum + (n || 0), 0);
        return sum + rowQty;
      }, 0)
    : null;
  comparisons.push(buildThresholdCheck("drinks_usage_vs_purchased", stockUsageDrinks, purchasedDrinkCount, 2));

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

  const formTruth = {
    dailySales: {
      cause:
        legacySalesRowsForShift.length === 0 && canonicalSalesRows.length > 0
          ? "wrong_source_mapping"
          : legacySalesRowsForShift.length === 0 && canonicalSalesRows.length === 0
          ? "not_submitted_or_save_missing"
          : "ok",
      detail:
        legacySalesRowsForShift.length === 0 && canonicalSalesRows.length > 0
          ? "Bob verify reads /api/bob/read/daily-sales -> /api/daily-stock-sales (legacy table) while canonical forms endpoint has rows."
          : legacySalesRowsForShift.length === 0 && canonicalSalesRows.length === 0
          ? "No row found in either legacy mapped read or canonical forms read for the shift date."
          : "Sales form row found for target shift date.",
    },
    dailyStock: {
      cause:
        legacyStockRowsForShift.length === 0 && canonicalStockRows.length > 0
          ? "wrong_source_mapping"
          : legacyStockRowsForShift.length === 0 && canonicalStockRows.length === 0
          ? "not_submitted_or_save_missing"
          : "ok",
      detail:
        legacyStockRowsForShift.length === 0 && canonicalStockRows.length > 0
          ? "Bob verify reads /api/bob/read/daily-stock -> /api/daily-stock-sales (legacy table) while canonical stock forms endpoint has rows."
          : legacyStockRowsForShift.length === 0 && canonicalStockRows.length === 0
          ? "No row found in either legacy mapped read or canonical forms read for the shift date."
          : "Stock form row found for target shift date.",
    },
  };

  const drinksTruth = {
    interpretation:
      stockUsageDrinks !== null && purchasedDrinkCount !== null
        ? "comparison_design_issue"
        : "insufficient_data",
    detail:
      stockUsageDrinks !== null && purchasedDrinkCount !== null
        ? "Current check compares same-day drinks sold vs same-day purchases. This can fail even when operations are correct because drinks are inventory-carried across days."
        : "Unable to fully interpret drinks mismatch due to missing usage or purchase numeric input.",
    recommendedBasis: "opening_drinks + purchased_drinks - sold_drinks = closing_drinks (per SKU, per shift date)",
    purchaseHistoryEvidence: {
      rows: purchaseDrinkCount,
      source: "purchase_tally + purchase_tally_drink via /api/analysis/stock-review/purchase-history",
    },
  };

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
    comparisons,
    truthChecks: {
      shiftReport: shiftReportTruth,
      forms: formTruth,
      drinks: drinksTruth,
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
