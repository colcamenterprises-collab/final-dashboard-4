// server/routes/rollsLedger.ts
import { Router } from 'express';
import { computeAndUpsertRollsLedger, getRollsLedgerRange, shiftWindowUTC, updateRollsLedgerManual } from '../services/rollsLedger.js';
import { normalizeDateParam } from '../utils/normalizeDate.js';
import { toShiftDateKey } from '../lib/shiftWindow.js';

const r = Router();

function logValidation400(route: string, req: any, validationFailure: string, errorMessage: string) {
  console.warn('[rolls-ledger][400]', {
    route,
    query: req.query,
    body: req.body,
    validationFailure,
    errorMessage,
  });
}

// GET one or range
r.get('/', async (req, res) => {
  try {
    const qp = req.query as any;
    const singleDate = qp.shiftDate || qp.date || toShiftDateKey(new Date());
    if (singleDate) {
      const s = normalizeDateParam(singleDate);
      const rows = await getRollsLedgerRange(s, s);
      const row = rows[0] ?? null;
      const win = shiftWindowUTC(s);
      return res.json({ ok: true, date: s, ...win, row });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const rows = await getRollsLedgerRange(start, end);
      return res.json({ ok: true, start, end, rows });
    }
    logValidation400('/api/analysis/rolls-ledger', req, 'missing date and range query params', 'Provide ?date= or ?start=&end=');
    return res.status(400).json({ ok: false, error: 'Provide ?date= or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// POST rebuild (single date or range)
r.post('/rebuild', async (req, res) => {
  try {
    const qp = req.query as any;
    if (qp.date) {
      const d = normalizeDateParam(qp.date);
      const out = await computeAndUpsertRollsLedger(d);
      return res.json({ ok: true, result: out });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const out:any[] = [];
      const s = new Date(start + 'T00:00:00Z');
      const e = new Date(end + 'T00:00:00Z');
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate()+1)) {
        out.push(await computeAndUpsertRollsLedger(d.toISOString().slice(0,10)));
      }
      return res.json({ ok: true, results: out });
    }
    logValidation400('/api/analysis/rolls-ledger/rebuild', req, 'missing date and range query params', 'Provide ?date= or ?start=&end=');
    return res.status(400).json({ ok: false, error: 'Provide ?date= or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// POST backfill last 14 days
r.post('/backfill-14', async (req, res) => {
  try {
    const results:any[] = [];
    for (let offset = -13; offset <= 0; offset++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      const key = d.toISOString().slice(0, 10);
      const result = await computeAndUpsertRollsLedger(key);
      results.push({ date: key, result });
    }
    return res.json({ ok: true, count: results.length, results });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// GET history (last 14 days descending)
r.get('/history', async (req, res) => {
  try {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 13);
    const startKey = start.toISOString().slice(0, 10);
    const rows = await getRollsLedgerRange(startKey, end);
    // Sort by date descending (handle both Date objects and strings)
    rows.sort((a, b) => {
      const dateA = a.shift_date instanceof Date ? a.shift_date.getTime() : new Date(a.shift_date).getTime();
      const dateB = b.shift_date instanceof Date ? b.shift_date.getTime() : new Date(b.shift_date).getTime();
      return dateB - dateA;
    });
    return res.json({ ok: true, start: startKey, end, rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// POST update manual amendments
r.post('/update-manual', async (req, res) => {
  try {
    const { shiftDate, rollsPurchasedManual, actualRollsEndManual, notes } = req.body;
    
    if (!shiftDate) {
      logValidation400('/api/analysis/rolls-ledger/update-manual', req, 'shiftDate missing in body', 'shiftDate is required');
      return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    }
    
    const date = normalizeDateParam(shiftDate);
    await updateRollsLedgerManual(
      date,
      rollsPurchasedManual !== undefined && rollsPurchasedManual !== null ? Number(rollsPurchasedManual) : null,
      actualRollsEndManual !== undefined && actualRollsEndManual !== null ? Number(actualRollsEndManual) : null,
      notes || null
    );
    
    return res.json({ ok: true, message: 'Manual amendments saved' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// POST toggle approval status
r.post('/approve', async (req, res) => {
  try {
    const { shiftDate, approved } = req.body;
    
    if (!shiftDate) {
      logValidation400('/api/analysis/rolls-ledger/approve', req, 'shiftDate missing in body', 'shiftDate is required');
      return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    }
    
    const date = normalizeDateParam(shiftDate);
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    
    await db.execute(sql`
      UPDATE rolls_ledger 
      SET approved = ${approved === true}, updated_at = NOW()
      WHERE shift_date = ${date}
    `);
    
    return res.json({ ok: true, approved: approved === true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

export default r;
