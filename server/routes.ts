import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertExpenseSchema, 
  insertExpenseSupplierSchema,
  insertExpenseCategorySchema,
  insertShoppingListSchema, 
  insertStaffShiftSchema,
  insertTransactionSchema,
  insertIngredientSchema,
  insertRecipeSchema,
  insertRecipeIngredientSchema
} from "@shared/schema";
import { 
  analyzeReceipt, 
  detectAnomalies, 
  calculateIngredientUsage, 
  generateStockRecommendations,
  analyzeFinancialVariance
} from "./services/ai";
import { loyverseReceiptService } from "./services/loyverseReceipts";
import { loyverseAPI } from "./loyverseAPI";
import { loyverseShiftReports, loyverseReceipts } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { generateMarketingContent } from "./openai";

// Drink minimum stock levels with package sizes (based on authentic requirements)
const DRINK_REQUIREMENTS = {
  'Coke': { minStock: 30, packageSize: 24, unit: 'cans' },
  'Schweppes Manow': { minStock: 24, packageSize: 4, unit: 'cans' },
  'Coke Zero': { minStock: 30, packageSize: 6, unit: 'cans' },
  'Fanta Strawberry': { minStock: 24, packageSize: 6, unit: 'cans' },
  'Fanta Orange': { minStock: 24, packageSize: 6, unit: 'cans' },
  'Kids Apple Juice': { minStock: 12, packageSize: 6, unit: 'cans' },
  'Kids Orange': { minStock: 12, packageSize: 6, unit: 'cans' },
  'Soda Water': { minStock: 18, packageSize: 6, unit: 'bottles' },
  'Bottle Water': { minStock: 24, packageSize: 12, unit: 'bottles' }
};

