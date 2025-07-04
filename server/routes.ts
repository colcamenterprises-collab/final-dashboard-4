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
import { loyverseShiftReports } from "@shared/schema";
import { db } from "./db";

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
      const kpis = await storage.getDashboardKPIs();
      res.json(kpis);
    } catch (error) {
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
      const result = await loyverseReceiptService.fetchAndStoreReceipts();
      res.json(result);
    } catch (error) {
      console.error("Failed to sync receipts:", error);
      res.status(500).json({ error: "Failed to sync receipts from Loyverse" });
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

  const httpServer = createServer(app);
  return httpServer;
}
