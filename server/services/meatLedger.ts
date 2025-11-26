// server/services/meatLedger.ts
import { PrismaClient } from '@prisma/client';
import { computeShiftAll } from './shiftItems.js';
const db = new PrismaClient();

const WASTE_G = Number(process.env.MEAT_WASTE_ALLOWANCE ?? 200);
const GRAMS_PER_PATTY = 140; // Standard patty weight

// BKK is UTC+7; shift on a given YYYY-MM-DD runs 17:00→03:00 (same UTC day: 10:00Z→20:00Z)
export function shiftWindowUTC(shiftDate: string) {
  const [y,m,d] = shiftDate.split('-').map(Number);
  const fromISO = new Date(Date.UTC(y, m-1, d, 10, 0, 0)).toISOString(); // 17:00 BKK
  const toISO   = new Date(Date.UTC(y, m-1, d, 20, 0, 0)).toISOString(); // 03:00 BKK next day
  return { fromISO, toISO };
}

// Ensure analytics cache exists for date (build if needed)
async function ensureAnalytics(shiftDate: string) {
  const existing = await db.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*)::bigint AS cnt FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date
  `;
  const has = existing?.[0]?.cnt && Number(existing[0].cnt) > 0;
  if (!has) {
    await computeShiftAll(shiftDate);
  }
}

// Get patties sold from analytics
async function getPattiesSoldFromAnalytics(shiftDate: string): Promise<number> {
  await ensureAnalytics(shiftDate);
  
  // Sum patties column from analytics
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(SUM(patties),0)::int AS n
    FROM analytics_shift_item
    WHERE shift_date = ${shiftDate}::date
  `;
  let patties = rows?.[0]?.n ?? 0;
  
  if (patties === 0) {
    // Fallback: sum qty where category='burger'
    const r2 = await db.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(SUM(qty),0)::int AS n
      FROM analytics_shift_item
      WHERE shift_date = ${shiftDate}::date AND category = 'burger'
    `;
    patties = r2?.[0]?.n ?? 0;
  }
  
  return patties;
}

// Get meat purchased from purchase_tally table
async function getMeatPurchased(shiftDate: string): Promise<{ grams: number }> {
  try {
    // Query purchase_tally table for meat purchases on this shift date
    // Meat purchases are stored with meat_grams column
    const r = await db.$queryRaw<{ qty: number }[]>`
      SELECT COALESCE(SUM(meat_grams), 0)::int AS qty
      FROM purchase_tally
      WHERE meat_grams IS NOT NULL
        AND date = ${shiftDate}::date
    `;
    return { grams: r?.[0]?.qty ?? 0 };
  } catch (_e) {
    console.error('Error fetching meat purchased:', _e);
    return { grams: 0 };
  }
}

// Get actual meat end weight from daily_sales_v2 form
async function getActualMeatEnd(shiftDate: string): Promise<{ grams: number | null }> {
  try {
    const a = await db.$queryRaw<{ meat_end: number | null }[]>`
      SELECT (payload->>'meatEnd')::int AS meat_end
      FROM daily_sales_v2
      WHERE "shiftDate" = ${shiftDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (a?.length && a[0].meat_end !== null) {
      return { grams: a[0].meat_end! };
    }
  } catch (_e) { 
    console.error('Error fetching meat from daily_sales_v2:', _e);
  }

  return { grams: null };
}

// Get meat start weight (from previous day's end)
async function getMeatStart(shiftDate: string): Promise<number> {
  // Previous day ledger if exists
  const prev = new Date(shiftDate + 'T00:00:00Z'); 
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0,10);
  
  const r1 = await db.$queryRaw<{ v: number | null }[]>`
    SELECT actual_meat_end_g AS v FROM meat_ledger WHERE shift_date = ${prevDate}::date
  `;
  if (r1?.length && r1[0].v !== null) return r1[0].v!;

  // Else previous day from daily_sales_v2 form
  try {
    const r2 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT (payload->>'meatEnd')::int AS v
      FROM daily_sales_v2
      WHERE "shiftDate" = ${prevDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (r2?.length && r2[0].v !== null) return r2[0].v!;
  } catch (_e) {}

  return 0;
}

