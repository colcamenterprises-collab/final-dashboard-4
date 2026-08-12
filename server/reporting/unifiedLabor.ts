import { pool } from "../db";
import type { ResolvedReportingRange } from "./unifiedLedger";

const LABOR_TYPES = new Set(["WAGES", "OVERTIME", "BONUS"]);

export function summarizeRecordedLabor(rows: Array<{ payload?: any }>) {
  let laborCost = 0;
  const staff = new Set<string>();

  for (const row of rows) {
    const wages = Array.isArray(row?.payload?.wages) ? row.payload.wages : [];
    for (const wage of wages) {
      const type = String(wage?.type || "WAGES").toUpperCase();
      if (!LABOR_TYPES.has(type)) continue;
      const amount = Number(wage?.amount || 0);
      if (Number.isFinite(amount) && amount > 0) laborCost += amount;
      const name = String(wage?.staff || "").trim().toLocaleLowerCase();
      if (name && amount > 0) staff.add(name);
    }
  }

  return { laborCost, paidStaffCount: staff.size };
}

export async function queryRecordedLabor(range: ResolvedReportingRange) {
  if (!pool) throw new Error("Database unavailable");
  // Overnight shift ranges end on the following calendar day, but the form is
  // owned by the business date on which the shift opened.
  const inclusiveEndDate = range.toTime <= range.fromTime ? range.fromDate : range.toDate;
  const result = await pool.query(
    `SELECT DISTINCT ON (shift_date) payload
       FROM daily_sales_v2
      WHERE shift_date >= $1::date
        AND shift_date <= $2::date
        AND "deletedAt" IS NULL
      ORDER BY shift_date, COALESCE("submittedAtISO", "createdAt") DESC NULLS LAST`,
    [range.fromDate, inclusiveEndDate],
  );
  return summarizeRecordedLabor(result.rows);
}
