import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * PIN THESE CONSTANTS TO YOUR ACTUAL SCHEMA NAMES.
 * Agent: set these from the schema probes. Do not guess.
 */
const EXPENSES_TABLE = "expenses";           // expenses table
const EXP_DATE_COL   = "shiftDate";          // shiftDate column (timestamp)
const EXP_CAT_COL    = "expenseType";        // expenseType column
const EXP_AMT_COL    = "costCents";          // costCents (stored in cents!)

const DS_TABLE       = "daily_sales_v2";     // daily sales v2 table
const DS_DATE_COL    = "shift_date";         // shift_date column
const DS_SALES_COL   = "totalSales";         // totalSales column (camelCase)
const DS_WAGES_COL   = "wagesTotal";         // wagesTotal column (camelCase)

// category normalisation for Food & Beverage
const FNB_MATCH = [
  "food & beverage", "food and beverage", "f&b", "food", "beverage"
];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the most recent shift_date present in daily_sales_v2. */
export async function getLatestShiftDate(): Promise<string | null> {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT MAX("${DS_DATE_COL}")::text AS d FROM ${DS_TABLE}`
  );
  const dateStr = rows?.[0]?.d;
  if (!dateStr) return null;
  
  // Ensure date is in YYYY-MM-DD format
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // If it's a Date object, format it
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  
  return ymd(d);
}

type PrimeCostRow = {
  date: string;
  sales: number;
  wages: number;
  fnb: number;
  primeCost: number;
  primePct: number | null;
};

export async function getPrimeCostForDate(dateYMD: string): Promise<PrimeCostRow> {
  // Sales + Wages from daily_sales_v2
  const ds: any[] = await db.$queryRawUnsafe(
    `SELECT "${DS_SALES_COL}" AS sales, "${DS_WAGES_COL}" AS wages
     FROM ${DS_TABLE}
     WHERE "${DS_DATE_COL}" = $1::date
     LIMIT 1`, dateYMD
  );
  const sales = Number(ds?.[0]?.sales ?? 0);
  const wages = Number(ds?.[0]?.wages ?? 0);

  // F&B from Business Expenses modal (strict same-day match)
  // Note: costCents is in cents, so divide by 100
  const fnb: any[] = await db.$queryRawUnsafe(
    `SELECT COALESCE(SUM("${EXP_AMT_COL}"),0) AS amt
     FROM ${EXPENSES_TABLE}
     WHERE DATE("${EXP_DATE_COL}") = $1::date
       AND LOWER("${EXP_CAT_COL}") IN (${FNB_MATCH.map((_,i)=>`$${i+2}`).join(",")})`,
       dateYMD, ...FNB_MATCH
  );
  const fnbAmt = Number(fnb?.[0]?.amt ?? 0) / 100; // Convert cents to baht

  const primeCost = wages + fnbAmt;
  const primePct = sales > 0 ? (primeCost / sales) * 100 : null;

  return {
    date: dateYMD,
    sales,
    wages,
    fnb: fnbAmt,
    primeCost,
    primePct
  };
}

export async function getPrimeCostMTD(dateYMD: string) {
  const d = new Date(dateYMD + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1));
  const startY = ymd(start), endY = ymd(end);

  const ds: any[] = await db.$queryRawUnsafe(
    `SELECT
       COALESCE(SUM("${DS_SALES_COL}"),0) AS sales,
       COALESCE(SUM("${DS_WAGES_COL}"),0) AS wages
     FROM ${DS_TABLE}
     WHERE "${DS_DATE_COL}" >= $1::date AND "${DS_DATE_COL}" < $2::date`,
     startY, endY
  );
  const sales = Number(ds?.[0]?.sales ?? 0);
  const wages = Number(ds?.[0]?.wages ?? 0);

  const fnb: any[] = await db.$queryRawUnsafe(
    `SELECT COALESCE(SUM("${EXP_AMT_COL}"),0) AS amt
     FROM ${EXPENSES_TABLE}
     WHERE DATE("${EXP_DATE_COL}") >= $1::date AND DATE("${EXP_DATE_COL}") < $2::date
       AND LOWER("${EXP_CAT_COL}") IN (${FNB_MATCH.map((_,i)=>`$${i+3}`).join(",")})`,
     startY, endY, ...FNB_MATCH
  );
  const fnbAmt = Number(fnb?.[0]?.amt ?? 0) / 100; // Convert cents to baht

  const primeCost = wages + fnbAmt;
  const primePct = sales > 0 ? (primeCost / sales) * 100 : null;

  return {
    start: startY,
    end: endY,
    sales,
    wages,
    fnb: fnbAmt,
    primeCost,
    primePct
  };
}
