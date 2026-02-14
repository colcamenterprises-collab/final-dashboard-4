/**
 * 🔒 CORE STOCK LOCK
 */
import { PrismaClient } from '@prisma/client';
import { computeShiftAll } from './shiftItems.js';
import { toShiftDateKey } from '../lib/shiftWindow.js';
import { getDrinksPurchases } from './stockPurchaseAdapter.js';

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
  if (!has) await computeShiftAll(shiftDate);
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
    const rows = await getDrinksPurchases(shiftDate);
    const qty = rows.reduce((sum, row: any) => sum + Number((row as any)?.qty ?? 0), 0);
    return { qty };
  } catch (_e) {
    console.error('Error fetching drinks purchased:', _e);
    return { qty: 0 };
  }
}

async function getActualDrinksEnd(shiftDate: string): Promise<{ count: number }> {
  const form = await db.daily_sales_v2.findFirst({
    where: { shiftDate, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  });

  if (!form) return { count: 0 };

  const payload = (form as any).payload || {};
  const drinksEnd = Number(payload.drinksEnd ?? 0);
  const drinkStock = payload.drinkStock;

  if (drinkStock && typeof drinkStock === 'object') {
    const total = Object.values(drinkStock).reduce((sum: number, value) => sum + Number(value ?? 0), 0);
    return { count: total };
  }

  return { count: drinksEnd || 0 };
}

async function getDrinksStart(shiftDate: string): Promise<number> {
  const prev = new Date(`${shiftDate}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);

  const r1 = await db.$queryRaw<{ v: number | null }[]>`SELECT actual_drinks_end AS v FROM drinks_ledger WHERE shift_date = ${prevDate}::date`;
  if (r1?.[0]?.v !== undefined && r1[0].v !== null) return r1[0].v;

  const r2 = await db.$queryRaw<{ v: number | null }[]>`SELECT estimated_drinks_end AS v FROM drinks_ledger WHERE shift_date = ${prevDate}::date`;
  if (r2?.[0]?.v !== undefined && r2[0].v !== null) return r2[0].v;

  return 0;
}

export interface DrinksLedgerEntry {
  shiftDate: string;
  drinksStart: number;
  drinksPurchased: number;
  drinksSold: number;
  estimatedDrinksEnd: number;
  actualDrinksEnd: number;
  wasteAllowance: number;
  variance: number;
  status: 'PENDING' | 'OK' | 'WARNING' | 'ALERT';
  approved: boolean;
  provenance: {
    purchasesSource: string;
    actualSource: string;
    soldSource: string;
  };
}

export async function computeDrinksLedger(shiftDate: string): Promise<DrinksLedgerEntry> {
  const normalizedShiftDate = toShiftDateKey(`${shiftDate}T17:00:00+07:00`);

  const drinksStart = await getDrinksStart(normalizedShiftDate);
  const { qty: drinksPurchased } = await getDrinksPurchased(normalizedShiftDate);
  const drinksSold = await getDrinksSoldFromAnalytics(normalizedShiftDate);
  const { count: actualDrinksEnd } = await getActualDrinksEnd(normalizedShiftDate);

  const estimatedDrinksEnd = drinksStart + drinksPurchased - drinksSold;
  const variance = actualDrinksEnd - estimatedDrinksEnd;

  let status: 'PENDING' | 'OK' | 'WARNING' | 'ALERT' = 'PENDING';
  const absVariance = Math.abs(variance);
  if (absVariance <= WASTE_ALLOWANCE) status = 'OK';
  else if (absVariance <= WASTE_ALLOWANCE * 2) status = 'WARNING';
  else status = 'ALERT';

  console.info('DRINKS LEDGER', { shiftDate: normalizedShiftDate, purchases: drinksPurchased, soldTotal: drinksSold, actualEnd: actualDrinksEnd });

  return {
    shiftDate: normalizedShiftDate,
    drinksStart,
    drinksPurchased,
    drinksSold,
    estimatedDrinksEnd,
    actualDrinksEnd,
    wasteAllowance: WASTE_ALLOWANCE,
    variance,
    status,
    approved: false,
    provenance: {
      purchasesSource: 'stock_received_log',
      actualSource: 'daily_sales_v2.payload',
      soldSource: 'analytics_shift_item',
    },
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
      ${entry.shiftDate}::date, ${entry.drinksStart}, ${entry.drinksPurchased}, ${entry.drinksSold},
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
  return rows.map((row) => ({
    ...row,
    provenance: {
      purchasesSource: 'stock_received_log',
      actualSource: 'daily_sales_v2.payload',
      soldSource: 'analytics_shift_item',
    },
  }));
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
  return rows.map((row) => ({
    ...row,
    provenance: {
      purchasesSource: 'stock_received_log',
      actualSource: 'daily_sales_v2.payload',
      soldSource: 'analytics_shift_item',
    },
  }));
}
