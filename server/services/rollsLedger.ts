// server/services/rollsLedger.ts
import { PrismaClient } from '@prisma/client';
import { computeShiftAll } from './shiftItems.js'; // existing service export
const db = new PrismaClient();

const WASTE = Number(process.env.ROLLS_WASTE_ALLOWANCE ?? 4);

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
    await computeShiftAll(shiftDate); // populates analytics_shift_item
  }
}

// Helpers pulling from your current tables. Adjust names if different.
async function getBurgersSoldFromAnalytics(shiftDate: string): Promise<number> {
  // preferred: sum rolls column (1 per burger)
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(SUM(rolls),0)::int AS n
    FROM analytics_shift_item
    WHERE shift_date = ${shiftDate}::date
  `;
  let burgers = rows?.[0]?.n ?? 0;
  if (burgers === 0) {
    // fallback: sum qty where category='burger'
    const r2 = await db.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(SUM(qty),0)::int AS n
      FROM analytics_shift_item
      WHERE shift_date = ${shiftDate}::date AND category = 'burger'
    `;
    burgers = r2?.[0]?.n ?? 0;
  }
  return burgers;
}

async function getRollsPurchased(fromISO: string, toISO: string): Promise<{ qty: number, sourceExpenseId: string | null }> {
  // Query expenses table for Stock Lodgment entries with rolls
  // Quantity is stored in meta->'quantity' JSON field
  try {
    const r = await db.$queryRaw<{ qty: number }[]>`
      SELECT COALESCE(SUM((meta->>'quantity')::int), 0)::int AS qty
      FROM expenses
      WHERE (lower(item) LIKE '%bun%' OR lower(item) LIKE '%roll%')
        AND source = 'STOCK_LODGMENT'
        AND "createdAt" >= ${fromISO}::timestamptz 
        AND "createdAt" < ${toISO}::timestamptz
        AND meta->>'quantity' IS NOT NULL
    `;
    return { qty: r?.[0]?.qty ?? 0, sourceExpenseId: null };
  } catch (_e) {
    console.error('Error fetching rolls purchased:', _e);
    return { qty: 0, sourceExpenseId: null };
  }
}

async function getActualRollsEnd(shiftDate: string): Promise<{ count: number | null, stockId: string | null, salesId: string | null }> {
  // Query daily_sales_v2 table where the actual form data is stored
  try {
    const a = await db.$queryRaw<{ id: string, rolls_end: number | null }[]>`
      SELECT id::text, (payload->>'rollsEnd')::int AS rolls_end
      FROM daily_sales_v2
      WHERE "shiftDate" = ${shiftDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (a?.length && a[0].rolls_end !== null) {
      return { count: a[0].rolls_end!, stockId: null, salesId: a[0].id };
    }
  } catch (_e) { 
    console.error('Error fetching rolls from daily_sales_v2:', _e);
  }

  // Fallback: Try legacy daily_stock_sales table
  try {
    const b = await db.$queryRaw<{ id: string, burger_buns_stock: number | null }[]>`
      SELECT id::text, burger_buns_stock
      FROM daily_stock_sales
      WHERE shift_date = ${shiftDate}::date
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (b?.length && b[0].burger_buns_stock !== null) {
      return { count: b[0].burger_buns_stock!, stockId: b[0].id, salesId: null };
    }
  } catch (_e) {}

  return { count: null, stockId: null, salesId: null };
}

async function getRollsStart(shiftDate: string): Promise<number> {
  // previous day ledger if exists
  const prev = new Date(shiftDate + 'T00:00:00Z'); prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0,10);
  const r1 = await db.$queryRaw<{ v: number | null }[]>`
    SELECT actual_rolls_end AS v FROM rolls_ledger WHERE shift_date = ${prevDate}::date
  `;
  if (r1?.length && r1[0].v !== null) return r1[0].v!;

  // else previous day from daily_sales_v2 form
  try {
    const r2 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT (payload->>'rollsEnd')::int AS v
      FROM daily_sales_v2
      WHERE "shiftDate" = ${prevDate}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (r2?.length && r2[0].v !== null) return r2[0].v!;
  } catch (_e) {}

  // Fallback: legacy daily_stock_sales table
  try {
    const r3 = await db.$queryRaw<{ v: number | null }[]>`
      SELECT burger_buns_stock AS v
      FROM daily_stock_sales
      WHERE shift_date = ${prevDate}::date
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (r3?.length && r3[0].v !== null) return r3[0].v!;
  } catch (_e) {}

  return 0;
}

export async function computeAndUpsertRollsLedger(shiftDate: string) {
  const { fromISO, toISO } = shiftWindowUTC(shiftDate);
  await ensureAnalytics(shiftDate);

  const [rolls_start, burgers_sold, purchased, actual] = await Promise.all([
    getRollsStart(shiftDate),
    getBurgersSoldFromAnalytics(shiftDate),
    (async () => {
      const r = await getRollsPurchased(fromISO, toISO);
      return r;
    })(),
    getActualRollsEnd(shiftDate),
  ]);

  const rolls_purchased = purchased.qty;
  const estimated = rolls_start + rolls_purchased - burgers_sold;
  const actual_end = actual.count;
  const variance = (actual_end ?? estimated) - estimated;

  const status =
    actual_end == null
      ? 'PENDING'
      : (Math.abs(variance) <= WASTE ? 'OK' : 'ALERT');

  await db.$executeRaw`
    INSERT INTO rolls_ledger
    (shift_date, rolls_start, rolls_purchased, burgers_sold,
     estimated_rolls_end, actual_rolls_end, waste_allowance, variance, status)
    VALUES
    (${shiftDate}::date, ${rolls_start}, ${rolls_purchased}, ${burgers_sold},
     ${estimated}, ${actual_end}, ${WASTE}, ${variance}, ${status})
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start = EXCLUDED.rolls_start,
      rolls_purchased = EXCLUDED.rolls_purchased,
      burgers_sold = EXCLUDED.burgers_sold,
      estimated_rolls_end = EXCLUDED.estimated_rolls_end,
      actual_rolls_end    = EXCLUDED.actual_rolls_end,
      waste_allowance = EXCLUDED.waste_allowance,
      variance = EXCLUDED.variance,
      status   = EXCLUDED.status,
      updated_at = now()
  `;

  return { shiftDate, fromISO, toISO, rolls_start, rolls_purchased, burgers_sold, estimated, actual_end, variance, status };
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
  
  // Recalculate estimated and variance
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
    const status = actual_rolls_end == null ? 'PENDING' : (Math.abs(variance) <= WASTE ? 'OK' : 'ALERT');
    
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
