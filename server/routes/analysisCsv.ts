import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizeDateParam } from '../utils/normalizeDate.js';

const db = new PrismaClient();
const r = Router();

r.get('/items.csv', async (req, res) => {
  try {
    const date = normalizeDateParam(req.query.date as string);
    const rows: any[] = await db.$queryRaw`
      SELECT sku, name, category, qty, patties, red_meat_g, chicken_g, rolls
      FROM analytics_shift_item
      WHERE shift_date = ${date}::date
      ORDER BY category, name
    `;
    const header = ['SKU', 'Item', 'Category', 'Qty', 'Patties', 'RedMeat(g)', 'Chicken(g)', 'Rolls'];
    const csv = [header.join(',')]
      .concat(
        rows.map((r) =>
          [
            r.sku ?? '',
            r.name,
            r.category,
            r.qty ?? 0,
            r.patties ?? 0,
            r.red_meat_g ?? 0,
            r.chicken_g ?? 0,
            r.rolls ?? 0,
          ]
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(',')
        )
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="shift-${date}.csv"`);
    res.status(200).send(csv);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'csv-failed' });
  }
});

export default r;
