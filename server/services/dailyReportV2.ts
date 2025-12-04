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

  // -------------------------------------------------------------
  // Fetch Shopping List V2
  // -------------------------------------------------------------
  const [shopping] = await drizzleDb
    .select()
    .from(shoppingListV2)
    .where(sql`"shiftDate" = ${shiftDate}`)
    .limit(1);

  // -------------------------------------------------------------
  // Build Variance Summary
  // -------------------------------------------------------------
  const variance = {
    rollsEnd: stock.rollsEnd,
    meatEnd: stock.meatEnd,
    drinks: stock.drinkStock,
  };

  // -------------------------------------------------------------
  // Construct Final JSON Bundle
  // -------------------------------------------------------------
  const report = {
    shiftDate,
    sales,
    stock,
    shoppingList: shopping ?? null,
    variance,
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
