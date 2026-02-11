import { DateTime } from 'luxon';
import { db } from '../lib/prisma';
import { loyverseGet } from '../utils/loyverse';

export interface NormalizedShiftReport {
  total: number;
  cash: number;
  qr: number;
  grab: number;
  other: number;
  exp_cash: number;
  exp: number;
}

const EMPTY_REPORT: NormalizedShiftReport = {
  total: 0,
  cash: 0,
  qr: 0,
  grab: 0,
  other: 0,
  exp_cash: 0,
  exp: 0,
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(raw: any): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return toNumber(raw);
  if (typeof raw === 'object') {
    if (raw.amount != null) {
      return toNumber(raw.amount) / 100;
    }
    if (raw.value != null) {
      return toNumber(raw.value) / 100;
    }
  }
  return 0;
}

function classifyPayment(name: string): 'cash' | 'qr' | 'grab' | 'other' {
  const key = name.toLowerCase();
  if (key.includes('cash')) return 'cash';
  if (key.includes('qr') || key.includes('promptpay') || key.includes('transfer')) return 'qr';
  if (key.includes('grab')) return 'grab';
  return 'other';
}

function getShiftWindow(date: string) {
  const start = DateTime.fromISO(date, { zone: 'Asia/Bangkok' })
    .set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const end = start.plus({ hours: 10 });
  return {
    start,
    end,
    opened_at_min: start.minus({ hours: 1 }).toUTC().toISO()!,
    closed_at_max: end.plus({ hours: 1 }).toUTC().toISO()!,
  };
}

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

export async function fetchShiftReport(date: string): Promise<NormalizedShiftReport> {
  const token = process.env.LOYVERSE_TOKEN || process.env.LOYVERSE_ACCESS_TOKEN;
  if (!token) {
    console.error('[loyverseService.fetchShiftReport] Missing LOYVERSE token');
    throw new Error('LOYVERSE token is not configured');
  }

  const { start, end, opened_at_min, closed_at_max } = getShiftWindow(date);

  try {
    const data = await loyverseGet('shifts', {
      opened_at_min,
      closed_at_max,
    });

    const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
    const report = { ...EMPTY_REPORT };

    for (const shift of shifts) {
      const openedAt = DateTime.fromISO(shift?.opened_at ?? '', { zone: 'utc' }).setZone('Asia/Bangkok');
      if (!openedAt.isValid || openedAt < start || openedAt >= end) {
        continue;
      }

      report.total += parseMoney(shift?.gross_sales ?? shift?.net_sales ?? shift?.total_sales);
      report.exp += parseMoney(shift?.paid_in_and_out?.paid_out ?? shift?.expenses_total);
      report.exp_cash += parseMoney(shift?.paid_in_and_out?.paid_out_cash ?? shift?.cash_expenses_total);

      const payments = Array.isArray(shift?.payments) ? shift.payments : [];
      for (const payment of payments) {
        const amount = parseMoney(payment?.total_money ?? payment?.amount_money ?? payment?.amount);
        const methodName = String(payment?.payment_type_name ?? payment?.name ?? payment?.payment_type_id ?? 'other');
        const bucket = classifyPayment(methodName);
        report[bucket] += amount;
      }
    }

    if (report.total === 0) {
      report.total = report.cash + report.qr + report.grab + report.other;
    }

    return report;
  } catch (error) {
    console.error('[loyverseService.fetchShiftReport] Failed to fetch/normalize shift', { date, error });
    throw error;
  }
}

export async function storeShiftSnapshot(date: string): Promise<void> {
  await ensureShiftDerivedTables();
  const prisma = db();
  const normalized = await fetchShiftReport(date);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shift_snapshot_v2 (date, pos_data, updated_at)
      VALUES ($1::date, $2::jsonb, NOW())
      ON CONFLICT (date)
      DO UPDATE SET pos_data = EXCLUDED.pos_data, updated_at = NOW();
    `,
    date,
    JSON.stringify(normalized),
  );
}
