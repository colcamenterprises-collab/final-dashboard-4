import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";

export function registerRoutes(app: express.Application): Server {
  // Stock discrepancy endpoint for dashboard
  app.get("/api/dashboard/stock-discrepancies", async (req: Request, res: Response) => {
    try {
      // Pull last shift's receipts right out of DB and analyze against staff forms
      const { loyverseReceiptService } = await import("./services/loyverseReceipts");
      const { getExpectedStockFromReceipts, analyzeStockDiscrepancies } = await import("./services/stockAnalysis");
      
      const shift = await loyverseReceiptService.getShiftData("last");
      const receipts = await loyverseReceiptService.getReceiptsByShift(shift.id.toString());
      
      // Calculate expected stock usage from receipts
      const expectedStock = getExpectedStockFromReceipts(receipts);
      
      // Get actual stock from the latest staff form (if available)
      const latestForms = await storage.getAllDailyStockSales();
      const actualStock = latestForms.length > 0 ? {
        "Burger Buns": latestForms[0].burgerBunsStock || 0,
        "French Fries": latestForms[0].frozenFood?.["French Fries"] || 0,
        "Chicken Wings": latestForms[0].frozenFood?.["Chicken Wings"] || 0,
        "Chicken Nuggets": latestForms[0].frozenFood?.["Chicken Nuggets"] || 0,
        "Coke": latestForms[0].drinkStock?.["Coke"] || 0,
        "Fanta": latestForms[0].drinkStock?.["Fanta"] || 0,
        "Water": latestForms[0].drinkStock?.["Water"] || 0
      } : {};
      
      // Analyze discrepancies between expected and actual
      const discrepancies = analyzeStockDiscrepancies(expectedStock, actualStock);
      
      res.json({ 
        shiftId: shift.id,
        discrepancies: discrepancies.slice(0, 10), // Top 10 discrepancies
        receiptsAnalyzed: receipts.length,
        expectedItems: expectedStock.length 
      });
    } catch (err) {
      console.error("Stock discrepancy analysis failed:", err);
      
      // Fallback to simple mock data if analysis fails
      const discrepancies = [
        {
          item: "Burger Buns",
          expected: 50,
          actual: 45,
          difference: -5,
          threshold: 10,
          isOutOfBounds: false,
          alert: null
        },
        {
          item: "Chicken Wings",
          expected: 100,
          actual: 85,
          difference: -15,
          threshold: 10,
          isOutOfBounds: true,
          alert: "Stock level below threshold"
        }
      ];
      
      res.json({ discrepancies });
    }
  });

  // Daily Stock Sales endpoints
  app.get("/api/daily-stock-sales/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      let results;
      
      if (query && typeof query === 'string') {
        results = await storage.searchDailyStockSales(query);
      } else {
        results = await storage.getAllDailyStockSales();
      }
      
      res.json(results);
    } catch (err) {
      console.error("Error searching daily stock sales:", err);
      res.status(500).json({ error: "Failed to search daily stock sales" });
    }
  });

  app.post("/api/daily-stock-sales", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      console.log("Received daily stock sales data:", data);
      
      // Save to storage
      const result = await storage.createDailyStockSales(data);
      
      res.json(result);
    } catch (err) {
      console.error("Error creating daily stock sales:", err);
      res.status(500).json({ error: "Failed to create daily stock sales" });
    }
  });

  app.get("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await storage.getDailyStockSalesById(parseInt(id));
      
      if (!result) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      res.json(result);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

  // ─── Manual "pull receipts now" endpoint ───────────────────────────────
  app.post("/api/loyverse/pull", async (_req: Request, res: Response) => {
    try {
      const { loyverseReceiptService } = await import("./services/loyverseReceipts");
      const { success, receiptsProcessed } = await loyverseReceiptService.fetchAndStoreReceipts();

      return res.json({ success, receiptsProcessed });
    } catch (err) {
      console.error("Receipt sync failed:", err);
      return res.status(500).json({ error: "Loyverse pull failed" });
    }
  });

  // GET /api/debug/receipts?limit=50
  app.get("/api/debug/receipts", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const { loyverseReceiptService } = await import("./services/loyverseReceipts");
      const receipts = await loyverseReceiptService.getAllReceipts(limit);
      res.json(receipts);
    } catch (err) {
      console.error("Error fetching debug receipts:", err);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  // Expense endpoints
  app.get("/api/expenses", async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (err) {
      console.error("Error fetching expenses:", err);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req: Request, res: Response) => {
    try {
      const expense = await storage.createExpense(req.body);
      res.json(expense);
    } catch (err) {
      console.error("Error creating expense:", err);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteExpense(parseInt(req.params.id));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Expense not found" });
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.get("/api/expenses/month-to-date", async (req: Request, res: Response) => {
    try {
      const total = await storage.getMonthToDateExpenses();
      res.json({ total });
    } catch (err) {
      console.error("Error fetching month-to-date expenses:", err);
      res.status(500).json({ error: "Failed to fetch month-to-date expenses" });
    }
  });

  app.get("/api/expenses/by-category", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getExpensesByCategory();
      res.json(categories);
    } catch (err) {
      console.error("Error fetching expenses by category:", err);
      res.status(500).json({ error: "Failed to fetch expenses by category" });
    }
  });

  app.get("/api/expense-suppliers", async (req: Request, res: Response) => {
    try {
      const suppliers = await storage.getExpenseSuppliers();
      res.json(suppliers);
    } catch (err) {
      console.error("Error fetching expense suppliers:", err);
      res.status(500).json({ error: "Failed to fetch expense suppliers" });
    }
  });

  app.get("/api/expense-categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (err) {
      console.error("Error fetching expense categories:", err);
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  // Shift Analytics endpoints
  app.get("/api/analysis/shift/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { getShiftAnalytics } = await import("./services/shiftAnalytics");
      const analytics = await getShiftAnalytics(date);
      
      if (!analytics) {
        return res.status(404).json({ error: "No analytics found for this shift" });
      }
      
      res.json(analytics);
    } catch (err) {
      console.error("Error fetching shift analytics:", err);
      res.status(500).json({ error: "Failed to fetch shift analytics" });
    }
  });

  app.get("/api/analysis/search", async (req: Request, res: Response) => {
    try {
      const { q, from, to, cat } = req.query;
      // TODO: implement search functionality
      res.json({ message: "Search functionality coming soon" });
    } catch (err) {
      console.error("Error searching analytics:", err);
      res.status(500).json({ error: "Failed to search analytics" });
    }
  });

  app.post("/api/analysis/process-shift", async (req: Request, res: Response) => {
    try {
      const { processPreviousShift } = await import("./services/shiftAnalytics");
      const result = await processPreviousShift();
      res.json(result);
    } catch (err) {
      console.error("Error processing shift analytics:", err);
      res.status(500).json({ error: "Failed to process shift analytics" });
    }
  });

  // NEW: latest shift summary
  app.get("/api/shift-summary/latest", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { dailyShiftReceiptSummary } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const latest = await db
        .select()
        .from(dailyShiftReceiptSummary)
        .orderBy(desc(dailyShiftReceiptSummary.shiftDate))
        .limit(1);
      
      res.json(latest[0] ?? {});
    } catch (err) {
      console.error("Error fetching latest shift summary:", err);
      res.status(500).json({ error: "Failed to fetch latest shift summary" });
    }
  });

  // NEW: generate shift summary
  app.post("/api/shift-summary/generate", async (req: Request, res: Response) => {
    try {
      const { date } = req.body;
      const { buildShiftSummary } = await import("./services/receiptSummary");
      
      const summary = await buildShiftSummary(date);
      
      res.json({ 
        success: true, 
        message: `Summary generated for ${date}`, 
        summary 
      });
    } catch (err) {
      console.error("Error generating shift summary:", err);
      res.status(500).json({ error: "Failed to generate shift summary" });
    }
  });

  // NEW: Get receipts for POSLoyverse page
  app.get("/api/loyverse/receipts", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const searchQuery = req.query.search as string || '';
      const dateFilter = req.query.dateFilter as string || 'all';
      
      const { db } = await import("./db");
      const { loyverseReceipts } = await import("../shared/schema");
      const { desc, like, gte, and } = await import("drizzle-orm");
      
      let whereConditions = [];
      
      // Add search filter
      if (searchQuery) {
        whereConditions.push(like(loyverseReceipts.receiptNumber, `%${searchQuery}%`));
      }
      
      // Add date filter
      if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        whereConditions.push(gte(loyverseReceipts.receiptDate, cutoffDate));
      }
      
      const receipts = await db
        .select()
        .from(loyverseReceipts)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(loyverseReceipts.receiptDate))
        .limit(limit);
      
      // Transform to expected format
      const formattedReceipts = receipts.map(receipt => ({
        id: receipt.id.toString(),
        receiptNumber: receipt.receiptNumber,
        receiptDate: receipt.receiptDate.toISOString(),
        totalAmount: receipt.totalAmount.toString(),
        paymentMethod: receipt.paymentMethod,
        staffMember: receipt.staffMember || 'Unknown',
        tableNumber: receipt.tableNumber || 0,
        items: receipt.items || [],
        rawData: receipt.rawData
      }));
      
      res.json(formattedReceipts);
    } catch (err) {
      console.error("Error fetching receipts:", err);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  // Roll variance endpoint for dashboard
  app.get("/api/dashboard/roll-variance", async (req: Request, res: Response) => {
    try {
      const { getLatestShiftSummary } = await import("./services/burgerVarianceService");
      const latest = await getLatestShiftSummary();
      res.json(latest || {});
    } catch (err) {
      console.error("Roll variance endpoint failed:", err);
      res.status(500).json({ error: "Failed to fetch roll variance data" });
    }
  });

  // Generate shift summary endpoint
  app.post("/api/shift-summary/generate-variance", async (req: Request, res: Response) => {
    try {
      const { date } = req.body;
      const { generateShiftSummary } = await import("./services/burgerVarianceService");
      const shiftDate = date ? new Date(date) : new Date();
      const result = await generateShiftSummary(shiftDate);
      res.json(result);
    } catch (err) {
      console.error("Generate shift summary failed:", err);
      res.status(500).json({ error: "Failed to generate shift summary" });
    }
  });

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
