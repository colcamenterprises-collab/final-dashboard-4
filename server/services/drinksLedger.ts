/**
 * 🔒 CORE STOCK LOCK
 *
 * Rolls, Meat, and Drinks are FIRST-CLASS STOCK ITEMS.
 *
 * Rules:
 * - All purchases MUST enter via coreStockIntake
 * - No string matching (e.g. "bun", "roll") allowed
 * - No alternate write paths permitted
 * - Ledgers are the ONLY reconciliation mechanism
 *
 * Any change here requires explicit approval.
 */

/**
 * PATCH 3: DRINKS LEDGER SERVICE
 * Mirrors rollsLedger and meatLedger pattern for drinks tracking.
 * Tracks: Drinks Start → Purchased → Sold → Expected End → Actual End → Variance
 */
import { PrismaClient } from '@prisma/client';
import { computeShiftAll } from './shiftItems.js';

const db = new PrismaClient();

const WASTE_ALLOWANCE = Number(process.env.DRINKS_WASTE_ALLOWANCE ?? 2);

export function shiftWindowUTC(shiftDate: string) {
  const [y, m, d] = shiftDate.split('-').map(Number);
  const fromISO = new Date(Date.UTC(y, m - 1, d, 10, 0, 0)).toISOString();
  const toISO = new Date(Date.UTC(y, m - 1, d, 20, 0, 0)).toISOString();
  return { fromISO, toISO };
}

async function ensureAnalytics(shiftDate: string) {
  const existing = await db.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*)::bigint AS cnt FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date
  `;
  const has = existing?.[0]?.cnt && Number(existing[0].cnt) > 0;
  if (!has) {
    await computeShiftAll(shiftDate);
  }
}

async function getDrinksSoldFromAnalytics(shiftDate: string): Promise<number> {
  await ensureAnalytics(shiftDate);
  
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(SUM(qty), 0)::int AS n
    FROM analytics_shift_item
    WHERE shift_date = ${shiftDate}::date 
      AND (category ILIKE '%drink%' OR category ILIKE '%beverage%')
  `;
  return rows?.[0]?.n ?? 0;
}

async function getDrinksPurchased(shiftDate: string): Promise<{ qty: number }> {
  try {
    const r = await db.$queryRaw<{ qty: number }[]>`
      SELECT COALESCE(SUM(qty), 0)::int AS qty
      FROM stock_received_log
      WHERE item_type = 'drinks'
        AND shift_date = ${shiftDate}::date
    `;
    return { qty: r?.[0]?.qty ?? 0 };
  } catch (_e) {
    console.error('Error fetching drinks purchased:', _e);
    return { qty: 0 };
  }
}

