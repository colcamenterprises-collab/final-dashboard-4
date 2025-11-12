import { Router } from 'express';
import { normalizeDateParam } from '../utils/normalizeDate.js';
import { latestIngestionFor } from '../services/ingestionAudit.js';

const r = Router();

r.get('/api/analysis/freshness', async (req, res) => {
  try {
    const date = normalizeDateParam(req.query.date as string);
    const f = await latestIngestionFor(date);
    res.json({ ok: true, freshness: f });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'freshness-failed' });
  }
});

export default r;
