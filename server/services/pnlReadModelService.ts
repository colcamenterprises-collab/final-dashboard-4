/**
 * 🔐 PATCH 1.6.18: P&L READ MODEL SERVICE
 * Deterministic rebuild of P&L data from source tables.
 * One row per day — idempotent writes.
 */

import { db } from "../db";
import { pnlReadModel, dailySalesV2, expenses, loyverse_shifts } from "@shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

const LOWER_BOUND_DATE = "2026-01-01";

export interface PnlDayData {
  date: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  shiftExpenses: number;
  businessExpenses: number;
  totalExpenses: number;
  grossProfit: number;
  grabGross: number;
  grabNet: number;
  grabVariance: number;
  dataStatus: "OK" | "PARTIAL" | "MISSING";
}

/**
 * Rebuild P&L data for a single date.
 * Deletes existing row and inserts fresh calculation.
 */
export async function rebuildDate(dateStr: string): Promise<PnlDayData> {
  if (dateStr < LOWER_BOUND_DATE) {
    throw new Error(`Date ${dateStr} is before lower bound ${LOWER_BOUND_DATE}`);
  }

  let grossSales = 0;
  let discounts = 0;
  let refunds = 0;
  let netSales = 0;
  let shiftExpenses = 0;
  let businessExpenses = 0;
  let grabGross = 0;
  let grabNet = 0;
  let dataStatus: "OK" | "PARTIAL" | "MISSING" = "MISSING";

  // 1. Read sales from Loyverse shifts (POS data - primary source)
  const loyverseResult = await db
    .select({
      posGross: sql<number>`
        COALESCE(
          CASE 
            WHEN jsonb_array_length(data->'shifts') > 0 
            THEN (
              SELECT SUM(CAST(shift->>'gross_sales' AS DECIMAL)) 
              FROM jsonb_array_elements(data->'shifts') AS shift
            )
            ELSE 0 
          END, 0
        )`.as('posGross'),
      posNet: sql<number>`
        COALESCE(
          CASE 
            WHEN jsonb_array_length(data->'shifts') > 0 
            THEN (
              SELECT SUM(CAST(shift->>'net_sales' AS DECIMAL)) 
              FROM jsonb_array_elements(data->'shifts') AS shift
            )
            ELSE 0 
          END, 0
        )`.as('posNet'),
      posDiscounts: sql<number>`
        COALESCE(
          CASE 
            WHEN jsonb_array_length(data->'shifts') > 0 
            THEN (
              SELECT SUM(CAST(COALESCE(shift->>'discounts', '0') AS DECIMAL)) 
              FROM jsonb_array_elements(data->'shifts') AS shift
            )
            ELSE 0 
          END, 0
        )`.as('posDiscounts'),
      posRefunds: sql<number>`
        COALESCE(
          CASE 
            WHEN jsonb_array_length(data->'shifts') > 0 
            THEN (
              SELECT SUM(CAST(COALESCE(shift->>'refunds', '0') AS DECIMAL)) 
              FROM jsonb_array_elements(data->'shifts') AS shift
            )
            ELSE 0 
          END, 0
        )`.as('posRefunds'),
    })
    .from(loyverse_shifts)
    .where(sql`shift_date = ${dateStr}::date`);

  if (loyverseResult.length > 0 && Number(loyverseResult[0].posNet) > 0) {
    grossSales = Number(loyverseResult[0].posGross);
    netSales = Number(loyverseResult[0].posNet);
    discounts = Number(loyverseResult[0].posDiscounts);
    refunds = Number(loyverseResult[0].posRefunds);
    dataStatus = "OK";
  }

  // 2. Fallback: Read sales from Daily Sales V2 (staff form data)
  if (dataStatus === "MISSING") {
    const salesResult = await db
      .select({
        totalSales: sql<number>`COALESCE(CAST(payload->>'totalSales' AS DECIMAL), 0)`.as('totalSales'),
      })
      .from(dailySalesV2)
      .where(and(
        sql`"shiftDate" = ${dateStr}`,
        sql`"deletedAt" IS NULL`
      ));

    if (salesResult.length > 0 && Number(salesResult[0].totalSales) > 0) {
      netSales = Number(salesResult[0].totalSales);
      grossSales = netSales; // Staff form doesn't track discounts separately
      dataStatus = "PARTIAL";
    }
  }

  // 3. Read shift expenses from Daily Sales V2 payload
  const shiftExpResult = await db
    .select({
      expenses: sql<number>`COALESCE(CAST(payload->>'totalExpenses' AS DECIMAL), 0)`.as('expenses'),
    })
    .from(dailySalesV2)
    .where(and(
      sql`"shiftDate" = ${dateStr}`,
      sql`"deletedAt" IS NULL`
    ));

  if (shiftExpResult.length > 0) {
    shiftExpenses = Number(shiftExpResult[0].expenses);
  }

  // 4. Read business expenses from expenses table
  const businessExpResult = await db
    .select({
      total: sql<number>`COALESCE(SUM("costCents"::DECIMAL / 100), 0)`.as('total'),
    })
    .from(expenses)
    .where(sql`"shiftDate" = ${dateStr}::date`);

  if (businessExpResult.length > 0) {
    businessExpenses = Number(businessExpResult[0].total);
  }

  // 5. Calculate totals
  const totalExpenses = shiftExpenses + businessExpenses;
  const grossProfit = netSales - totalExpenses;

  // 6. Grab variance (if tracked separately in payload)
  const grabResult = await db
    .select({
      grabGross: sql<number>`COALESCE(CAST(payload->>'grabSales' AS DECIMAL), 0)`.as('grabGross'),
      grabNet: sql<number>`COALESCE(CAST(payload->>'grabNet' AS DECIMAL), 0)`.as('grabNet'),
    })
    .from(dailySalesV2)
    .where(and(
      sql`"shiftDate" = ${dateStr}`,
      sql`"deletedAt" IS NULL`
    ));

  if (grabResult.length > 0) {
    grabGross = Number(grabResult[0].grabGross);
    grabNet = Number(grabResult[0].grabNet) || grabGross; // Default to gross if net not tracked
  }

  const grabVariance = grabGross - grabNet;

  // 7. Delete existing row (idempotent)
  await db.delete(pnlReadModel).where(eq(pnlReadModel.date, dateStr));

  // 8. Insert new row
  const [inserted] = await db
    .insert(pnlReadModel)
    .values({
      date: dateStr,
      grossSales: grossSales.toString(),
      discounts: discounts.toString(),
      refunds: refunds.toString(),
      netSales: netSales.toString(),
      shiftExpenses: shiftExpenses.toString(),
      businessExpenses: businessExpenses.toString(),
      totalExpenses: totalExpenses.toString(),
      grossProfit: grossProfit.toString(),
      grabGross: grabGross.toString(),
      grabNet: grabNet.toString(),
      grabVariance: grabVariance.toString(),
      dataStatus,
      rebuiltAt: new Date(),
    })
    .returning();

  return {
    date: dateStr,
    grossSales,
    discounts,
    refunds,
    netSales,
    shiftExpenses,
    businessExpenses,
    totalExpenses,
    grossProfit,
    grabGross,
    grabNet,
    grabVariance,
    dataStatus,
  };
}