async function getActualDrinksEnd(shiftDate: string): Promise<{ count: number | null }> {
  try {
    const a = await db.$queryRaw<{ drinks_end: number | null }[]>`
      SELECT (payload->>'drinksEnd')::int AS drinks_end
      FROM daily_sales_v2
      WHERE "shiftDate" = ${shiftDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (a?.length && a[0].drinks_end !== null) {
      return { count: a[0].drinks_end! };
    }
  } catch (_e) {
    console.error('Error fetching drinks from daily_sales_v2:', _e);
  }
  return { count: null };
}

async function getDrinksStart(shiftDate: string): Promise<number> {
  const prev = new Date(shiftDate + 'T00:00:00Z');
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);
  
  const r1 = await db.$queryRaw<{ v: number | null }[]>`
    SELECT actual_drinks_end AS v FROM drinks_ledger WHERE shift_date = ${prevDate}::date
  `;
  if (r1?.[0]?.v !== undefined && r1[0].v !== null) {
    return r1[0].v;
  }
  
  const r2 = await db.$queryRaw<{ v: number | null }[]>`
    SELECT estimated_drinks_end AS v FROM drinks_ledger WHERE shift_date = ${prevDate}::date
  `;
  if (r2?.[0]?.v !== undefined && r2[0].v !== null) {
    return r2[0].v;
  }
  
  return 0;
}

export interface DrinksLedgerEntry {
  shiftDate: string;
  drinksStart: number;
  drinksPurchased: number;
  drinksSold: number;
  estimatedDrinksEnd: number;
  actualDrinksEnd: number | null;
  wasteAllowance: number;
  variance: number;
  status: 'PENDING' | 'OK' | 'WARNING' | 'ALERT';
  approved: boolean;
}

export async function computeDrinksLedger(shiftDate: string): Promise<DrinksLedgerEntry> {
  const { fromISO, toISO } = shiftWindowUTC(shiftDate);
  
  const drinksStart = await getDrinksStart(shiftDate);
  const { qty: drinksPurchased } = await getDrinksPurchased(shiftDate);
  const drinksSold = await getDrinksSoldFromAnalytics(shiftDate);
  const { count: actualDrinksEnd } = await getActualDrinksEnd(shiftDate);
  
  const estimatedDrinksEnd = drinksStart + drinksPurchased - drinksSold;
  const variance = actualDrinksEnd !== null ? actualDrinksEnd - estimatedDrinksEnd : 0;
  
  let status: 'PENDING' | 'OK' | 'WARNING' | 'ALERT' = 'PENDING';
  if (actualDrinksEnd !== null) {
    const absVariance = Math.abs(variance);
    if (absVariance <= WASTE_ALLOWANCE) {
      status = 'OK';
    } else if (absVariance <= WASTE_ALLOWANCE * 2) {
      status = 'WARNING';
    } else {
      status = 'ALERT';
    }
  }
  
  return {
    shiftDate,
    drinksStart,
    drinksPurchased,
    drinksSold,
    estimatedDrinksEnd,
    actualDrinksEnd,
    wasteAllowance: WASTE_ALLOWANCE,
    variance,
    status,
    approved: false,
  };
}

export async function computeAndUpsertDrinksLedger(shiftDate: string): Promise<DrinksLedgerEntry> {
  const entry = await computeDrinksLedger(shiftDate);
  
  await db.$executeRaw`
    INSERT INTO drinks_ledger (
      shift_date, drinks_start, drinks_purchased, drinks_sold,
      estimated_drinks_end, actual_drinks_end, waste_allowance,
      variance, status, approved, created_at, updated_at
    ) VALUES (
      ${shiftDate}::date, ${entry.drinksStart}, ${entry.drinksPurchased}, ${entry.drinksSold},
      ${entry.estimatedDrinksEnd}, ${entry.actualDrinksEnd}, ${entry.wasteAllowance},
      ${entry.variance}, ${entry.status}, ${entry.approved}, NOW(), NOW()
    )
    ON CONFLICT (shift_date) DO UPDATE SET
      drinks_start = EXCLUDED.drinks_start,
      drinks_purchased = EXCLUDED.drinks_purchased,
      drinks_sold = EXCLUDED.drinks_sold,
      estimated_drinks_end = EXCLUDED.estimated_drinks_end,
      actual_drinks_end = EXCLUDED.actual_drinks_end,
      waste_allowance = EXCLUDED.waste_allowance,
      variance = EXCLUDED.variance,
      status = EXCLUDED.status,
      updated_at = NOW()
  `;
  
  console.log(`[DRINKS_LEDGER] Upserted for ${shiftDate}: start=${entry.drinksStart}, purchased=${entry.drinksPurchased}, sold=${entry.drinksSold}, variance=${entry.variance}`);
  
  return entry;
}

export async function getDrinksLedgerHistory(days: number = 30): Promise<DrinksLedgerEntry[]> {
  const rows = await db.$queryRaw<any[]>`
    SELECT 
      shift_date::text AS "shiftDate",
      drinks_start AS "drinksStart",
      drinks_purchased AS "drinksPurchased",
      drinks_sold AS "drinksSold",
      estimated_drinks_end AS "estimatedDrinksEnd",
      actual_drinks_end AS "actualDrinksEnd",
      waste_allowance AS "wasteAllowance",
      variance,
      status,
      approved
    FROM drinks_ledger
    ORDER BY shift_date DESC
    LIMIT ${days}
  `;
  return rows;
}

export async function getDrinksLedgerRange(startDate: string, endDate: string): Promise<any[]> {
  const rows = await db.$queryRaw<any[]>`
    SELECT 
      shift_date::text AS shift_date,
      drinks_start,
      drinks_purchased,
      drinks_sold,
      estimated_drinks_end,
      actual_drinks_end,
      waste_allowance,
      variance,
      status,
      approved
    FROM drinks_ledger
    WHERE shift_date >= ${startDate}::date AND shift_date <= ${endDate}::date
    ORDER BY shift_date DESC
  `;
  return rows;
}
