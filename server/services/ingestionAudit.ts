import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

export async function recordIngestionAudit(p: {
  shiftDate: string;
  fromISO: string;
  toISO: string;
  source: 'loyverse_api' | 'manual' | 'backfill' | 'unknown';
  receipts: number;
  items: number;
  modifiers: number;
  durationMs: number;
  status?: 'success' | 'failed' | 'skipped';
  error?: string;
}) {
  await db.$executeRaw`
    INSERT INTO ingestion_audit
      (shift_date, from_ts, to_ts, source, receipts_count, line_items_count, modifiers_count,
       duration_ms, status, error_message)
    VALUES
      (${p.shiftDate}::date, ${p.fromISO}::timestamptz, ${p.toISO}::timestamptz, ${p.source},
       ${p.receipts}, ${p.items}, ${p.modifiers}, ${p.durationMs},
       ${p.status ?? 'success'}, ${p.error ?? null})
  `;
}

export async function latestIngestionFor(shiftDate: string) {
  const rows = await db.$queryRaw<any[]>`
    SELECT source, receipts_count, line_items_count, modifiers_count, status, created_at
    FROM ingestion_audit
    WHERE shift_date = ${shiftDate}::date
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}
