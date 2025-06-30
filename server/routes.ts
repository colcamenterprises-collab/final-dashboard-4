import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertExpenseSchema, 
  insertShoppingListSchema, 
  insertStaffShiftSchema,
  insertTransactionSchema 
} from "@shared/schema";
import { 
  analyzeReceipt, 
  detectAnomalies, 
  calculateIngredientUsage, 
  generateStockRecommendations,
  analyzeFinancialVariance
} from "./services/ai";
import { loyverseReceiptService } from "./services/loyverseReceipts";

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
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
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
      const result = await loyverseReceiptService.fetchAndStoreShiftReports();
      res.json(result);
    } catch (error) {
      console.error("Failed to sync shift reports:", error);
      res.status(500).json({ error: "Failed to sync shift reports" });
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

  const httpServer = createServer(app);
  return httpServer;
}
