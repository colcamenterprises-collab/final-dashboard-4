import { DateTime } from 'luxon';
import { db } from '../lib/prisma';

export interface NormalizedShiftReport {
  total: number;
  cash: number;
  qr: number;
  grab: number;
  other: number;
  exp_cash: number;
  exp: number;
}

export type PosShiftSnapshot = NormalizedShiftReport & {
  sourceAvailable: true;
  source: 'sbb_pos_core';
  receipt_count: number;
  window_start: string;
  window_end: string;
};

export async function ensureShiftDerivedTables(): Promise<void> {
  const prisma = db();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS shift_snapshot_v2 (
      date DATE PRIMARY KEY,
      form_data JSONB,
      pos_data JSONB,
      approved BOOLEAN NOT NULL DEFAULT false,
      cash_banked NUMERIC(12,2),
      qr_banked NUMERIC(12,2),
      notes TEXT,
      completed_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_entries_shift (
      id BIGSERIAL PRIMARY KEY,
      date DATE NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      source TEXT NOT NULL DEFAULT 'shift',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT financial_entries_shift_uq UNIQUE (date, type, category, source)
    );
  `);
}

// Legacy API helper retained only so historical code still compiles.
// It must never make a live Loyverse request.
export async function fetchShiftReport(_date: string): Promise<NormalizedShiftReport> {
  throw new Error('Loyverse live API ingestion is retired; use SBB POS reporting');
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Compatibility entry point used by the daily shift audit.
 *
 * Loyverse is no longer queried here. The snapshot is rebuilt from the SBB POS
 * ordering ledger for the restaurant business-day window 17:00 -> 03:00
 * Asia/Bangkok. A successful query is explicitly marked sourceAvailable=true,
 * so a genuine zero-sales shift cannot be confused with missing POS data.
 */
export async function storeShiftSnapshot(date: string): Promise<void> {
  await ensureShiftDerivedTables();

  const shiftDate = DateTime.fromISO(date, { zone: 'Asia/Bangkok' }).startOf('day');
  if (!shiftDate.isValid) {
    throw new Error(`Invalid shift date: ${date}`);
  }

  const windowStart = shiftDate.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const windowEnd = shiftDate.plus({ days: 1 }).set({ hour: 3, minute: 0, second: 0, millisecond: 0 });
  const prisma = db();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT
        COUNT(*)::int AS receipt_count,
        COALESCE(SUM(total), 0)::numeric AS total,
        COALESCE(SUM(CASE
          WHEN order_mode = 'direct' AND payment_method = 'cash' THEN total
          ELSE 0
        END), 0)::numeric AS cash,
        COALESCE(SUM(CASE
          WHEN order_mode = 'direct' AND payment_method = 'manual_qr_transfer' THEN total
          ELSE 0
        END), 0)::numeric AS qr,
        COALESCE(SUM(CASE
          WHEN order_mode = 'grab' OR payment_method = 'grab' THEN total
          ELSE 0
        END), 0)::numeric AS grab,
        COALESCE(SUM(CASE
          WHEN NOT (
            (order_mode = 'direct' AND payment_method IN ('cash', 'manual_qr_transfer'))
            OR order_mode = 'grab'
            OR payment_method = 'grab'
          ) THEN total
          ELSE 0
        END), 0)::numeric AS other
      FROM ordering_orders
      WHERE created_at >= $1::timestamptz
        AND created_at < $2::timestamptz
        AND status <> 'cancelled'
        AND payment_status = 'paid'
    `,
    windowStart.toUTC().toISO(),
    windowEnd.toUTC().toISO(),
  );

  const row = rows[0] ?? {};
  const posData: PosShiftSnapshot = {
    sourceAvailable: true,
    source: 'sbb_pos_core',
    receipt_count: Math.max(0, Math.trunc(numeric(row.receipt_count))),
    total: numeric(row.total),
    cash: numeric(row.cash),
    qr: numeric(row.qr),
    grab: numeric(row.grab),
    other: numeric(row.other),
    exp_cash: 0,
    exp: 0,
    window_start: windowStart.toISO()!,
    window_end: windowEnd.toISO()!,
  };

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shift_snapshot_v2 (date, pos_data, updated_at)
      VALUES ($1::date, $2::jsonb, NOW())
      ON CONFLICT (date)
      DO UPDATE SET pos_data = EXCLUDED.pos_data, updated_at = NOW();
    `,
    date,
    JSON.stringify(posData),
  );

  console.log(
    `[SBB POS] shift snapshot ${date}: ${posData.receipt_count} receipts, total ${posData.total.toFixed(2)}, grab ${posData.grab.toFixed(2)}`,
  );
}
