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
import { getRollsPurchases } from './stockPurchaseAdapter.js';

const db = new PrismaClient();
const WASTE = Number(process.env.ROLLS_WASTE_ALLOWANCE ?? 4);

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

async function getBurgersSoldFromAnalytics(shiftDate: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(SUM(rolls),0)::int AS n
    FROM analytics_shift_item
    WHERE shift_date = ${shiftDate}::date
  `;
  let burgers = rows?.[0]?.n ?? 0;
  if (burgers === 0) {
    const r2 = await db.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(SUM(qty),0)::int AS n
      FROM analytics_shift_item
      WHERE shift_date = ${shiftDate}::date AND category = 'burger'
    `;
    burgers = r2?.[0]?.n ?? 0;
  }
  return burgers;
}

async function getRollsPurchased(shiftDate: string): Promise<{ qty: number; sourceExpenseId: string | null }> {
  try {
    const purchases = await getRollsPurchases(shiftDate);
    const qty = purchases.reduce((sum, row: any) => {
      const metaQty = Number((row as any)?.meta?.quantity ?? 0);
      return sum + (Number.isFinite(metaQty) ? metaQty : 0);
    }, 0);
    return { qty, sourceExpenseId: purchases[0]?.id ?? null };
  } catch (_e) {
    console.error('Error fetching rolls purchased:', _e);
    return { qty: 0, sourceExpenseId: null };
  }
}

async function getActualRollsEnd(shiftDate: string): Promise<{ count: number | null; stockId: string | null; salesId: string | null }> {
  try {
    const a = await db.$queryRaw<{ id: string; rolls_end: number | null }[]>`
      SELECT id::text, (payload->>'rollsEnd')::int AS rolls_end
      FROM daily_sales_v2
      WHERE "shiftDate" = ${shiftDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (a?.length && a[0].rolls_end !== null) return { count: a[0].rolls_end, stockId: null, salesId: a[0].id };
  } catch (_e) {
    console.error('Error fetching rolls from daily_sales_v2:', _e);
  }

  try {
    const b = await db.$queryRaw<{ id: string; burger_buns_stock: number | null }[]>`
      SELECT id::text, burger_buns_stock
      FROM daily_stock_sales
      WHERE shift_date = ${shiftDate}::date
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (b?.length && b[0].burger_buns_stock !== null) return { count: b[0].burger_buns_stock, stockId: b[0].id, salesId: null };
  } catch (_e) {}

  return { count: null, stockId: null, salesId: null };
}