/**
 * Get P&L data for a date range.
 * Read-only from pnl_read_model.
 */
export async function getRange(from: string, to: string): Promise<PnlDayData[]> {
  if (from < LOWER_BOUND_DATE) {
    from = LOWER_BOUND_DATE;
  }

  const rows = await db
    .select()
    .from(pnlReadModel)
    .where(and(
      gte(pnlReadModel.date, from),
      lte(pnlReadModel.date, to)
    ))
    .orderBy(pnlReadModel.date);

  return rows.map(row => ({
    date: row.date,
    grossSales: Number(row.grossSales || 0),
    discounts: Number(row.discounts || 0),
    refunds: Number(row.refunds || 0),
    netSales: Number(row.netSales || 0),
    shiftExpenses: Number(row.shiftExpenses || 0),
    businessExpenses: Number(row.businessExpenses || 0),
    totalExpenses: Number(row.totalExpenses || 0),
    grossProfit: Number(row.grossProfit || 0),
    grabGross: Number(row.grabGross || 0),
    grabNet: Number(row.grabNet || 0),
    grabVariance: Number(row.grabVariance || 0),
    dataStatus: (row.dataStatus as "OK" | "PARTIAL" | "MISSING") || "MISSING",
  }));
}

/**
 * Rebuild P&L data for a date range.
 */
export async function rebuildRange(from: string, to: string): Promise<{ rebuilt: number; errors: string[] }> {
  const errors: string[] = [];
  let rebuilt = 0;

  const fromDate = new Date(from);
  const toDate = new Date(to);

  for (let d = fromDate; d <= toDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    try {
      await rebuildDate(dateStr);
      rebuilt++;
    } catch (err: any) {
      errors.push(`${dateStr}: ${err.message}`);
    }
  }

  return { rebuilt, errors };
}

/**
 * Get distinct years that have P&L data.
 */
export async function getDistinctYears(): Promise<number[]> {
  const result = await db
    .select({
      year: sql<number>`DISTINCT EXTRACT(YEAR FROM date)::integer`.as('year'),
    })
    .from(pnlReadModel)
    .orderBy(sql`1 DESC`);

  const years = result.map(r => r.year).filter(y => y != null);
  
  // Always include current year even if no data
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }
  
  return years.sort((a, b) => b - a);
}
