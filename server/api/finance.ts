import { Router } from "express";
import { db } from "../db";
import { plRow, plCategoryMap, plMonthCache, loyverseReceipts, expenses, expenseCategories } from "../../shared/schema";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";

const router = Router();

// P&L calculation logic based on your specifications
type MonthVec = { m: number[]; total: number };

async function getPL(year: number, includeShift = false): Promise<Record<string, MonthVec>> {
  const r: Record<string, MonthVec> = {};
  
  const acc = (code: string, m: number, val: number) => {
    if (!r[code]) r[code] = { m: Array(12).fill(0), total: 0 };
    r[code].m[m - 1] += val;
    r[code].total += val;
  };

  // 1) Sales aggregation from receipts (simplified for demo)
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  
  // Get sales data by month from loyverse receipts
  const salesByMonth = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${loyverseReceipts.createdAt})`,
      totalAmount: sql<number>`SUM(CAST(${loyverseReceipts.totalAmount} AS DECIMAL))`,
      paymentFees: sql<number>`SUM(CASE WHEN ${loyverseReceipts.paymentMethod} = 'CARD' THEN CAST(${loyverseReceipts.totalAmount} AS DECIMAL) * 0.029 ELSE 0 END)`,
    })
    .from(loyverseReceipts)
    .where(and(
      gte(loyverseReceipts.createdAt, startDate),
      lte(loyverseReceipts.createdAt, endDate)
    ))
    .groupBy(sql`EXTRACT(MONTH FROM ${loyverseReceipts.createdAt})`);

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

  // 2) Expenses aggregation
  const sources = includeShift ? ['DIRECT_UPLOAD', 'MANUAL', 'SHIFT_FORM'] : ['DIRECT_UPLOAD', 'MANUAL'];
  
  const expensesByMonth = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${expenses.date})`,
      categoryId: expenses.categoryId,
      totalAmount: sql<number>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
    })
    .from(expenses)
    .where(and(
      gte(expenses.date, startDate),
      lte(expenses.date, endDate),
      inArray(expenses.source, sources)
    ))
    .groupBy(sql`EXTRACT(MONTH FROM ${expenses.date})`, expenses.categoryId);

  // Map expenses to P&L rows through category mapping
  const categoryMappings = await db
    .select()
    .from(plCategoryMap)
    .innerJoin(expenseCategories, eq(plCategoryMap.categoryId, expenseCategories.id));

  const categoryToPLRow: Record<number, string> = {};
  categoryMappings.forEach(mapping => {
    categoryToPLRow[mapping.pl_category_map.categoryId] = mapping.pl_category_map.plrowCode;
  });

  for (const exp of expensesByMonth) {
    if (exp.categoryId !== null) {
      const plRowCode = categoryToPLRow[exp.categoryId];
      if (plRowCode) {
        acc(plRowCode, exp.month, exp.totalAmount);
      }
    }
  }

  // 3) COGS and composite calculations
  for (let m = 1; m <= 12; m++) {
    const cFood = r.COGS_FOOD?.m[m - 1] || 0;
    const cBev = r.COGS_BEVERAGE?.m[m - 1] || 0;
    acc('COGS_TOTAL', m, cFood + cBev);
    
    const netIncFees = r.NET_REV_INC_FEES?.m[m - 1] || 0;
    const cogs = cFood + cBev;
    const gp = netIncFees - cogs;
    acc('GROSS_PROFIT', m, gp);

    // Margin as percentage (0..1)
    const margin = netIncFees ? gp / netIncFees : 0;
    acc('GROSS_MARGIN', m, margin);
  }

  // 4) Total Expenses and EBIT
  const expenseRows = [
    'WAGES', 'TIPS_QR', 'BONUS_PAY', 'STAFF_FROM_ACCOUNT', 'RENT', 'ADMIN',
    'ADVERTISING_GRAB', 'ADVERTISING_OTHER', 'DELIVERY_FEE_DISCOUNT', 'DIRECTOR_PAYMENT',
    'DISCOUNT_MERCHANT_FUNDED', 'FITTINGS', 'KITCHEN_SUPPLIES', 'MARKETING',
    'MARKETING_SUCCESS_FEE', 'MISC', 'PRINTERS', 'RENOVATIONS', 'SUBSCRIPTIONS',
    'STATIONARY', 'TRAVEL', 'UTILITIES', 'MISC_CASH_PURCHASES'
  ];

  for (let m = 1; m <= 12; m++) {
    const sum = expenseRows.reduce((a, code) => a + (r[code]?.m[m - 1] || 0), 0);
    acc('TOTAL_EXPENSES', m, sum);

    const ebit = (r.GROSS_PROFIT?.m[m - 1] || 0) - sum;
    acc('EBIT', m, ebit);
    acc('EBT', m, ebit); // Assuming 0 interest for v1
    acc('NET_EARNINGS', m, ebit); // Assuming 0 tax for v1
  }

  return r;
}

// GET /api/finance/pl
router.get('/pl', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const includeShift = req.query.includeShift === 'true';
    
    const plData = await getPL(year, includeShift);
    
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
router.get('/pl/export', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const includeShift = req.query.includeShift === 'true';
    
    const plData = await getPL(year, includeShift);
    
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

export { router as financeRouter };