import { pool } from "../db";

/**
 * PRIME COST SERVICE
 * Calculates Prime Cost (Wages + F&B) as percentage of Sales
 * Data sources:
 * - Sales/Wages: daily_sales_v2.payload JSONB field
 * - F&B: expenses table (costCents stores whole THB amounts)
 */

const EXPENSES_TABLE = "expenses";
const EXP_DATE_COL = "shiftDate";
const EXP_CAT_COL = "expenseType";
const EXP_AMT_COL = "costCents";

const DS_TABLE = "daily_sales_v2";
const DS_DATE_COL = "shift_date";

// F&B expense category matches
const FNB_MATCH = [
  "food & beverage",
  "food and beverage",
  "f&b",
  "food",
  "beverage",
  "fnb",
  "ingredients",
  "meat",
  "rolls",
  "burger buns",
  "stock",
  "purchase"
];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the most recent shift_date from daily_sales_v2. */
export async function getLatestShiftDate(): Promise<string | null> {
  const result = await pool.query(
    `SELECT shift_date
     FROM ${DS_TABLE}
     WHERE shift_date IS NOT NULL
     ORDER BY shift_date DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) return null;

  const shiftDate = result.rows[0].shift_date;

  // Handle date conversion
  if (shiftDate instanceof Date) {
    return ymd(shiftDate);
  }

  // If it's already a string in YYYY-MM-DD format
  if (typeof shiftDate === "string") {
    return shiftDate.split("T")[0];
  }

  return null;
}

type PrimeCostRow = {
  date: string;
  sales: number;
  wages: number;
  fnb: number;
  primeCost: number;
  primePct: number | null;
};

export async function getPrimeCostForDate(
  dateYMD: string
): Promise<PrimeCostRow> {
  // Sales + Wages from daily_sales_v2 payload JSONB
  const ds = await pool.query(
    `SELECT 
       COALESCE((payload->>'totalSales')::numeric, 0) AS sales,
       COALESCE((
         SELECT SUM((wage->>'amount')::numeric)
         FROM jsonb_array_elements(payload->'wages') AS wage
       ), 0) AS wages
     FROM ${DS_TABLE}
     WHERE "${DS_DATE_COL}" = $1::date
     LIMIT 1`,
    [dateYMD]
  );

  const sales = Number(ds.rows?.[0]?.sales ?? 0);
  const wages = Number(ds.rows?.[0]?.wages ?? 0);

  // F&B from Business Expenses modal (costCents stores whole THB)
  const fnb = await pool.query(
    `SELECT COALESCE(SUM("${EXP_AMT_COL}"), 0) AS amt
     FROM ${EXPENSES_TABLE}
     WHERE DATE("${EXP_DATE_COL}") = $1::date
       AND LOWER("${EXP_CAT_COL}") IN (${FNB_MATCH.map((_, i) => `$${i + 2}`).join(",")})`,
    [dateYMD, ...FNB_MATCH]
  );

  const fnbAmt = Number(fnb.rows?.[0]?.amt ?? 0); // costCents stores whole THB

  const primeCost = wages + fnbAmt;
  const primePct = sales > 0 ? (primeCost / sales) * 100 : null;

  return {
    date: dateYMD,
    sales,
    wages,
    fnb: fnbAmt,
    primeCost,
    primePct,
  };
}

export async function getPrimeCostMTD(dateYMD: string) {
  const d = new Date(dateYMD + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const startY = ymd(start),
    endY = ymd(end);

  const ds = await pool.query(
    `SELECT
       COALESCE(SUM((payload->>'totalSales')::numeric), 0) AS sales,
       COALESCE(SUM((
         SELECT SUM((wage->>'amount')::numeric)
         FROM jsonb_array_elements(payload->'wages') AS wage
       )), 0) AS wages
     FROM ${DS_TABLE}
     WHERE "${DS_DATE_COL}" >= $1::date AND "${DS_DATE_COL}" < $2::date`,
    [startY, endY]
  );

  const sales = Number(ds.rows?.[0]?.sales ?? 0);
  const wages = Number(ds.rows?.[0]?.wages ?? 0);

  const fnb = await pool.query(
    `SELECT COALESCE(SUM("${EXP_AMT_COL}"), 0) AS amt
     FROM ${EXPENSES_TABLE}
     WHERE DATE("${EXP_DATE_COL}") >= $1::date AND DATE("${EXP_DATE_COL}") < $2::date
       AND LOWER("${EXP_CAT_COL}") IN (${FNB_MATCH.map((_, i) => `$${i + 3}`).join(",")})`,
    [startY, endY, ...FNB_MATCH]
  );

  const fnbAmt = Number(fnb.rows?.[0]?.amt ?? 0); // costCents stores whole THB

  const primeCost = wages + fnbAmt;
  const primePct = sales > 0 ? (primeCost / sales) * 100 : null;

  return {
    start: startY,
    end: endY,
    sales,
    wages,
    fnb: fnbAmt,
    primeCost,
    primePct,
  };
}
