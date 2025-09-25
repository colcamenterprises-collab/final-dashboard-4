import type { Request, Response, NextFunction } from 'express';

const ENABLED = process.env.BLOCK_LEGACY_INGREDIENTS === 'true';

const legacyPatterns = [
  /ingredients\.csv/i,
  /god.*file/i,
  /legacyIngredients/i,
  /ingredients_legacy/i
];

export function blockLegacyIngredients(req: Request, res: Response, next: NextFunction) {
  if (!ENABLED) return next();
  const path = (req.path || '') + ' ' + (req.url || '');
  if (legacyPatterns.some(rx => rx.test(path))) {
    res.setHeader('X-Legacy-Blocked', 'true');
    return res.status(410).json({ error: 'Legacy ingredient source blocked. Use DB.' });
  }
  return next();
}