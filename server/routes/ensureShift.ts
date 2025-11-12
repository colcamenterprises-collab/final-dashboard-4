import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizeDateParam } from '../utils/normalizeDate.js';
import { recordIngestionAudit } from '../services/ingestionAudit.js';

// Use the window helper from rollsLedger service
function shiftWindowUTC(shiftDate: string) {
  const [y, m, d] = shiftDate.split('-').map(Number);
  const fromISO = new Date(Date.UTC(y, m - 1, d, 10, 0, 0)).toISOString();
  const toISO = new Date(Date.UTC(y, m - 1, d, 20, 0, 0)).toISOString();
  return { fromISO, toISO };
}

const db = new PrismaClient();
const r = Router();

async function countsInDb(fromISO: string, toISO: string) {
  const [r1, r2, r3] = await Promise.all([
    db.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM lv_receipt WHERE datetime_bkk >= ${fromISO}::timestamptz AND datetime_bkk < ${toISO}::timestamptz`,
    db.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM lv_line_item WHERE receipt_id IN (SELECT receipt_id FROM lv_receipt WHERE datetime_bkk >= ${fromISO}::timestamptz AND datetime_bkk < ${toISO}::timestamptz)`,
    db.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM lv_modifier WHERE receipt_id IN (SELECT receipt_id FROM lv_receipt WHERE datetime_bkk >= ${fromISO}::timestamptz AND datetime_bkk < ${toISO}::timestamptz)`,
  ]);
  return { receipts: r1?.[0]?.n ?? 0, items: r2?.[0]?.n ?? 0, modifiers: r3?.[0]?.n ?? 0 };
}

// Stub: replace with real Loyverse sync later
async function tryIngestFromLoyverseAPI(_fromISO: string, _toISO: string) {
  if (!process.env.LOYVERSE_API_TOKEN) return { receipts: 0, items: 0, modifiers: 0, used: false };
  // TODO: call your existing importer here
  return { receipts: 0, items: 0, modifiers: 0, used: true };
}

r.post('/api/loyverse/ensure-shift', async (req, res) => {
  const started = Date.now();
  try {
    const date = normalizeDateParam(req.query.date as string);
    const { fromISO, toISO } = shiftWindowUTC(date);

    const before = await countsInDb(fromISO, toISO);
    let receipts = before.receipts;
    let items = before.items;
    let modifiers = before.modifiers;
    let source: 'loyverse_api' | 'manual' | 'backfill' | 'unknown' = 'unknown';

    if (receipts === 0) {
      const ing = await tryIngestFromLoyverseAPI(fromISO, toISO);
      source = ing.used ? 'loyverse_api' : 'unknown';
      const after = await countsInDb(fromISO, toISO);
      receipts = after.receipts;
      items = after.items;
      modifiers = after.modifiers;
      await recordIngestionAudit({
        shiftDate: date,
        fromISO,
        toISO,
        source,
        receipts,
        items,
        modifiers,
        durationMs: Date.now() - started,
        status: ing.used ? 'success' : 'skipped',
        error: ing.used ? undefined : 'LOYVERSE_API_TOKEN not set or importer not wired',
      });
    } else {
      source = 'manual';
      await recordIngestionAudit({
        shiftDate: date,
        fromISO,
        toISO,
        source,
        receipts,
        items,
        modifiers,
        durationMs: Date.now() - started,
        status: 'success',
      });
    }

    res.json({ ok: true, date, fromISO, toISO, source, receipts, items, modifiers });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'ensure-failed' });
  }
});

export default r;