async function getRollsStart(shiftDate: string): Promise<number> {
  const prev = new Date(`${shiftDate}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);

  const r1 = await db.$queryRaw<{ v: number | null }[]>`SELECT actual_rolls_end AS v FROM rolls_ledger WHERE shift_date = ${prevDate}::date`;
  if (r1?.length && r1[0].v !== null) return r1[0].v;

  try {
    const r2 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT (payload->>'rollsEnd')::int AS v
      FROM daily_sales_v2
      WHERE "shiftDate" = ${prevDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (r2?.length && r2[0].v !== null) return r2[0].v;
  } catch (_e) {}

  try {
    const r3 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT burger_buns_stock AS v
      FROM daily_stock_sales
      WHERE shift_date = ${prevDate}::date
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (r3?.length && r3[0].v !== null) return r3[0].v;
  } catch (_e) {}

  return 0;
}

export async function computeAndUpsertRollsLedger(shiftDate: string) {
  const normalizedShiftDate = toShiftDateKey(`${shiftDate}T17:00:00+07:00`);
  const { fromISO, toISO } = shiftWindowUTC(normalizedShiftDate);
  await ensureAnalytics(normalizedShiftDate);

  const [rolls_start, burgers_sold, purchased, actual] = await Promise.all([
    getRollsStart(normalizedShiftDate),
    getBurgersSoldFromAnalytics(normalizedShiftDate),
    getRollsPurchased(normalizedShiftDate),
    getActualRollsEnd(normalizedShiftDate),
  ]);

  const rolls_purchased = purchased.qty;
  const estimated = rolls_start + rolls_purchased - burgers_sold;
  const actual_end = actual.count;
  const variance = (actual_end ?? estimated) - estimated;
  const status = actual_end == null ? 'PENDING' : Math.abs(variance) <= WASTE ? 'OK' : 'ALERT';

  console.info('ROLLS LEDGER', { shiftDate: normalizedShiftDate, purchases: rolls_purchased, soldTotal: burgers_sold, actualEnd: actual_end });

  await db.$executeRaw`
    INSERT INTO rolls_ledger
    (shift_date, rolls_start, rolls_purchased, burgers_sold,
     estimated_rolls_end, actual_rolls_end, waste_allowance, variance, status)
    VALUES
    (${normalizedShiftDate}::date, ${rolls_start}, ${rolls_purchased}, ${burgers_sold},
     ${estimated}, ${actual_end}, ${WASTE}, ${variance}, ${status})
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start = EXCLUDED.rolls_start,
      rolls_purchased = EXCLUDED.rolls_purchased,
      burgers_sold = EXCLUDED.burgers_sold,
      estimated_rolls_end = EXCLUDED.estimated_rolls_end,
      actual_rolls_end = EXCLUDED.actual_rolls_end,
      waste_allowance = EXCLUDED.waste_allowance,
      variance = EXCLUDED.variance,
      status = EXCLUDED.status,
      updated_at = now()
  `;

  return {
    shiftDate: normalizedShiftDate,
    fromISO,
    toISO,
    rolls_start,
    rolls_purchased,
    burgers_sold,
    estimated,
    actual_end,
    variance,
    status,
    provenance: {
      purchasesSource: 'expenses',
      actualSource: 'daily_sales_v2.payload',
      soldSource: 'analytics_shift_item',
    },
  };
}

export async function getRollsLedgerRange(startDate: string, endDate: string) {
  return db.$queryRaw<any[]>`
    SELECT 
      shift_date,
      rolls_start,
      COALESCE(rolls_purchased_manual, rolls_purchased) as rolls_purchased,
      burgers_sold,
      estimated_rolls_end,
      COALESCE(actual_rolls_end_manual, actual_rolls_end) as actual_rolls_end,
      variance,
      status,
      COALESCE(approved, false) as approved,
      rolls_purchased_manual,
      actual_rolls_end_manual,
      notes
    FROM rolls_ledger
    WHERE shift_date >= ${startDate}::date AND shift_date <= ${endDate}::date
    ORDER BY shift_date DESC
  `;
}

export async function updateRollsLedgerManual(
  shiftDate: string,
  rollsPurchasedManual: number | null,
  actualRollsEndManual: number | null,
  notes: string | null
) {
  await db.$executeRaw`
    UPDATE rolls_ledger
    SET
      rolls_purchased_manual = ${rollsPurchasedManual},
      actual_rolls_end_manual = ${actualRollsEndManual},
      notes = ${notes},
      updated_at = now()
    WHERE shift_date = ${shiftDate}::date
  `;

  const row = await db.$queryRaw<any[]>`
    SELECT
      rolls_start,
      COALESCE(rolls_purchased_manual, rolls_purchased) as rolls_purchased,
      burgers_sold,
      COALESCE(actual_rolls_end_manual, actual_rolls_end) as actual_rolls_end
    FROM rolls_ledger
    WHERE shift_date = ${shiftDate}::date
  `;

  if (row?.length) {
    const { rolls_start, rolls_purchased, burgers_sold, actual_rolls_end } = row[0];
    const estimated = rolls_start + rolls_purchased - burgers_sold;
    const variance = (actual_rolls_end ?? estimated) - estimated;
    const status = actual_rolls_end == null ? 'PENDING' : Math.abs(variance) <= WASTE ? 'OK' : 'ALERT';

    await db.$executeRaw`
      UPDATE rolls_ledger
      SET
        estimated_rolls_end = ${estimated},
        variance = ${variance},
        status = ${status},
        updated_at = now()
      WHERE shift_date = ${shiftDate}::date
    `;
  }

  return { success: true };
}
