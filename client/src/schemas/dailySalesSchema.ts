import { z } from 'zod'

// Fort Knox Daily Sales Schema matching the locked structure
export const DailyStockSchema = z.object({
  // Section 1: Shift Information
  shift_time: z.string().min(1, 'Shift time is required'),
  completed_by: z.string().min(1, 'Completed by is required'),
  
  // Section 2: Sales Information
  grab_sales: z.number().min(0, 'Grab sales must be positive'),
  aroi_dee_sales: z.number().min(0, 'Aroi Dee sales must be positive'),
  qr_scan_sales: z.number().min(0, 'QR scan sales must be positive'),
  cash_sales: z.number().min(0, 'Cash sales must be positive'),
  total_sales: z.number().min(0, 'Total sales must be positive'),
  
  // Section 3: Wages & Staff Payments
  staff_wages: z.array(z.object({
    name: z.string(),
    amount: z.number().min(0)
  })).optional(),
  
  // Section 4: Shopping & Expenses
  shopping_items: z.array(z.object({
    item: z.string(),
    amount: z.number().min(0),
    shop: z.string()
  })).optional(),
  
  // Section 5: Cash Management (includes Burger Buns & Meat Count)
  starting_cash: z.number().min(0, 'Starting cash must be positive'),
  ending_cash: z.number().min(0, 'Ending cash must be positive'),
  burger_buns_stock: z.number().min(0, 'Burger buns stock must be positive'),
  meat_weight: z.number().min(0, 'Meat weight must be positive'),
  buns_ordered: z.number().min(0, 'Buns ordered must be positive'),
  
  // Sections 6-12: Stock items (dynamic from CSV)
  drink_stock: z.record(z.number().min(0)).optional(),
  fresh_food_stock: z.record(z.number().min(0)).optional(),
  frozen_food: z.record(z.number().min(0)).optional(),
  shelf_items: z.record(z.number().min(0)).optional(),
  kitchen_items: z.record(z.number().min(0)).optional(),
  packaging_items: z.record(z.number().min(0)).optional(),
  
  // Section 13: Total Summary
  total_expenses: z.number().min(0, 'Total expenses must be positive'),
  net_revenue: z.number().optional()
})

export type DailyStockFormData = z.infer<typeof DailyStockSchema>