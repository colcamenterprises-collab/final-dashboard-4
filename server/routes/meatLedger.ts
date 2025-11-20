// server/routes/meatLedger.ts
import { Router } from 'express';
import { computeAndUpsertMeatLedger, getMeatLedgerRange, shiftWindowUTC, updateMeatLedgerManual } from '../services/meatLedger.js';
import { normalizeDateParam } from '../utils/normalizeDate.js';

const r = Router();

// GET one or range
r.get('/', async (req, res) => {
  try {
    const qp = req.query as any;
    if (qp.date) {
      const s = normalizeDateParam(qp.date);
      const rows = await getMeatLedgerRange(s, s);
      const row = rows[0] ?? null;
      const win = shiftWindowUTC(s);
      return res.json({ ok: true, date: s, ...win, row });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const rows = await getMeatLedgerRange(start, end);
      return res.json({ ok: true, start, end, rows });
    }
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
      const out = await computeAndUpsertMeatLedger(d);
      return res.json({ ok: true, result: out });
    }
    if (qp.start && qp.end) {
      const start = normalizeDateParam(qp.start);
      const end = normalizeDateParam(qp.end);
      const out:any[] = [];
      const s = new Date(start + 'T00:00:00Z');
      const e = new Date(end + 'T00:00:00Z');
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate()+1)) {
        out.push(await computeAndUpsertMeatLedger(d.toISOString().slice(0,10)));
      }
      return res.json({ ok: true, results: out });
    }
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
      const result = await computeAndUpsertMeatLedger(key);
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
    const rows = await getMeatLedgerRange(startKey, end);
    // Sort by date descending
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
    const { shiftDate, meatPurchasedManualG, actualMeatEndManualG, notes } = req.body;
    
    if (!shiftDate) {
      return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    }
    
    const date = normalizeDateParam(shiftDate);
    await updateMeatLedgerManual(
      date,
      meatPurchasedManualG !== undefined && meatPurchasedManualG !== null ? Number(meatPurchasedManualG) : null,
      actualMeatEndManualG !== undefined && actualMeatEndManualG !== null ? Number(actualMeatEndManualG) : null,
      notes || null
    );
    
    return res.json({ ok: true, message: 'Manual amendments saved' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

export default r;
