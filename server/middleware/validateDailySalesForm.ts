import { Request, Response, NextFunction } from 'express';

export function validateDailySalesForm(req: Request, res: Response, next: NextFunction) {
  const body = req.body;

  const requiredFields = [
    'date',
    'starting_cash',
    'cash_sales',
    'qr_sales',
    'grab_sales',
    'aroi_dee_sales',
    'ziptap_sales',
    'refunds',
    'banked_amount',
    'burger_buns_stock',
    'meat_weight',
    'drinks_stock',
    'expenses',
    'wages',
    'shopping_items'
  ];

  const missing = requiredFields.filter(field => !(field in body));

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      fields: missing
    });
  }

  // Example of custom field validation (optional)
  if (isNaN(Number(body.cash_sales)) || Number(body.cash_sales) < 0) {
    return res.status(400).json({ error: 'Cash sales must be a non-negative number' });
  }

  next();
}