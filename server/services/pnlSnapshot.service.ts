import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { pnlSnapshot } from "@shared/schema";

function checksum(rows: any[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
}

export async function buildPnLSnapshot(start: string, end: string) {
  const revenueRows = await db.execute(sql`
    SELECT
      date,
      net_sales
    FROM receipt_truth_summary
    WHERE date BETWEEN ${start} AND ${end}
    ORDER BY date
  `);

  const revenueTotal = revenueRows.rows.reduce(
    (sum: number, r: any) => sum + Number(r.net_sales || 0),
    0
  );

  const revenueHash = checksum(revenueRows.rows);

  const expenseRows = await db.execute(sql`
    SELECT id, amount, expense_date FROM expenses
    WHERE expense_date BETWEEN ${start} AND ${end}
    ORDER BY expense_date, id
  `);

  const expenseTotal = expenseRows.rows.reduce(
    (sum: number, r: any) => sum + Number(r.amount || 0),
    0
  );

  const expenseHash = checksum(expenseRows.rows);

  const profit = revenueTotal - expenseTotal;

  const receiptCount = revenueRows.rows.length;

  await db.execute(sql`
    INSERT INTO pnl_snapshot (
      period_start,
      period_end,
      revenue_total,
      expense_total,
      profit_total,
      pos_receipt_count,
      revenue_checksum,
      expense_checksum
    )
    VALUES (
      ${start}::date,
      ${end}::date,
      ${revenueTotal},
      ${expenseTotal},
      ${profit},
      ${receiptCount},
      ${revenueHash},
      ${expenseHash}
    )
    ON CONFLICT (period_start, period_end)
    DO UPDATE SET
      revenue_total = EXCLUDED.revenue_total,
      expense_total = EXCLUDED.expense_total,
      profit_total = EXCLUDED.profit_total,
      pos_receipt_count = EXCLUDED.pos_receipt_count,
      revenue_checksum = EXCLUDED.revenue_checksum,
      expense_checksum = EXCLUDED.expense_checksum,
      built_at = now();
  `);

  return {
    periodStart: start,
    periodEnd: end,
    revenueTotal,
    expenseTotal,
    profitTotal: profit,
    posReceiptCount: receiptCount,
    revenueChecksum: revenueHash,
    expenseChecksum: expenseHash,
  };
}

export async function getLatestSnapshot(start: string, end: string) {
  const result = await db.execute(sql`
    SELECT * FROM pnl_snapshot
    WHERE period_start = ${start}::date AND period_end = ${end}::date
    ORDER BY built_at DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

export async function getAllSnapshots() {
  const result = await db.execute(sql`
    SELECT * FROM pnl_snapshot
    ORDER BY built_at DESC
    LIMIT 50
  `);

  return result.rows;
}
