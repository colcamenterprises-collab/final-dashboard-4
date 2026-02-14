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

import { PrismaClient } from '@prisma/client';
import { computeShiftAll } from './shiftItems.js';
import { toShiftDateKey } from '../lib/shiftWindow.js';
import { getMeatPurchases } from './stockPurchaseAdapter.js';
import { MEAT_GRAMS_PER_PATTY } from './stockConstants.js';

const db = new PrismaClient();
const WASTE_G = Number(process.env.MEAT_WASTE_ALLOWANCE ?? 200);

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
  if (!has) await computeShiftAll(shiftDate);
}

async function getPattiesSoldFromAnalytics(shiftDate: string): Promise<number> {
  await ensureAnalytics(shiftDate);
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(SUM(patties),0)::int AS n
    FROM analytics_shift_item
    WHERE shift_date = ${shiftDate}::date
  `;
  let patties = rows?.[0]?.n ?? 0;
  if (patties === 0) {
    const r2 = await db.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(SUM(qty),0)::int AS n
      FROM analytics_shift_item
      WHERE shift_date = ${shiftDate}::date AND category = 'burger'
    `;
    patties = r2?.[0]?.n ?? 0;
  }
  return patties;
}

async function getMeatPurchased(shiftDate: string): Promise<{ grams: number }> {
  try {
    const purchases = await getMeatPurchases(shiftDate);
    const grams = purchases.reduce((sum, row) => sum + (row.meat_grams ?? 0), 0);
    return { grams };
  } catch (_e) {
    console.error('Error fetching meat purchased:', _e);
    return { grams: 0 };
  }
}

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
    if (a?.length && a[0].meat_end !== null) return { grams: a[0].meat_end };
  } catch (_e) {
    console.error('Error fetching meat from daily_sales_v2:', _e);
  }

  return { grams: null };
}

async function getMeatStart(shiftDate: string): Promise<number> {
  const prev = new Date(`${shiftDate}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);

  const r1 = await db.$queryRaw<{ v: number | null }[]>`SELECT actual_meat_end_g AS v FROM meat_ledger WHERE shift_date = ${prevDate}::date`;
  if (r1?.length && r1[0].v !== null) return r1[0].v;

  try {
    const r2 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT (payload->>'meatEnd')::int AS v
      FROM daily_sales_v2
      WHERE "shiftDate" = ${prevDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (r2?.length && r2[0].v !== null) return r2[0].v;
  } catch (_e) {}

  return 0;
}

export async function computeAndUpsertMeatLedger(shiftDate: string) {
  const normalizedShiftDate = toShiftDateKey(`${shiftDate}T17:00:00+07:00`);
  const { fromISO, toISO } = shiftWindowUTC(normalizedShiftDate);

  const [meat_start_g, patties_sold, purchased, actual] = await Promise.all([
    getMeatStart(normalizedShiftDate),
    getPattiesSoldFromAnalytics(normalizedShiftDate),
    getMeatPurchased(normalizedShiftDate),
    getActualMeatEnd(normalizedShiftDate),
  ]);

  const meat_purchased_g = purchased.grams;
  const meat_used_g = patties_sold * MEAT_GRAMS_PER_PATTY;
  const estimated_g = meat_start_g + meat_purchased_g - meat_used_g;
  const actual_end_g = actual.grams;
  const variance_g = (actual_end_g ?? estimated_g) - estimated_g;
  const status = actual_end_g == null ? 'PENDING' : Math.abs(variance_g) <= WASTE_G ? 'OK' : 'ALERT';

  console.info('MEAT LEDGER', { shiftDate: normalizedShiftDate, purchases: meat_purchased_g, soldTotal: patties_sold, actualEnd: actual_end_g });

  await db.$executeRaw`
    INSERT INTO meat_ledger
    (shift_date, meat_start_g, meat_purchased_g, patties_sold,
     estimated_meat_end_g, actual_meat_end_g, waste_allowance_g, variance_g, status)
    VALUES
    (${normalizedShiftDate}::date, ${meat_start_g}, ${meat_purchased_g}, ${patties_sold},
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
    shiftDate: normalizedShiftDate,
    fromISO,
    toISO,
    meat_start_g,
    meat_purchased_g,
    patties_sold,
    estimated_g,
    actual_end_g,
    variance_g,
    status,
    provenance: {
      purchasesSource: 'purchase_tally',
      actualSource: 'daily_sales_v2.payload',
      soldSource: 'analytics_shift_item',
    },
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
    const meat_used_g = patties_sold * MEAT_GRAMS_PER_PATTY;
    const estimated_g = meat_start_g + meat_purchased_g - meat_used_g;
    const variance_g = (actual_meat_end_g ?? estimated_g) - estimated_g;
    const status = actual_meat_end_g == null ? 'PENDING' : Math.abs(variance_g) <= WASTE_G ? 'OK' : 'ALERT';

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
