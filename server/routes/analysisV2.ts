import { Router } from 'express';
import { getDailyAnalysis } from '../services/dataAnalystService';

const router = Router();

router.get('/v2', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query parameter required (YYYY-MM-DD)' });
  }

  const analysis = await getDailyAnalysis(date);

  res.json({
    ...analysis,
    tables: {
      drinks: analysis.data.drinks,
      burgersAndSets: analysis.data.burgers,
      sideOrders: analysis.data.sides,
      modifiers: analysis.data.modifiers,
    },
  });
});

export default router;
