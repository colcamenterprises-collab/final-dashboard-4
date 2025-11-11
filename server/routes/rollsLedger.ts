// server/routes/rollsLedger.ts
import { Router } from 'express';
import { computeAndUpsertRollsLedger, getRollsLedgerRange, shiftWindowUTC } from '../services/rollsLedger.js';

const r = Router();

// GET one or range
r.get('/', async (req, res) => {
  const { date, start, end } = req.query as { date?: string, start?: string, end?: string };
  try {
    if (date) {
      const s = date;
      const rows = await getRollsLedgerRange(s, s);
      const row = rows[0] ?? null;
      const win = shiftWindowUTC(s);
      return res.json({ ok: true, date: s, ...win, row });
    }
    if (start && end) {
      const rows = await getRollsLedgerRange(start, end);
      return res.json({ ok: true, start, end, rows });
    }
    return res.status(400).json({ ok: false, error: 'Provide ?date=YYYY-MM-DD or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

// POST rebuild (single date or range)
r.post('/rebuild', async (req, res) => {
  const { date, start, end } = req.query as any;
  try {
    if (date) {
      const out = await computeAndUpsertRollsLedger(date);
      return res.json({ ok: true, result: out });
    }
    if (start && end) {
      const out:any[] = [];
      const s = new Date(start + 'T00:00:00Z');
      const e = new Date(end + 'T00:00:00Z');
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate()+1)) {
        const key = d.toISOString().slice(0,10);
        out.push(await computeAndUpsertRollsLedger(key));
      }
      return res.json({ ok: true, results: out });
    }
    return res.status(400).json({ ok: false, error: 'Provide ?date= or ?start=&end=' });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'unknown' });
  }
});

export default r;
