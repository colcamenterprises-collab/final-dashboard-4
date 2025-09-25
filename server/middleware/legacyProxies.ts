import type { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';

const ENABLED = process.env.LEGACY_API_PROXY === 'true';

export async function proxyDailyStockSales(req: Request, res: Response, next: NextFunction) {
  if (!ENABLED) return next();
  try {
    // Map body if legacy shape differs. Here we forward as-is to canonical.
    const target = `${req.protocol}://${req.get('host')}/api/daily-stock`;
    const r = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['POST','PATCH','PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return next(e);
  }
}