export async function computeAndUpsertMeatLedger(shiftDate: string) {
  const { fromISO, toISO } = shiftWindowUTC(shiftDate);

  const [meat_start_g, patties_sold, purchased, actual] = await Promise.all([
    getMeatStart(shiftDate),
    getPattiesSoldFromAnalytics(shiftDate),
    getMeatPurchased(shiftDate),
    getActualMeatEnd(shiftDate),
  ]);

  const meat_purchased_g = purchased.grams;
  const meat_used_g = patties_sold * GRAMS_PER_PATTY;
  const estimated_g = meat_start_g + meat_purchased_g - meat_used_g;
  const actual_end_g = actual.grams;
  const variance_g = (actual_end_g ?? estimated_g) - estimated_g;

  const status =
    actual_end_g == null
      ? 'PENDING'
      : (Math.abs(variance_g) <= WASTE_G ? 'OK' : 'ALERT');

  await db.$executeRaw`
    INSERT INTO meat_ledger
    (shift_date, meat_start_g, meat_purchased_g, patties_sold,
     estimated_meat_end_g, actual_meat_end_g, waste_allowance_g, variance_g, status)
    VALUES
    (${shiftDate}::date, ${meat_start_g}, ${meat_purchased_g}, ${patties_sold},
     ${estimated_g}, ${actual_end_g}, ${WASTE_G}, ${variance_g}, ${status})
    ON CONFLICT (shift_date) DO UPDATE SET
      meat_start_g = EXCLUDED.meat_start_g,
      meat_purchased_g = EXCLUDED.meat_purchased_g,
      patties_sold = EXCLUDED.patties_sold,
      estimated_meat_end_g = EXCLUDED.estimated_meat_end_g,
      actual_meat_end_g = EXCLUDED.actual_meat_end_g,
      waste_allowance_g = EXCLUDED.waste_allowance_g,
      variance_g = EXCLUDED.variance_g,
      status = EXCLUDED.status,
      updated_at = now()
  `;

  return { 
    shiftDate, 
    fromISO, 
    toISO, 
    meat_start_g, 
    meat_purchased_g, 
    patties_sold, 
    estimated_g, 
    actual_end_g, 
    variance_g, 
    status 
  };
}

export async function getMeatLedgerRange(startDate: string, endDate: string) {
  return db.$queryRaw<any[]>`
    SELECT 
      shift_date,
      meat_start_g,
      COALESCE(meat_purchased_manual_g, meat_purchased_g) as meat_purchased_g,
      patties_sold,
      estimated_meat_end_g,
      COALESCE(actual_meat_end_manual_g, actual_meat_end_g) as actual_meat_end_g,
      variance_g,
      status,
      COALESCE(approved, false) as approved,
      meat_purchased_manual_g,
      actual_meat_end_manual_g,
      notes
    FROM meat_ledger
    WHERE shift_date >= ${startDate}::date AND shift_date <= ${endDate}::date
    ORDER BY shift_date DESC
  `;
}

export async function updateMeatLedgerManual(
  shiftDate: string, 
  meatPurchasedManualG: number | null,
  actualMeatEndManualG: number | null,
  notes: string | null
) {
  await db.$executeRaw`
    UPDATE meat_ledger
    SET 
      meat_purchased_manual_g = ${meatPurchasedManualG},
      actual_meat_end_manual_g = ${actualMeatEndManualG},
      notes = ${notes},
      updated_at = now()
    WHERE shift_date = ${shiftDate}::date
  `;
  
  // Recalculate estimated and variance
  const row = await db.$queryRaw<any[]>`
    SELECT 
      meat_start_g,
      COALESCE(meat_purchased_manual_g, meat_purchased_g) as meat_purchased_g,
      patties_sold,
      COALESCE(actual_meat_end_manual_g, actual_meat_end_g) as actual_meat_end_g
    FROM meat_ledger
    WHERE shift_date = ${shiftDate}::date
  `;
  
  if (row?.length) {
    const { meat_start_g, meat_purchased_g, patties_sold, actual_meat_end_g } = row[0];
    const meat_used_g = patties_sold * GRAMS_PER_PATTY;
    const estimated_g = meat_start_g + meat_purchased_g - meat_used_g;
    const variance_g = (actual_meat_end_g ?? estimated_g) - estimated_g;
    const status = actual_meat_end_g == null ? 'PENDING' : (Math.abs(variance_g) <= WASTE_G ? 'OK' : 'ALERT');
    
    await db.$executeRaw`
      UPDATE meat_ledger
      SET 
        estimated_meat_end_g = ${estimated_g},
        variance_g = ${variance_g},
        status = ${status},
        updated_at = now()
      WHERE shift_date = ${shiftDate}::date
    `;
  }
  
  return { success: true };
}
