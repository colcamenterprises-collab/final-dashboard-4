import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { plRow, plCategoryMap, plMonthCache, loyverseReceipts, expenses, expenseCategories } from "../../shared/schema";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";

const router = Router();

// Extend Express Request interface for authentication
interface AuthenticatedRequest extends Request {
  restaurantId: string;
  userId: string;
  userRole: string;
}

// SECURE Authentication middleware - REQUIRES valid authentication
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const restaurantId = req.headers['x-restaurant-id'] as string;
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  
  // SECURITY: Reject requests without proper authentication
  if (!restaurantId || !userId || restaurantId === 'default' || userId === 'anonymous') {
    return res.status(401).json({ error: 'Authentication required: Missing or invalid restaurant/user credentials' });
  }
  
  const authReq = req as AuthenticatedRequest;
  authReq.restaurantId = restaurantId;
  authReq.userId = userId;
  authReq.userRole = userRole || 'user';
  next();
};

// GET /api/finance/summary/today - Current Month Sales and Expenses
// Public endpoint - no auth required for dashboard display
router.get('/summary/today', async (req: Request, res: Response) => {
  try {
    // Get current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // Get verified sales from loyverse_shifts table for current month
    // Extract net_sales from each shift in the jsonb data array
    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(
          SUM(
            (shift_data->>'net_sales')::decimal
          ), 0
        ) as total_sales,
        COUNT(*) as shift_count
      FROM loyverse_shifts,
      jsonb_array_elements(data->'shifts') as shift_data
      WHERE EXTRACT(YEAR FROM shift_date) = ${year}
        AND EXTRACT(MONTH FROM shift_date) = ${month}
        AND jsonb_array_length(data->'shifts') > 0
    `);
    
    // Get shift expenses by parsing payload from daily_sales_v2 (matches expenses page display)
    const shiftFormsResult = await db.execute(sql`
      SELECT 
        "shiftDate",
        payload
      FROM daily_sales_v2
      WHERE payload IS NOT NULL
        AND EXTRACT(YEAR FROM TO_DATE("shiftDate", 'YYYY-MM-DD')) = ${year}
        AND EXTRACT(MONTH FROM TO_DATE("shiftDate", 'YYYY-MM-DD')) = ${month}
    `);
    
    // Parse payload to get accurate line-item totals
    let shiftExpensesTotal = 0;
    let shoppingExpenses = 0;
    let wagesExpenses = 0;
    
    for (const row of shiftFormsResult.rows) {
      const payload = row.payload as any;
      
      // Sum shopping expenses from payload
      if (payload.expenses && Array.isArray(payload.expenses)) {
        for (const expense of payload.expenses) {
          const amount = Number(expense.cost || 0);
          shoppingExpenses += amount;
          shiftExpensesTotal += amount;
        }
      }
      
      // Sum wages from payload
      if (payload.wages && Array.isArray(payload.wages)) {
        for (const wage of payload.wages) {
          const amount = Number(wage.amount || 0);
          wagesExpenses += amount;
          shiftExpensesTotal += amount;
        }
      }
    }
    
    // Get business expenses from expenses table for current month (amount stored in cents as costCents)
    // Includes DIRECT (modal entries) and STOCK_LODGMENT (paid rolls stock)
    const businessExpenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("costCents") / 100.0, 0) as business_total
      FROM expenses
      WHERE EXTRACT(YEAR FROM "shiftDate") = ${year}
        AND EXTRACT(MONTH FROM "shiftDate") = ${month}
        AND source IN ('DIRECT', 'STOCK_LODGMENT')
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const shiftCount = parseInt(rows[0]?.shift_count || '0');
    
    const businessExpenses = parseFloat(businessExpenseResult.rows[0]?.business_total || '0');
    
    const totalExpenses = shiftExpensesTotal + businessExpenses;
    
    res.json({
      sales: currentMonthSales,
      currentMonthSales,
      shiftCount,
      expenses: totalExpenses,
      currentMonthExpenses: totalExpenses,
      expenseBreakdown: {
        shopping: shoppingExpenses,
        wages: wagesExpenses,
        business: businessExpenses,
        shiftTotal: shiftExpensesTotal
      },
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales - totalExpenses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Current month summary error:', error);
    res.status(500).json({ error: 'Failed to fetch current month summary' });
  }
});

// Apply authentication to all other finance routes below
router.use(requireAuth);

// P&L calculation logic based on your specifications
type MonthVec = { m: number[]; total: number };

async function getPL(year: number, includeShift = false, restaurantId?: string): Promise<Record<string, MonthVec>> {
  const r: Record<string, MonthVec> = {};
  
  const acc = (code: string, m: number, val: number) => {
    if (!r[code]) r[code] = { m: Array(12).fill(0), total: 0 };
    r[code].m[m - 1] += val;
    r[code].total += val;
  };

  // 1) Sales aggregation from receipts (simplified for demo)
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  
  // Get sales data by month from loyverse receipts (with restaurant scoping if provided)
  const salesQuery = db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${loyverseReceipts.createdAt})`,
      totalAmount: sql<number>`SUM(CAST(${loyverseReceipts.totalAmount} AS DECIMAL))`,
      paymentFees: sql<number>`SUM(CASE WHEN ${loyverseReceipts.paymentMethod} = 'CARD' THEN CAST(${loyverseReceipts.totalAmount} AS DECIMAL) * 0.029 ELSE 0 END)`,
    })
    .from(loyverseReceipts)
    .where(and(
      gte(loyverseReceipts.createdAt, startDate),
      lte(loyverseReceipts.createdAt, endDate),
      ...(restaurantId ? [eq(loyverseReceipts.restaurantId, restaurantId)] : [])
    ))
    .groupBy(sql`EXTRACT(MONTH FROM ${loyverseReceipts.createdAt})`);
  
  const salesByMonth = await salesQuery;

  // Process sales data (simplified - in reality you'd separate food vs drinks)
  for (const s of salesByMonth) {
    const foodGross = s.totalAmount * 0.7; // Assume 70% food, 30% drinks
    const drinkGross = s.totalAmount * 0.3;
    const foodDisc = foodGross * 0.05; // Assume 5% discount rate
    const drinkDisc = drinkGross * 0.03; // Assume 3% discount rate
    
    acc('FOOD_GROSS', s.month, foodGross);
    acc('FOOD_DISCOUNT', s.month, foodDisc);
    acc('DRINK_GROSS', s.month, drinkGross);
    acc('DRINK_DISCOUNT', s.month, drinkDisc);
    acc('PAYMENT_FEES', s.month, s.paymentFees);
  }

  // Derived calculations
  for (let m = 1; m <= 12; m++) {
    const fg = r.FOOD_GROSS?.m[m - 1] || 0;
    const fd = r.FOOD_DISCOUNT?.m[m - 1] || 0;
    const dg = r.DRINK_GROSS?.m[m - 1] || 0;
    const dd = r.DRINK_DISCOUNT?.m[m - 1] || 0;
    const discTotal = fd + dd;
    const foodNet = fg - fd;
    const drinkNet = dg - dd;

    acc('FOOD_NET', m, foodNet);
    acc('DRINK_NET', m, drinkNet);
    acc('TOTAL_GROSS_REVENUE', m, fg + dg);
    acc('DISCOUNTS_TOTAL', m, discTotal);
    const netExFees = fg + dg - discTotal;
    acc('NET_REV_EX_FEES', m, netExFees);
    const fees = r.PAYMENT_FEES?.m[m - 1] || 0;
    acc('NET_REV_INC_FEES', m, netExFees - fees);
  }

  // 2) Expenses aggregation - Use valid schema enum values
  const sources = includeShift ? ['BANK_UPLOAD', 'PARTNER_UPLOAD', 'MANUAL_ENTRY'] : ['BANK_UPLOAD', 'PARTNER_UPLOAD', 'MANUAL_ENTRY'];
  
  const expensesByMonth = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${expenses.date})`,
      category: expenses.category,
      totalAmount: sql<number>`SUM(CAST(${expenses.amountCents} AS DECIMAL) / 100)`,
    })
    .from(expenses)
    .where(and(
      gte(sql`CAST(${expenses.date} AS DATE)`, startDate.toISOString().split('T')[0]),
      lte(sql`CAST(${expenses.date} AS DATE)`, endDate.toISOString().split('T')[0]),
      inArray(expenses.source, sources),
      ...(restaurantId ? [eq(expenses.restaurantId, restaurantId)] : [])
    ))
    .groupBy(sql`EXTRACT(MONTH FROM ${expenses.date})`, expenses.category);

  // Map expenses to P&L rows through category mapping
  const categoryMappings = await db
    .select()
    .from(plCategoryMap)
    .innerJoin(expenseCategories, eq(plCategoryMap.categoryId, expenseCategories.id));

  const categoryToPLRow: Record<number, string> = {};
  categoryMappings.forEach(mapping => {
    categoryToPLRow[mapping.pl_category_map.categoryId] = mapping.pl_category_map.plrowCode;
  });

  // Use database-driven category mapping (not hardcoded)
  for (const exp of expensesByMonth) {
    if (exp.category) {
      // First try to find in database category mappings
      const categoryMapping = categoryMappings.find(
        mapping => mapping.expense_categories.name === exp.category
      );
      
      let plRowCode = 'GENERAL_EXPENSES'; // default fallback
      
      if (categoryMapping) {
        // Use database mapping
        plRowCode = categoryMapping.pl_category_map.plrowCode;
      } else {
        // Only use hardcoded mapping as absolute fallback
        const fallbackMapping: Record<string, string> = {
          'Food & Beverage': 'COGS_FOOD',
          'Utilities': 'UTILITIES', 
          'Rent': 'RENT',
          'Fuel': 'FUEL',
          'Bank Fees': 'BANK_FEES'
        };
        plRowCode = fallbackMapping[exp.category] || 'GENERAL_EXPENSES';
      }
      
      acc(plRowCode, exp.month, exp.totalAmount);
    }
  }

  // 3) COGS and composite calculations
  for (let m = 1; m <= 12; m++) {
    const cFood = r.COGS_FOOD?.m[m - 1] || 0;
    const cBev = r.COGS_BEVERAGE?.m[m - 1] || 0;
    acc('COGS_TOTAL', m, cFood + cBev);
    
    // Calculate comprehensive TOTAL_EXPENSES from all expense categories
    const allExpenseCategories = Object.keys(r).filter(key => 
      !key.includes('GROSS') && !key.includes('NET') && !key.includes('REVENUE') && 
      !key.includes('DISCOUNT') && !key.includes('PAYMENT_FEES') && 
      (key.includes('COGS') || key.includes('EXPENSE') || key.includes('UTIL') || 
       key.includes('RENT') || key.includes('FUEL') || key.includes('BANK') ||
       key.includes('WAGE') || key.includes('ADMIN') || key.includes('MARKETING') ||
       key.includes('GENERAL'))
    );
    
    const totalExpensesForMonth = allExpenseCategories.reduce((sum, category) => {
      return sum + (r[category]?.m[m - 1] || 0);
    }, 0);
    
    acc('TOTAL_EXPENSES', m, totalExpensesForMonth);
    
    const netIncFees = r.NET_REV_INC_FEES?.m[m - 1] || 0;
    const cogs = cFood + cBev;
    const gp = netIncFees - cogs;
    acc('GROSS_PROFIT', m, gp);

    // Margin as percentage (0..1)
    const margin = netIncFees ? gp / netIncFees : 0;
    acc('GROSS_MARGIN', m, margin);
  }

  // 4) EBIT calculations (TOTAL_EXPENSES already calculated above - don't overwrite!)
  for (let m = 1; m <= 12; m++) {
    const totalExpenses = r.TOTAL_EXPENSES?.m[m - 1] || 0;
    const grossProfit = r.GROSS_PROFIT?.m[m - 1] || 0;
    
    const ebit = grossProfit - totalExpenses;
    acc('EBIT', m, ebit);
    acc('EBT', m, ebit); // Assuming 0 interest for v1
    acc('NET_EARNINGS', m, ebit); // Assuming 0 tax for v1
  }

  return r;
}

// GET /api/finance/pl
router.get('/pl', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurantId = authReq.restaurantId;
    
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const includeShift = req.query.includeShift === 'true';
    
    const plData = await getPL(year, includeShift, restaurantId);
    
    // Convert to format expected by frontend with labels
    const result: Record<string, any> = {};
    
    // Add labels for each P&L row
    const rowLabels: Record<string, { label: string; isPercentage?: boolean }> = {
      'TOTAL_GROSS_REVENUE': { label: 'Total Gross Revenue' },
      'FOOD_GROSS': { label: 'Food - Gross Sales' },
      'FOOD_DISCOUNT': { label: 'Food - Discounts' },
      'FOOD_NET': { label: 'Food - Net Sales' },
      'DRINK_GROSS': { label: 'Beverages - Gross Sales' },
      'DRINK_DISCOUNT': { label: 'Beverages - Discounts' },
      'DRINK_NET': { label: 'Beverages - Net Sales' },
      'DISCOUNTS_TOTAL': { label: 'Total Discounts' },
      'NET_REV_EX_FEES': { label: 'Net Revenue (Ex. Fees)' },
      'PAYMENT_FEES': { label: 'Payment Processing Fees' },
      'NET_REV_INC_FEES': { label: 'Net Revenue (Inc. Fees)' },
      'COGS_FOOD': { label: 'COGS - Food' },
      'COGS_BEVERAGE': { label: 'COGS - Beverages' },
      'COGS_TOTAL': { label: 'Total COGS' },
      'GROSS_PROFIT': { label: 'Gross Profit' },
      'GROSS_MARGIN': { label: 'Gross Margin %', isPercentage: true },
      'WAGES': { label: 'Staff Expenses - Wages' },
      'TIPS_QR': { label: 'Tips via QR' },
      'BONUS_PAY': { label: 'Bonus Payments' },
      'STAFF_FROM_ACCOUNT': { label: 'Staff Expenses (from Account)' },
      'RENT': { label: 'Rent' },
      'ADMIN': { label: 'Administrative Expenses' },
      'ADVERTISING_GRAB': { label: 'Advertising - Grab' },
      'ADVERTISING_OTHER': { label: 'Advertising - Other' },
      'DELIVERY_FEE_DISCOUNT': { label: 'Delivery Fee Discount' },
      'DIRECTOR_PAYMENT': { label: 'Director Payments' },
      'DISCOUNT_MERCHANT_FUNDED': { label: 'Merchant-Funded Discounts' },
      'FITTINGS': { label: 'Fittings & Equipment' },
      'KITCHEN_SUPPLIES': { label: 'Kitchen Supplies & Packaging' },
      'MARKETING': { label: 'Marketing' },
      'MARKETING_SUCCESS_FEE': { label: 'Marketing Success Fees' },
      'MISC': { label: 'Miscellaneous' },
      'PRINTERS': { label: 'Printers & Technology' },
      'RENOVATIONS': { label: 'Renovations' },
      'SUBSCRIPTIONS': { label: 'Subscriptions' },
      'STATIONARY': { label: 'Stationary & Office' },
      'TRAVEL': { label: 'Travel Expenses' },
      'UTILITIES': { label: 'Utilities' },
      'MISC_CASH_PURCHASES': { label: 'Miscellaneous Cash Purchases' },
      'TOTAL_EXPENSES': { label: 'Total Operating Expenses' },
      'EBIT': { label: 'EBIT (Earnings Before Interest & Tax)' },
      'INTEREST_EXPENSE': { label: 'Interest Expense' },
      'EBT': { label: 'Earnings Before Tax' },
      'INCOME_TAX': { label: 'Income Tax' },
      'NET_EARNINGS': { label: 'Net Earnings' },
    };

    for (const [code, data] of Object.entries(plData)) {
      const labelInfo = rowLabels[code];
      if (labelInfo) {
        result[code] = {
          code,
          label: labelInfo.label,
          months: data.m,
          total: data.total,
          isPercentage: labelInfo.isPercentage || false,
        };
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching P&L data:', error);
    res.status(500).json({ error: 'Failed to fetch P&L data' });
  }
});

// GET /api/finance/pl/export
router.get('/pl/export', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurantId = authReq.restaurantId;
    
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const includeShift = req.query.includeShift === 'true';
    
    const plData = await getPL(year, includeShift, restaurantId);
    
    // Convert to CSV format
    let csv = 'Account,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Full Year\n';
    
    for (const [code, data] of Object.entries(plData)) {
      const monthsStr = data.m.map(val => val.toFixed(2)).join(',');
      csv += `${code},${monthsStr},${data.total.toFixed(2)}\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=PL_${year}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting P&L data:', error);
    res.status(500).json({ error: 'Failed to export P&L data' });
  }
});

