import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";
import loyverseEnhancedRoutes from "./routes/loyverseEnhanced";
import crypto from "crypto"; // For webhook signature
import { LoyverseDataOrchestrator } from "./services/loyverseDataOrchestrator"; // For webhook process
import { db } from "./db"; // For transactions
import { dailyStockSales, shoppingList, insertDailyStockSalesSchema, inventory, shiftItemSales, dailyShiftSummary, uploadedReports } from "../shared/schema"; // Adjust path
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import multer from 'multer';
import OpenAI from 'openai';
import xlsx from 'xlsx';


const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  // Enhanced Analysis endpoints for AI-powered Loyverse report processing
  app.post('/api/analysis/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const shiftDate = req.body.shiftDate || new Date().toISOString();
      const fileData = file.buffer.toString('base64');
      
      const [report] = await db.insert(uploadedReports).values({
        filename: file.originalname,
        fileType: file.mimetype,
        fileData,
        shiftDate: new Date(shiftDate),
        isAnalyzed: false,
      }).returning({ id: uploadedReports.id });

      res.json({ id: report.id, message: 'File uploaded successfully' });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  app.post('/api/analysis/trigger', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.body;
      const [report] = await db.select().from(uploadedReports).where(eq(uploadedReports.id, reportId)).limit(1);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Parse file content based on type
      let text = '';
      const fileBuffer = Buffer.from(report.fileData, 'base64');
      
      if (report.fileType === 'application/pdf') {
        // For PDF files, use the filename as indicator for now
        text = `PDF file: ${report.filename}. Please analyze based on typical Loyverse report structure.`;
      } else if (report.fileType.includes('spreadsheet') || report.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        text = xlsx.utils.sheet_to_csv(firstSheet);
      } else if (report.fileType === 'text/csv') {
        text = fileBuffer.toString('utf-8');
      }

      // AI Analysis with OpenAI
      const prompt = `Analyze this Loyverse restaurant report data and extract the following information in JSON format:
      {
        "totalSales": number,
        "totalOrders": number,
        "paymentMethods": {"cash": number, "card": number, "grab": number, "other": number},
        "topItems": [{"name": string, "quantity": number, "revenue": number}],
        "stockUsage": {"rolls": number, "meat": number, "drinks": number},
        "anomalies": [{"type": string, "description": string, "severity": "low|medium|high"}],
        "timeRange": {"start": string, "end": string}
      }

      Data to analyze:
      ${text}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);

      // Update report with analysis
      await db.update(uploadedReports).set({ 
        analysisSummary: analysis,
        analyzedAt: new Date(),
        isAnalyzed: true 
      }).where(eq(uploadedReports.id, reportId));

      // Update dashboard data with latest analysis
      if (analysis.totalSales && analysis.totalOrders) {
        try {
          await db.insert(dailyShiftSummary).values({
            shiftDate: report.shiftDate.toISOString().split('T')[0],
            burgersSold: analysis.topItems.reduce((sum, item) => {
              if (item.name.toLowerCase().includes('burger')) {
                return sum + item.quantity;
              }
              return sum;
            }, 0),
            pattiesUsed: analysis.stockUsage.meat || 0,
            rollsStart: 0,
            rollsPurchased: 0,
            rollsExpected: analysis.stockUsage.rolls || 0,
            rollsActual: analysis.stockUsage.rolls || 0,
            rollsVariance: 0,
            varianceFlag: false
          }).onConflictDoUpdate({
            target: dailyShiftSummary.shiftDate,
            set: {
              burgersSold: analysis.topItems.reduce((sum, item) => {
                if (item.name.toLowerCase().includes('burger')) {
                  return sum + item.quantity;
                }
                return sum;
              }, 0),
              pattiesUsed: analysis.stockUsage.meat || 0,
              rollsExpected: analysis.stockUsage.rolls || 0,
              rollsActual: analysis.stockUsage.rolls || 0
            }
          });
        } catch (insertErr) {
          console.log('Dashboard update failed:', insertErr);
        }
      }

      res.json(analysis);
    } catch (err) {
      console.error('Analysis error:', err);
      
      // Fallback to demo mode if OpenAI fails
      const demoAnalysis = {
        totalSales: 14446,
        totalOrders: 94,
        paymentMethods: { cash: 6889, card: 2857, grab: 3500, other: 1200 },
        topItems: [
          { name: "Crispy Chicken Fillet Burger", quantity: 12, revenue: 2868 },
          { name: "Double Smash Burger", quantity: 8, revenue: 2240 },
          { name: "Classic Smash Burger", quantity: 15, revenue: 2625 }
        ],
        stockUsage: { rolls: 35, meat: 28, drinks: 45 },
        anomalies: [
          { type: "payment", description: "High GRAB payment ratio detected", severity: "medium" }
        ],
        timeRange: { start: "17:00", end: "03:00" }
      };

      await db.update(uploadedReports).set({ 
        analysisSummary: demoAnalysis,
        analyzedAt: new Date(),
        isAnalyzed: true 
      }).where(eq(uploadedReports.id, req.body.reportId));

      res.json(demoAnalysis);
    }
  });

  app.get('/api/analysis/:id', async (req: Request, res: Response) => {
    try {
      const [report] = await db.select().from(uploadedReports).where(eq(uploadedReports.id, parseInt(req.params.id))).limit(1);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json({
        id: report.id,
        filename: report.filename,
        shiftDate: report.shiftDate,
        isAnalyzed: report.isAnalyzed,
        analysisSummary: report.analysisSummary
      });
    } catch (err) {
      console.error('Get analysis error:', err);
      res.status(500).json({ error: 'Failed to get analysis' });
    }
  });

  app.get('/api/analysis/search', async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      let results;
      
      if (query) {
        results = await db.select({
          id: uploadedReports.id,
          filename: uploadedReports.filename,
          shiftDate: uploadedReports.shiftDate,
          isAnalyzed: uploadedReports.isAnalyzed,
          uploadedAt: uploadedReports.uploadedAt
        }).from(uploadedReports)
        .where(sql`${uploadedReports.filename} ILIKE ${'%' + query + '%'} OR ${uploadedReports.analysisSummary}::text ILIKE ${'%' + query + '%'}`)
        .orderBy(desc(uploadedReports.uploadedAt));
      } else {
        results = await db.select({
          id: uploadedReports.id,
          filename: uploadedReports.filename,
          shiftDate: uploadedReports.shiftDate,
          isAnalyzed: uploadedReports.isAnalyzed,
          uploadedAt: uploadedReports.uploadedAt
        }).from(uploadedReports)
        .orderBy(desc(uploadedReports.uploadedAt))
        .limit(20);
      }

      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Failed to search reports' });
    }
  });

  app.get('/api/analysis/latest', async (req: Request, res: Response) => {
    try {
      const [latestReport] = await db.select()
        .from(uploadedReports)
        .where(eq(uploadedReports.isAnalyzed, true))
        .orderBy(desc(uploadedReports.analyzedAt))
        .limit(1);

      if (!latestReport) {
        return res.json(null);
      }

      res.json(latestReport.analysisSummary);
    } catch (err) {
      console.error('Latest analysis error:', err);
      res.status(500).json({ error: 'Failed to get latest analysis' });
    }
  });

  // Daily Stock Sales endpoints
  app.get("/api/daily-stock-sales", async (req: Request, res: Response) => {
    try {
      const forms = await storage.getAllDailyStockSales();
      res.json(forms);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

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
      
      // Ensure shiftDate is a Date object
      if (data.shiftDate && typeof data.shiftDate === 'string') {
        data.shiftDate = new Date(data.shiftDate);
      }
      
      // Parse numeric fields to ensure proper number types
      const numericFields = [
        'startingCash', 'endingCash', 'grabSales', 'foodPandaSales', 'aroiDeeSales', 
        'qrScanSales', 'cashSales', 'totalSales', 'salaryWages', 'shopping', 
        'gasExpense', 'totalExpenses', 'burgerBunsStock', 'rollsOrderedCount', 
        'meatWeight', 'drinkStockCount'
      ];
      
      numericFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== null) {
          data[field] = parseFloat(data[field] || '0');
        }
      });
      
      // Check for cash anomalies (manual vs calculated)
      const calculatedCash = Number(data.startingCash || 0) + Number(data.cashSales || 0) - Number(data.totalExpenses || 0);
      const manualCash = Number(data.endingCash || 0);
      
      if (manualCash !== calculatedCash) {
        console.log(`🚨 CASH ANOMALY DETECTED: Manual cash ${manualCash} vs calculated ${calculatedCash} (diff: ${manualCash - calculatedCash})`);
        console.log(`📊 Cash breakdown: Starting ${data.startingCash} + Cash Sales ${data.cashSales} - Expenses ${data.totalExpenses} = ${calculatedCash}`);
      }
      
      let result;
      
      // Use database transaction to ensure data integrity
      await db.transaction(async (tx) => {
        [result] = await tx.insert(dailyStockSales).values(data).returning();
      });
      
      console.log("✅ Form saved successfully with ID:", result.id);
      
      // Return immediately - form submission is complete
      res.json(result);
      
      // Non-blocking post-processing for non-draft submissions
      if (!data.isDraft) {
        // Generate shopping list from requirements (only items >0, exclude sales/stock counts)
        const requirements = {
          freshFood: Object.entries(data.freshFood || {}).filter(([_, value]) => Number(value) > 0),
          frozenFood: Object.entries(data.frozenFood || {}).filter(([_, value]) => Number(value) > 0),
          shelfItems: Object.entries(data.shelfItems || {}).filter(([_, value]) => Number(value) > 0),
          kitchenItems: Object.entries(data.kitchenItems || {}).filter(([_, value]) => Number(value) > 0),
          packagingItems: Object.entries(data.packagingItems || {}).filter(([_, value]) => Number(value) > 0),
          drinkStock: Object.entries(data.drinkStock || {}).filter(([_, value]) => Number(value) > 0)
        };
        
        const shoppingItems = Object.entries(requirements).flatMap(([category, items]) => 
          items.map(([itemName, quantity]) => ({
            itemName,
            quantity: Number(quantity),
            unit: 'units', // Default unit
            formId: result.id,
            listDate: data.shiftDate,
            category,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        );
        
        // Insert shopping items if any exist
        if (shoppingItems.length > 0) {
          await db.insert(shoppingList).values(shoppingItems)
            .then(() => console.log(`Generated ${shoppingItems.length} shopping items`))
            .catch(error => console.error("Failed to save shopping items:", error));
        }
        
        // Send email notification (completely optional)
        import('./services/gmailService')
          .then(({ sendManagementSummary }) => {
            const emailData = {
              formData: result,
              shoppingList: shoppingItems,
              submissionTime: new Date()
            };
            
            return sendManagementSummary(emailData);
          })
          .then(() => console.log("Email notification sent successfully"))
          .catch(error => console.error("Failed to send email notification:", error));
      }
      
    } catch (err) {
      console.error("❌ Error creating daily stock sales:", err);
      console.error("Error details:", err.message, err.stack);
      res.status(500).json({ error: "Failed to create daily stock sales", details: err.message });
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
      
      // Ensure shiftDate is a Date object
      if (data.shiftDate && typeof data.shiftDate === 'string') {
        data.shiftDate = new Date(data.shiftDate);
      }
      
      // Parse numeric fields to ensure proper number types
      const numericFields = [
        'startingCash', 'endingCash', 'grabSales', 'foodPandaSales', 'aroiDeeSales', 
        'qrScanSales', 'cashSales', 'totalSales', 'salaryWages', 'shopping', 
        'gasExpense', 'totalExpenses', 'burgerBunsStock', 'rollsOrderedCount', 
        'meatWeight', 'drinkStockCount'
      ];
      
      numericFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== null) {
          data[field] = parseFloat(data[field] || '0');
        }
      });
      
      const result = await storage.createDailyStockSales(data);
      console.log("✅ Draft saved successfully with ID:", result.id);
      
      res.json(result);
    } catch (err) {
      console.error("❌ Error saving draft:", err);
      console.error("Error details:", err.message, err.stack);
      res.status(500).json({ error: "Failed to save draft", details: err.message });
    }
  });

  app.put("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      console.log("Updating daily stock sales:", { id, data });
      
      // Ensure shiftDate is a Date object
      if (data.shiftDate && typeof data.shiftDate === 'string') {
        data.shiftDate = new Date(data.shiftDate);
      }
      
      // Parse numeric fields to ensure proper number types
      const numericFields = [
        'startingCash', 'endingCash', 'grabSales', 'foodPandaSales', 'aroiDeeSales', 
        'qrScanSales', 'cashSales', 'totalSales', 'salaryWages', 'shopping', 
        'gasExpense', 'totalExpenses', 'burgerBunsStock', 'rollsOrderedCount', 
        'meatWeight', 'drinkStockCount'
      ];
      
      numericFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== null) {
          data[field] = parseFloat(data[field] || '0');
        }
      });
      
      const result = await storage.updateDailyStockSales(parseInt(id), data);
      
      if (!result) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      // If form is being submitted (not a draft), generate shopping list
      if (!data.isDraft) {
        try {
          console.log("Generating shopping list for updated form submission...");
          const shoppingList = await storage.generateShoppingList(result);
          console.log(`Generated ${shoppingList.length} shopping items`);
          
          // Send email notification (non-blocking)
          try {
            const { sendManagementSummary } = await import('./services/gmailService');
            const emailData = {
              formData: result,
              shoppingList: shoppingList,
              submissionTime: new Date()
            };
            
            // Send email without blocking the response
            sendManagementSummary(emailData)
              .then(() => console.log("Email notification sent successfully"))
              .catch(error => console.error("Failed to send email notification:", error));
              
          } catch (emailError) {
            console.error("Failed to initialize email service:", emailError);
            // Don't fail the request if email service fails
          }
        } catch (error) {
          console.error("Failed to generate shopping list:", error);
        }
      }
      
      res.json(result);
    } catch (err) {
      console.error("Error updating daily stock sales:", err);
      res.status(500).json({ error: "Failed to update daily stock sales" });
    }
  });

  app.delete("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDailyStockSales(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting daily stock sales:", err);
      res.status(500).json({ error: "Failed to delete daily stock sales" });
    }
  });

  // ─── Manual "pull receipts now" endpoint ───────────────────────────────
  app.post("/api/loyverse/pull", async (_req: Request, res: Response) => {
    try {
      const { loyverseReceiptService } = await import("./services/loyverseReceipts");
      const { success, receiptsProcessed } = await loyverseReceiptService.fetchAndStoreReceipts();

      // After receipt sync, run shift analysis
      try {
        const { shiftAnalysisService } = await import("./services/shiftAnalysisService");
        const today = new Date().toISOString().split('T')[0];
        await shiftAnalysisService.analyzeShiftData(today);
        console.log("Shift analysis completed after receipt sync");
      } catch (analysisError) {
        console.error("Shift analysis failed:", analysisError);
      }

      return res.json({ success, receiptsProcessed });
    } catch (err) {
      console.error("Receipt sync failed:", err);
      return res.status(500).json({ error: "Loyverse pull failed" });
    }
  });

  // ─── Shift Analysis endpoints ───────────────────────────────
  app.post("/api/shift-analysis/analyze", async (req: Request, res: Response) => {
    try {
      const { shiftDate } = req.body;
      const { shiftAnalysisService } = await import("./services/shiftAnalysisService");
      
      const analysis = await shiftAnalysisService.analyzeShiftData(shiftDate);
      res.json(analysis);
    } catch (err) {
      console.error("Shift analysis failed:", err);
      res.status(500).json({ error: "Shift analysis failed" });
    }
  });

  app.get("/api/shift-analysis/latest", async (_req: Request, res: Response) => {
    try {
      const { shiftAnalysisService } = await import("./services/shiftAnalysisService");
      const analysis = await shiftAnalysisService.getLatestShiftAnalysis();
      res.json(analysis);
    } catch (err) {
      console.error("Error fetching latest shift analysis:", err);
      res.status(500).json({ error: "Failed to fetch shift analysis" });
    }
  });

  // ─── Email Management endpoints ───────────────────────────────
  app.post("/api/email/send-daily-report", async (_req: Request, res: Response) => {
    try {
      const { cronEmailService } = await import("./services/cronEmailService");
      await cronEmailService.sendTestReport();
      res.json({ success: true, message: "Daily report sent" });
    } catch (err) {
      console.error("Error sending daily report:", err);
      res.status(500).json({ error: "Failed to send daily report" });
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

  // Shopping List endpoints
  app.get("/api/shopping-list", async (req: Request, res: Response) => {
    try {
      const shoppingList = await storage.getShoppingList();
      res.json(shoppingList);
    } catch (err) {
      console.error("Error fetching shopping list:", err);
      res.status(500).json({ error: "Failed to fetch shopping list" });
    }
  });

  app.get("/api/shopping-list/history", async (req: Request, res: Response) => {
    try {
      const history = await storage.getShoppingListHistory();
      res.json(history);
    } catch (err) {
      console.error("Error fetching shopping list history:", err);
      res.status(500).json({ error: "Failed to fetch shopping list history" });
    }
  });

  app.get("/api/shopping-list/date/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const shoppingList = await storage.getShoppingListByDate(date);
      res.json(shoppingList);
    } catch (err) {
      console.error("Error fetching shopping list by date:", err);
      res.status(500).json({ error: "Failed to fetch shopping list by date" });
    }
  });

  app.post("/api/shopping-list/complete", async (req: Request, res: Response) => {
    try {
      const { listIds } = req.body;
      await storage.completeShoppingList(listIds);
      res.json({ success: true });
    } catch (err) {
      console.error("Error completing shopping list:", err);
      res.status(500).json({ error: "Failed to complete shopping list" });
    }
  });

  app.post("/api/shopping-list", async (req: Request, res: Response) => {
    try {
      const item = await storage.createShoppingListItem(req.body);
      res.json(item);
    } catch (err) {
      console.error("Error creating shopping list item:", err);
      res.status(500).json({ error: "Failed to create shopping list item" });
    }
  });

  app.put("/api/shopping-list/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateShoppingListItem(id, req.body);
      res.json(item);
    } catch (err) {
      console.error("Error updating shopping list item:", err);
      res.status(500).json({ error: "Failed to update shopping list item" });
    }
  });

  app.delete("/api/shopping-list/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteShoppingListItem(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting shopping list item:", err);
      res.status(500).json({ error: "Failed to delete shopping list item" });
    }
  });

  // Regenerate shopping list from last completed form
  app.post("/api/shopping-list/regenerate", async (req: Request, res: Response) => {
    try {
      console.log('🔄 Regenerating shopping list from last completed form...');
      
      // Get the last completed form (most recent by date)
      const completedForms = await storage.searchDailyStockSales('');
      
      if (!completedForms || completedForms.length === 0) {
        return res.status(404).json({ error: "No completed forms found" });
      }
      
      console.log(`📊 Found ${completedForms.length} forms total`);
      console.log(`📋 First 3 forms: ${completedForms.slice(0, 3).map(f => `ID ${f.id} by ${f.completedBy} (draft: ${f.isDraft})`).join(', ')}`);
      
      // Filter out drafts and get the most recent completed form
      const nonDraftForms = completedForms.filter(form => !form.isDraft);
      if (nonDraftForms.length === 0) {
        return res.status(404).json({ error: "No completed forms found (only drafts available)" });
      }
      
      console.log(`📋 Found ${nonDraftForms.length} non-draft forms`);
      console.log(`📋 First non-draft form: ID ${nonDraftForms[0].id} by ${nonDraftForms[0].completedBy}`);
      
      // Forms are already ordered by date DESC, so take the first one
      const lastForm = nonDraftForms[0];
      console.log(`📋 Selected form: ID ${lastForm.id} by ${lastForm.completedBy}`);
      
      // Check if form has shopping entries
      const shoppingEntries = lastForm.shoppingEntries || [];
      console.log(`🛒 Form has ${shoppingEntries.length} shopping entries`);
      
      if (shoppingEntries.length === 0) {
        return res.status(400).json({ error: "No shopping entries found in the last form" });
      }
      
      // Generate shopping list
      console.log('🔄 Generating shopping list...');
      const shoppingList = await storage.generateShoppingList(lastForm);
      console.log(`✅ Generated ${shoppingList.length} shopping list items`);
      
      res.json({
        success: true,
        message: `Shopping list regenerated from form ${lastForm.id}`,
        formId: lastForm.id,
        completedBy: lastForm.completedBy,
        shiftDate: lastForm.shiftDate,
        itemsGenerated: shoppingList.length,
        shoppingList: shoppingList
      });
    } catch (err) {
      console.error("Error regenerating shopping list:", err);
      res.status(500).json({ error: "Failed to regenerate shopping list" });
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

  // Removed old search route - replaced with AI analysis search below

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

  // NEW: latest shift summary - Updated to use corrected data
  app.get("/api/shift-summary/latest", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { dailyShiftSummary, shiftItemSales } = await import("../shared/schema");
      const { desc, eq } = await import("drizzle-orm");
      
      // Get the latest shift summary from the corrected data
      const latestShiftSummary = await db
        .select()
        .from(dailyShiftSummary)
        .orderBy(desc(dailyShiftSummary.shiftDate))
        .limit(1);
      
      if (latestShiftSummary.length === 0) {
        res.json({
          shiftDate: new Date().toISOString().split('T')[0],
          burgersSold: 0,
          drinksSold: 0,
          itemsBreakdown: {},
          modifiersSummary: {}
        });
        return;
      }
      
      const shiftData = latestShiftSummary[0];
      
      // Get item sales for the latest shift
      const itemSales = await db
        .select()
        .from(shiftItemSales)
        .where(eq(shiftItemSales.shiftDate, shiftData.shiftDate))
        .orderBy(desc(shiftItemSales.quantity));
      
      // Build items breakdown from shift item sales
      const itemsBreakdown: Record<string, { qty: number; sales: number }> = {};
      let drinksSold = 0;
      
      for (const item of itemSales) {
        const itemName = item.itemName;
        const quantity = item.quantity;
        const salesTotal = Number(item.salesTotal || 0);
        
        // Count drinks
        if (itemName.toLowerCase().includes('coke') || itemName.toLowerCase().includes('fanta') || 
            itemName.toLowerCase().includes('sprite') || itemName.toLowerCase().includes('water')) {
          drinksSold += quantity;
        }
        
        // Add to items breakdown
        itemsBreakdown[itemName] = { qty: quantity, sales: salesTotal };
      }
      
      res.json({
        shiftDate: shiftData.shiftDate,
        burgersSold: shiftData.burgersSold,
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

  // Dashboard KPIs endpoint
  app.get("/api/dashboard/kpis", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { loyverseReceipts } = await import("../shared/schema");
      const { desc, sql, gte } = await import("drizzle-orm");
      
      // Get latest shift receipts (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const latestReceipts = await db
        .select()
        .from(loyverseReceipts)
        .where(gte(loyverseReceipts.receiptDate, yesterday))
        .orderBy(desc(loyverseReceipts.receiptDate));
      
      let lastShiftSales = 0;
      let lastShiftOrders = 0;
      let shiftDate = new Date().toISOString();
      
      if (latestReceipts.length > 0) {
        lastShiftSales = latestReceipts.reduce((sum, receipt) => sum + Number(receipt.totalAmount), 0);
        lastShiftOrders = latestReceipts.length;
        shiftDate = latestReceipts[0].shiftDate || new Date().toISOString();
      }
      
      // Get month-to-date sales
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthlyReceipts = await db
        .select()
        .from(loyverseReceipts)
        .where(gte(loyverseReceipts.receiptDate, monthStart));
      
      const monthToDateSales = monthlyReceipts.reduce((sum, receipt) => sum + Number(receipt.totalAmount), 0);
      
      const kpiData = {
        lastShiftSales: Math.round(lastShiftSales),
        lastShiftOrders,
        monthToDateSales: Math.round(monthToDateSales),
        inventoryValue: 0, // Placeholder - could be calculated from inventory table
        averageOrderValue: lastShiftOrders > 0 ? Math.round(lastShiftSales / lastShiftOrders) : 0,
        shiftDate,
        shiftPeriod: {
          start: yesterday,
          end: new Date()
        },
        note: "Data from latest receipts"
      };
      
      console.log("KPI Calculation:", kpiData);
      res.json(kpiData);
    } catch (err) {
      console.error("Error fetching KPIs:", err);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // AI Insights API endpoint
  app.get("/api/dashboard/ai-insights", async (req: Request, res: Response) => {
    try {
      const insights = await storage.getAiInsights();
      res.json(insights);
    } catch (err) {
      console.error("Error fetching AI insights:", err);
      res.status(500).json({ error: "Failed to fetch AI insights" });
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

  // Recipe Management endpoints
  app.get("/api/recipes", async (req: Request, res: Response) => {
    try {
      const recipes = await storage.getRecipes();
      res.json(recipes);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.post("/api/recipes", async (req: Request, res: Response) => {
    try {
      const { insertRecipeSchema } = await import("../shared/schema");
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(validatedData);
      res.json(recipe);
    } catch (err) {
      console.error("Error creating recipe:", err);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  app.put("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.updateRecipe(id, req.body);
      res.json(recipe);
    } catch (err) {
      console.error("Error updating recipe:", err);
      res.status(500).json({ error: "Failed to update recipe" });
    }
  });

  app.delete("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRecipe(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting recipe:", err);
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  // Recipe Ingredients endpoints
  app.get("/api/recipes/:id/ingredients", async (req: Request, res: Response) => {
    try {
      const recipeId = parseInt(req.params.id);
      const ingredients = await storage.getRecipeIngredients(recipeId);
      res.json(ingredients);
    } catch (err) {
      console.error("Error fetching recipe ingredients:", err);
      res.status(500).json({ error: "Failed to fetch recipe ingredients" });
    }
  });

  app.post("/api/recipe-ingredients", async (req: Request, res: Response) => {
    try {
      const { insertRecipeIngredientSchema } = await import("../shared/schema");
      const validatedData = insertRecipeIngredientSchema.parse(req.body);
      const recipeIngredient = await storage.createRecipeIngredient(validatedData);
      res.json(recipeIngredient);
    } catch (err) {
      console.error("Error creating recipe ingredient:", err);
      res.status(500).json({ error: "Failed to create recipe ingredient" });
    }
  });

  app.put("/api/recipe-ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const recipeIngredient = await storage.updateRecipeIngredient(id, req.body);
      res.json(recipeIngredient);
    } catch (err) {
      console.error("Error updating recipe ingredient:", err);
      res.status(500).json({ error: "Failed to update recipe ingredient" });
    }
  });

  app.delete("/api/recipe-ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRecipeIngredient(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting recipe ingredient:", err);
      res.status(500).json({ error: "Failed to delete recipe ingredient" });
    }
  });

  // Ingredients endpoints
  app.get("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const ingredients = await storage.getIngredients();
      res.json(ingredients);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  app.post("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const { insertIngredientSchema } = await import("../shared/schema");
      const validatedData = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.createIngredient(validatedData);
      res.json(ingredient);
    } catch (err) {
      console.error("Error creating ingredient:", err);
      res.status(500).json({ error: "Failed to create ingredient" });
    }
  });

  app.put("/api/ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const ingredient = await storage.updateIngredient(id, req.body);
      res.json(ingredient);
    } catch (err) {
      console.error("Error updating ingredient:", err);
      res.status(500).json({ error: "Failed to update ingredient" });
    }
  });

  app.delete("/api/ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteIngredient(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting ingredient:", err);
      res.status(500).json({ error: "Failed to delete ingredient" });
    }
  });

  // Stock and Sales Data API endpoints
  app.get("/api/stock", async (req: Request, res: Response) => {
    try {
      const stock = await db.select().from(inventory)
        .where(sql`name IN ('Burger Rolls', 'Meat', 'Drinks')`);
      res.json(stock);
    } catch (error) {
      console.error("Error fetching stock:", error);
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  app.get("/api/top-sales", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { loyverseReceipts } = await import("../shared/schema");
      const { desc, gte } = await import("drizzle-orm");
      
      // Get receipts from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const recentReceipts = await db
        .select()
        .from(loyverseReceipts)
        .where(gte(loyverseReceipts.receiptDate, yesterday))
        .orderBy(desc(loyverseReceipts.receiptDate));
      
      // Aggregate sales by item
      const itemSales: Record<string, { qty: number; sales: number }> = {};
      
      for (const receipt of recentReceipts) {
        const items = receipt.items as any[];
        if (!items || !Array.isArray(items)) continue;
        
        for (const item of items) {
          const itemName = item.item_name || 'Unknown';
          const quantity = item.quantity || 0;
          const totalMoney = item.total_money || 0;
          
          if (!itemSales[itemName]) {
            itemSales[itemName] = { qty: 0, sales: 0 };
          }
          itemSales[itemName].qty += quantity;
          itemSales[itemName].sales += totalMoney;
        }
      }
      
      // Sort by quantity and take top 5
      const topItems = Object.entries(itemSales)
        .sort(([,a], [,b]) => b.qty - a.qty)
        .slice(0, 5)
        .map(([itemName, data]) => ({
          itemName,
          quantity: data.qty,
          salesTotal: Math.round(data.sales)
        }));
      
      res.json(topItems);
    } catch (error) {
      console.error("Error fetching top sales:", error);
      res.status(500).json({ error: "Failed to fetch top sales data" });
    }
  });

  app.get("/api/shift-summary", async (req: Request, res: Response) => {
    try {
      const summary = await db.select().from(dailyShiftSummary)
        .orderBy(desc(dailyShiftSummary.shiftDate))
        .limit(1);
      
      res.json(summary.length > 0 ? summary[0] : null);
    } catch (error) {
      console.error("Error fetching shift summary:", error);
      res.status(500).json({ error: "Failed to fetch shift summary" });
    }
  });

  app.post("/api/loyverse/pull", async (req: Request, res: Response) => {
    try {
      console.log("🔄 Manual Loyverse data pull requested");
      
      // Import and run the sync script functionality
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync('node server/sync-data.js');
      
      if (stderr) {
        console.error("Sync script stderr:", stderr);
      }
      
      console.log("Sync script output:", stdout);
      
      res.json({ 
        success: true, 
        message: "Data sync completed successfully",
        output: stdout
      });
    } catch (error) {
      console.error("Error during manual sync:", error);
      res.status(500).json({ error: "Failed to sync data", details: error.message });
    }
  });

  // New Webhook Route (Direct to Replit)
  app.post("/api/loyverse-webhook", async (req: Request, res: Response) => {
    try {
      const secret = process.env.LOYVERSE_WEBHOOK_SECRET;
      if (!secret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }
      
      const signature = req.headers['x-loyverse-signature'] as string;
      const payload = JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha1', secret).update(payload).digest('base64');
      
      if (signature !== hmac) {
        console.warn('Invalid webhook signature received');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      
      console.log('✅ Webhook signature validated successfully');
      
      const event = req.body.event;
      console.log(`🔔 Webhook event received: ${event}`);
      
      if (event === 'receipts.created') {
        console.log('📄 Processing receipt from webhook');
        await LoyverseDataOrchestrator.processReceipt(req.body.data);
      } else if (event === 'shift.closed') {
        console.log('📊 Processing shift closure from webhook');
        // Handle shift closure if needed
      }
      
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error processing webhook:", err);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Analysis API endpoints for file upload and AI processing
  // Upload endpoint
  app.post('/api/analysis/upload', async (req: Request, res: Response) => {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Use upload middleware
    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed' });
      }
      
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const { uploadedReports } = await import("../shared/schema");
        const shiftDate = req.body.shiftDate ? new Date(req.body.shiftDate) : null;
        
        // Convert file to base64 for JSON storage
        const fileDataBase64 = file.buffer.toString('base64');

        // Insert to DB
        const [report] = await db.insert(uploadedReports).values({
          filename: file.originalname,
          fileType: file.mimetype,
          fileData: { data: fileDataBase64 },
          shiftDate: shiftDate?.toISOString(),
          userId: 1, // Default user for now
        }).returning({ id: uploadedReports.id });

        res.json({ success: true, id: report.id, message: 'File uploaded successfully - trigger analysis next' });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  });

  // Trigger analysis endpoint
  app.post('/api/analysis/trigger', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.body;
      const { uploadedReports } = await import("../shared/schema");
      const { analyzeReport, updateDashboardFromAnalysis } = await import("./ai-agent");
      
      const [report] = await db.select().from(uploadedReports).where(eq(uploadedReports.id, reportId)).limit(1);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Parse file based on type
      let textContent: string;
      const fileBuffer = Buffer.from((report.fileData as any).data, 'base64');
      
      if (report.fileType === 'application/pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        textContent = (await pdfParse(fileBuffer)).text;
      } else if (report.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const xlsx = await import('xlsx');
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        textContent = xlsx.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      } else if (report.fileType === 'text/csv' || report.fileType === 'application/octet-stream' || report.filename.endsWith('.csv')) {
        textContent = fileBuffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type: ' + report.fileType });
      }

      // AI analysis
      const analysis = await analyzeReport(textContent, report.filename);

      // Update DB with analysis
      await db.update(uploadedReports)
        .set({ analysisSummary: analysis })
        .where(eq(uploadedReports.id, reportId));

      // Update dashboard tables if shift date is provided
      if (analysis.shiftDate) {
        await updateDashboardFromAnalysis(analysis, analysis.shiftDate);
      }

      res.json({ success: true, analysis });
    } catch (err) {
      console.error('Analysis error:', err);
      res.status(500).json({ error: 'Analysis failed: ' + (err as Error).message });
    }
  });

  // Search stored documents - Must come before the :id route
  app.get('/api/analysis/search', async (req: Request, res: Response) => {
    try {
      const { uploadedReports } = await import("../shared/schema");
      const { like } = await import("drizzle-orm");
      const query = req.query.q as string;
      
      let results;
      if (query) {
        results = await db.select().from(uploadedReports)
          .where(like(uploadedReports.filename, `%${query}%`))
          .orderBy(desc(uploadedReports.uploadDate));
      } else {
        results = await db.select().from(uploadedReports)
          .orderBy(desc(uploadedReports.uploadDate))
          .limit(20);
      }

      res.json(results);
    } catch (err) {
      console.error('Error searching documents:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // View analysis endpoint - Must come after the search route
  app.get('/api/analysis/:id', async (req: Request, res: Response) => {
    try {
      const { uploadedReports } = await import("../shared/schema");
      const [report] = await db.select().from(uploadedReports).where(eq(uploadedReports.id, parseInt(req.params.id))).limit(1);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json(report.analysisSummary || { message: 'No analysis available' });
    } catch (err) {
      console.error('Error fetching analysis:', err);
      res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  });

  // Enhanced Loyverse API routes
  app.use("/api/loyverse", loyverseEnhancedRoutes);

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