async function generateShoppingListFromStockForm(formData: any) {
  try {
    // Process Fresh Food items (anything with quantity > 0 needs to be purchased)
    const freshFood = formData.freshFood || {};
    for (const [itemName, quantity] of Object.entries(freshFood)) {
      if (typeof quantity === 'number' && quantity > 0) {
        await storage.createShoppingListItem({
          itemName,
          quantity: quantity.toString(),
          unit: 'each',
          supplier: 'Fresh Market',
          pricePerUnit: '0',
          priority: 'high',
          selected: false,
          aiGenerated: false
        });
      }
    }

    // Process Frozen Food items (anything with quantity > 0 needs to be purchased)
    const frozenFood = formData.frozenFood || {};
    for (const [itemName, quantity] of Object.entries(frozenFood)) {
      if (typeof quantity === 'number' && quantity > 0) {
        await storage.createShoppingListItem({
          itemName,
          quantity: quantity.toString(),
          unit: 'each',
          supplier: 'Frozen Foods',
          pricePerUnit: '0',
          priority: 'medium',
          selected: false,
          aiGenerated: false
        });
      }
    }

    // Process Shelf Items (anything with quantity > 0 needs to be purchased)
    const shelfItems = formData.shelfItems || {};
    for (const [itemName, quantity] of Object.entries(shelfItems)) {
      if (typeof quantity === 'number' && quantity > 0) {
        await storage.createShoppingListItem({
          itemName,
          quantity: quantity.toString(),
          unit: 'each',
          supplier: 'Pantry Supplier',
          pricePerUnit: '0',
          priority: 'low',
          selected: false,
          aiGenerated: false
        });
      }
    }

    // Process drinks based on minimum stock requirements (only if current stock < minimum)
    const drinkStock = formData.drinkStock || {};
    
    for (const [drinkName, currentStock] of Object.entries(drinkStock)) {
      const requirement = DRINK_REQUIREMENTS[drinkName as keyof typeof DRINK_REQUIREMENTS];
      if (requirement && typeof currentStock === 'number') {
        if (currentStock < requirement.minStock) {
          // Calculate packages needed to reach minimum stock
          const packagesNeeded = Math.ceil((requirement.minStock - currentStock) / requirement.packageSize);
          
          await storage.createShoppingListItem({
            itemName: `${drinkName} (${requirement.packageSize} ${requirement.unit} pack)`,
            quantity: packagesNeeded.toString(),
            unit: 'packages',
            supplier: 'Beverage Supplier',
            pricePerUnit: '0',
            priority: 'high',
            selected: false,
            aiGenerated: true
          });
        }
      }
    }

    // Process burger buns stock count (only if quantity > 0)
    if (formData.burgerBunsStock && typeof formData.burgerBunsStock === 'number' && formData.burgerBunsStock > 0) {
      await storage.createShoppingListItem({
        itemName: 'Burger Buns',
        quantity: formData.burgerBunsStock.toString(),
        unit: 'packs',
        supplier: 'Bakery',
        pricePerUnit: '0',
        priority: 'high',
        selected: false,
        aiGenerated: false
      });
    }

    // Process meat weight (only if quantity > 0)
    if (formData.meatWeight && parseFloat(formData.meatWeight) > 0) {
      await storage.createShoppingListItem({
        itemName: 'Ground Beef',
        quantity: formData.meatWeight,
        unit: 'kg',
        supplier: 'Meat Supplier',
        pricePerUnit: '0',
        priority: 'high',
        selected: false,
        aiGenerated: false
      });
    }

    // Process kitchen items
    const kitchenItems = formData.kitchenItems || {};
    for (const [itemName, quantity] of Object.entries(kitchenItems)) {
      if (typeof quantity === 'number' && quantity > 0) {
        await storage.createShoppingListItem({
          itemName,
          quantity: quantity.toString(),
          unit: 'each',
          supplier: 'Kitchen Supplies',
          pricePerUnit: '0',
          priority: 'low',
          selected: false,
          aiGenerated: false
        });
      }
    }

    // Process packaging items
    const packagingItems = formData.packagingItems || {};
    for (const [itemName, quantity] of Object.entries(packagingItems)) {
      if (typeof quantity === 'number' && quantity > 0) {
        await storage.createShoppingListItem({
          itemName,
          quantity: quantity.toString(),
          unit: 'each',
          supplier: 'Packaging Supplier',
          pricePerUnit: '0',
          priority: 'medium',
          selected: false,
          aiGenerated: false
        });
      }
    }

    console.log('Generated shopping list items from daily stock form');
  } catch (error) {
    console.error('Error generating shopping list from stock form:', error);
  }
}
import { schedulerService } from "./services/scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard endpoints
  app.get("/api/dashboard/kpis", async (req, res) => {
    try {
      console.log("Getting KPIs for last completed shift...");
      
      // Import database components
      const { db } = await import('./db');
      const { loyverseShiftReports, loyverseReceipts } = await import('../shared/schema');
      const { sql } = await import('drizzle-orm');
      
      // Get latest shift using raw SQL to avoid syntax issues
      const latestShiftResult = await db.execute(sql`
        SELECT id, report_id, shift_date, shift_start, shift_end, total_sales, total_transactions
        FROM loyverse_shift_reports 
        ORDER BY id DESC 
        LIMIT 1
      `);
      
      const latestShift = latestShiftResult.rows[0];
      
      // Calculate Month-to-Date Sales using raw SQL
      const mtdResult = await db.execute(sql`
        SELECT COALESCE(SUM(total_amount), 0) as total_sales 
        FROM loyverse_receipts 
        WHERE receipt_date >= '2025-07-01'
      `);
      
      const monthToDateSales = parseFloat(mtdResult.rows[0]?.total_sales || '0');
      
      console.log(`📊 Latest shift: ${latestShift?.report_id} with ฿${latestShift?.total_sales}`);
      console.log(`💰 Month-to-Date Sales: ฿${monthToDateSales.toFixed(2)}`);
      
      const kpis = await storage.getDashboardKPIs();
      
      // Return authentic latest shift data (shift 540)
      const lastShiftKpis = {
        lastShiftSales: parseFloat(latestShift?.total_sales || '0'),
        lastShiftOrders: parseInt(latestShift?.total_transactions || '0'),
        monthToDateSales: monthToDateSales,
        inventoryValue: kpis.inventoryValue || 125000,
        averageOrderValue: latestShift?.total_sales && latestShift?.total_transactions 
          ? Math.round(parseFloat(latestShift.total_sales) / parseInt(latestShift.total_transactions))
          : 0,
        shiftDate: latestShift?.report_id?.includes('540') ? "July 4th-5th" : "Previous Shift",
        shiftPeriod: { 
          start: latestShift?.shift_start || new Date('2025-07-04T18:00:00+07:00'),
          end: latestShift?.shift_end || new Date('2025-07-05T03:00:00+07:00')
        },
        note: `Last completed shift: ${latestShift?.report_id || 'Unknown'}`
      };
      
      res.json(lastShiftKpis);
    } catch (error) {
      console.error("Failed to fetch KPIs:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  app.get("/api/dashboard/top-menu-items", async (req, res) => {
    try {
      const items = await storage.getTopMenuItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top menu items" });
    }
  });

  // NEW: Live API version that fetches directly from Loyverse API
  app.get("/api/dashboard/top-menu-items-live", async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      console.log('📡 Fetching live top items from Loyverse API...');
      
      // Get receipts from current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const receiptsResult = await loyverseAPI.getReceipts({
        start_time: startOfMonth.toISOString(),
        end_time: endOfMonth.toISOString(),
        limit: 1000
      });
      
      console.log(`📡 Retrieved ${receiptsResult.receipts.length} live receipts from API`);
      
      // Process live receipts to get top items
      const itemSales = new Map<string, { count: number; total: number }>();
      
      receiptsResult.receipts.forEach(receipt => {
        receipt.line_items.forEach(item => {
          const existing = itemSales.get(item.item_name) || { count: 0, total: 0 };
          itemSales.set(item.item_name, {
            count: existing.count + item.quantity,
            total: existing.total + item.line_total
          });
        });
      });
      
      // Convert to array and sort by sales
      const topItems = Array.from(itemSales.entries())
        .map(([name, data]) => ({
          name,
          sales: data.total,
          orders: data.count,
          monthlyGrowth: Math.random() * 30,
          category: storage.categorizeItem(name)
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      
      console.log('📡 Live API top items:', topItems);
      res.json(topItems);
      
    } catch (error) {
      console.error('❌ Error fetching live top items:', error);
      res.status(500).json({ error: 'Failed to fetch live data from Loyverse API' });
    }
  });

  app.get("/api/dashboard/recent-transactions", async (req, res) => {
    try {
      const transactions = await storage.getRecentTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent transactions" });
    }
  });

  app.get("/api/dashboard/ai-insights", async (req, res) => {
    try {
      const insights = await storage.getAiInsights();
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI insights" });
    }
  });

  // Inventory endpoints
  app.get("/api/inventory", async (req, res) => {
    try {
      const inventory = await storage.getInventory();
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const lowStockItems = await storage.getLowStockItems();
      res.json(lowStockItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  app.put("/api/inventory/:id/quantity", async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const updated = await storage.updateInventoryQuantity(parseInt(id), quantity);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update inventory quantity" });
    }
  });

  // Shopping List endpoints
  app.get("/api/shopping-list", async (req, res) => {
    try {
      const shoppingList = await storage.getShoppingList();
      res.json(shoppingList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shopping list" });
    }
  });

  app.post("/api/shopping-list", async (req, res) => {
    try {
      const validatedData = insertShoppingListSchema.parse(req.body);
      const item = await storage.createShoppingListItem(validatedData);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid shopping list item data" });
    }
  });

  app.put("/api/shopping-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateShoppingListItem(parseInt(id), req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update shopping list item" });
    }
  });

  app.delete("/api/shopping-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteShoppingListItem(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete shopping list item" });
    }
  });

  // Generate shopping list with AI
  app.post("/api/shopping-list/generate", async (req, res) => {
    try {
      const inventory = await storage.getInventory();
      const lowStockItems = await storage.getLowStockItems();
      const recommendations = await generateStockRecommendations(inventory, []);
      
      for (const rec of recommendations) {
        await storage.createShoppingListItem({
          itemName: rec.item,
          quantity: rec.recommendedQuantity.toString(),
          unit: "lbs",
          supplier: "Auto-Generated",
          pricePerUnit: "0.00",
          priority: "medium",
          selected: false,
          aiGenerated: true
        });
      }
      
      const updatedList = await storage.getShoppingList();
      res.json(updatedList);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate shopping list" });
    }
  });

  // Expenses endpoints
  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const { description, date, amount, category, paymentMethod, supplier, items, notes } = req.body;
      
      // Calculate month and year from date
      const expenseDate = new Date(date);
      const month = expenseDate.getMonth() + 1;
      const year = expenseDate.getFullYear();
      
      const expenseData = {
        description,
        date: expenseDate,
        amount: String(amount),
        category,
        paymentMethod,
        supplier: supplier || null,
        items: items || null,
        notes: notes || null,
        month,
        year
      };
      
      console.log("Expense data before validation:", expenseData);
      const validatedData = insertExpenseSchema.parse(expenseData);
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
      console.error("Expense creation error:", error);
      res.status(400).json({ error: "Invalid expense data" });
    }
  });

  app.get("/api/expenses/by-category", async (req, res) => {
    try {
      const categories = await storage.getExpensesByCategory();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expenses/month-to-date", async (req, res) => {
    try {
      const mtdTotal = await storage.getMonthToDateExpenses();
      res.json({ total: mtdTotal });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch month-to-date expenses" });
    }
  });

  app.get("/api/expenses/by-month", async (req, res) => {
    try {
      const { month, year } = req.query;
      const monthlyExpenses = await storage.getExpensesByMonth(
        parseInt(month as string), 
        parseInt(year as string)
      );
      res.json(monthlyExpenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monthly expenses" });
    }
  });

  // Expense Suppliers endpoints
  app.get("/api/expense-suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getExpenseSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense suppliers" });
    }
  });

  app.post("/api/expense-suppliers", async (req, res) => {
    try {
      const validatedData = insertExpenseSupplierSchema.parse(req.body);
      const supplier = await storage.createExpenseSupplier(validatedData);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Invalid expense supplier data" });
    }
  });

  // Expense Categories endpoints
  app.get("/api/expense-categories", async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory(validatedData);
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid expense category data" });
    }
  });

  // Bank statement endpoints
  app.get("/api/bank-statements", async (req, res) => {
    try {
      const statements = await storage.getBankStatements();
      res.json(statements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank statements" });
    }
  });

  app.post("/api/bank-statements", async (req, res) => {
    try {
      const { filename, fileData, fileSize, mimeType } = req.body;
      
      const statement = await storage.createBankStatement({
        filename,
        fileData,
        fileSize,
        mimeType,
        uploadDate: new Date(),
        analysisStatus: 'pending'
      });

      // Start OpenAI analysis in the background
      analyzeBankStatementWithOpenAI(statement.id, fileData)
        .catch(error => console.error('Bank statement analysis failed:', error));

      res.json(statement);
    } catch (error) {
      console.error("Bank statement creation error:", error);
      res.status(400).json({ error: "Failed to upload bank statement" });
    }
  });

  // OpenAI bank statement analysis function
  async function analyzeBankStatementWithOpenAI(statementId: number, fileData: string) {
    try {
      // Get current month's expenses for comparison
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const monthlyExpenses = await storage.getExpensesByMonth(currentMonth, currentYear);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a financial analysis AI integrated into the Smash Brothers Burgers restaurant app.

Your role is to:
1. Review uploaded bank statements (CSV, PDF, or plain text)
2. Categorise each transaction into predefined categories (e.g., Inventory, Wages, Utilities, Rent, Supplies, Marketing, Other)
3. Match each transaction against the listed internal expenses recorded in the system for the same month
4. Flag any mismatches, missing entries, or duplicated transactions
5. Raise questions for review if:
   - A transaction has no matching entry
   - A transaction is unusually high/low
   - A transaction is ambiguous or unclear in category
6. Summarise your findings in a structured JSON format for system review and display

### Output Structure (JSON):
{
  "matched_expenses": [...],
  "unmatched_expenses": [...],
  "suspect_transactions": [
    {
      "date": "",
      "amount": "",
      "description": "",
      "reason_flagged": "No matching entry / Unusual amount / Unknown vendor"
    }
  ],
  "category_totals": {
    "Wages": 0,
    "Inventory": 0,
    "Supplies": 0,
    "Marketing": 0,
    "Utilities": 0,
    "Rent": 0,
    "Other": 0
  },
  "summary": "X% of expenses matched. Y suspect transactions found. Total recorded: $___, Total banked: $___"
}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this bank statement for ${currentMonth}/${currentYear}. Compare against these internal expenses recorded in our system:

${JSON.stringify(monthlyExpenses, null, 2)}

Focus on restaurant-related transactions and provide detailed analysis with matching recommendations.`
                },
                {
                  type: 'image_url',
                  image_url: { url: fileData }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      const analysis = JSON.parse(data.choices[0].message.content);
      
      await storage.updateBankStatementAnalysis(statementId, analysis);
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      await storage.updateBankStatementAnalysis(statementId, { error: 'Analysis failed' });
    }
  }

  // Staff Shifts endpoints
  app.get("/api/staff-shifts", async (req, res) => {
    try {
      const shifts = await storage.getStaffShifts();
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff shifts" });
    }
  });

  app.post("/api/staff-shifts", async (req, res) => {
    try {
      const validatedData = insertStaffShiftSchema.parse(req.body);
      const shift = await storage.createStaffShift(validatedData);
      res.json(shift);
    } catch (error) {
      res.status(400).json({ error: "Invalid staff shift data" });
    }
  });

  // Finance endpoints
  app.get("/api/finance/pos-vs-staff", async (req, res) => {
    try {
      // Mock POS vs Staff comparison data
      const posData = {
        totalSales: 2478.36,
        transactions: 127,
        cashSales: 856.40,
        cardSales: 1621.96
      };
      
      const staffData = {
        totalSales: 2465.80,
        transactions: 125,
        cashSales: 840.75,
        tips: 124.50
      };

      const variance = await analyzeFinancialVariance(posData, staffData);
      
      res.json({
        pos: posData,
        staff: staffData,
        variance
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch finance comparison" });
    }
  });

  // Suppliers endpoints
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  // Loyverse POS Receipt Management endpoints
  app.get("/api/loyverse/receipts", async (req, res) => {
    try {
      const { startDate, endDate, search } = req.query;
      
      let receipts;
      if (search) {
        receipts = await loyverseReceiptService.searchReceipts(search as string);
      } else if (startDate && endDate) {
        receipts = await loyverseReceiptService.getReceiptsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Get today's shift receipts by default
        const today = new Date();
        const shiftStart = new Date(today);
        shiftStart.setHours(18, 0, 0, 0); // 6pm today
        if (today.getHours() < 18) {
          shiftStart.setDate(shiftStart.getDate() - 1); // Yesterday's shift if before 6pm
        }
        const shiftEnd = new Date(shiftStart);
        shiftEnd.setHours(27, 0, 0, 0); // 3am next day
        
        receipts = await loyverseReceiptService.getReceiptsByDateRange(shiftStart, shiftEnd);
      }
      
      res.json(receipts);
    } catch (error) {
      console.error("Failed to fetch receipts:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  app.get("/api/loyverse/timezone-test", async (req, res) => {
    try {
      // Test Bangkok timezone handling
      const now = new Date();
      const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      res.json({
        utc_time: now.toISOString(),
        bangkok_time: bangkokTime.toISOString(),
        bangkok_formatted: bangkokTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }),
        bangkok_hour: bangkokTime.getHours(),
        shift_determination: bangkokTime.getHours() >= 18 ? "Current shift (6pm-3am)" : 
                           bangkokTime.getHours() < 6 ? "Early morning of ongoing shift" : 
                           "No active shift (6am-6pm)"
      });
    } catch (error) {
      console.error("Timezone test failed:", error);
      res.status(500).json({ error: "Timezone test failed" });
    }
  });

  app.post("/api/loyverse/receipts/sync", async (req, res) => {
    try {
      const result = await loyverseReceiptService.fetchReceiptsFromLoyverseAPI();
      res.json(result);
    } catch (error) {
      console.error("Failed to sync receipts:", error);
      res.status(500).json({ error: "Failed to sync receipts from Loyverse" });
    }
  });

  app.post("/api/loyverse/receipts/sync-live", async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      console.log("Syncing receipts from live Loyverse API...");
      
      // Use the working loyverseAPI instead
      const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();
      
      const receiptsData = await loyverseAPI.getReceipts({
        start_time: start,
        end_time: end,
        limit: 100
      });
      
      console.log(`Fetched ${receiptsData.receipts.length} receipts from Loyverse API`);
      
      let processed = 0;
      for (const receipt of receiptsData.receipts) {
        try {
          // Store receipt directly in database
          const receiptDate = new Date(receipt.receipt_date);
          const shiftDate = new Date(receiptDate);
          
          // Determine shift date (6pm-3am cycle)
          if (receiptDate.getHours() < 6) {
            shiftDate.setDate(shiftDate.getDate() - 1);
          }
          shiftDate.setHours(18, 0, 0, 0);
          
          const receiptId = receipt.receipt_number;
          
          // Check if receipt already exists
          const existing = await db.select().from(loyverseReceipts)
            .where(eq(loyverseReceipts.receiptId, receiptId))
            .limit(1);
          
          if (existing.length === 0) {
            await db.insert(loyverseReceipts).values({
              receiptId: receiptId,
              receiptNumber: receipt.receipt_number,
              receiptDate: receiptDate,
              totalAmount: receipt.total_money.toString(),
              paymentMethod: receipt.payments[0]?.type || 'CASH',
              customerInfo: receipt.customer_id ? { id: receipt.customer_id } : null,
              items: receipt.line_items || [],
              taxAmount: receipt.total_tax?.toString() || "0",
              discountAmount: "0",
              staffMember: receipt.employee_id || null,
              tableNumber: null,
              shiftDate: shiftDate,
              rawData: receipt
            });
            processed++;
            console.log(`Stored receipt ${receipt.receipt_number}: ฿${receipt.total_money}`);
          }
        } catch (error) {
          console.error(`Failed to store receipt ${receipt.receipt_number}:`, error);
        }
      }
      
      console.log(`Successfully processed ${processed} receipts from Loyverse API`);
      res.json({ success: true, receiptsProcessed: processed });
      
    } catch (error) {
      console.error("Failed to sync live receipts:", error);
      res.status(500).json({ error: "Failed to sync receipts from live Loyverse API" });
    }
  });

  app.get("/api/loyverse/shift-reports", async (req, res) => {
    try {
      const { startDate, endDate, limit } = req.query;
      
      let reports;
      if (startDate && endDate) {
        reports = await loyverseReceiptService.getShiftReportsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        reports = await loyverseReceiptService.getLatestShiftReports(
          limit ? parseInt(limit as string) : 10
        );
      }
      
      res.json(reports);
    } catch (error) {
      console.error("Failed to fetch shift reports:", error);
      res.status(500).json({ error: "Failed to fetch shift reports" });
    }
  });

  app.post("/api/loyverse/shift-reports/sync", async (req, res) => {
    try {
      console.log("Starting sync with authentic Loyverse data...");
      
      // Clear existing shift data to ensure fresh authentic data
      await db.delete(loyverseShiftReports);
      console.log("Cleared existing shift reports");
      
      const result = await loyverseReceiptService.fetchAndStoreShiftReports();
      console.log("Authentic shift data sync completed");
      
      res.json(result);
    } catch (error) {
      console.error("Failed to sync shift reports:", error);
      res.status(500).json({ error: "Failed to sync shift reports" });
    }
  });

  // Import authentic shift data from latest CSV
  app.post("/api/loyverse/import-authentic-shifts", async (req, res) => {
    try {
      console.log("Importing authentic shift data from latest CSV...");
      
      // Clear existing shift data
      await db.delete(loyverseShiftReports);
      console.log("Cleared existing shift reports");
      
      const { importLoyverseShifts } = await import('./importLoyverseShifts');
      const result = await importLoyverseShifts();
      
      console.log("Authentic shift import completed:", result);
      res.json(result);
    } catch (error) {
      console.error("Failed to import authentic shifts:", error);
      res.status(500).json({ error: "Failed to import authentic shifts" });
    }
  });

  app.get("/api/loyverse/shift-balance-analysis", async (req, res) => {
    try {
      const analysis = await loyverseReceiptService.getShiftBalanceAnalysis();
      res.json(analysis);
    } catch (error) {
      console.error("Failed to get shift balance analysis:", error);
      res.status(500).json({ error: "Failed to get shift balance analysis" });
    }
  });

  app.get("/api/loyverse/sales-by-payment-type", async (req, res) => {
    try {
      const paymentData = await loyverseReceiptService.getSalesByPaymentType();
      res.json(paymentData);
    } catch (error) {
      console.error("Failed to get sales by payment type:", error);
      res.status(500).json({ error: "Failed to get sales by payment type" });
    }
  });

  // New endpoint: Get receipts grouped by shifts with separated items and modifiers
  app.get("/api/loyverse/receipts-by-shifts", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Get all receipts from database
      let receipts;
      if (startDate && endDate) {
        receipts = await loyverseReceiptService.getReceiptsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Get last 7 days by default
        const endDateDefault = new Date();
        const startDateDefault = new Date();
        startDateDefault.setDate(endDateDefault.getDate() - 7);
        receipts = await loyverseReceiptService.getReceiptsByDateRange(startDateDefault, endDateDefault);
      }
      
      // Group receipts by shifts and separate items/modifiers
      const groupedShifts = groupReceiptsByShifts(receipts);
      
      res.json(groupedShifts);
    } catch (error) {
      console.error("Failed to get receipts by shifts:", error);
      res.status(500).json({ error: "Failed to get receipts by shifts" });
    }
  });

  // Helper function to group receipts by shifts (6pm-3am Bangkok time)
  function groupReceiptsByShifts(receipts: any[]) {
    const shifts: { [key: string]: any } = {};
    
    receipts.forEach(receipt => {
      const receiptDate = new Date(receipt.receiptDate);
      
      // Convert to Bangkok time (UTC+7)
      const bangkokTime = new Date(receiptDate.getTime() + (7 * 60 * 60 * 1000));
      
      // Determine shift date: if before 6am Bangkok time, belongs to previous day's shift
      let shiftDate = new Date(bangkokTime);
      if (bangkokTime.getHours() < 6) {
        shiftDate.setDate(shiftDate.getDate() - 1);
      }
      
      // Set to start of shift date for grouping
      shiftDate.setHours(0, 0, 0, 0);
      const shiftKey = shiftDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!shifts[shiftKey]) {
        const shiftStartBangkok = new Date(shiftDate);
        shiftStartBangkok.setHours(18, 0, 0, 0); // 6pm Bangkok time
        const shiftEndBangkok = new Date(shiftStartBangkok);
        shiftEndBangkok.setDate(shiftEndBangkok.getDate() + 1);
        shiftEndBangkok.setHours(3, 0, 0, 0); // 3am next day Bangkok time
        
        shifts[shiftKey] = {
          shiftDate: shiftKey,
          shiftPeriod: `${shiftStartBangkok.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'Asia/Bangkok'
          })} 6:00 PM - ${shiftEndBangkok.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'Asia/Bangkok'
          })} 3:00 AM`,
          receipts: [],
          totalSales: 0,
          totalReceipts: 0,
          itemsSold: [],
          modifiersUsed: []
        };
      }
      
      // Process receipt items and modifiers separately
      const { itemsList, modifiersList } = processReceiptItemsAndModifiers(receipt);
      
      // Add processed receipt with separated lists
      const processedReceipt = {
        ...receipt,
        itemsList,
        modifiersList
      };
      
      shifts[shiftKey].receipts.push(processedReceipt);
      shifts[shiftKey].totalSales += parseFloat(receipt.totalAmount || '0');
      shifts[shiftKey].totalReceipts += 1;
      
      // Aggregate items for shift summary
      itemsList.forEach(item => {
        const existingItem = shifts[shiftKey].itemsSold.find(i => i.item_name === item.item_name);
        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.total_amount += item.total_amount;
        } else {
          shifts[shiftKey].itemsSold.push({ ...item });
        }
      });
      
      // Aggregate modifiers for shift summary
      modifiersList.forEach(modifier => {
        const existingModifier = shifts[shiftKey].modifiersUsed.find(m => 
          m.option === modifier.option && m.modifier_name === modifier.modifier_name
        );
        if (existingModifier) {
          existingModifier.count += 1;
          existingModifier.total_amount += modifier.money_amount;
        } else {
          shifts[shiftKey].modifiersUsed.push({ 
            ...modifier, 
            count: 1,
            total_amount: modifier.money_amount 
          });
        }
      });
    });
    
    // Sort shifts by date (newest first) and sort items/modifiers within each shift
    return Object.values(shifts)
      .sort((a: any, b: any) => new Date(b.shiftDate).getTime() - new Date(a.shiftDate).getTime())
      .map((shift: any) => ({
        ...shift,
        itemsSold: shift.itemsSold.sort((a: any, b: any) => b.quantity - a.quantity),
        modifiersUsed: shift.modifiersUsed.sort((a: any, b: any) => b.count - a.count)
      }));
  }

  // Helper function to separate items and modifiers from receipt data
  function processReceiptItemsAndModifiers(receipt: any) {
    const itemsList: any[] = [];
    const modifiersList: any[] = [];
    
    // Parse items from different possible sources
    let items = [];
    try {
      if (Array.isArray(receipt.items)) {
        items = receipt.items;
      } else if (receipt.items && typeof receipt.items === 'string') {
        items = JSON.parse(receipt.items);
      } else if (receipt.rawData?.line_items) {
        items = receipt.rawData.line_items;
      }
    } catch (error) {
      console.error('Error parsing receipt items:', error);
    }
    
    items.forEach((item, itemIndex) => {
      // Add item to separated items list
      itemsList.push({
        item_id: item.item_id || `item_${itemIndex}`,
        item_name: item.item_name || item.name,
        quantity: item.quantity || 1,
        unit_price: parseFloat(item.price || '0'),
        total_amount: parseFloat(item.total_money || item.gross_total_money || item.price || '0'),
        cost: parseFloat(item.cost || '0'),
        sku: item.sku,
        variant_name: item.variant_name,
        receipt_id: receipt.receiptId || receipt.id
      });
      
      // Add modifiers to separated modifiers list
      if (item.line_modifiers && Array.isArray(item.line_modifiers)) {
        item.line_modifiers.forEach((modifier, modIndex) => {
          modifiersList.push({
            modifier_id: modifier.id || `mod_${itemIndex}_${modIndex}`,
            modifier_name: modifier.name,
            option: modifier.option || modifier.name,
            money_amount: parseFloat(modifier.money_amount || '0'),
            item_applied_to: item.item_name || item.name,
            item_id: item.item_id,
            receipt_id: receipt.receiptId || receipt.id
          });
        });
      }
    });
    
    return { itemsList, modifiersList };
  }

  app.get("/api/loyverse/sales-summary", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const salesSummary = await loyverseReceiptService.getDailySalesSummary(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(salesSummary);
    } catch (error) {
      console.error("Failed to get sales summary:", error);
      res.status(500).json({ error: "Failed to get sales summary" });
    }
  });

  // POS/Loyverse endpoints
  app.post("/api/pos/analyze-receipt", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      const analysis = await analyzeReceipt(imageBase64);
      
      // Create AI insight for the analysis
      await storage.createAiInsight({
        type: "suggestion",
        severity: "low",
        title: "Receipt Analysis Complete",
        description: `Processed ${analysis.items.length} items with ${analysis.anomalies.length} anomalies detected`,
        data: analysis
      });
      
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze receipt" });
    }
  });

  app.post("/api/pos/detect-anomalies", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      const anomalies = await detectAnomalies(transactions);
      
      // Create AI insights for detected anomalies
      for (const anomaly of anomalies) {
        await storage.createAiInsight({
          type: "anomaly",
          severity: anomaly.severity,
          title: anomaly.type,
          description: anomaly.description,
          data: { confidence: anomaly.confidence }
        });
      }
      
      res.json(anomalies);
    } catch (error) {
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  // Transactions endpoints
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });

  // AI Insights endpoints
  app.put("/api/ai-insights/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      const resolved = await storage.resolveAiInsight(parseInt(id));
      res.json(resolved);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve AI insight" });
    }
  });

  // Loyverse shift reports endpoint
  app.get("/api/loyverse/shift-reports", async (req, res) => {
    try {
      const reports = await loyverseReceiptService.getLatestShiftReports(10);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching shift reports:", error);
      res.status(500).json({ error: "Failed to fetch shift reports" });
    }
  });

  // Loyverse receipts endpoint
  app.get("/api/loyverse/receipts", async (req, res) => {
    try {
      const receipts = await loyverseReceiptService.getAllReceipts(50);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  // Manual sync endpoint - fetch real Loyverse data
  app.post("/api/loyverse/sync", async (req, res) => {
    try {
      console.log("Starting manual sync with real Loyverse API...");
      
      // Fetch real receipts and shift reports from Loyverse
      const receiptsResult = await loyverseReceiptService.fetchAndStoreReceipts();
      const shiftsResult = await loyverseReceiptService.fetchRealShiftReports();
      
      const result = {
        success: receiptsResult.success && shiftsResult.success,
        receiptsProcessed: receiptsResult.receiptsProcessed,
        shiftsProcessed: shiftsResult.reportsProcessed,
        message: `Processed ${receiptsResult.receiptsProcessed} receipts and ${shiftsResult.reportsProcessed} shift reports`
      };
      
      console.log("Manual sync completed:", result);
      res.json(result);
    } catch (error) {
      console.error("Error during manual sync:", error);
      res.status(500).json({ error: "Failed to sync data", details: error.message });
    }
  });

  // Daily Stock and Sales endpoints
  app.get('/api/daily-stock-sales', async (req, res) => {
    try {
      const dailyStockSales = await storage.getDailyStockSales();
      res.json(dailyStockSales);
    } catch (error) {
      console.error('Error fetching daily stock sales:', error);
      res.status(500).json({ error: 'Failed to fetch daily stock sales' });
    }
  });

  // Ingredients routes
  app.get('/api/ingredients', async (req, res) => {
    try {
      const { category } = req.query;
      if (category) {
        const ingredients = await storage.getIngredientsByCategory(category as string);
        res.json(ingredients);
      } else {
        const ingredients = await storage.getIngredients();
        res.json(ingredients);
      }
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      res.status(500).json({ error: 'Failed to fetch ingredients' });
    }
  });

  app.post('/api/ingredients', async (req, res) => {
    try {
      const parsed = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.createIngredient(parsed);
      res.json(ingredient);
    } catch (error) {
      console.error('Error creating ingredient:', error);
      res.status(400).json({ error: 'Failed to create ingredient' });
    }
  });

  app.put('/api/ingredients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      const ingredient = await storage.updateIngredient(id, req.body);
      res.json(ingredient);
    } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ error: 'Failed to update ingredient' });
    }
  });

  app.delete('/api/ingredients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      await storage.deleteIngredient(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      res.status(500).json({ error: 'Failed to delete ingredient' });
    }
  });

  // Import ingredient costs from CSV
  app.post('/api/ingredients/import-costs', async (req, res) => {
    try {
      const { importIngredientCosts } = await import('./importIngredientCosts');
      const result = await importIngredientCosts();
      res.json(result);
    } catch (error) {
      console.error('Error importing ingredient costs:', error);
      res.status(500).json({ error: 'Failed to import ingredient costs' });
    }
  });

  // Recipes routes
  app.get('/api/recipes', async (req, res) => {
    try {
      const recipes = await storage.getRecipes();
      res.json(recipes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  app.get('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      const recipe = await storage.getRecipeById(id);
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      res.json(recipe);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      res.status(500).json({ error: 'Failed to fetch recipe' });
    }
  });

  app.post('/api/recipes', async (req, res) => {
    try {
      const parsed = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(parsed);
      res.json(recipe);
    } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(400).json({ error: 'Failed to create recipe' });
    }
  });

  app.put('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      const recipe = await storage.updateRecipe(id, req.body);
      res.json(recipe);
    } catch (error) {
      console.error('Error updating recipe:', error);
      res.status(500).json({ error: 'Failed to update recipe' });
    }
  });

  app.delete('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      await storage.deleteRecipe(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ error: 'Failed to delete recipe' });
    }
  });

  // Recipe Ingredients routes
  app.get('/api/recipes/:id/ingredients', async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) {
        return res.status(400).json({ error: 'Invalid recipe ID format' });
      }
      const ingredients = await storage.getRecipeIngredients(recipeId);
      res.json(ingredients);
    } catch (error) {
      console.error('Error fetching recipe ingredients:', error);
      res.status(500).json({ error: 'Failed to fetch recipe ingredients' });
    }
  });

  app.post('/api/recipe-ingredients', async (req, res) => {
    try {
      const parsed = insertRecipeIngredientSchema.parse(req.body);
      const recipeIngredient = await storage.addRecipeIngredient(parsed);
      
      // Recalculate recipe cost
      const totalCost = await storage.calculateRecipeCost(parsed.recipeId);
      await storage.updateRecipe(parsed.recipeId, { totalCost: totalCost.toString() });
      
      res.json(recipeIngredient);
    } catch (error) {
      console.error('Error adding recipe ingredient:', error);
      res.status(400).json({ error: 'Failed to add recipe ingredient' });
    }
  });

  app.put('/api/recipe-ingredients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      const recipeIngredient = await storage.updateRecipeIngredient(id, req.body);
      
      // Recalculate recipe cost
      const totalCost = await storage.calculateRecipeCost(recipeIngredient.recipeId);
      await storage.updateRecipe(recipeIngredient.recipeId, { totalCost: totalCost.toString() });
      
      res.json(recipeIngredient);
    } catch (error) {
      console.error('Error updating recipe ingredient:', error);
      res.status(500).json({ error: 'Failed to update recipe ingredient' });
    }
  });

  app.delete('/api/recipe-ingredients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      // Get the recipe ingredient first to know which recipe to update
      const recipeIngredients = Array.from((storage as any).recipeIngredients.values());
      const recipeIngredient = recipeIngredients.find((ri: any) => ri.id === id);
      
      await storage.removeRecipeIngredient(id);
      
      // Recalculate recipe cost if we found the recipe ingredient
      if (recipeIngredient) {
        const totalCost = await storage.calculateRecipeCost(recipeIngredient.recipeId);
        await storage.updateRecipe(recipeIngredient.recipeId, { totalCost: totalCost.toString() });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing recipe ingredient:', error);
      res.status(500).json({ error: 'Failed to remove recipe ingredient' });
    }
  });

  app.get('/api/recipes/:id/cost', async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) {
        return res.status(400).json({ error: 'Invalid recipe ID format' });
      }
      const cost = await storage.calculateRecipeCost(recipeId);
      res.json({ cost });
    } catch (error) {
      console.error('Error calculating recipe cost:', error);
      res.status(500).json({ error: 'Failed to calculate recipe cost' });
    }
  });

  app.get('/api/daily-stock-sales/search', async (req, res) => {
    try {
      const { q, startDate, endDate } = req.query;
      const query = (q as string) || '';
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const result = await storage.searchDailyStockSales(query, start, end);
      res.json(result);
    } catch (error) {
      console.error('Error searching daily stock sales:', error);
      res.status(500).json({ error: 'Failed to search daily stock sales' });
    }
  });

  app.get('/api/daily-stock-sales/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const result = await storage.getDailyStockSalesById(id);
      if (!result) {
        return res.status(404).json({ error: 'Daily stock sales form not found' });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching daily stock sales by ID:', error);
      res.status(500).json({ error: 'Failed to fetch daily stock sales' });
    }
  });

  app.post('/api/daily-stock-sales', async (req, res) => {
    try {
      const formData = req.body;
      
      // Handle photo receipts and draft status
      const dataToSave = {
        ...formData,
        receiptPhotos: formData.receiptPhotos || [],
        isDraft: formData.isDraft || false
      };
      
      const dailyStockSales = await storage.createDailyStockSales(dataToSave);
      
      // Only generate shopping list and send email if this is not a draft
      if (!formData.isDraft) {
        await generateShoppingListFromStockForm(formData);
        
        // Send management summary email
        try {
          const { emailService } = await import('./emailService');
          const shoppingList = await storage.getShoppingList();
          
          await emailService.sendManagementSummary({
            formData: dailyStockSales,
            shoppingList,
            receiptPhotos: formData.receiptPhotos || [],
            submissionTime: new Date()
          });
          
          console.log('Management summary email sent successfully');
        } catch (emailError) {
          console.error('Failed to send management summary email:', emailError);
          // Don't fail the entire request if email fails
        }
      }
      
      res.json(dailyStockSales);
    } catch (error) {
      console.error('Error creating daily stock sales:', error);
      res.status(500).json({ error: 'Failed to create daily stock sales' });
    }
  });
  
  // Get draft forms
  app.get('/api/daily-stock-sales/drafts', async (req, res) => {
    try {
      const drafts = await storage.getDraftForms();
      res.json(drafts);
    } catch (error) {
      console.error('Error fetching draft forms:', error);
      res.status(500).json({ error: 'Failed to fetch draft forms' });
    }
  });
  
  // Update an existing form (for converting drafts to final)
  app.put('/api/daily-stock-sales/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const formData = req.body;
      const dataToUpdate = {
        ...formData,
        receiptPhotos: formData.receiptPhotos || [],
        isDraft: formData.isDraft || false
      };
      
      const updatedForm = await storage.updateDailyStockSales(id, dataToUpdate);
      
      // Generate shopping list if converting from draft to final
      if (!formData.isDraft) {
        await generateShoppingListFromStockForm(formData);
      }
      
      res.json(updatedForm);
    } catch (error) {
      console.error('Error updating daily stock sales:', error);
      res.status(500).json({ error: 'Failed to update daily stock sales' });
    }
  });

  // Import historical Daily Sales and Stock forms
  app.post("/api/daily-stock-sales/import-historical", async (req, res) => {
    try {
      console.log("Starting import of historical Daily Sales and Stock forms...");
      
      // Import from CSV file
      const { importHistoricalData } = await import('./importHistoricalData');
      const result = await importHistoricalData();
      
      console.log(`Import completed: ${result.imported} records imported`);
      res.json(result);
    } catch (error) {
      console.error("Failed to import historical data:", error);
      res.status(500).json({ error: "Failed to import historical data" });
    }
  });

  // Import authentic Loyverse shifts from CSV
  app.post("/api/loyverse/import-shifts", async (req, res) => {
    try {
      console.log("Starting import of authentic Loyverse shift data...");
      
      const { importLoyverseShifts } = await import('./importLoyverseShifts');
      const result = await importLoyverseShifts();
      
      console.log(`Loyverse shift import completed: ${result.imported} records processed`);
      res.json(result);
    } catch (error) {
      console.error("Failed to import Loyverse shifts:", error);
      res.status(500).json({ error: "Failed to import Loyverse shifts" });
    }
  });

  // Live Loyverse API integration endpoints
  app.get('/api/loyverse/live/status', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const isConnected = await loyverseAPI.testConnection();
      
      res.json({ 
        connected: isConnected,
        message: isConnected ? 'Loyverse API connected successfully' : 'Loyverse API connection failed'
      });
    } catch (error) {
      console.error('Loyverse status check error:', error);
      res.status(500).json({ connected: false, message: 'Connection test failed' });
    }
  });

  // CRITICAL API: Get receipts with proper UTC/Bangkok timezone handling
  app.get('/api/loyverse/receipts', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { start_time, end_time, limit, cursor } = req.query;
      
      const receipts = await loyverseAPI.getReceipts({
        start_time: start_time as string,
        end_time: end_time as string,
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string
      });
      
      res.json(receipts);
    } catch (error) {
      console.error('Failed to get receipts:', error);
      res.status(500).json({ error: 'Failed to fetch receipts from Loyverse API' });
    }
  });

  // CRITICAL API: Get shifts with proper UTC/Bangkok timezone handling  
  app.get('/api/loyverse/shifts', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { start_time, end_time, limit, cursor } = req.query;
      
      const shifts = await loyverseAPI.getShifts({
        start_time: start_time as string,
        end_time: end_time as string,
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string
      });
      
      res.json(shifts);
    } catch (error) {
      console.error('Failed to get shifts:', error);
      res.status(500).json({ error: 'Failed to fetch shifts from Loyverse API' });
    }
  });

  // API: Get items
  app.get('/api/loyverse/items', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { limit, cursor, updated_at_min } = req.query;
      
      const items = await loyverseAPI.getItems({
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string,
        updated_at_min: updated_at_min as string
      });
      
      res.json(items);
    } catch (error) {
      console.error('Failed to get items:', error);
      res.status(500).json({ error: 'Failed to fetch items from Loyverse API' });
    }
  });

  // API: Get categories
  app.get('/api/loyverse/categories', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { limit, cursor } = req.query;
      
      const categories = await loyverseAPI.getCategories({
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string
      });
      
      res.json(categories);
    } catch (error) {
      console.error('Failed to get categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories from Loyverse API' });
    }
  });

  // API: Get modifiers
  app.get('/api/loyverse/modifiers', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { limit, cursor } = req.query;
      
      const modifiers = await loyverseAPI.getModifiers({
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string
      });
      
      res.json(modifiers);
    } catch (error) {
      console.error('Failed to get modifiers:', error);
      res.status(500).json({ error: 'Failed to fetch modifiers from Loyverse API' });
    }
  });

  // CRITICAL API: Get payment types
  app.get('/api/loyverse/payment-types', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const paymentTypes = await loyverseAPI.getPaymentTypes();
      res.json(paymentTypes);
    } catch (error) {
      console.error('Failed to get payment types:', error);
      res.status(500).json({ error: 'Failed to fetch payment types from Loyverse API' });
    }
  });

  // API: Get customers
  app.get('/api/loyverse/customers', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const { limit, cursor, updated_at_min } = req.query;
      
      const customers = await loyverseAPI.getCustomers({
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string,
        updated_at_min: updated_at_min as string
      });
      
      res.json(customers);
    } catch (error) {
      console.error('Failed to get customers:', error);
      res.status(500).json({ error: 'Failed to fetch customers from Loyverse API' });
    }
  });

  // CRITICAL API: Get last completed shift data (historical, not live)
  app.get('/api/loyverse/last-completed-shift', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const shiftData = await loyverseAPI.getLastCompletedShiftData();
      
      res.json({
        success: true,
        data: {
          shiftPeriod: shiftData.shiftPeriod,
          totalSales: shiftData.totalSales,
          receiptCount: shiftData.receiptCount,
          receipts: shiftData.receipts
        }
      });
    } catch (error) {
      console.error('Failed to get last completed shift data:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch last completed shift data' 
      });
    }
  });



  app.post('/api/loyverse/live/sync-receipts', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const receiptCount = await loyverseAPI.syncTodaysReceipts();
      
      res.json({ 
        success: true, 
        receiptsCount: receiptCount,
        message: `Successfully synced ${receiptCount} receipts from today`
      });
    } catch (error) {
      console.error('Receipt sync error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to sync receipts: ${error.message}` 
      });
    }
  });

  app.post('/api/loyverse/live/sync-items', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const itemCount = await loyverseAPI.syncAllItems();
      
      res.json({ 
        success: true, 
        itemsCount: itemCount,
        message: `Successfully synced ${itemCount} menu items`
      });
    } catch (error) {
      console.error('Items sync error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to sync items: ${error.message}` 
      });
    }
  });

  app.post('/api/loyverse/live/sync-customers', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const customerCount = await loyverseAPI.syncCustomers();
      
      res.json({ 
        success: true, 
        customersCount: customerCount,
        message: `Successfully synced ${customerCount} customers`
      });
    } catch (error) {
      console.error('Customer sync error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to sync customers: ${error.message}` 
      });
    }
  });

  app.get('/api/loyverse/live/stores', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const storesData = await loyverseAPI.getStores();
      
      res.json(storesData);
    } catch (error) {
      console.error('Stores fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch stores' });
    }
  });

  // Force fetch latest shifts including shift 540 with proper Bangkok timezone
  app.post("/api/loyverse/fetch-latest-shifts", async (req, res) => {
    try {
      console.log('🔍 Fetching latest shifts for July 4-6 to find shift 540...');
      
      const { loyverseAPI } = await import('./loyverseAPI');
      
      // Fetch shifts from July 4-6 Bangkok time (converted to UTC for API)
      const startTimeBangkok = new Date('2025-07-04T18:00:00+07:00'); // July 4th 6pm Bangkok
      const endTimeBangkok = new Date('2025-07-06T03:00:00+07:00');   // July 6th 3am Bangkok
      
      const startTimeUTC = startTimeBangkok.toISOString();
      const endTimeUTC = endTimeBangkok.toISOString();
      
      console.log(`🕐 Date range: ${startTimeUTC} to ${endTimeUTC}`);
      
      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        limit: 20
      });
      
      console.log(`📊 Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);
      
      // Return raw shift data to identify shift 540
      const processedShifts = shiftsResponse.shifts.map((shift, index) => {
        console.log(`📋 Shift ${index + 1}: ID=${shift.id}, Opening=${shift.opening_time}, Closing=${shift.closing_time || 'Open'}`);
        return {
          id: shift.id,
          opening_time: shift.opening_time,
          closing_time: shift.closing_time,
          opening_amount: shift.opening_amount,
          expected_amount: shift.expected_amount,
          actual_amount: shift.actual_amount,
          store_id: shift.store_id,
          pos_device_id: shift.pos_device_id
        };
      });
      
      res.json({
        success: true,
        shifts_found: shiftsResponse.shifts.length,
        shifts: processedShifts,
        message: `Found ${shiftsResponse.shifts.length} shifts from ${startTimeUTC} to ${endTimeUTC}`,
        timezone_note: "All times converted to Bangkok time (UTC+7)"
      });
      
    } catch (error) {
      console.error("Failed to fetch latest shifts:", error);
      res.status(500).json({ error: "Failed to fetch latest shifts", details: error.message });
    }
  });

  // Find and import missing shift 540
  app.post("/api/loyverse/find-shift-540", async (req, res) => {
    try {
      console.log('🔍 Searching for missing shift 540...');
      
      const { loyverseAPI } = await import('./loyverseAPI');
      
      console.log('📋 Looking for shift 540 in Loyverse API...');
      
      // Search for shifts in a wider date range to find 540
      const startTime = new Date('2025-07-04T11:00:00.000Z'); // July 4th 6pm Bangkok = 11am UTC
      const endTime = new Date('2025-07-06T11:00:00.000Z');   // July 6th 6pm Bangkok = 11am UTC
      
      console.log(`🕐 Searching date range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        limit: 50
      });
      
      console.log(`📊 Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);
      
      // Look for shift 540 specifically
      let shift540Found = false;
      const allShifts = [];
      
      for (const shift of shiftsResponse.shifts) {
        const openingTime = new Date(shift.opening_time);
        const closingTime = shift.closing_time ? new Date(shift.closing_time) : null;
        
        // Convert to Bangkok time for logging
        const bangkokOpen = new Date(openingTime.getTime() + (7 * 60 * 60 * 1000));
        const bangkokClose = closingTime ? new Date(closingTime.getTime() + (7 * 60 * 60 * 1000)) : null;
        
        allShifts.push({
          id: shift.id,
          opening_time: shift.opening_time,
          closing_time: shift.closing_time,
          opening_time_bangkok: bangkokOpen.toISOString(),
          closing_time_bangkok: bangkokClose?.toISOString() || null,
          opening_amount: shift.opening_amount,
          expected_amount: shift.expected_amount,
          actual_amount: shift.actual_amount
        });
        
        console.log(`📋 Shift ${shift.id}: ${bangkokOpen.toLocaleString()} to ${bangkokClose?.toLocaleString() || 'Open'}`);
        
        // Check if this could be shift 540 (July 4th-5th shift)
        if (bangkokOpen.getDate() === 4 && bangkokOpen.getMonth() === 6 && bangkokOpen.getHours() >= 18) {
          console.log(`🎯 Found potential shift 540: ${shift.id}`);
          shift540Found = true;
        }
      }
      
      res.json({
        success: true,
        total_shifts_found: shiftsResponse.shifts.length,
        shift_540_found: shift540Found,
        all_shifts: allShifts,
        message: shift540Found ? 'Found potential shift 540' : 'Shift 540 not found in date range'
      });
      
    } catch (error) {
      console.error("Failed to find shift 540:", error);
      res.status(500).json({ error: "Failed to find shift 540", details: error.message });
    }
  });

  // Automatic shift synchronization - prevents missing shifts like 540, 541, 542, etc.
  app.post("/api/loyverse/sync-all-shifts", async (req, res) => {
    try {
      console.log('🔄 Starting comprehensive shift synchronization...');
      
      const { loyverseAPI } = await import('./loyverseAPI');
      const { importLoyverseShifts } = await import('./importLoyverseShifts');
      
      // Get the last 10 shifts to catch any missed shifts
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (10 * 24 * 60 * 60 * 1000));
      
      console.log(`🕐 Syncing shifts from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        limit: 100
      });
      
      console.log(`📊 Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);
      
      // Process and import all shifts
      let newShiftsImported = 0;
      let shiftsFound = [];
      
      for (const shift of shiftsResponse.shifts) {
        // Convert times to Bangkok timezone
        const openingTime = new Date(shift.opening_time);
        const closingTime = shift.closing_time ? new Date(shift.closing_time) : null;
        
        const bangkokOpen = new Date(openingTime.getTime() + (7 * 60 * 60 * 1000));
        const bangkokClose = closingTime ? new Date(closingTime.getTime() + (7 * 60 * 60 * 1000)) : null;
        
        // Check if this shift is already in our database
        const { db } = await import('./db');
        const { loyverseShiftReports } = await import('../shared/schema');
        
        const { eq } = await import('drizzle-orm');
        const existingShift = await db.select()
          .from(loyverseShiftReports)
          .where(eq(loyverseShiftReports.report_id, `shift-${shift.id}-authentic`))
          .limit(1);
        
        if (existingShift.length === 0) {
          // This is a new shift - import it
          console.log(`🆕 Importing new shift ${shift.id}: ${bangkokOpen.toLocaleString()} to ${bangkokClose?.toLocaleString() || 'Open'}`);
          
          // Calculate actual sales from receipts for this shift period
          const shiftStartUTC = new Date(shift.opening_time);
          const shiftEndUTC = shift.closing_time ? new Date(shift.closing_time) : new Date();
          
          // Get receipts for this shift to calculate accurate sales
          const shiftReceipts = await loyverseAPI.getReceipts({
            start_time: shiftStartUTC.toISOString(),
            end_time: shiftEndUTC.toISOString(),
            limit: 200
          });
          
          const actualSales = shiftReceipts.receipts.reduce((sum, receipt) => {
            return sum + (receipt.receipt_type === 'SALE' ? receipt.total_money : -receipt.total_money);
          }, 0);
          
          // Create shift report data with accurate sales figures
          const shiftData = {
            report_id: `shift-${shift.id}-authentic`,
            shift_date: new Date(bangkokOpen.getFullYear(), bangkokOpen.getMonth(), bangkokOpen.getDate()),
            shift_start: openingTime,
            shift_end: closingTime,
            total_sales: actualSales,
            total_transactions: shiftReceipts.receipts.length,
            cash_sales: 0, // Will be calculated separately
            card_sales: actualSales, // Approximate for now
            report_data: JSON.stringify({
              shift_number: shift.id.toString(),
              opening_time: shift.opening_time,
              closing_time: shift.closing_time,
              opening_amount: shift.opening_amount,
              expected_amount: shift.expected_amount,
              actual_amount: shift.actual_amount,
              starting_cash: shift.opening_amount,
              expected_cash: shift.expected_amount,
              actual_cash: shift.actual_amount || shift.expected_amount,
              cash_difference: (shift.actual_amount || shift.expected_amount) - shift.expected_amount,
              net_sales: actualSales,
              total_receipts: shiftReceipts.receipts.length
            }),
            created_at: new Date(),
            updated_at: new Date()
          };
          
          // Insert into database
          await db.insert(loyverseShiftReports).values(shiftData);
          newShiftsImported++;
          
          console.log(`✅ Imported shift ${shift.id} with ฿${actualSales} sales and ${shiftReceipts.receipts.length} receipts`);
        }
        
        shiftsFound.push({
          id: shift.id,
          opening_time_bangkok: bangkokOpen.toISOString(),
          closing_time_bangkok: bangkokClose?.toISOString() || null,
          is_new: existingShift.length === 0
        });
      }
      
      console.log(`✅ Synchronization complete: ${newShiftsImported} new shifts imported`);
      
      res.json({
        success: true,
        total_shifts_found: shiftsResponse.shifts.length,
        new_shifts_imported: newShiftsImported,
        shifts: shiftsFound,
        message: `Synchronized ${newShiftsImported} new shifts. All future shifts will be automatically captured.`
      });
      
    } catch (error) {
      console.error("Failed to sync shifts:", error);
      res.status(500).json({ error: "Failed to sync shifts", details: error.message });
    }
  });

  app.get('/api/loyverse/live/items', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const limit = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string;
      
      const itemsData = await loyverseAPI.getItems({ limit, cursor });
      
      res.json(itemsData);
    } catch (error) {
      console.error('Items fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  app.get('/api/loyverse/live/receipts', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const startTime = req.query.start_time as string;
      const endTime = req.query.end_time as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string;
      
      const receiptsData = await loyverseAPI.getReceipts({
        start_time: startTime,
        end_time: endTime,
        limit,
        cursor
      });
      
      res.json(receiptsData);
    } catch (error) {
      console.error('Receipts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch receipts' });
    }
  });

  app.post('/api/loyverse/live/start-realtime', async (req, res) => {
    try {
      const { loyverseAPI } = await import('./loyverseAPI');
      const intervalMinutes = parseInt(req.body.intervalMinutes) || 5;
      
      // Start real-time sync (non-blocking)
      loyverseAPI.startRealtimeSync(intervalMinutes);
      
      res.json({ 
        success: true, 
        message: `Real-time sync started with ${intervalMinutes} minute intervals`
      });
    } catch (error) {
      console.error('Real-time sync start error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to start real-time sync: ${error.message}` 
      });
    }
  });

  // Test endpoint for email service
  app.post('/api/test-email', async (req, res) => {
    try {
      const { emailService } = await import('./emailService');
      
      // Test with minimal data
      const testData = {
        formData: {
          id: 1,
          completedBy: 'Test User',
          shiftType: 'Evening',
          shiftDate: new Date(),
          startingCash: '1000',
          endingCash: '1200',
          totalSales: '2000',
          cashSales: '800',
          grabSales: '500',
          foodPandaSales: '300',
          aroiDeeSales: '200',
          qrScanSales: '200',
          totalExpenses: '600',
          salaryWages: '400',
          shopping: '100',
          gasExpense: '100',
          createdAt: new Date(),
          updatedAt: new Date(),
          receiptPhotos: [],
          wageEntries: [],
          isDraft: false
        },
        shoppingList: [],
        receiptPhotos: [],
        submissionTime: new Date()
      };
      
      const result = await emailService.sendManagementSummary(testData);
      
      if (result) {
        res.json({ success: true, message: 'Test email sent successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to send test email' });
      }
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ success: false, message: 'Email service error', error: error.message });
    }
  });

  // Generate marketing content for recipes
  app.post("/api/recipes/:id/generate-marketing", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      const { outputType, notes } = req.body;
      
      if (!outputType || !['delivery', 'advertising', 'social'].includes(outputType)) {
        return res.status(400).json({ error: "Invalid output type. Must be 'delivery', 'advertising', or 'social'" });
      }

      // Get recipe details
      const recipe = await storage.getRecipeById(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      // Get recipe ingredients
      const recipeIngredients = await storage.getRecipeIngredients(recipeId);
      const allIngredients = await storage.getIngredients();
      const ingredientNames = recipeIngredients.map(ri => {
        const ingredient = allIngredients.find(ing => ing.id === ri.ingredientId);
        return ingredient?.name || `Ingredient ${ri.ingredientId}`;
      });

      // Generate marketing content using OpenAI
      const marketingContent = await generateMarketingContent(
        recipe.name,
        ingredientNames,
        notes || '',
        outputType as 'delivery' | 'advertising' | 'social'
      );

      // Update recipe with generated content
      const contentField = `${outputType}Content` as 'deliveryContent' | 'advertisingContent' | 'socialContent';
      await storage.updateRecipe(recipeId, {
        [contentField]: JSON.stringify(marketingContent),
        marketingNotes: notes || recipe.marketingNotes
      });

      res.json({
        success: true,
        content: marketingContent,
        outputType
      });

    } catch (error: any) {
      console.error('Marketing content generation error:', error);
      res.status(500).json({ 
        error: "Failed to generate marketing content", 
        details: error.message 
      });
    }
  });

  // Get marketing content for a recipe
  app.get("/api/recipes/:id/marketing", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      const { type } = req.query;

      const recipe = await storage.getRecipeById(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      let content = null;
      if (type === 'delivery' && recipe.deliveryContent) {
        content = JSON.parse(recipe.deliveryContent);
      } else if (type === 'advertising' && recipe.advertisingContent) {
        content = JSON.parse(recipe.advertisingContent);
      } else if (type === 'social' && recipe.socialContent) {
        content = JSON.parse(recipe.socialContent);
      }

      res.json({
        content,
        marketingNotes: recipe.marketingNotes,
        hasContent: {
          delivery: !!recipe.deliveryContent,
          advertising: !!recipe.advertisingContent,
          social: !!recipe.socialContent
        }
      });

    } catch (error: any) {
      console.error('Get marketing content error:', error);
      res.status(500).json({ 
        error: "Failed to get marketing content", 
        details: error.message 
      });
    }
  });

  // Google Sheets backup endpoints
  app.get('/api/google-sheets/status', async (req, res) => {
    try {
      const { googleSheetsService } = await import('./googleSheetsService');
      res.json({
        configured: googleSheetsService.isConfigured(),
        spreadsheetUrl: googleSheetsService.getSpreadsheetUrl()
      });
    } catch (error) {
      console.error('Error checking Google Sheets status:', error);
      res.status(500).json({ error: 'Failed to check Google Sheets status' });
    }
  });

  app.post('/api/google-sheets/backup/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      const form = await storage.getDailyStockSalesById(id);
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }

      const { googleSheetsService } = await import('./googleSheetsService');
      const success = await googleSheetsService.backupDailyStockSales(form);
      
      if (success) {
        res.json({ success: true, message: 'Form backed up to Google Sheets' });
      } else {
        res.status(500).json({ error: 'Failed to backup to Google Sheets' });
      }
    } catch (error) {
      console.error('Error backing up to Google Sheets:', error);
      res.status(500).json({ error: 'Failed to backup to Google Sheets' });
    }
  });

  app.get('/api/google-sheets/backup-data', async (req, res) => {
    try {
      const { googleSheetsService } = await import('./googleSheetsService');
      const backupData = await googleSheetsService.getBackupData();
      res.json(backupData);
    } catch (error) {
      console.error('Error retrieving backup data:', error);
      res.status(500).json({ error: 'Failed to retrieve backup data' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
