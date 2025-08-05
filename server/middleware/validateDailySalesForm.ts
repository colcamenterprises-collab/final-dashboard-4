import { Request, Response, NextFunction } from 'express';

export function validateDailySalesForm(req: Request, res: Response, next: NextFunction) {
  const body = req.body;

  // Core required fields aligned with database schema
  const requiredFields = [
    'completed_by',
    'shift_date',
    'starting_cash',
    'ending_cash',
    'cash_sales',
    'qr_scan_sales',
    'grab_sales',
    'aroi_dee_sales',
    'food_panda_sales',
    'total_sales',
    'burger_buns_stock',
    'meat_weight',
    'salary_wages',
    'gas_expense',
    'total_expenses'
  ];

  // Check for missing required fields
  const missing = requiredFields.filter(field => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      fields: missing,
      message: 'All required fields must be provided and cannot be empty'
    });
  }

  // Validate numeric fields (sales, cash, expenses)
  const numericFields = [
    'starting_cash', 'ending_cash', 'cash_sales', 'qr_scan_sales', 
    'grab_sales', 'aroi_dee_sales', 'food_panda_sales', 'total_sales',
    'salary_wages', 'gas_expense', 'total_expenses', 'meat_weight'
  ];

  for (const field of numericFields) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ 
          error: `${field} must be a non-negative number`,
          field: field,
          provided: value 
        });
      }
    }
  }

  // Validate integer fields (stock counts)
  const integerFields = ['burger_buns_stock'];
  
  for (const field of integerFields) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue)) {
        return res.status(400).json({ 
          error: `${field} must be a non-negative integer`,
          field: field,
          provided: value 
        });
      }
    }
  }

  // Validate date field
  if (body.shift_date) {
    const date = new Date(body.shift_date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ 
        error: 'shift_date must be a valid date',
        provided: body.shift_date 
      });
    }
    
    // Check if date is not too far in the future (more than 7 days)
    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + 7);
    
    if (date > maxFutureDate) {
      return res.status(400).json({ 
        error: 'shift_date cannot be more than 7 days in the future',
        provided: body.shift_date 
      });
    }
  }

  // Validate completed_by field
  if (body.completed_by && typeof body.completed_by !== 'string') {
    return res.status(400).json({ 
      error: 'completed_by must be a string',
      provided: body.completed_by 
    });
  }

  // Business logic validation: Total sales should roughly match individual sales
  const salesFields = ['cash_sales', 'qr_scan_sales', 'grab_sales', 'aroi_dee_sales', 'food_panda_sales'];
  const calculatedTotal = salesFields.reduce((sum, field) => {
    const value = Number(body[field]) || 0;
    return sum + value;
  }, 0);

  const providedTotal = Number(body.total_sales) || 0;
  const tolerance = Math.max(1, providedTotal * 0.01); // 1% tolerance or minimum 1 unit

  if (Math.abs(calculatedTotal - providedTotal) > tolerance) {
    return res.status(400).json({
      error: 'Total sales does not match sum of individual sales categories',
      calculated_total: calculatedTotal,
      provided_total: providedTotal,
      difference: Math.abs(calculatedTotal - providedTotal),
      message: 'Please verify your sales figures'
    });
  }

  // Cash flow validation: ending cash should be reasonable based on starting cash and sales
  const startingCash = Number(body.starting_cash) || 0;
  const endingCash = Number(body.ending_cash) || 0;
  const cashSales = Number(body.cash_sales) || 0;
  const totalExpenses = Number(body.total_expenses) || 0;

  const expectedEndingCash = startingCash + cashSales - totalExpenses;
  const cashDifference = Math.abs(endingCash - expectedEndingCash);

  // Allow for reasonable cash difference (tips, minor discrepancies, etc.)
  const maxCashDifference = Math.max(100, cashSales * 0.1); // 100 THB or 10% of cash sales

  if (cashDifference > maxCashDifference) {
    // This is a warning, not an error - we'll allow it but log it
    console.warn(`Cash flow discrepancy detected: Expected ${expectedEndingCash}, Got ${endingCash}, Difference: ${cashDifference}`);
  }

  // Sanitize and format data
  req.body = {
    ...body,
    // Ensure numeric fields are properly formatted
    starting_cash: Number(body.starting_cash) || 0,
    ending_cash: Number(body.ending_cash) || 0,
    total_sales: Number(body.total_sales) || 0,
    total_expenses: Number(body.total_expenses) || 0,
    burger_buns_stock: parseInt(body.burger_buns_stock) || 0,
    // Ensure string fields are trimmed
    completed_by: (body.completed_by || '').trim(),
    shift_type: body.shift_type || 'night',
    // Ensure date is properly formatted
    shift_date: body.shift_date ? new Date(body.shift_date) : new Date(),
    // Add metadata
    validated_at: new Date(),
    status: 'completed'
  };

  next();
}