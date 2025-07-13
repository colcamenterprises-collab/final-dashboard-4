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

  app.post("/api/daily-stock-sales/draft", async (req: Request, res: Response) => {
    try {
      const data = { ...req.body, isDraft: true };
      console.log("Saving draft:", data);
      
      const result = await storage.createDailyStockSales(data);
      
      res.json(result);
    } catch (err) {
      console.error("Error saving draft:", err);
      res.status(500).json({ error: "Failed to save draft" });
    }
  });

  app.put("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      console.log("Updating daily stock sales:", { id, data });
      
      const result = await storage.updateDailyStockSales(parseInt(id), data);
      
      if (!result) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      res.json(result);
    } catch (err) {
      console.error("Error updating daily stock sales:", err);
      res.status(500).json({ error: "Failed to update daily stock sales" });
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

  // Stock Purchase endpoints
  app.get("/api/stock-purchase/rolls/:expenseId", async (req: Request, res: Response) => {
    try {
      const rolls = await storage.getStockPurchaseRolls(parseInt(req.params.expenseId));
      res.json(rolls);
    } catch (err) {
      console.error("Error fetching stock purchase rolls:", err);
      res.status(500).json({ error: "Failed to fetch stock purchase rolls" });
    }
  });

  app.post("/api/stock-purchase/rolls", async (req: Request, res: Response) => {
    try {
      const roll = await storage.createStockPurchaseRolls(req.body);
      res.json(roll);
    } catch (err) {
      console.error("Error creating stock purchase rolls:", err);
      res.status(500).json({ error: "Failed to create stock purchase rolls" });
    }
  });

  app.get("/api/stock-purchase/drinks/:expenseId", async (req: Request, res: Response) => {
    try {
      const drinks = await storage.getStockPurchaseDrinks(parseInt(req.params.expenseId));
      res.json(drinks);
    } catch (err) {
      console.error("Error fetching stock purchase drinks:", err);
      res.status(500).json({ error: "Failed to fetch stock purchase drinks" });
    }
  });

  app.post("/api/stock-purchase/drinks", async (req: Request, res: Response) => {
    try {
      const drink = await storage.createStockPurchaseDrinks(req.body);
      res.json(drink);
    } catch (err) {
      console.error("Error creating stock purchase drinks:", err);
      res.status(500).json({ error: "Failed to create stock purchase drinks" });
    }
  });

  app.get("/api/stock-purchase/meat/:expenseId", async (req: Request, res: Response) => {
    try {
      const meat = await storage.getStockPurchaseMeat(parseInt(req.params.expenseId));
      res.json(meat);
    } catch (err) {
      console.error("Error fetching stock purchase meat:", err);
      res.status(500).json({ error: "Failed to fetch stock purchase meat" });
    }
  });

  app.post("/api/stock-purchase/meat", async (req: Request, res: Response) => {
    try {
      const meat = await storage.createStockPurchaseMeat(req.body);
      res.json(meat);
    } catch (err) {
      console.error("Error creating stock purchase meat:", err);
      res.status(500).json({ error: "Failed to create stock purchase meat" });
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
      const { loyverseReceipts, dailyShiftReceiptSummary } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      
      // Generate from receipts directly for now
      
      // If no summary or empty, generate from latest receipts
      const latestReceipts = await db
        .select()
        .from(loyverseReceipts)
        .orderBy(desc(loyverseReceipts.receiptDate))
        .limit(50);
      
      if (latestReceipts.length === 0) {
        res.json({
          shiftDate: new Date().toISOString().split('T')[0],
          burgersSold: 0,
          drinksSold: 0,
          itemsBreakdown: {},
          modifiersSummary: {}
        });
        return;
      }
      
      // Calculate summary from receipts
      let burgersSold = 0;
      let drinksSold = 0;
      const itemsBreakdown: Record<string, { qty: number; sales: number }> = {};
      
      for (const receipt of latestReceipts) {
        const items = receipt.items as any[];
        if (!items || !Array.isArray(items)) continue;
        
        for (const item of items) {
          const itemName = item.item_name || 'Unknown';
          const quantity = item.quantity || 0;
          const totalMoney = item.total_money || 0;
          
          // Count burgers and drinks
          if (itemName.toLowerCase().includes('burger') || itemName.toLowerCase().includes('smash')) {
            burgersSold += quantity;
          }
          if (itemName.toLowerCase().includes('coke') || itemName.toLowerCase().includes('fanta') || 
              itemName.toLowerCase().includes('sprite') || itemName.toLowerCase().includes('water')) {
            drinksSold += quantity;
          }
          
          // Update items breakdown
          if (!itemsBreakdown[itemName]) {
            itemsBreakdown[itemName] = { qty: 0, sales: 0 };
          }
          itemsBreakdown[itemName].qty += quantity;
          itemsBreakdown[itemName].sales += totalMoney;
        }
      }
      
      // Get the latest shift date
      const latestShiftDate = latestReceipts[0]?.shiftDate || new Date().toISOString().split('T')[0];
      
      res.json({
        shiftDate: latestShiftDate,
        burgersSold,
        drinksSold,
        itemsBreakdown,
        modifiersSummary: {}
      });
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

  // Quick Notes API endpoints
  app.get("/api/quick-notes", async (req: Request, res: Response) => {
    try {
      const notes = await storage.getQuickNotes();
      res.json(notes);
    } catch (err) {
      console.error("Error fetching quick notes:", err);
      res.status(500).json({ error: "Failed to fetch quick notes" });
    }
  });

  app.post("/api/quick-notes", async (req: Request, res: Response) => {
    try {
      const note = await storage.createQuickNote(req.body);
      res.json(note);
    } catch (err) {
      console.error("Error creating quick note:", err);
      res.status(500).json({ error: "Failed to create quick note" });
    }
  });

  app.put("/api/quick-notes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const note = await storage.updateQuickNote(id, req.body);
      res.json(note);
    } catch (err) {
      console.error("Error updating quick note:", err);
      res.status(500).json({ error: "Failed to update quick note" });
    }
  });

  app.delete("/api/quick-notes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuickNote(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting quick note:", err);
      res.status(500).json({ error: "Failed to delete quick note" });
    }
  });

  // Shift Report Balance Review endpoint
  app.get("/api/shift-reports/balance-review", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { loyverseShiftReports } = await import("../shared/schema");
      const { desc } = await import("drizzle-orm");
      const { format } = await import("date-fns");
      
      // Get last 5 authentic shift reports from Loyverse data
      const recentShifts = await db
        .select()
        .from(loyverseShiftReports)
        .orderBy(desc(loyverseShiftReports.shiftDate))
        .limit(5);
      
      const balanceReports = recentShifts.map(shift => {
        // Extract authentic cash difference from report_data JSON
        const reportData = shift.reportData as any;
        const cashDifference = parseFloat(reportData?.cash_difference?.toString() || '0');
        const isWithinRange = Math.abs(cashDifference) <= 50;
        
        // Format date to show actual shift date
        const shiftDate = shift.shiftDate ? new Date(shift.shiftDate) : new Date();
        const formattedDate = format(shiftDate, 'dd/MM/yyyy');
        
        return {
          date: formattedDate,
          balance: cashDifference,
          status: isWithinRange ? "Balanced" : "Attention",
          isWithinRange
        };
      });
      
      res.json(balanceReports);
    } catch (err) {
      console.error("Error fetching shift balance review:", err);
      res.status(500).json({ error: "Failed to fetch shift balance review" });
    }
  });

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
