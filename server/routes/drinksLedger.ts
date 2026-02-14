import { Router } from 'express';
import { computeAndUpsertDrinksLedger, getDrinksLedgerRange, shiftWindowUTC } from '../services/drinksLedger.js';
import { normalizeDateParam } from '../utils/normalizeDate.js';
import { toShiftDateKey } from '../lib/shiftWindow.js';

const r = Router();

function logValidation400(route: string, req: any, validationFailure: string, errorMessage: string) {
  console.warn('[drinks-ledger][400]', {
    route,
    query: req.query,
    body: req.body,
    validationFailure,
    errorMessage,
  });
}

r.get('/', async (req, res) => {
  try {
    const qp = req.query as any;
    const singleDate = qp.shiftDate || qp.date || toShiftDateKey(new Date());
    if (singleDate) {
      const s = normalizeDateParam(singleDate);
      const rows = await getDrinksLedgerRange(s, s);
      const row = rows[0] ?? null;
      const win = shiftWindowUTC(s);
      return res.json({ ok: true, date: s, ...win, row });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const rows = await getDrinksLedgerRange(start, end);
      return res.json({ ok: true, start, end, rows });
    }
    logValidation400('/api/analysis/drinks-ledger', req, 'missing date and range query params', 'Provide ?date= or ?start=&end=');
    return res.status(400).json({ ok: false, error: 'Provide ?date= or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

r.post('/rebuild', async (req, res) => {
  try {
    const qp = req.query as any;
    if (qp.date) {
      const d = normalizeDateParam(qp.date);
      const out = await computeAndUpsertDrinksLedger(d);
      return res.json({ ok: true, result: out });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const out:any[] = [];
      const s = new Date(start + 'T00:00:00Z');
      const e = new Date(end + 'T00:00:00Z');
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate()+1)) {
        out.push(await computeAndUpsertDrinksLedger(d.toISOString().slice(0,10)));
      }
      return res.json({ ok: true, results: out });
    }
    logValidation400('/api/analysis/drinks-ledger/rebuild', req, 'missing date and range query params', 'Provide ?date= or ?start=&end=');
    return res.status(400).json({ ok: false, error: 'Provide ?date= or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

r.get('/history', async (req, res) => {
  try {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 13);
    const startKey = start.toISOString().slice(0, 10);
    const rows = await getDrinksLedgerRange(startKey, end);
    rows.sort((a, b) => (a.shift_date > b.shift_date ? -1 : 1));
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

export default r;
