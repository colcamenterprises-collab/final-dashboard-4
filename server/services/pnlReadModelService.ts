/**
 * 🔐 P&L READ MODEL SERVICE v2 — POS-DRIVEN, DETERMINISTIC
 * Source of truth: receipt_truth_summary (POS data)
 * Expenses: expenses table (business_date)
 * COGS: Future - from recipe mappings
 */

import { db } from "../db";
import { pnlReadModel, expenses } from "@shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

const LOWER_BOUND_DATE = "2026-01-01";

export interface PnlDayData {
  date: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  shiftExpenses: number;
  businessExpenses: number;
  totalExpenses: number;
  operatingIncome: number;
  grabGross: number;
  grabNet: number;
  grabVariance: number;
  dataStatus: "OK" | "PARTIAL" | "MISSING";
}

/**
 * Rebuild P&L data for a single date.
 * POS-driven: receipt_truth_summary is the source of truth for sales.
 */
export async function rebuildDate(dateStr: string): Promise<PnlDayData> {
  if (dateStr < LOWER_BOUND_DATE) {
    throw new Error(`Date ${dateStr} is before lower bound ${LOWER_BOUND_DATE}`);
  }

  let grossSales = 0;
  let discounts = 0;
  let refunds = 0;
  let netSales = 0;
  let cogs = 0;
  let shiftExpenses = 0;
  let businessExpenses = 0;
  let grabGross = 0;
  let grabNet = 0;
  let dataStatus: "OK" | "PARTIAL" | "MISSING" = "MISSING";

  // 1. Read sales from receipt_truth_summary (POS SOURCE OF TRUTH)
  const posResult = await db.execute(sql`
    SELECT 
      COALESCE(gross_sales, 0) as gross_sales,
      COALESCE(discounts, 0) as discounts,
      COALESCE(refunds, 0) as refunds,
      COALESCE(net_sales, 0) as net_sales
    FROM receipt_truth_summary
    WHERE business_date = ${dateStr}::date
    LIMIT 1
  `);

  if (posResult.rows.length > 0) {
    const pos = posResult.rows[0] as any;
    grossSales = Number(pos.gross_sales || 0);
    discounts = Number(pos.discounts || 0);
    refunds = Number(pos.refunds || 0);
    netSales = Number(pos.net_sales || 0);
    dataStatus = netSales > 0 ? "OK" : "MISSING";
  }

  // 2. Read COGS from receipt_truth_ingredient (if available)
  const cogsResult = await db.execute(sql`
    SELECT COALESCE(SUM(
      rti.quantity_used * COALESCE(pi."unitCost" / NULLIF(pi.purchase_unit_qty, 0), 0)
    ), 0) as total_cogs
    FROM receipt_truth_ingredient rti
    LEFT JOIN purchasing_items pi ON rti.ingredient_id = pi.id
    WHERE rti.receipt_date = ${dateStr}::date
  `);

  if (cogsResult.rows.length > 0) {
    cogs = Number((cogsResult.rows[0] as any).total_cogs || 0);
    if (netSales > 0 && cogs === 0) {
      dataStatus = "PARTIAL"; // Has sales but no COGS mapping
    }
  }

  // 3. Read business expenses from expenses table
  const expResult = await db.execute(sql`
    SELECT COALESCE(SUM("costCents"::DECIMAL / 100), 0) as total
    FROM expenses
    WHERE "shiftDate"::date = ${dateStr}::date
  `);

  if (expResult.rows.length > 0) {
    businessExpenses = Number((expResult.rows[0] as any).total || 0);
  }

  // 4. Calculate totals
  const totalExpenses = shiftExpenses + businessExpenses;
  const grossProfit = netSales - cogs;
  const operatingIncome = grossProfit - totalExpenses;
  const grabVariance = grabGross - grabNet;

  // 5. Delete existing row (idempotent)
  await db.delete(pnlReadModel).where(eq(pnlReadModel.date, dateStr));

  // 6. Insert new row
  await db
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
    });

  return {
    date: dateStr,
    grossSales,
    discounts,
    refunds,
    netSales,
    cogs,
    grossProfit,
    shiftExpenses,
    businessExpenses,
    totalExpenses,
    operatingIncome,
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

  return rows.map(row => {
    const grossProfit = Number(row.grossProfit || 0);
    const totalExpenses = Number(row.totalExpenses || 0);
    return {
      date: row.date,
      grossSales: Number(row.grossSales || 0),
      discounts: Number(row.discounts || 0),
      refunds: Number(row.refunds || 0),
      netSales: Number(row.netSales || 0),
      cogs: 0, // Not stored in current schema, calculated at read time
      grossProfit,
      shiftExpenses: Number(row.shiftExpenses || 0),
      businessExpenses: Number(row.businessExpenses || 0),
      totalExpenses,
      operatingIncome: grossProfit - totalExpenses,
      grabGross: Number(row.grabGross || 0),
      grabNet: Number(row.grabNet || 0),
      grabVariance: Number(row.grabVariance || 0),
      dataStatus: (row.dataStatus as "OK" | "PARTIAL" | "MISSING") || "MISSING",
    };
  });
}

/**
 * Rebuild P&L data for a date range.
 */
export async function rebuildRange(from: string, to: string): Promise<{ rebuilt: number; errors: string[] }> {
  const errors: string[] = [];
  let rebuilt = 0;

  const fromDate = new Date(from);
  const toDate = new Date(to);

  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
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
  
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }
  
  return years.sort((a, b) => b - a);
}
