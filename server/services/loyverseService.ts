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

// The 08:00 legacy scheduler may still call this compatibility function,
// but it deliberately performs no external request and no data mutation.
export async function storeShiftSnapshot(_date: string): Promise<void> {
  console.log('[Loyverse] shift_snapshot_v2 live sync disabled — SBB POS is source of truth');
}
