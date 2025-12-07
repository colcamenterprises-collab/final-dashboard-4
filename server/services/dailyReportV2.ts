/**
 * DAILY REPORT V2 — Aggregated Daily Summary
 *
 * This service compiles:
 * - Daily Sales V2
 * - Daily Stock V2
 * - Shopping List V2
 * - Variances (rolls/meat/drinks)
 * - Expenses summary
 *
 * Output:
 * A clean JSON structure used for:
 * - PDF generation
 * - Email summary
 * - Dashboard report viewer
 */

import { db as drizzleDb } from "../db";
import { sql } from "drizzle-orm";
import { dailySalesV2, shoppingListV2, dailyReportsV2 } from "../../shared/schema";
import { calculateVarianceV2 } from "./varianceEngineV2";
import { generateInsightsV2 } from "./insightsEngineV2";

export async function compileDailyReportV2(shiftDate: string) {
  // -------------------------------------------------------------
  // Fetch Sales V2 (stock data is stored in the payload)
  // -------------------------------------------------------------
  const [sales] = await drizzleDb
    .select()
    .from(dailySalesV2)
    .where(sql`"shiftDate" = ${shiftDate}`)
    .limit(1);

  if (!sales) {
    return { error: "No Daily Sales V2 found for " + shiftDate };
  }

  // -------------------------------------------------------------
  // Extract Stock from Sales Payload
  // -------------------------------------------------------------
  const payload = (sales as any).payload ?? {};
  const stock = {
    rollsEnd: payload.rollsEnd ?? null,
    meatEnd: payload.meatEnd ?? null,
    drinkStock: payload.drinkStock ?? {},
  };

  // Purchased Stock (from daily_stock_v2)
  const purchasedStock = {
    rolls: payload.rollsPurchased || 0,
    meatKg: payload.meatPurchasedGrams
      ? Number(payload.meatPurchasedGrams / 1000).toFixed(1)
      : "0.0",
    drinks: payload.drinksPurchased || {}
  };

  // -------------------------------------------------------------
  // Fetch Shopping List V2
  // -------------------------------------------------------------
  const [shopping] = await drizzleDb
    .select()
    .from(shoppingListV2)
    .where(sql`"shiftDate" = ${shiftDate}`)
    .limit(1);

  // Add sales breakdown for variance calculation
  const salesData = (sales as any);
  
  // Build proper stock structure for variance calc
  const stockForVariance = {
    rollsStart: payload.rollsStart || 0,
    rollsEnd: payload.rollsEnd || 0,
    meatStartGrams: payload.meatStartGrams || 0,
    meatEndGrams: payload.meatEndGrams || 0,
    drinkStockStart: payload.drinkStockStart || {},
    drinkStockEnd: payload.drinkStockEnd || {}
  };

  const purchasedStockForVariance = {
    rolls: payload.rollsPurchased || 0,
    meatGrams: payload.meatPurchasedGrams || 0,
    drinks: payload.drinksPurchased || {}
  };

  // Calculate variance
  const variance = calculateVarianceV2({
    sales: salesData,
    stock: stockForVariance,
    purchasedStock: purchasedStockForVariance,
  });

  // Generate insights
  const insights = generateInsightsV2({
    sales: salesData,
    stock,
    purchasedStock,
    variance,
    shoppingList: shopping?.itemsJson || []
  });

  // -------------------------------------------------------------
  // Construct Final JSON Bundle
  // -------------------------------------------------------------
  const report = {
    shiftDate,
    sales,
    stock,
    shoppingList: shopping ?? null,
    variance,
    purchasedStock,
    insights,
  };

  return report;
}

/**
 * Saves the compiled report into daily_reports_v2 table
 */
export async function saveDailyReportV2(reportJson: any) {
  const shiftDate = reportJson.shiftDate;

  // Check if report already exists
  const [existing] = await drizzleDb
    .select()
    .from(dailyReportsV2)
    .where(sql`"date" = ${shiftDate}`)
    .limit(1);

  if (existing) {
    await drizzleDb
      .update(dailyReportsV2)
      .set({ json: reportJson })
      .where(sql`id = ${existing.id}`);

    return existing.id;
  }

  // Insert new report
  const inserted = await drizzleDb
    .insert(dailyReportsV2)
    .values({
      date: shiftDate,
      salesId: reportJson.sales?.id ?? null,
      stockId: reportJson.stock?.id ?? null,
      shoppingListId: reportJson.shoppingList?.id ?? null,
      json: reportJson,
    })
    .returning({ id: dailyReportsV2.id });

  return inserted[0].id;
}
