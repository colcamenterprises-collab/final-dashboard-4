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

export type OfficialGrabEvidence = {
  sourceAvailable: boolean;
  coverageComplete: boolean;
  receipt_count: number;
  gross: number | null;
  net: number | null;
  deductions: number | null;
  coverage_start: string | null;
  coverage_end: string | null;
};

export type PosShiftSnapshot = NormalizedShiftReport & {
  sourceAvailable: true;
  source: 'sbb_pos_core';
  receipt_count: number;
  window_start: string;
  window_end: string;
  official_grab: OfficialGrabEvidence;
  grab_capture_gap: boolean;
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

function nullableNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getOfficialGrabEvidence(
  businessId: string,
  windowStartUtc: string,
  windowEndUtc: string,
): Promise<OfficialGrabEvidence> {
  const prisma = db();
  try {
    const [totals, coverage] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            COUNT(*) FILTER (WHERE t.transaction_type IN ('sale','refund'))::int AS receipt_count,
            SUM(t.gross_sales) FILTER (WHERE t.transaction_type IN ('sale','refund'))::numeric AS gross,
            SUM(t.net_sales) FILTER (WHERE t.transaction_type IN ('sale','refund'))::numeric AS net,
            SUM(t.other_deduction) FILTER (WHERE t.transaction_type IN ('sale','refund'))::numeric AS deductions
          FROM financial_transactions t
          JOIN financial_evidence_sources e ON e.id=t.evidence_source_id
          WHERE t.business_id=$3
            AND e.business_id=$3
            AND e.provider_key='grabfood'
            AND t.transaction_at >= $1::timestamptz
            AND t.transaction_at < $2::timestamptz
        `,
        windowStartUtc,
        windowEndUtc,
        businessId,
      ),
      prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            EXISTS(
              SELECT 1
              FROM financial_import_batches b
              JOIN financial_evidence_sources e ON e.id=b.evidence_source_id
              WHERE b.business_id=$3
                AND e.business_id=$3
                AND e.provider_key='grabfood'
                AND b.status='validated'
                AND b.coverage_start IS NOT NULL
                AND b.coverage_end IS NOT NULL
                AND b.coverage_start <= $1::timestamptz
                AND b.coverage_end >= $2::timestamptz
            ) AS coverage_complete,
            MIN(b.coverage_start) AS coverage_start,
            MAX(b.coverage_end) AS coverage_end
          FROM financial_import_batches b
          JOIN financial_evidence_sources e ON e.id=b.evidence_source_id
          WHERE b.business_id=$3
            AND e.business_id=$3
            AND e.provider_key='grabfood'
            AND b.status='validated'
        `,
        windowStartUtc,
        windowEndUtc,
        businessId,
      ),
    ]);

    const row = totals[0] ?? {};
    const coverageRow = coverage[0] ?? {};
    const count = Math.max(0, Math.trunc(numeric(row.receipt_count)));
    const coverageComplete = coverageRow.coverage_complete === true;
    return {
      sourceAvailable: count > 0 || coverageComplete,
      coverageComplete,
      receipt_count: count,
      gross: nullableNumeric(row.gross),
      net: nullableNumeric(row.net),
      deductions: nullableNumeric(row.deductions),
      coverage_start: coverageRow.coverage_start ? new Date(coverageRow.coverage_start).toISOString() : null,
      coverage_end: coverageRow.coverage_end ? new Date(coverageRow.coverage_end).toISOString() : null,
    };
  } catch (error: any) {
    // External evidence is additive. Before the migration/import is installed,
    // POS snapshots must continue to work and must not invent provider zeroes.
    if (error?.code === '42P01' || /financial_(transactions|import_batches|evidence_sources)/i.test(error?.message || '')) {
      return {
        sourceAvailable: false,
        coverageComplete: false,
        receipt_count: 0,
        gross: null,
        net: null,
        deductions: null,
        coverage_start: null,
        coverage_end: null,
      };
    }
    throw error;
  }
}

/**
 * Compatibility entry point used by the daily shift audit.
 *
 * Loyverse is no longer queried here. The operational snapshot is rebuilt from
 * the SBB POS ordering ledger for 17:00 -> 03:00 Asia/Bangkok. Official
 * marketplace evidence is attached separately and never overwrites POS facts.
 */
export async function storeShiftSnapshot(date: string): Promise<void> {
  await ensureShiftDerivedTables();

  const shiftDate = DateTime.fromISO(date, { zone: 'Asia/Bangkok' }).startOf('day');
  if (!shiftDate.isValid) {
    throw new Error(`Invalid shift date: ${date}`);
  }

  const windowStart = shiftDate.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const windowEnd = shiftDate.plus({ days: 1 }).set({ hour: 3, minute: 0, second: 0, millisecond: 0 });
  const windowStartUtc = windowStart.toUTC().toISO()!;
  const windowEndUtc = windowEnd.toUTC().toISO()!;
  const businessId = process.env.SBB_BUSINESS_ID || 'sbb-rawai';
  const prisma = db();

  const [rows, officialGrab] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
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
      windowStartUtc,
      windowEndUtc,
    ),
    getOfficialGrabEvidence(businessId, windowStartUtc, windowEndUtc),
  ]);

  const row = rows[0] ?? {};
  const posGrab = numeric(row.grab);
  const grabCaptureGap = officialGrab.coverageComplete && (officialGrab.gross ?? 0) > 0 && posGrab === 0;
  const posData: PosShiftSnapshot = {
    sourceAvailable: true,
    source: 'sbb_pos_core',
    receipt_count: Math.max(0, Math.trunc(numeric(row.receipt_count))),
    total: numeric(row.total),
    cash: numeric(row.cash),
    qr: numeric(row.qr),
    grab: posGrab,
    other: numeric(row.other),
    exp_cash: 0,
    exp: 0,
    window_start: windowStart.toISO()!,
    window_end: windowEnd.toISO()!,
    official_grab: officialGrab,
    grab_capture_gap: grabCaptureGap,
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

  const officialSummary = officialGrab.sourceAvailable
    ? `official Grab ${officialGrab.gross == null ? 'n/a' : officialGrab.gross.toFixed(2)} gross / ${officialGrab.net == null ? 'n/a' : officialGrab.net.toFixed(2)} net / coverage ${officialGrab.coverageComplete ? 'complete' : 'partial'}`
    : 'official Grab unavailable';
  console.log(
    `[SBB POS] shift snapshot ${date}: ${posData.receipt_count} receipts, total ${posData.total.toFixed(2)}, POS grab ${posData.grab.toFixed(2)}, ${officialSummary}${grabCaptureGap ? ' [GRAB CAPTURE GAP]' : ''}`,
  );
}