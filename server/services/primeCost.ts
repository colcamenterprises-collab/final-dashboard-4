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

/** 
 * Returns the most recent shift_date based on 5PM-3AM Bangkok time window.
 * 
 * Shift logic:
 * - A shift starts at shift_date + 17:00 (5 PM BKK)
 * - A shift ends at (shift_date + 1 day) + 03:00 (3 AM BKK)
 * 
 * Current time logic:
 * - If now is 00:00-02:59 (before 3 AM) → we're in yesterday's shift
 * - If now is 03:00-16:59 (3 AM to before 5 PM) → latest completed shift is yesterday
 * - If now is 17:00-23:59 (5 PM onwards) → current shift is today
 */
export async function getLatestShiftDate(): Promise<string | null> {
  // Get current time in Bangkok timezone
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT NOW() AT TIME ZONE 'Asia/Bangkok' AS bkk_now`
  );
  const bkkNow = new Date(rows?.[0]?.bkk_now);
  const currentHour = bkkNow.getHours();
  
  // Determine the shift date based on current Bangkok time
  let shiftDate = new Date(bkkNow);
  
  if (currentHour >= 0 && currentHour < 3) {
    // Between midnight and 3 AM → we're in yesterday's shift
    shiftDate.setDate(shiftDate.getDate() - 1);
  } else if (currentHour >= 3 && currentHour < 17) {
    // Between 3 AM and 5 PM → latest completed shift is yesterday
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  // else: currentHour >= 17 → current shift is today (no adjustment needed)
  
  return ymd(shiftDate);
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