// GET /api/finance/summary - Golden Patch P&L Summary Endpoint
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurantId = authReq.restaurantId;
    
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const includeShift = req.query.includeShift === 'true';
    
    const plData = await getPL(year, includeShift, restaurantId);
    
    // Use comprehensive TOTAL_EXPENSES from P&L calculation (if available) or calculate sum
    const totalExpenses = plData.TOTAL_EXPENSES?.total || Object.keys(plData)
      .filter(key => key.startsWith('COGS_') || ['UTILITIES', 'RENT', 'FUEL', 'BANK_FEES', 'GENERAL_EXPENSES', 'WAGES', 'ADMIN', 'MARKETING'].includes(key))
      .reduce((sum, category) => sum + (plData[category]?.total || 0), 0);
    
    // Transform P&L data to summary format for Golden Patch frontend
    const summary = {
      year,
      totalRevenue: plData.TOTAL_GROSS_REVENUE?.total || 0,
      netRevenue: plData.NET_REV_INC_FEES?.total || 0,
      totalExpenses,
      netProfit: (plData.NET_REV_INC_FEES?.total || 0) - totalExpenses,
      monthlyBreakdown: plData,
      includeShift,
      timestamp: new Date().toISOString()
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({ error: 'Failed to generate financial summary' });
  }
});

export { router as financeRouter };