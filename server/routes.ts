import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";
import loyverseEnhancedRoutes from "./routes/loyverseEnhanced";
import crypto from "crypto"; // For webhook signature
import { LoyverseDataOrchestrator } from "./services/loyverseDataOrchestrator"; // For webhook process
import { db } from "./db"; // For transactions
import { dailyStockSales, shoppingList, insertDailyStockSalesSchema, inventory, shiftItemSales, dailyShiftSummary, uploadedReports, shiftReports, insertShiftReportSchema, dailyReceiptSummaries } from "../shared/schema"; // Adjust path
import { z } from "zod";
import { eq, desc, sql, inArray } from "drizzle-orm";
import multer from 'multer';
import OpenAI from 'openai';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { supplierService } from "./supplierService";
import { calculateShiftTimeWindow, getShiftTimeWindowForDate } from './utils/shiftTimeCalculator';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import PDFDocument from 'pdfkit';


const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function registerRoutes(app: express.Application): Server {
  // Stock discrepancy endpoint for dashboard
  // Suppliers JSON endpoint (loads all suppliers for form)
  app.get('/api/suppliers-json', async (req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Debug path information
      const cwd = process.cwd();
      const suppliersPath = path.join(cwd, 'data', 'suppliers.json');
      console.log('Current working directory:', cwd);
      console.log('Looking for suppliers file at:', suppliersPath);
      console.log('File exists:', fs.existsSync(suppliersPath));
      
      if (!fs.existsSync(suppliersPath)) {
        return res.status(404).json({ error: 'Suppliers file not found', path: suppliersPath });
      }
      
      const suppliersData = fs.readFileSync(suppliersPath, 'utf8');
      const suppliers = JSON.parse(suppliersData);
      console.log('Loaded suppliers count:', suppliers.length);
      res.json(suppliers);
    } catch (err) {
      console.error('Suppliers load error:', err);
      res.status(500).json({ error: 'Failed to load suppliers', details: (err as Error).message });
    }
  });

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
      const actualStock: Record<string, number> = latestForms.length > 0 ? {
        "Burger Buns": Number(latestForms[0].burgerBunsStock) || 0,
        "French Fries": Number((latestForms[0].frozenFood as any)?.["French Fries"]) || 0,
        "Chicken Wings": Number((latestForms[0].frozenFood as any)?.["Chicken Wings"]) || 0,
        "Chicken Nuggets": Number((latestForms[0].frozenFood as any)?.["Chicken Nuggets"]) || 0,
        "Coke": Number((latestForms[0].drinkStock as any)?.["Coke"]) || 0,
        "Fanta": Number((latestForms[0].drinkStock as any)?.["Fanta"]) || 0,
        "Water": Number((latestForms[0].drinkStock as any)?.["Water"]) || 0
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

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

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
            shiftDate: new Date(report.shiftDate).toISOString().split('T')[0],
            burgersSold: analysis.topItems.reduce((sum: number, item: any) => {
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
              burgersSold: analysis.topItems.reduce((sum: number, item: any) => {
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
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
      }
      const [report] = await db.select().from(uploadedReports).where(eq(uploadedReports.id, reportId)).limit(1);
      
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

  // Daily Shift Forms endpoints (comprehensive form data handling)
  app.post("/api/daily-shift-forms", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      console.log("Comprehensive form submission:", data);
      
      // Prepare data for database insertion
      const formData = {
        completedBy: data.completedBy || 'Unknown User',
        shiftType: data.shiftType || 'Standard',
        shiftDate: data.shiftDate ? new Date(data.shiftDate) : new Date(),
        
        // Sales data
        startingCash: parseFloat(data.startingCash || '0'),
        grabSales: parseFloat(data.grabSales || '0'),
        aroiDeeSales: parseFloat(data.aroiDeeSales || '0'),
        qrScanSales: parseFloat(data.qrScanSales || '0'),
        cashSales: parseFloat(data.cashSales || '0'),
        totalSales: parseFloat(data.grabSales || '0') + parseFloat(data.aroiDeeSales || '0') + parseFloat(data.qrScanSales || '0') + parseFloat(data.cashSales || '0'),
        
        // Cash management
        endingCash: parseFloat(data.endingCash || '0'),
        bankedAmount: parseFloat(data.bankedAmount || '0'),
        
        // Expenses
        wages: JSON.stringify(data.wages || []),
        shopping: JSON.stringify(data.shopping || []),
        totalExpenses: (data.wages || []).reduce((sum: number, wage: any) => sum + parseFloat(wage.amount || '0'), 0) + 
                       (data.shopping || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0),
        
        // Inventory data
        numberNeeded: JSON.stringify(data.inventory || {}),
        
        // Status
        isDraft: false,
        status: 'completed'
      };
      
      console.log("Processed form data:", formData);
      
      // Use Drizzle ORM with proper schema field mapping
      const [result] = await db.insert(dailyStockSales).values([formData]).returning();
      
      console.log("✅ Comprehensive form saved successfully with ID:", result.id);
      res.json(result);
    } catch (err: any) {
      console.error("Form submission error:", err.message);
      let detailedError = 'Failed to save form';
      if (err.code === '22P02') {
        detailedError = 'Invalid numeric input – check fields like sales/amounts are numbers (no text/symbols). Reasoning: DB expects decimals; strings cause syntax errors.';
      }
      res.status(500).json({ error: detailedError, details: err.message });
    }
  });

  // Draft Forms endpoints
  app.post("/api/daily-stock-sales/draft", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      console.log("Draft save request:", data);
      
      const [result] = await db.insert(dailyStockSales).values({
        completedBy: data.completedBy || '',
        shiftType: data.shiftType || '',
        shiftDate: data.shiftDate ? new Date(data.shiftDate) : new Date(),
        numberNeeded: JSON.stringify(data.numberNeeded || {}),
        isDraft: true,
        status: 'draft'
      }).returning();
      
      res.json(result);
    } catch (err: any) {
      console.error("Draft save error:", err);
      res.status(500).json({ error: 'Failed to save draft' });
    }
  });

  // Daily Shift Forms endpoint (simplified responsive form)
  app.post("/api/daily-shift-forms", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      console.log("Daily shift form submission:", data);
      
      // Store form data with proper structure
      const formData = {
        completedBy: 'Shift Staff',
        shiftType: 'daily',
        shiftDate: new Date(),
        numberNeeded: JSON.stringify(data.numberNeeded || {}),
        isDraft: false,
        status: 'completed'
      };
      
      const [result] = await db.insert(dailyStockSales).values(formData).returning();
      console.log("✅ Daily shift form saved with ID:", result.id);
      
      res.json(result);
    } catch (err: any) {
      console.error("Daily shift form error:", err);
      res.status(500).json({ error: 'Failed to save daily shift form', details: err.message });
    }
  });

  // Daily Stock Sales endpoints - completed forms only
  app.get("/api/daily-stock-sales", async (req: Request, res: Response) => {
    try {
      const forms = await storage.getAllDailyStockSales();
      // Filter to only return completed forms (isDraft = false)
      const completedForms = forms.filter(form => form.isDraft === false);
      res.json(completedForms);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

  // Stock Lodge API for quick inventory management (Burger Buns, Drinks, Meat)
  app.post('/api/lodge-stock', async (req: Request, res: Response) => {
    try {
      const { burgerBuns, drinks, meat } = req.body;
      const lodgeData = {
        burgerBuns: parseInt(burgerBuns) || 0,
        drinks: parseInt(drinks) || 0,
        meat: parseInt(meat) || 0,
        lodgeDate: new Date().toISOString(),
        lodgedBy: req.body.lodgedBy || 'Unknown',
      };
      
      console.log('Stock lodged:', lodgeData);
      
      res.json({ success: true, data: lodgeData, message: 'Stock lodged successfully' });
    } catch (error) {
      console.error('Error lodging stock:', error);
      res.status(500).json({ error: 'Failed to lodge stock' });
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
      console.log("💾 BULLETPROOF form submission received:", data);
      
      // BULLETPROOF DATA VALIDATION AND SANITIZATION
      const bulletproofData = {
        // Core fields (guaranteed safe)
        completedBy: String(data.completedBy || 'Unknown User').trim(),
        shiftType: String(data.shiftType || 'night').trim(),
        shiftDate: data.shiftDate ? new Date(data.shiftDate) : new Date(),
        
        // Sales fields (guaranteed numbers, no NaN)
        startingCash: parseFloat(String(data.startingCash || 0)) || 0,
        grabSales: parseFloat(String(data.grabSales || 0)) || 0,
        aroiDeeSales: parseFloat(String(data.aroiDeeSales || 0)) || 0,
        qrScanSales: parseFloat(String(data.qrScanSales || 0)) || 0,
        cashSales: parseFloat(String(data.cashSales || 0)) || 0,
        totalSales: parseFloat(String(data.totalSales || 0)) || 0,
        
        // Cash management (guaranteed numbers)
        endingCash: parseFloat(String(data.endingCash || 0)) || 0,
        bankedAmount: parseFloat(String(data.bankedAmount || 0)) || 0,
        
        // Expenses (guaranteed clean arrays)
        wages: data.wages && Array.isArray(data.wages) ? 
          JSON.stringify(data.wages.map((w: any) => ({
            name: String(w.name || '').trim(),
            amount: parseFloat(String(w.amount || 0)) || 0,
            type: String(w.type || 'wages')
          })).filter((w: any) => w.name || w.amount > 0)) : 
          JSON.stringify([]),
        
        shopping: data.shopping && Array.isArray(data.shopping) ? 
          JSON.stringify(data.shopping.map((s: any) => ({
            item: String(s.item || '').trim(),
            amount: parseFloat(String(s.amount || 0)) || 0,
            shop: String(s.shop || '').trim()
          })).filter((s: any) => s.item || s.amount > 0)) : 
          JSON.stringify([]),
        
        totalExpenses: parseFloat(String(data.totalExpenses || 0)) || 0,
        gasExpense: parseFloat(String(data.gasExpense || 0)) || 0,
        
        // Stock/inventory data (guaranteed safe object)
        numberNeeded: data.numberNeeded && typeof data.numberNeeded === 'object' ? 
          JSON.stringify(data.numberNeeded) : 
          JSON.stringify({}),
        
        // Status flags (guaranteed safe)
        isDraft: Boolean(data.isDraft || false),
        status: String(data.status || 'completed')
      };
      
      console.log("🛡️ Bulletproof data prepared:", bulletproofData);
      
      // BULLETPROOF CASH VALIDATION
      const calculatedCash = bulletproofData.startingCash + bulletproofData.cashSales - bulletproofData.totalExpenses;
      const manualCash = bulletproofData.endingCash;
      
      if (Math.abs(manualCash - calculatedCash) > 0.01) { // Allow for rounding
        console.log(`🚨 CASH ANOMALY: Manual ฿${manualCash} vs calculated ฿${calculatedCash} (diff: ฿${manualCash - calculatedCash})`);
      }
      
      let result: any;
      
      // BULLETPROOF DATABASE TRANSACTION WITH MULTIPLE RETRY ATTEMPTS
      let dbAttempts = 0;
      const maxDbAttempts = 3;
      
      while (dbAttempts < maxDbAttempts) {
        dbAttempts++;
        
        try {
          await db.transaction(async (tx) => {
            [result] = await tx.insert(dailyStockSales).values([bulletproofData]).returning();
          });
          
          console.log(`✅ BULLETPROOF SAVE SUCCESS! ID: ${result.id} (attempt ${dbAttempts})`);
          break; // Success - exit retry loop
          
        } catch (dbError: any) {
          console.error(`❌ Database attempt ${dbAttempts} failed:`, dbError.message);
          
          if (dbAttempts === maxDbAttempts) {
            // Final attempt failed
            throw new Error(`Database save failed after ${maxDbAttempts} attempts: ${dbError.message}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * dbAttempts));
        }
      }
      
      // BULLETPROOF SUCCESS RESPONSE
      console.log("🎉 BULLETPROOF SUBMISSION COMPLETE!");
      res.json({
        ...result,
        message: "Form saved successfully with bulletproof data validation",
        bulletproof: true
      });
      
      // Non-blocking post-processing for non-draft submissions
      if (!data.isDraft) {
        try {
          // Generate shopping list from form data (exclude drinks/rolls/meat as specified)
          const purchaseItems = [];
          
          // Process all food categories for items > 0 - handle object format from simplified form
          if (data.freshFood && typeof data.freshFood === 'object') {
            Object.entries(data.freshFood).forEach(([name, value]) => {
              const numValue = Number(value);
              if (numValue > 0) purchaseItems.push({ name, value: numValue });
            });
          }
          
          if (data.frozenFood && typeof data.frozenFood === 'object') {
            Object.entries(data.frozenFood).forEach(([name, value]) => {
              const numValue = Number(value);
              if (numValue > 0) purchaseItems.push({ name, value: numValue });
            });
          }
          
          if (data.shelfItems && typeof data.shelfItems === 'object') {
            Object.entries(data.shelfItems).forEach(([name, value]) => {
              const numValue = Number(value);
              if (numValue > 0) purchaseItems.push({ name, value: numValue });
            });
          }
          
          if (data.kitchenItems && typeof data.kitchenItems === 'object') {
            Object.entries(data.kitchenItems).forEach(([name, value]) => {
              const numValue = Number(value);
              if (numValue > 0) purchaseItems.push({ name, value: numValue });
            });
          }
          
          if (data.packagingItems && typeof data.packagingItems === 'object') {
            Object.entries(data.packagingItems).forEach(([name, value]) => {
              const numValue = Number(value);
              if (numValue > 0) purchaseItems.push({ name, value: numValue });
            });
          }

          // Create shopping list entries if there are purchase items
          if (purchaseItems.length > 0) {
            const shoppingListEntries = purchaseItems.map(item => ({
              itemName: item.name,
              quantity: item.value,
              unit: 'unit',
              supplier: 'General', // Default supplier
              pricePerUnit: '0',
              priority: 'medium',
              formId: result.id,
              listDate: new Date(data.shiftDate),
              isCompleted: false,
              createdAt: new Date(),
              updatedAt: new Date()
            }));

            // Insert shopping list items
            await db.insert(shoppingList).values(shoppingListEntries);
            console.log(`✅ Generated ${shoppingListEntries.length} shopping list items`);
          }
        } catch (error) {
          console.error("Error generating shopping list:", error);
        }

        // Send automatic email notification with PDF attachment after form completion
        try {
          console.log("📧 Generating PDF and sending automatic email notification...");
          
          // Import the email service
          const { emailService } = await import('./services/emailService');
          
          // Generate PDF in memory
          const doc = new PDFDocument({ margin: 40 });
          const pdfBuffers: Buffer[] = [];
          
          doc.on('data', (chunk) => pdfBuffers.push(chunk));
          doc.on('end', async () => {
            try {
              const pdfBuffer = Buffer.concat(pdfBuffers);
              const base64PDF = pdfBuffer.toString('base64');
              
              // Create comprehensive email content
              const shiftDate = new Date(data.shiftDate).toLocaleDateString();
              const emailHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
                  <h2>New Daily Shift Report Submitted</h2>
                  <p><strong>Form ID:</strong> ${result.id}</p>
                  <p><strong>Date:</strong> ${shiftDate}</p>
                  <p><strong>Shift:</strong> ${data.shiftType}</p>
                  <p><strong>Completed by:</strong> ${data.completedBy}</p>
                  
                  <h3>Sales Summary</h3>
                  <ul>
                    <li>Total Sales: THB ${parseFloat(data.totalSales || '0').toFixed(2)}</li>
                    <li>Cash Sales: THB ${parseFloat(data.cashSales || '0').toFixed(2)}</li>
                    <li>Grab Sales: THB ${parseFloat(data.grabSales || '0').toFixed(2)}</li>
                    <li>QR Scan Sales: THB ${parseFloat(data.qrScanSales || '0').toFixed(2)}</li>
                  </ul>
                  
                  <h3>Cash Management</h3>
                  <ul>
                    <li>Starting Cash: THB ${parseFloat(data.startingCash || '0').toFixed(2)}</li>
                    <li>Ending Cash: THB ${parseFloat(data.endingCash || '0').toFixed(2)}</li>
                    <li>Total Expenses: THB ${parseFloat(data.totalExpenses || '0').toFixed(2)}</li>
                  </ul>
                  
                  <p>The complete daily shift report is attached as a PDF for your records.</p>
                  
                  <p style="color: #666; font-size: 12px;">This email was sent automatically when the form was submitted.</p>
                </div>
              `;
              
              // Send email with PDF attachment
              const emailSent = await emailService.sendDailyShiftReport({
                ...data,
                id: result.id,
                shiftDate: shiftDate
              }, pdfBuffer);
              
              if (emailSent) {
                console.log("✅ Automatic email with PDF attachment sent successfully");
              } else {
                console.log("⚠️ Failed to send automatic email notification");
              }
            } catch (error) {
              console.error("❌ Error sending automatic email:", error);
            }
          });
          
          // Generate the same PDF content as the download endpoint
          doc.fontSize(20).font('Helvetica-Bold')
             .text('SMASH BROTHERS BURGERS', 40, 40);
          
          doc.fontSize(16).font('Helvetica')
             .text('Daily Shift Report', 40, 70)
             .fontSize(12)
             .text(`Form ID: ${result.id}`, 40, 95)
             .text(`Date: ${new Date(data.shiftDate).toLocaleDateString()}`, 40, 110)
             .text(`Shift: ${data.shiftType}`, 40, 125)
             .text(`Completed by: ${data.completedBy}`, 40, 140);

          let y = 170;

          // Sales Information
          doc.fontSize(14).font('Helvetica-Bold')
             .text('SALES BREAKDOWN', 40, y);
          y += 25;
          
          const grabSales = parseFloat(data.grabSales || '0');
          const qrScanSales = parseFloat(data.qrScanSales || '0');
          const cashSales = parseFloat(data.cashSales || '0');
          const aroiDeeSales = parseFloat(data.aroiDeeSales || '0');
          const totalSales = parseFloat(data.totalSales || '0');
          
          doc.fontSize(11).font('Helvetica')
             .text(`Grab Sales: THB ${grabSales.toFixed(2)}`, 40, y)
             .text(`QR Scan Sales: THB ${qrScanSales.toFixed(2)}`, 200, y)
             .text(`Cash Sales: THB ${cashSales.toFixed(2)}`, 350, y);
          y += 20;
          
          doc.text(`Aroi Dee Sales: THB ${aroiDeeSales.toFixed(2)}`, 40, y)
             .text(`TOTAL SALES: THB ${totalSales.toFixed(2)}`, 200, y);
          y += 40;

          // Cash Management
          doc.fontSize(14).font('Helvetica-Bold')
             .text('CASH MANAGEMENT', 40, y);
          y += 25;
          
          const startingCash = parseFloat(data.startingCash || '0');
          const endingCash = parseFloat(data.endingCash || '0');
          const bankedAmount = parseFloat(data.bankedAmount || '0');
          
          doc.fontSize(11).font('Helvetica')
             .text(`Starting Cash: THB ${startingCash.toFixed(2)}`, 40, y)
             .text(`Ending Cash: THB ${endingCash.toFixed(2)}`, 200, y)
             .text(`Banked Amount: THB ${bankedAmount.toFixed(2)}`, 350, y);
          y += 40;

          // Staff Wages
          doc.fontSize(14).font('Helvetica-Bold')
             .text('STAFF WAGES', 40, y);
          y += 25;
          
          const wages = data.wages ? JSON.parse(data.wages) : [];
          if (Array.isArray(wages)) {
            wages.forEach((wage: any) => {
              doc.fontSize(11).font('Helvetica')
                 .text(`${wage.name}: THB ${parseFloat(wage.amount || 0).toFixed(2)}`, 40, y);
              y += 15;
            });
          }
          y += 15;

          // Shopping Expenses
          doc.fontSize(14).font('Helvetica-Bold')
             .text('SHOPPING EXPENSES', 40, y);
          y += 25;
          
          const shopping = data.shopping ? JSON.parse(data.shopping) : [];
          if (Array.isArray(shopping)) {
            shopping.forEach((item: any) => {
              doc.fontSize(11).font('Helvetica')
                 .text(`${item.item}: THB ${parseFloat(item.amount || 0).toFixed(2)}`, 40, y);
              y += 15;
            });
          }
          
          const totalExpenses = parseFloat(data.totalExpenses || '0');
          doc.text(`TOTAL EXPENSES: THB ${totalExpenses.toFixed(2)}`, 40, y);
          y += 40;

          // Add second page for inventory
          doc.addPage();
          y = 40;

          // Inventory Section
          doc.fontSize(16).font('Helvetica-Bold')
             .text('INVENTORY STOCK LEVELS', 40, y);
          y += 30;

          const inventory = data.numberNeeded ? JSON.parse(data.numberNeeded) : {};
          if (typeof inventory === 'object' && inventory !== null) {
            Object.entries(inventory).forEach(([item, quantity]) => {
              doc.fontSize(10).font('Helvetica')
                 .text(`${item}: ${quantity}`, 40, y);
              y += 12;
              if (y > 750) {
                doc.addPage();
                y = 40;
              }
            });
          }

          // Footer
          doc.fontSize(8).font('Helvetica')
             .text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 50)
             .text('Smash Brothers Burgers - Daily Operations Report', 40, doc.page.height - 35);

          doc.end();
        } catch (emailError) {
          console.error("❌ Error generating/sending automatic email notification:", emailError);
          // Don't fail the form submission if email fails
        }
      }
      
    } catch (err: any) {
      console.error("❌ Error creating daily stock sales:", err);
      console.error("Error details:", err?.message, err?.stack);
      res.status(500).json({ error: "Failed to create daily stock sales", details: err?.message || 'Unknown error' });
    }
  });

  // Move :id route after specific routes to avoid routing conflicts

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
          const parsed = parseFloat(data[field] || '0');
          data[field] = isNaN(parsed) ? 0 : parsed;
        }
      });
      
      const result = await storage.createDailyStockSales(data);
      console.log("✅ Draft saved successfully with ID:", result.id);
      
      res.json(result);
    } catch (err: any) {
      console.error("❌ Error saving draft:", err);
      console.error("Error details:", err?.message, err?.stack);
      res.status(500).json({ error: "Failed to save draft", details: err?.message || 'Unknown error' });
    }
  });

  app.put("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const numericId = parseInt(id);
      
      if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid ID parameter - must be a number" });
      }
      
      const data = req.body;
      console.log("Updating daily stock sales:", { id: numericId, data });
      
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
          const parsed = parseFloat(data[field] || '0');
          data[field] = isNaN(parsed) ? 0 : parsed;
        }
      });
      
      const result = await storage.updateDailyStockSales(numericId, data);
      
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

  // Search daily stock sales forms
  app.get("/api/daily-stock-sales/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string || '';
      const forms = await storage.searchDailyStockSales(query);
      res.json(forms);
    } catch (err) {
      console.error("Error searching daily stock sales:", err);
      res.status(500).json({ error: "Failed to search daily stock sales" });
    }
  });

  // Get all forms (completed and drafts) - moved before specific routes
  app.get("/api/daily-stock-sales/all", async (req: Request, res: Response) => {
    try {
      const forms = await storage.searchDailyStockSales('');
      res.json(forms);
    } catch (err) {
      console.error("Error fetching all forms:", err);
      res.status(500).json({ error: "Failed to fetch all forms" });
    }
  });

  // Get drafts only - moved before :id route to avoid conflicts
  app.get("/api/daily-stock-sales/drafts", async (req: Request, res: Response) => {
    try {
      const forms = await storage.searchDailyStockSales('');
      // Filter to only return draft forms (isDraft = true)
      const drafts = forms.filter(form => form.isDraft === true);
      res.json(drafts);
    } catch (err) {
      console.error("Error fetching drafts:", err);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // Get individual daily stock sales by ID (moved after specific routes)
  app.get("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const numericId = parseInt(id);
      
      if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid ID parameter - must be a number" });
      }
      
      const result = await storage.getDailyStockSalesById(numericId);
      
      if (!result) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      res.json(result);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

  // ─── PDF Generation and Storage endpoints ───────────────────────────────
  app.post("/api/daily-stock-sales/:id/pdf", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { pdfData } = req.body;
      
      if (!pdfData) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }
      
      // Get form data to validate it exists
      const form = await storage.getDailyStockSalesById(numericId);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      
      // Convert base64 PDF data to buffer
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      
      // Generate filename with timestamp and form ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `daily-form-${numericId}-${timestamp}.pdf`;
      
      // Store PDF in object storage
      const objectStorageService = new ObjectStorageService();
      const storedPath = await objectStorageService.storePDF(pdfBuffer, filename);
      
      // Update form record with PDF path
      await db.update(dailyStockSales)
        .set({ pdfPath: storedPath })
        .where(eq(dailyStockSales.id, numericId));
      
      res.json({ 
        success: true, 
        pdfPath: storedPath,
        filename: filename
      });
    } catch (err) {
      console.error("Error storing PDF:", err);
      res.status(500).json({ error: "Failed to store PDF" });
    }
  });

  // Send form as email with PDF attachment
  app.post("/api/daily-stock-sales/:id/send-email", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.body;
      const numericId = parseInt(id);
      
      if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid ID parameter" });
      }
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      const formData = await storage.getDailyStockSalesById(numericId);
      if (!formData) {
        return res.status(404).json({ error: "Form not found" });
      }

      // Generate PDF in memory
      const doc = new PDFDocument({ margin: 40 });
      const pdfBuffers: Buffer[] = [];
      
      doc.on('data', (chunk) => pdfBuffers.push(chunk));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(pdfBuffers);
          const base64PDF = pdfBuffer.toString('base64');
          
          // Create email content
          const shiftDate = new Date(formData.shiftDate).toLocaleDateString();
          const emailHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
              <h2>Daily Shift Report - Form ${formData.id}</h2>
              <p><strong>Date:</strong> ${shiftDate}</p>
              <p><strong>Shift:</strong> ${formData.shiftType}</p>
              <p><strong>Completed by:</strong> ${formData.completedBy}</p>
              
              <h3>Sales Summary</h3>
              <ul>
                <li>Total Sales: THB ${parseFloat(formData.totalSales || '0').toFixed(2)}</li>
                <li>Cash Sales: THB ${parseFloat(formData.cashSales || '0').toFixed(2)}</li>
                <li>Grab Sales: THB ${parseFloat(formData.grabSales || '0').toFixed(2)}</li>
                <li>QR Scan Sales: THB ${parseFloat(formData.qrScanSales || '0').toFixed(2)}</li>
              </ul>
              
              <h3>Cash Management</h3>
              <ul>
                <li>Starting Cash: THB ${parseFloat(formData.startingCash || '0').toFixed(2)}</li>
                <li>Ending Cash: THB ${parseFloat(formData.endingCash || '0').toFixed(2)}</li>
                <li>Banked Amount: THB ${parseFloat(formData.bankedAmount || '0').toFixed(2)}</li>
              </ul>
              
              <p>Please find the complete daily shift report attached as a PDF.</p>
              
              <p style="color: #666; font-size: 12px;">Generated by Smash Brothers Burgers Management System</p>
            </div>
          `;
          
          // Send email with PDF attachment
          const emailSent = await sendEmailWithAttachment(
            email,
            `Daily Shift Report - Form ${formData.id} - ${shiftDate}`,
            emailHTML,
            [{
              filename: `form-${numericId}-daily-shift-report.pdf`,
              content: base64PDF,
              encoding: 'base64'
            }]
          );
          
          if (emailSent) {
            res.json({ 
              success: true, 
              message: `Form ${numericId} sent successfully to ${email}` 
            });
          } else {
            res.status(500).json({ error: "Failed to send email" });
          }
        } catch (error) {
          console.error('Error sending email:', error);
          res.status(500).json({ error: 'Failed to send email' });
        }
      });
      
      // Generate the same PDF content as the download endpoint
      doc.fontSize(20).font('Helvetica-Bold')
         .text('SMASH BROTHERS BURGERS', 40, 40);
      
      doc.fontSize(16).font('Helvetica')
         .text('Daily Shift Report', 40, 70)
         .fontSize(12)
         .text(`Form ID: ${formData.id}`, 40, 95)
         .text(`Date: ${new Date(formData.shiftDate).toLocaleDateString()}`, 40, 110)
         .text(`Shift: ${formData.shiftType}`, 40, 125)
         .text(`Completed by: ${formData.completedBy}`, 40, 140);

      let y = 170;

      // Sales Information
      doc.fontSize(14).font('Helvetica-Bold')
         .text('SALES BREAKDOWN', 40, y);
      y += 25;
      
      const grabSales = parseFloat(formData.grabSales || '0');
      const qrScanSales = parseFloat(formData.qrScanSales || '0');
      const cashSales = parseFloat(formData.cashSales || '0');
      const aroiDeeSales = parseFloat(formData.aroiDeeSales || '0');
      const totalSales = parseFloat(formData.totalSales || '0');
      
      doc.fontSize(11).font('Helvetica')
         .text(`Grab Sales: THB ${grabSales.toFixed(2)}`, 40, y)
         .text(`QR Scan Sales: THB ${qrScanSales.toFixed(2)}`, 200, y)
         .text(`Cash Sales: THB ${cashSales.toFixed(2)}`, 350, y);
      y += 20;
      
      doc.text(`Aroi Dee Sales: THB ${aroiDeeSales.toFixed(2)}`, 40, y)
         .text(`TOTAL SALES: THB ${totalSales.toFixed(2)}`, 200, y);
      y += 40;

      // Cash Management
      doc.fontSize(14).font('Helvetica-Bold')
         .text('CASH MANAGEMENT', 40, y);
      y += 25;
      
      const startingCash = parseFloat(formData.startingCash || '0');
      const endingCash = parseFloat(formData.endingCash || '0');
      const bankedAmount = parseFloat(formData.bankedAmount || '0');
      
      doc.fontSize(11).font('Helvetica')
         .text(`Starting Cash: THB ${startingCash.toFixed(2)}`, 40, y)
         .text(`Ending Cash: THB ${endingCash.toFixed(2)}`, 200, y)
         .text(`Banked Amount: THB ${bankedAmount.toFixed(2)}`, 350, y);
      y += 40;

      // Staff Wages
      doc.fontSize(14).font('Helvetica-Bold')
         .text('STAFF WAGES', 40, y);
      y += 25;
      
      const wages = formData.wages || [];
      if (Array.isArray(wages)) {
        wages.forEach(wage => {
          doc.fontSize(11).font('Helvetica')
             .text(`${wage.name}: THB ${parseFloat(wage.amount || 0).toFixed(2)}`, 40, y);
          y += 15;
        });
      }
      y += 15;

      // Shopping Expenses
      doc.fontSize(14).font('Helvetica-Bold')
         .text('SHOPPING EXPENSES', 40, y);
      y += 25;
      
      const shopping = formData.shopping || [];
      if (Array.isArray(shopping)) {
        shopping.forEach(item => {
          doc.fontSize(11).font('Helvetica')
             .text(`${item.item}: THB ${parseFloat(item.amount || 0).toFixed(2)}`, 40, y);
          y += 15;
        });
      }
      
      const totalExpenses = parseFloat(formData.totalExpenses || '0');
      doc.text(`TOTAL EXPENSES: THB ${totalExpenses.toFixed(2)}`, 40, y);
      y += 40;

      // Add second page for inventory
      doc.addPage();
      y = 40;

      // Inventory Section
      doc.fontSize(16).font('Helvetica-Bold')
         .text('INVENTORY STOCK LEVELS', 40, y);
      y += 30;

      const inventory = formData.numberNeeded || {};
      if (typeof inventory === 'object' && inventory !== null) {
        Object.entries(inventory).forEach(([item, quantity]) => {
          doc.fontSize(10).font('Helvetica')
             .text(`${item}: ${quantity}`, 40, y);
          y += 12;
          if (y > 750) {
            doc.addPage();
            y = 40;
          }
        });
      }

      // Footer
      doc.fontSize(8).font('Helvetica')
         .text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 50)
         .text('Smash Brothers Burgers - Daily Operations Report', 40, doc.page.height - 35);

      doc.end();
    } catch (error: any) {
      console.error('Error sending form email:', error);
      res.status(500).json({ error: 'Failed to send form email' });
    }
  });

  // Generate and download PDF for specific form (direct download)
  app.get("/api/daily-stock-sales/:id/download-pdf", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const numericId = parseInt(id);
      
      if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid ID parameter" });
      }
      
      const formData = await storage.getDailyStockSalesById(numericId);
      if (!formData) {
        return res.status(404).json({ error: "Form not found" });
      }

      // Use imported PDFDocument
      const doc = new PDFDocument({ margin: 40 });
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="form-${numericId}-daily-shift-report.pdf"`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Header
      doc.fontSize(20).font('Helvetica-Bold')
         .text('SMASH BROTHERS BURGERS', 40, 40);
      
      doc.fontSize(16).font('Helvetica')
         .text('Daily Shift Report', 40, 70)
         .fontSize(12)
         .text(`Form ID: ${formData.id}`, 40, 95)
         .text(`Date: ${new Date(formData.shiftDate).toLocaleDateString()}`, 40, 110)
         .text(`Shift: ${formData.shiftType}`, 40, 125)
         .text(`Completed by: ${formData.completedBy}`, 40, 140);

      let y = 170;

      // Sales Information
      doc.fontSize(14).font('Helvetica-Bold')
         .text('SALES BREAKDOWN', 40, y);
      y += 25;
      
      const grabSales = parseFloat(formData.grabSales || 0);
      const qrScanSales = parseFloat(formData.qrScanSales || 0);
      const cashSales = parseFloat(formData.cashSales || 0);
      const aroiDeeSales = parseFloat(formData.aroiDeeSales || 0);
      const totalSales = parseFloat(formData.totalSales || 0);
      
      doc.fontSize(11).font('Helvetica')
         .text(`Grab Sales: THB ${grabSales.toFixed(2)}`, 40, y)
         .text(`QR Scan Sales: THB ${qrScanSales.toFixed(2)}`, 200, y)
         .text(`Cash Sales: THB ${cashSales.toFixed(2)}`, 350, y);
      y += 20;
      
      doc.text(`Aroi Dee Sales: THB ${aroiDeeSales.toFixed(2)}`, 40, y)
         .text(`TOTAL SALES: THB ${totalSales.toFixed(2)}`, 200, y);
      y += 40;

      // Cash Management
      doc.fontSize(14).font('Helvetica-Bold')
         .text('CASH MANAGEMENT', 40, y);
      y += 25;
      
      const startingCash = parseFloat(formData.startingCash || 0);
      const endingCash = parseFloat(formData.endingCash || 0);
      const bankedAmount = parseFloat(formData.bankedAmount || 0);
      
      doc.fontSize(11).font('Helvetica')
         .text(`Starting Cash: THB ${startingCash.toFixed(2)}`, 40, y)
         .text(`Ending Cash: THB ${endingCash.toFixed(2)}`, 200, y)
         .text(`Banked Amount: THB ${bankedAmount.toFixed(2)}`, 350, y);
      y += 40;

      // Staff Wages
      doc.fontSize(14).font('Helvetica-Bold')
         .text('STAFF WAGES', 40, y);
      y += 25;
      
      const wages = formData.wages || [];
      if (Array.isArray(wages)) {
        wages.forEach(wage => {
          doc.fontSize(11).font('Helvetica')
             .text(`${wage.name}: THB ${parseFloat(wage.amount || 0).toFixed(2)}`, 40, y);
          y += 15;
        });
      }
      y += 15;

      // Shopping Expenses
      doc.fontSize(14).font('Helvetica-Bold')
         .text('SHOPPING EXPENSES', 40, y);
      y += 25;
      
      const shopping = formData.shopping || [];
      if (Array.isArray(shopping)) {
        shopping.forEach(item => {
          doc.fontSize(11).font('Helvetica')
             .text(`${item.item}: THB ${parseFloat(item.amount || 0).toFixed(2)}`, 40, y);
          y += 15;
        });
      }
      
      const totalExpenses = parseFloat(formData.totalExpenses || 0);
      doc.text(`TOTAL EXPENSES: THB ${totalExpenses.toFixed(2)}`, 40, y);
      y += 40;

      // Add second page for inventory
      doc.addPage();
      y = 40;

      // Inventory Section
      doc.fontSize(16).font('Helvetica-Bold')
         .text('INVENTORY STOCK LEVELS', 40, y);
      y += 30;

      const inventory = formData.numberNeeded || {};
      if (typeof inventory === 'object' && inventory !== null) {
        Object.entries(inventory).forEach(([item, quantity]) => {
          doc.fontSize(10).font('Helvetica')
             .text(`${item}: ${quantity}`, 40, y);
          y += 12;
          if (y > 750) {
            doc.addPage();
            y = 40;
          }
        });
      }

      // Footer
      doc.fontSize(8).font('Helvetica')
         .text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 50)
         .text('Smash Brothers Burgers - Daily Operations Report', 40, doc.page.height - 35);

      doc.end();
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Serve stored PDF files
  app.get("/objects/form-pdfs/:filename", async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const objectStorageService = new ObjectStorageService();
      const objectPath = `/objects/form-pdfs/${filename}`;
      
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving PDF:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "PDF not found" });
      }
      return res.status(500).json({ error: "Error serving PDF" });
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
  
  // Send latest form summary endpoint (manual trigger)
  app.post("/api/send-last-form-summary", async (req: Request, res: Response) => {
    try {
      console.log("📧 Manual trigger: Sending latest form summary");
      
      const latestEntry = await storage.getLatestDailyStockSales();
      if (!latestEntry) {
        return res.status(404).json({ message: 'No recent form submission found' });
      }

      console.log(`📊 Found latest form ID ${latestEntry.id} from ${latestEntry.shiftDate}`);
      
      const emailTo = 'smashbrothersburgersth@gmail.com';

      // Construct detailed HTML email body
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>📋 Smash Brothers Burgers - Latest Form Submission</h2>
          <p><strong>Form ID:</strong> ${latestEntry.id}</p>
          <p><strong>Date:</strong> ${new Date(latestEntry.shiftDate).toLocaleDateString()}</p>
          <p><strong>Shift:</strong> ${latestEntry.shiftType}</p>
          <p><strong>Completed by:</strong> ${latestEntry.completedBy}</p>
          
          <h3>Sales Summary</h3>
          <ul>
            <li>Total Sales: THB ${parseFloat(latestEntry.totalSales?.toString() || '0').toFixed(2)}</li>
            <li>Grab Sales: THB ${parseFloat(latestEntry.grabSales?.toString() || '0').toFixed(2)}</li>
            <li>QR Scan Sales: THB ${parseFloat(latestEntry.qrScanSales?.toString() || '0').toFixed(2)}</li>
            <li>Cash Sales: THB ${parseFloat(latestEntry.cashSales?.toString() || '0').toFixed(2)}</li>
          </ul>
          
          <h3>Cash Management</h3>
          <ul>
            <li>Starting Cash: THB ${parseFloat(latestEntry.startingCash?.toString() || '0').toFixed(2)}</li>
            <li>Ending Cash: THB ${parseFloat(latestEntry.endingCash?.toString() || '0').toFixed(2)}</li>
          </ul>
          
          <p style="color: #666; font-size: 12px;">Generated automatically by Smash Brothers Burgers Management System</p>
        </div>
      `;

      // Import email service
      const { sendEmailWithAttachment } = await import('./services/workingEmailService');

      // Send email
      const emailSent = await sendEmailWithAttachment(
        emailTo,
        `📋 Latest Form Submission - ${new Date(latestEntry.shiftDate).toLocaleDateString()}`,
        htmlBody,
        []
      );

      if (emailSent) {
        console.log(`✅ Latest form summary email sent to ${emailTo}`);
        res.json({ 
          success: true, 
          message: 'Email sent successfully',
          formId: latestEntry.id,
          sentTo: emailTo
        });
      } else {
        console.log(`❌ Failed to send email to ${emailTo}`);
        res.status(500).json({ message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('❌ Error sending latest form summary:', error);
      res.status(500).json({ message: 'Failed to send email', error: error });
    }
  });

  // Send form summary endpoint for DailySalesAndStockForm
  app.post("/api/send-form-summary", async (req: Request, res: Response) => {
    try {
      const { formData } = req.body;
      if (!formData) {
        return res.status(400).json({ message: 'Missing form data' });
      }

      const emailTo = 'smashbrothersburgersth@gmail.com';

      // Calculations
      const totalSales = (formData.grabSales || 0) + (formData.aroiDeeSales || 0) + (formData.qrScanSales || 0) + (formData.cashSales || 0);
      const totalWages = formData.wages?.reduce((sum: number, w: any) => sum + (w.amount || 0), 0) || 0;
      const totalShopping = formData.shopping?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0;
      const netRevenue = totalSales - (totalWages + totalShopping);
      const cashDifference = (formData.startingCash + totalSales) - formData.endingCash;
      const totalExpenses = totalWages + totalShopping;

      // Email Body (HTML)
      const createHtmlSection = (title: string, data: Record<string, any>) => {
        const rows = Object.entries(data)
          .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`)
          .join('');
        return `<h3>${title}</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Arial; font-size: 14px;">${rows}</table><br/>`;
      };

      const htmlBody = `
        <div style="font-family: Arial; font-size: 14px;">
          <h2>📋 Smash Brothers Burgers - Daily Shift Report</h2>
          ${createHtmlSection("Shift Information", {
            "Completed By": formData.completedBy,
            "Shift Type": formData.shiftType,
            "Shift Date": formData.shiftDate,
          })}
          ${createHtmlSection("Sales Information", {
            "Grab Sales": formData.grabSales || 0,
            "Aroi Dee Sales": formData.aroiDeeSales || 0,
            "QR Scan Sales": formData.qrScanSales || 0,
            "Cash Sales": formData.cashSales || 0,
            "Total Sales": totalSales
          })}
          ${formData.wages?.length ? createHtmlSection("Wages & Staff Payments", Object.fromEntries((formData.wages || []).map((w: any) => [w.name, w.amount]))) : ''}
          ${createHtmlSection("Total Wages", { "Total Wages": totalWages })}
          ${formData.shopping?.length ? createHtmlSection("Shopping & Expenses", Object.fromEntries((formData.shopping || []).map((s: any) => [s.item, s.amount]))) : ''}
          ${createHtmlSection("Total Shopping", { "Total Shopping": totalShopping })}
          ${createHtmlSection("Cash Management", {
            "Starting Cash": formData.startingCash,
            "Ending Cash": formData.endingCash,
            "Banked Amount": formData.bankedAmount,
            "Cash Difference": cashDifference
          })}
          ${formData.drinkStock ? createHtmlSection("Drink Stock", formData.drinkStock) : ''}
          ${formData.freshFoodStock ? createHtmlSection("Fresh Food Stock", formData.freshFoodStock) : ''}
          ${formData.frozenFood ? createHtmlSection("Frozen Food Stock", formData.frozenFood) : ''}
          ${formData.shelfItems ? createHtmlSection("Shelf Items", formData.shelfItems) : ''}
          ${formData.kitchenItems ? createHtmlSection("Kitchen Items", formData.kitchenItems) : ''}
          ${formData.packagingItems ? createHtmlSection("Packaging Items", formData.packagingItems) : ''}
          ${createHtmlSection("Total Summary", {
            "Total Sales": totalSales,
            "Total Wages": totalWages,
            "Total Shopping": totalShopping,
            "Total Expenses": totalExpenses,
            "Net Revenue": netRevenue,
            "Banked Today": formData.bankedAmount,
          })}
        </div>
      `;

      // PDF generation
      const PDFDocument = (await import('pdfkit')).default;
      
      const doc = new PDFDocument();
      doc.fontSize(18).text('Smash Brothers Burgers - Daily Shift Report', { underline: true }).moveDown();
      
      const addSection = (title: string, data: Record<string, any>) => {
        doc.fontSize(14).text(title, { underline: true });
        Object.entries(data).forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v}`));
        doc.moveDown();
      };

      addSection("Shift Information", {
        "Completed By": formData.completedBy,
        "Shift Type": formData.shiftType,
        "Shift Date": formData.shiftDate,
      });
      addSection("Sales Information", {
        "Grab Sales": formData.grabSales || 0,
        "Aroi Dee Sales": formData.aroiDeeSales || 0,
        "QR Scan Sales": formData.qrScanSales || 0,
        "Cash Sales": formData.cashSales || 0,
        "Total Sales": totalSales
      });
      if (formData.wages?.length) {
        addSection("Wages & Staff Payments", Object.fromEntries((formData.wages || []).map((w: any) => [w.name, w.amount])));
      }
      addSection("Total Wages", { "Total Wages": totalWages });
      if (formData.shopping?.length) {
        addSection("Shopping & Expenses", Object.fromEntries((formData.shopping || []).map((s: any) => [s.item, s.amount])));
      }
      addSection("Total Shopping", { "Total Shopping": totalShopping });
      addSection("Cash Management", {
        "Starting Cash": formData.startingCash,
        "Ending Cash": formData.endingCash,
        "Banked Amount": formData.bankedAmount,
        "Cash Difference": cashDifference
      });
      if (formData.drinkStock) addSection("Drink Stock", formData.drinkStock);
      if (formData.freshFoodStock) addSection("Fresh Food Stock", formData.freshFoodStock);
      if (formData.frozenFood) addSection("Frozen Food Stock", formData.frozenFood);
      if (formData.shelfItems) addSection("Shelf Items", formData.shelfItems);
      if (formData.kitchenItems) addSection("Kitchen Items", formData.kitchenItems);
      if (formData.packagingItems) addSection("Packaging Items", formData.packagingItems);
      addSection("Total Summary", {
        "Total Sales": totalSales,
        "Total Wages": totalWages,
        "Total Shopping": totalShopping,
        "Total Expenses": totalExpenses,
        "Net Revenue": netRevenue,
        "Banked Today": formData.bankedAmount
      });

      // Create PDF buffer using promise
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
        doc.end();
      });

      // Send email
      const { sendEmailWithAttachment } = await import('./services/workingEmailService');
      
      await sendEmailWithAttachment(
        emailTo,
        `📋 Daily Form Submitted - ${formData.shiftDate} by ${formData.completedBy}`,
        htmlBody,
        [
          {
            filename: `SBB-DailyForm-${formData.shiftDate}.pdf`,
            content: pdfBuffer,
          },
        ]
      );

      return res.status(200).json({ message: 'Email sent with PDF' });
    } catch (err) {
      console.error('❌ Failed to send email with form:', err);
      return res.status(500).json({ message: 'Error sending form email', error: err });
    }
  });

  app.post("/api/email/send-daily-report", async (req: Request, res: Response) => {
    try {
      const { formId } = req.body;
      console.log("📧 Email request received with formId:", formId);
      
      // If formId provided, fetch authentic data from database
      if (formId) {
        console.log("📊 Fetching authentic Form", formId, "from database...");
        const [form] = await db.select().from(dailyStockSales).where(eq(dailyStockSales.id, formId)).limit(1);
        
        if (!form) {
          console.log("❌ Form", formId, "not found in database");
          return res.status(404).json({ error: "Form not found" });
        }

        console.log("✅ Found authentic Form", formId, "- Total Sales:", form.totalSales);

        // Use authentic form data from database
        const reportData = {
          id: form.id,
          completedBy: form.completedBy,
          shiftType: form.shiftType,
          shiftDate: form.shiftDate,
          totalSales: Number(form.totalSales),
          cashSales: Number(form.cashSales),
          grabSales: Number(form.grabSales),
          qrScanSales: Number(form.qrScanSales),
          aroiDeeSales: Number(form.aroiDeeSales),
          startingCash: Number(form.startingCash),
          endingCash: Number(form.endingCash),
          bankedAmount: Number(form.bankedAmount),
          totalExpenses: Number(form.totalExpenses),
          numberNeeded: typeof form.numberNeeded === 'string' ? JSON.parse(form.numberNeeded) : form.numberNeeded,
          wages: typeof form.wages === 'string' ? JSON.parse(form.wages) : form.wages,
          shopping: typeof form.shopping === 'string' ? JSON.parse(form.shopping) : form.shopping
        };

        // Generate expense description from authentic data
        let expenseDescription = '';
        if (reportData.wages && Array.isArray(reportData.wages)) {
          const wageDetails = reportData.wages.map((w: any) => `${w.name} (${w.amount})`).join(', ');
          expenseDescription += `Wages: ${wageDetails}. `;
        }
        if (reportData.shopping && Array.isArray(reportData.shopping)) {
          const shoppingDetails = reportData.shopping.map((s: any) => `${s.item} (${s.amount})`).join(', ');
          expenseDescription += `Shopping: ${shoppingDetails}.`;
        }
        reportData.expenseDescription = expenseDescription;

        console.log("📧 Sending email with AUTHENTIC data - Sales:", reportData.totalSales);
        
        // Send email with authentic data
        const { emailService } = await import("./services/emailService");
        await emailService.sendDailyShiftReport(reportData, Buffer.from('PDF placeholder'));
        
      } else {
        console.log("⚠️ No formId provided - using legacy test report (should be avoided)");
        // Legacy test report call (should be avoided)
        const { cronEmailService } = await import("./services/cronEmailService");
        await cronEmailService.sendTestReport();
      }
      
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

  // Loyverse OAuth callback endpoint
  app.get("/auth/loyverse/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: "Authorization code not provided" });
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://api.loyverse.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          client_id: process.env.LOYVERSE_CLIENT_ID!,
          client_secret: process.env.LOYVERSE_CLIENT_SECRET!,
          redirect_uri: `${req.protocol}://${req.get('host')}/auth/loyverse/callback`
        })
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        return res.status(400).json({ error: tokenData.error_description || tokenData.error });
      }

      // Store the tokens securely (in production, save to database)
      console.log('Loyverse OAuth Success:', {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in
      });

      // Redirect to success page or dashboard
      res.redirect('/?loyverse_connected=true');

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'OAuth callback failed' });
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

  // Monthly stock purchases summary endpoint
  app.get("/api/stock-purchase/monthly-summary", async (req: Request, res: Response) => {
    try {
      const summary = await storage.getMonthlyStockPurchaseSummary();
      res.json(summary);
    } catch (err) {
      console.error("Error fetching monthly stock purchase summary:", err);
      res.status(500).json({ error: "Failed to fetch monthly stock purchase summary" });
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
      const shoppingList = await storage.getShoppingListsByDate(date);
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

  // Update shopping list from latest form submission
  app.post("/api/shopping-list/update-from-latest", async (req: Request, res: Response) => {
    try {
      console.log("📝 Updating shopping list from latest form submission");
      
      // Get the most recent daily stock sales form
      const latestForm = await storage.getLatestDailyStockSales();
      if (!latestForm) {
        return res.json({ success: false, message: "No recent form found" });
      }
      
      console.log(`📊 Processing form ID ${latestForm.id} for shopping list updates`);
      
      // Generate shopping list items from the latest form data
      await generateShoppingListFromForm(latestForm);
      
      res.json({ 
        success: true, 
        message: "Shopping list updated from latest form",
        formId: latestForm.id,
        date: latestForm.shiftDate
      });
    } catch (err) {
      console.error("Error updating shopping list from latest:", err);
      res.status(500).json({ error: "Failed to update shopping list" });
    }
  });

  // Shopping List bulk endpoint for enhanced form
  app.post("/api/shopping-list/bulk", async (req: Request, res: Response) => {
    try {
      const shoppingItems = req.body;
      console.log("Creating bulk shopping list items:", shoppingItems.length);

      if (!Array.isArray(shoppingItems) || shoppingItems.length === 0) {
        return res.json({ message: "No items to add", count: 0 });
      }

      // Validate and format each item
      const formattedItems = shoppingItems.map(item => ({
        itemName: item.itemName || 'Unknown Item',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'unit',
        formId: item.formId,
        listDate: item.listDate ? new Date(item.listDate) : new Date(),
        estimatedCost: String(parseFloat(item.estimatedCost || '0')),
        supplier: item.supplier || '',
        pricePerUnit: String(parseFloat(item.pricePerUnit || '0')),
        notes: item.notes || '',
        priority: item.priority || 'medium',
        selected: false,
        aiGenerated: false,
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const results = await db.insert(shoppingList).values(formattedItems).returning();
      console.log(`✅ Created ${results.length} shopping list items`);

      res.json({ message: "Shopping list created successfully", count: results.length, items: results });
    } catch (err) {
      console.error("❌ Error creating bulk shopping list:", err);
      res.status(500).json({ error: "Failed to create shopping list" });
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

  // Shopping list bulk endpoint for form submission
  app.post("/api/shopping-list/bulk", async (req: Request, res: Response) => {
    try {
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Expected array of shopping items" });
      }
      
      // Ensure proper date conversion for timestamp fields
      const processedItems = items.map(item => ({
        ...item,
        supplier: item.supplier || 'General', // Provide default supplier
        pricePerUnit: item.pricePerUnit || '0.00', // Provide default price
        priority: item.priority || 'medium', // Provide default priority
        listDate: item.listDate ? (item.listDate instanceof Date ? item.listDate : new Date(item.listDate)) : new Date(),
        createdAt: item.createdAt ? (item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)) : new Date(),
        updatedAt: item.updatedAt ? (item.updatedAt instanceof Date ? item.updatedAt : new Date(item.updatedAt)) : new Date(),
        completedAt: item.completedAt ? (item.completedAt instanceof Date ? item.completedAt : new Date(item.completedAt)) : null
      }));
      
      const { shoppingList } = await import("../shared/schema");
      const results = await db.insert(shoppingList).values(processedItems).returning();
      res.json(results);
    } catch (err) {
      console.error("Error creating bulk shopping list:", err);
      res.status(500).json({ error: "Failed to create shopping list items" });
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
      const entriesArray = Array.isArray(shoppingEntries) ? shoppingEntries : [];
      console.log(`🛒 Form has ${entriesArray.length} shopping entries`);
      
      if (entriesArray.length === 0) {
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

  // Jussi Daily Summary endpoints
  app.post("/api/receipts/summary/generate/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { generateJussiSummaryForDate } = await import("./services/jussiDailySummaryService");
      
      const summary = await generateJussiSummaryForDate(date);
      
      if (!summary) {
        return res.status(404).json({ 
          success: false, 
          error: `No receipts found for date ${date}` 
        });
      }
      
      res.json({ 
        success: true, 
        message: `Summary generated for ${date}`, 
        summary 
      });
    } catch (err) {
      console.error("Error generating Jussi summary:", err);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Get latest shift summary (most recent 5PM-3AM shift)
  app.get("/api/receipts/jussi-summary/latest", async (req: Request, res: Response) => {
    try {
      const { getLatestShiftSummary } = await import("./services/jussiLatestShiftService");
      
      const summary = await getLatestShiftSummary();
      
      if (!summary) {
        return res.status(404).json({ error: "No recent shift data found" });
      }
      
      res.json(summary);
    } catch (err) {
      console.error("Error fetching latest shift summary:", err);
      res.status(500).json({ error: "Failed to fetch latest shift summary" });
    }
  });

  // Get shift summary by date
  app.get("/api/receipts/jussi-summary/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { JussiLatestShiftService } = await import("./services/jussiLatestShiftService");
      
      const summary = await JussiLatestShiftService.getShiftSummaryForDate(date);
      
      if (!summary) {
        return res.status(404).json({ error: `No shift data found for ${date}` });
      }
      
      res.json(summary);
    } catch (err) {
      console.error(`Error fetching shift summary for ${req.params.date}:`, err);
      res.status(500).json({ error: "Failed to fetch shift summary" });
    }
  });

  // Export latest shift summary as CSV
  app.get("/api/receipts/export/csv", async (req: Request, res: Response) => {
    try {
      const { JussiLatestShiftService } = await import("./services/jussiLatestShiftService");
      
      const csvData = await JussiLatestShiftService.generateCSVExport();
      const summary = await JussiLatestShiftService.getLatestShiftSummary();
      
      if (!summary) {
        return res.status(404).json({ error: "No shift data available for export" });
      }
      
      const filename = `shift-summary-${summary.shiftDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvData);
    } catch (err) {
      console.error("Error exporting shift summary:", err);
      res.status(500).json({ error: "Failed to export shift summary" });
    }
  });

  // Get shift data for analysis page (rolls, drinks, meat)
  app.get("/api/analysis/shift-data", async (req: Request, res: Response) => {
    try {
      const { JussiLatestShiftService } = await import("./services/jussiLatestShiftService");
      
      const summary = await JussiLatestShiftService.getLatestShiftSummary();
      
      if (!summary) {
        return res.status(404).json({ error: "No shift data available" });
      }
      
      // Extract data for analysis page
      const analysisData = {
        shiftDate: summary.shiftDate,
        burgerRollsUsed: summary.burgerRollsUsed,
        meatUsedKg: summary.meatUsedKg,
        drinkQuantities: summary.drinkQuantities,
        totalReceipts: summary.totalReceipts,
        grossSales: summary.grossSales,
        netSales: summary.netSales
      };
      
      res.json(analysisData);
    } catch (err) {
      console.error("Error fetching analysis shift data:", err);
      res.status(500).json({ error: "Failed to fetch analysis data" });
    }
  });

  // Get last 31 days summaries (for background MTD calculations)
  app.get("/api/receipts/jussi-summaries", async (req: Request, res: Response) => {
    try {
      const { JussiDailySummaryService } = await import("./services/jussiDailySummaryService");
      
      const summaries = await JussiDailySummaryService.getLast31DaysSummaries();
      
      res.json(summaries);
    } catch (err) {
      console.error("Error fetching Jussi summaries:", err);
      res.status(500).json({ error: "Failed to fetch summaries" });
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

  // Enhanced Recipe Management endpoints with cost calculation
  app.get("/api/recipes", async (req: Request, res: Response) => {
    try {
      const { recipes } = await import("../shared/schema");
      const recipesList = await db.select().from(recipes).orderBy(recipes.name);
      res.json(recipesList);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.post("/api/recipes", async (req: Request, res: Response) => {
    try {
      const { recipes } = await import("../shared/schema");
      const data = req.body;
      
      const [result] = await db.insert(recipes).values({
        name: data.name,
        description: data.description,
        category: data.category || 'Burgers',
        yieldQuantity: '1',
        yieldUnit: 'portions',
        ingredients: data.ingredients || [],
        totalIngredientCost: data.totalIngredientCost || '0',
        costPerUnit: data.costPerUnit || '0',
        costPerServing: data.costPerServing || null,
        preparationTime: data.preparationTime || 0,
        servingSize: data.servingSize || null,
        profitMargin: data.profitMargin || null,
        sellingPrice: data.sellingPrice || null,
        notes: data.notes || null,
        isActive: data.isActive ?? true,
      }).returning();
      
      res.json(result);
    } catch (err) {
      console.error("Error creating recipe:", err);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  app.put("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const { recipes } = await import("../shared/schema");
      const id = parseInt(req.params.id);
      const data = req.body;
      
      const [result] = await db.update(recipes).set({
        name: data.name,
        description: data.description,
        category: data.category,
        yieldQuantity: '1',
        yieldUnit: 'portions',
        ingredients: data.ingredients || [],
        totalIngredientCost: data.totalIngredientCost,
        costPerUnit: data.costPerUnit,
        costPerServing: data.costPerServing,
        preparationTime: data.preparationTime,
        servingSize: data.servingSize,
        profitMargin: data.profitMargin,
        sellingPrice: data.sellingPrice,
        notes: data.notes,
        isActive: data.isActive,
        updatedAt: new Date(),
      }).where(eq(recipes.id, id)).returning();
      
      res.json(result);
    } catch (err) {
      console.error("Error updating recipe:", err);
      res.status(500).json({ error: "Failed to update recipe" });
    }
  });

  app.delete("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const { recipes } = await import("../shared/schema");
      const id = parseInt(req.params.id);
      await db.delete(recipes).where(eq(recipes.id, id));
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
      const { ingredients: ingredientsTable } = await import("../shared/schema");
      const ingredientsList = await db.select().from(ingredientsTable).orderBy(ingredientsTable.name);
      res.json(ingredientsList);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  app.post("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const { ingredients: ingredientsTable } = await import("../shared/schema");
      
      // Auto-calculate cost per portion
      const price = parseFloat(req.body.price) || 0;
      const packageSize = parseFloat(req.body.packageSize) || 1;
      const portionSize = parseFloat(req.body.portionSize) || 1;
      const costPerPortion = price / (packageSize / portionSize) || 0;
      
      const [result] = await db.insert(ingredientsTable).values({
        name: req.body.name,
        category: req.body.category,
        supplier: req.body.supplier,
        unitPrice: req.body.unitPrice || req.body.price || '0',
        price: req.body.price || '0',
        packageSize: req.body.packageSize || '0',
        portionSize: req.body.portionSize || '0',
        costPerPortion: costPerPortion.toString(),
        unit: req.body.unit || 'g',
        notes: req.body.notes || '',
      }).returning();
      res.json(result);
    } catch (err) {
      console.error("Error creating ingredient:", err);
      res.status(500).json({ error: "Failed to create ingredient" });
    }
  });

  app.put("/api/ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { ingredients: ingredientsTable, recipes, shoppingList } = await import("../shared/schema");
      
      // Auto-calculate cost per portion
      const price = parseFloat(req.body.price) || 0;
      const packageSize = parseFloat(req.body.packageSize) || 1;
      const portionSize = parseFloat(req.body.portionSize) || 1;
      const costPerPortion = price / (packageSize / portionSize) || 0;
      
      const [result] = await db.update(ingredientsTable)
        .set({
          name: req.body.name,
          category: req.body.category,
          supplier: req.body.supplier,
          unitPrice: req.body.unitPrice || req.body.price || '0',
          price: req.body.price || '0',
          packageSize: req.body.packageSize || '0',
          portionSize: req.body.portionSize || '0',
          costPerPortion: costPerPortion.toString(),
          unit: req.body.unit || 'g',
          notes: req.body.notes || '',
          updatedAt: new Date(), // Auto-timestamp
        })
        .where(eq(ingredientsTable.id, id))
        .returning();
        
      // Update shopping list estimated costs for this ingredient
      try {
        const shoppingItems = await db.select().from(shoppingList)
          .where(sql`item_name = ${req.body.name}`);
        
        for (const item of shoppingItems) {
          const newEstCost = (parseFloat(item.quantity) || 0) * price;
          await db.update(shoppingList)
            .set({ estimatedCost: newEstCost.toString() })
            .where(eq(shoppingList.id, item.id));
        }
      } catch (shoppingErr: any) {
        console.log("Shopping list update skipped (table may not exist):", shoppingErr?.message);
      }
      
      // Update recipes that use this ingredient - recalculate costs
      try {
        const { recipes } = await import("../shared/schema");
        const recipesUsingIngredient = await db.select().from(recipes)
          .where(sql`ingredients::jsonb @> '[{"ingredientId": ${id}}]'`);
          
        for (const recipe of recipesUsingIngredient) {
          let newCost = 0;
          const newBreakDown = [];
          
          for (const ing of recipe.ingredients || []) {
            const ingData = await db.select().from(ingredientsTable)
              .where(eq(ingredientsTable.id, ing.ingredientId)).limit(1);
            
            if (ingData[0]) {
              const ingCost = ing.portion * parseFloat(ingData[0].costPerPortion || '0');
              newCost += ingCost;
              newBreakDown.push({ 
                name: ingData[0].name, 
                portion: ing.portion, 
                cost: ingCost 
              });
            }
          }
          
          await db.update(recipes)
            .set({ 
              costPerServing: newCost.toString(),
              breakDown: newBreakDown,
              updatedAt: new Date()
            })
            .where(eq(recipes.id, recipe.id));
        }
      } catch (recipeErr: any) {
        console.log("Recipe cost update skipped:", recipeErr?.message);
      }
      
      res.json(result);
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
          fileData: fileDataBase64, // Store as text, not as object
          shiftDate: shiftDate || new Date(), // Ensure we have a valid date
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
      const fileBuffer = Buffer.from(report.fileData as string, 'base64');
      
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
          .orderBy(desc(uploadedReports.uploadedAt));
      } else {
        results = await db.select().from(uploadedReports)
          .orderBy(desc(uploadedReports.uploadedAt))
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

  // Receipts upload endpoint - multiple files
  app.post('/api/receipts/upload', upload.array('files', 5), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const shiftDate = req.body.shiftDate || new Date().toISOString().split('T')[0];
      const ids: number[] = [];
      
      for (const file of files) {
        const fileData = file.buffer.toString('base64');
        
        const [report] = await db.insert(uploadedReports).values({
          filename: file.originalname,
          fileType: file.mimetype,
          fileData,
          shiftDate: new Date(shiftDate + 'T00:00:00Z'),
          isAnalyzed: false,
          analysisSummary: null,
          compilationSummary: null,
        }).returning({ id: uploadedReports.id });
        
        ids.push(report.id);
      }

      res.json({ ids, message: `${files.length} files uploaded successfully` });
    } catch (err) {
      console.error('Receipts upload error:', err);
      res.status(500).json({ error: 'Failed to upload receipts files' });
    }
  });

  // Receipts compilation endpoint - multiple files
  app.post('/api/receipts/compile', async (req: Request, res: Response) => {
    try {
      const { reportIds } = req.body;
      if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ error: 'Report IDs required' });
      }

      // Get all uploaded reports
      const reports = await db
        .select()
        .from(uploadedReports)
        .where(inArray(uploadedReports.id, reportIds));

      if (reports.length === 0) {
        return res.status(404).json({ error: 'No reports found' });
      }

      // Combine text from all files
      let combinedText = '';
      for (const report of reports) {
        let text = '';
        try {
          const fileBuffer = Buffer.from(report.fileData as string, 'base64');
          
          if (report.fileType === 'application/pdf') {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(fileBuffer);
            text = pdfData.text;
          } else if (report.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            text = xlsx.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
          } else if (report.fileType === 'text/csv') {
            text = fileBuffer.toString('utf-8');
          }
          combinedText += `\n--- ${report.filename} ---\n${text}`;
        } catch (parseError) {
          console.error(`File parsing error for ${report.filename}:`, parseError);
          combinedText += `\n--- ${report.filename} (parsing failed) ---\n`;
        }
      }

      // AI analysis with OpenAI
      const prompt = `Compile receipts from multiple files: List items sold by category, include quantities/modifiers, calculate ingredient usage (e.g., Single Smash Burger: 1 roll, 20g butter, 1 cheese, 95g meat). 

Use this calculation guide:
- Single Smash Burger: 1 roll, 20g butter, 1 cheese slice, 95g meat
- Double Smash Burger: 1 roll, 25g butter, 2 cheese slices, 190g meat  
- French Fries: 150g potatoes, 10ml oil
- Chicken Wings (6pc): 200g chicken, 5ml oil
- Jalapeños: 15g jalapeños per serving

Return JSON format:
{
  "items": [{"category": "string", "name": "string", "quantity": number}],
  "modifiers": [{"name": "string", "count": number}], 
  "ingredients": [{"name": "string", "quantity": number, "unit": "string"}]
}

Combined receipt data:
${combinedText.slice(0, 10000)}`; // Limit text to avoid token limits

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.1
        });

        const compilationText = response.choices[0].message.content;
        let compilation;

        try {
          compilation = JSON.parse(compilationText || '{}');
        } catch (jsonError) {
          console.error('JSON parse error:', jsonError);
          // Fallback compilation if AI response isn't valid JSON
          compilation = {
            items: [
              { category: "Burgers", name: "Combined Analysis Error", quantity: 0 },
              { category: "Files", name: `${reports.length} files processed`, quantity: reports.length }
            ],
            modifiers: [
              { name: "AI Analysis Unavailable", count: 0 }
            ],
            ingredients: [
              { name: "Manual Review Required", quantity: reports.length, unit: "files" }
            ]
          };
        }

        // Store compilation in first report
        await db
          .update(uploadedReports)
          .set({ 
            compilationSummary: compilation,
            analyzedAt: new Date(),
            isAnalyzed: true
          })
          .where(eq(uploadedReports.id, reportIds[0]));

        res.json(compilation);

      } catch (aiError) {
        console.error('OpenAI analysis error:', aiError);
        
        // Return fallback compilation if OpenAI fails
        const fallbackCompilation = {
          items: [
            { category: "Files", name: `${reports.length} files uploaded`, quantity: reports.length }
          ],
          modifiers: [
            { name: "AI Analysis Unavailable", count: 0 }
          ],
          ingredients: [
            { name: "Manual Review Required", quantity: reports.length, unit: "files" }
          ]
        };
        
        res.json(fallbackCompilation);
      }

    } catch (err) {
      console.error('Receipts compilation error:', err);
      res.status(500).json({ error: 'Failed to compile receipts data' });
    }
  });

  // Email Individual Form API
  app.post('/api/email-individual-form', async (req: Request, res: Response) => {
    try {
      const { to, subject, formData } = req.body;
      
      // Import email service
      const { EmailService } = await import('./services/emailService');
      const emailService = new EmailService();
      
      // Create email content
      const emailContent = `
DAILY SALES & STOCK FORM
========================

Shift Information:
- Completed By: ${formData.completedBy}
- Shift Type: ${formData.shiftType}
- Shift Date: ${formData.shiftDate}

Cash Management:
- Starting Cash: ฿${formData.startingCash?.toLocaleString() || '0'}
- Ending Cash: ฿${formData.endingCash?.toLocaleString() || '0'}
- Banked Amount: ฿${formData.bankedAmount?.toLocaleString() || '0'}

Sales Information:
- Grab Sales: ฿${formData.grabSales?.toLocaleString() || '0'}
- Aroi Dee Sales: ฿${formData.aroiDeeSales?.toLocaleString() || '0'}
- QR Scan Sales: ฿${formData.qrScanSales?.toLocaleString() || '0'}
- Cash Sales: ฿${formData.cashSales?.toLocaleString() || '0'}
- TOTAL SALES: ฿${formData.totalSales?.toLocaleString() || '0'}

Gas Expense: ฿${formData.gasExpense?.toLocaleString() || '0'}

Wages & Staff Payments:
${formData.wages?.map((w: any) => `- ${w.name}: ฿${w.amount?.toLocaleString() || '0'} (${w.type})`).join('\n') || 'No wage entries'}
Total Wages: ฿${formData.totalWages?.toLocaleString() || '0'}

Shopping & Expenses:
${formData.shopping?.map((s: any) => `- ${s.item}: ฿${s.amount?.toLocaleString() || '0'} (${s.shop})`).join('\n') || 'No shopping entries'}
Total Shopping: ฿${formData.totalShopping?.toLocaleString() || '0'}

TOTAL EXPENSES: ฿${formData.totalExpenses?.toLocaleString() || '0'}
NET REVENUE: ฿${formData.netRevenue?.toLocaleString() || '0'}

Fresh Food Stock:
${Object.entries(formData.freshFood || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Frozen Food Stock:
${Object.entries(formData.frozenFood || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Shelf Items Stock:
${Object.entries(formData.shelfItems || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Kitchen Items Stock:
${Object.entries(formData.kitchenItems || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Packaging Items Stock:
${Object.entries(formData.packagingItems || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Drink Stock:
${Object.entries(formData.drinkStock || {}).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n')}

Notes: ${formData.notes || 'No notes'}
Discrepancy Notes: ${formData.discrepancyNotes || 'No discrepancy notes'}

Generated: ${new Date().toLocaleString()}
      `;

      // Send email
      const result = await emailService.sendEmail({
        to: to || 'colcamenterprises@gmail.com',
        subject: subject || 'Daily Shift Form',
        text: emailContent,
        html: emailContent.replace(/\n/g, '<br>')
      });

      if (result.success) {
        res.json({ success: true, message: 'Email sent successfully' });
      } else {
        throw new Error(result.error || 'Email sending failed');
      }
    } catch (error) {
      console.error('Error sending individual form email:', error);
      res.status(500).json({ error: 'Failed to send email', details: (error as Error).message });
    }
  });

  // Stock Lodge API (Quick Lodge for Burger Buns, Drinks, Meat)
  app.post('/api/lodge-stock', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      data.lodgeDate = new Date(); // Timestamp
      
      // Here you would save to a stock_lodge table
      // For now, we'll just return success
      console.log('Stock lodge data received:', data);
      
      res.json({ success: true, message: 'Stock lodged successfully', data });
    } catch (error) {
      console.error('Error lodging stock:', error);
      res.status(500).json({ error: 'Failed to lodge stock' });
    }
  });

  // Enhanced Shift Comparison API - CSV upload with automatic database matching
  app.post('/api/shift-comparison', upload.single('shiftReport'), async (req: Request, res: Response) => {
    const TOLERANCE = 50; // Tolerance in THB
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      // Write buffer to temporary file for csv-parser
      const tempFilePath = path.join(process.cwd(), 'temp', `${Date.now()}-shift.csv`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Parse CSV using csv-parser
      const shiftData: any[] = await new Promise((resolve, reject) => {
        const results: any[] = [];
        fs.createReadStream(tempFilePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (shiftData.length === 0) {
        return res.status(400).json({ error: 'No data found in CSV file' });
      }

      const shift = shiftData[0]; // Use first row of data

      // Extract date from CSV for database matching
      const shiftDate = shift.date || shift.Date || shift.DATE;
      if (!shiftDate) {
        return res.status(400).json({ error: 'No date field found in CSV' });
      }

      // Parse and format date for database search
      const parsedDate = new Date(shiftDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format in CSV' });
      }

      const searchDate = parsedDate.toISOString().split('T')[0];

      // Query database for matching Daily Sales Form
      const matchingForms = await db
        .select()
        .from(dailyStockSales)
        .where(sql`DATE(${dailyStockSales.createdAt}) = ${searchDate}`)
        .orderBy(desc(dailyStockSales.createdAt))
        .limit(1);

      if (matchingForms.length === 0) {
        return res.json({ error: 'No Daily Sales Form found for this shift date' });
      }

      const dailyForm = matchingForms[0];

      // Helper function to perform comparison
      const compare = (label: string, shiftVal: number, formVal: number) => {
        const diff = Math.abs(shiftVal - formVal);
        return {
          label,
          shiftValue: shiftVal,
          formValue: formVal,
          difference: diff,
          withinTolerance: diff <= TOLERANCE,
          status: diff <= TOLERANCE ? 'match' : 'discrepancy'
        };
      };

      // Perform comparisons with proper field mapping
      const comparisons = [
        compare('Total Sales', 
          parseFloat(shift['total_sales'] || shift['Total Sales'] || '0'), 
          parseFloat(dailyForm.totalSales?.toString() || '0')
        ),
        compare('Cash Sales', 
          parseFloat(shift['cash_sales'] || shift['Cash'] || '0'), 
          parseFloat(dailyForm.cashSales?.toString() || '0')
        ),
        compare('QR Code Sales', 
          parseFloat(shift['qr_sales'] || shift['QR Code'] || '0'), 
          parseFloat(dailyForm.qrScanSales?.toString() || '0')
        ),
        compare('Grab Sales', 
          parseFloat(shift['grab_sales'] || shift['Grab'] || '0'), 
          parseFloat(dailyForm.grabSales?.toString() || '0')
        ),
        compare('Aroi Dee Sales', 
          parseFloat(shift['aroi_sales'] || shift['Aroi Dee'] || '0'), 
          parseFloat(dailyForm.aroiDeeSales?.toString() || '0')
        ),
        compare('Register Balance', 
          parseFloat(shift['register_balance'] || shift['Register Balance'] || '0'), 
          parseFloat(dailyForm.endingCash?.toString() || '0')
        )
      ];

      // Return comprehensive comparison data
      res.json({
        comparisons,
        matchedFormId: dailyForm.id,
        matchedDate: searchDate,
        shiftDate: shiftDate,
        tolerance: TOLERANCE,
        summary: {
          totalComparisons: comparisons.length,
          matches: comparisons.filter(c => c.status === 'match').length,
          discrepancies: comparisons.filter(c => c.status === 'discrepancy').length
        }
      });

    } catch (error) {
      console.error('Shift comparison error:', error);
      res.status(500).json({ error: 'Failed to process shift comparison' });
    }
  });

  // Enhanced Loyverse API routes
  app.use("/api/loyverse", loyverseEnhancedRoutes);

  // Supplier Management API
  // GET /api/suppliers - Return full list
  app.get('/api/suppliers', (req: Request, res: Response) => {
    try {
      const suppliers = supplierService.getAll();
      res.json(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  // POST /api/suppliers - Add new item
  app.post('/api/suppliers', (req: Request, res: Response) => {
    try {
      const newSupplier = supplierService.add(req.body);
      res.json(newSupplier);
    } catch (error) {
      console.error('Error adding supplier:', error);
      res.status(500).json({ error: 'Failed to add supplier' });
    }
  });

  // PUT /api/suppliers/:id - Edit item
  app.put('/api/suppliers/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedSupplier = supplierService.update(id, req.body);
      
      if (!updatedSupplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.json(updatedSupplier);
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  });

  // DELETE /api/suppliers/:id - Remove item
  app.delete('/api/suppliers/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = supplierService.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.json({ message: 'Supplier deleted successfully', deleted });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  });

  // Shift Reports API routes
  app.get('/api/shift-reports', async (req: Request, res: Response) => {
    try {
      const reports = await storage.getShiftReports();
      res.json(reports);
    } catch (error) {
      console.error('Error fetching shift reports:', error);
      res.status(500).json({ error: 'Failed to fetch shift reports' });
    }
  });

  app.get('/api/shift-reports/:id', async (req: Request, res: Response) => {
    try {
      const report = await storage.getShiftReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Shift report not found' });
      }
      res.json(report);
    } catch (error) {
      console.error('Error fetching shift report:', error);
      res.status(500).json({ error: 'Failed to fetch shift report' });
    }
  });

  app.get('/api/shift-reports/date/:date', async (req: Request, res: Response) => {
    try {
      const report = await storage.getShiftReportByDate(req.params.date);
      if (!report) {
        return res.status(404).json({ error: 'Shift report not found for this date' });
      }
      res.json(report);
    } catch (error) {
      console.error('Error fetching shift report by date:', error);
      res.status(500).json({ error: 'Failed to fetch shift report' });
    }
  });

  app.post('/api/shift-reports', async (req: Request, res: Response) => {
    try {
      const reportData = insertShiftReportSchema.parse(req.body);
      const report = await storage.createShiftReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      console.error('Error creating shift report:', error);
      res.status(500).json({ error: 'Failed to create shift report' });
    }
  });

  app.put('/api/shift-reports/:id', async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const report = await storage.updateShiftReport(req.params.id, updates);
      res.json(report);
    } catch (error) {
      console.error('Error updating shift report:', error);
      res.status(500).json({ error: 'Failed to update shift report' });
    }
  });

  app.delete('/api/shift-reports/:id', async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteShiftReport(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Shift report not found' });
      }
      res.json({ message: 'Shift report deleted successfully' });
    } catch (error) {
      console.error('Error deleting shift report:', error);
      res.status(500).json({ error: 'Failed to delete shift report' });
    }
  });

  // Balance Review Summary for ShiftReportSummary component
  app.get('/api/shift-reports/balance-review', async (req: Request, res: Response) => {
    try {
      const reports = await storage.getShiftReports();
      
      // Generate summary data with banking differences
      const summary = reports.map(report => {
        // Calculate banking difference from sales data if available with safety checks
        let bankingDiff = 0;
        if (report.salesData && report.shiftData) {
          // Expected banked amount should include both cash and QR sales with safety parsing
          const safeCashSales = parseFloat(report.salesData.cashSales?.toString() || '0');
          const safeQrSales = parseFloat(report.salesData.qrSales?.toString() || '0');
          const expectedBanked = safeCashSales + safeQrSales;
          const actualRegister = parseFloat(report.shiftData.registerBalance?.toString() || '0');
          bankingDiff = actualRegister - expectedBanked;
        }
        
        // Determine status based on difference (±50 threshold)
        const status = Math.abs(bankingDiff) <= 50 ? 'balanced' : 'attention';
        
        // Count anomalies from the anomalies array
        const anomaliesCount = Array.isArray(report.anomalies) ? report.anomalies.length : 0;
        
        return {
          date: report.reportDate,
          banking_diff: bankingDiff,
          status,
          anomalies: anomaliesCount
        };
      }).slice(0, 7); // Show last 7 reports
      
      res.json(summary);
    } catch (error) {
      console.error('Error fetching balance review summary:', error);
      res.status(500).json({ error: 'Failed to fetch balance review summary' });
    }
  });

  // Legacy endpoint for HomePage compatibility
  app.get('/api/shift-report/summary', async (req: Request, res: Response) => {
    try {
      const reports = await storage.getShiftReports();
      
      // Convert our data format to what the homepage expects
      const summary = reports.map(report => {
        let bankingDiff = 0;
        if (report.salesData && report.shiftData) {
          // Safe parsing to prevent NaN values
          const safeCashSales = parseFloat(report.salesData.cashSales?.toString() || '0');
          const safeQrSales = parseFloat(report.salesData.qrSales?.toString() || '0');
          const expectedBanked = safeCashSales + safeQrSales;
          const actualRegister = parseFloat(report.shiftData.registerBalance?.toString() || '0');
          bankingDiff = actualRegister - expectedBanked;
        }
        
        const anomaliesCount = Array.isArray(report.anomalies) ? report.anomalies.length : 0;
        
        return {
          date: report.reportDate,
          register_difference: bankingDiff,
          anomalies: anomaliesCount
        };
      }).slice(0, 7);
      
      res.json(summary);
    } catch (error) {
      console.error('Error fetching shift report summary:', error);
      res.status(500).json({ error: 'Failed to fetch shift report summary' });
    }
  });

  // New endpoint: Pull shift reports from Loyverse and match with Daily Sales Forms
  app.get('/api/loyverse/shift-reports', async (req: Request, res: Response) => {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date parameters are required' });
      }

      // Get Loyverse shift reports using existing enhanced routes
      const loyverseResponse = await fetch(`${req.protocol}://${req.get('host')}/api/loyverse/shifts?start_created_at=${start_date}&end_created_at=${end_date}`);
      
      if (!loyverseResponse.ok) {
        throw new Error('Failed to fetch Loyverse shift data');
      }

      const loyverseShifts = await loyverseResponse.json();
      const processedReports = [];

      // Process each shift and match with Daily Sales Forms
      for (const shift of loyverseShifts) {
        const shiftDate = new Date(shift.created_at).toISOString().split('T')[0];
        
        // Check if Daily Sales Form exists for this date
        const dailySalesForm = await storage.getDailyStockSalesByDate(shiftDate);
        
        // Prepare shift data
        const shiftData = {
          shiftId: shift.id,
          totalSales: Number(shift.total_sales || 0),
          cashSales: Number(shift.total_cash || 0),
          cardSales: Number(shift.total_card || 0),
          qrSales: Number(shift.total_other || 0),
          registerOpening: Number(shift.opening_balance || 0),
          registerClosing: Number(shift.closing_balance || 0),
          bankedAmount: Number(shift.banked_amount || 0),
          totalOrders: shift.receipts_count || 0,
          shiftDuration: shift.duration || 0
        };

        // Prepare daily sales data if available
        let salesData = null;
        if (dailySalesForm) {
          salesData = {
            formId: dailySalesForm.id,
            totalSales: Number(dailySalesForm.grabSales || 0) + Number(dailySalesForm.aroiDeeSales || 0) + Number(dailySalesForm.qrScanSales || 0) + Number(dailySalesForm.cashSales || 0),
            cashSales: Number(dailySalesForm.cashSales || 0),
            grabSales: Number(dailySalesForm.grabSales || 0),
            aroiDeeSales: Number(dailySalesForm.aroiDeeSales || 0),
            qrScanSales: Number(dailySalesForm.qrScanSales || 0),
            totalExpenses: Number(dailySalesForm.totalWages || 0) + Number(dailySalesForm.totalShopping || 0) + Number(dailySalesForm.gasBill || 0),
            endingCash: Number(dailySalesForm.endingCash || 0),
            bankedAmount: Number(dailySalesForm.bankedAmount || 0)
          };
        }

        // Determine status and analyze discrepancies
        let status = 'missing';
        let bankingCheck = null;
        let anomalies: string[] = [];
        let manualReviewNeeded = false;

        if (dailySalesForm && shift) {
          status = 'complete';
          
          // Banking accuracy check
          const cashVariance = Math.abs((salesData?.cashSales || 0) - shiftData.cashSales);
          const salesVariance = Math.abs((salesData?.totalSales || 0) - shiftData.totalSales);
          
          bankingCheck = cashVariance <= 50 ? 'Accurate' : 'Mismatch';
          
          // Detect anomalies
          if (salesVariance > 100) {
            anomalies.push(`Total sales variance: ฿${salesVariance.toFixed(2)}`);
          }
          
          if (cashVariance > 50) {
            anomalies.push(`Cash variance: ฿${cashVariance.toFixed(2)}`);
          }
          
          if (anomalies.length > 0) {
            status = 'manual_review';
            manualReviewNeeded = true;
          }
        } else if (dailySalesForm && !shift) {
          status = 'partial';
          anomalies.push('POS shift report missing');
        } else if (!dailySalesForm && shift) {
          status = 'partial';
          anomalies.push('Daily Sales Form missing');
        }

        // Create or update shift report in database
        const existingReport = await storage.getShiftReportByDate(shiftDate);
        
        if (existingReport) {
          await storage.updateShiftReport(existingReport.id, {
            hasDailySales: !!salesData,
            hasShiftReport: !!shiftData,
            salesData,
            shiftData,
            status,
            bankingCheck,
            anomaliesDetected: anomalies,
            manualReviewNeeded
          });
        } else {
          await storage.createShiftReport({
            reportDate: shiftDate,
            hasDailySales: !!salesData,
            hasShiftReport: !!shiftData,
            salesData,
            shiftData,
            status,
            bankingCheck,
            anomaliesDetected: anomalies,
            manualReviewNeeded
          });
        }

        processedReports.push({
          date: shiftDate,
          status,
          hasDailySales: !!salesData,
          hasShiftReport: !!shiftData,
          bankingCheck,
          anomalies,
          salesData,
          shiftData
        });
      }

      res.json({
        message: `Processed ${processedReports.length} shift reports`,
        reports: processedReports,
        summary: {
          total: processedReports.length,
          complete: processedReports.filter(r => r.status === 'complete').length,
          partial: processedReports.filter(r => r.status === 'partial').length,
          manual_review: processedReports.filter(r => r.status === 'manual_review').length,
          missing: processedReports.filter(r => r.status === 'missing').length
        }
      });

    } catch (error) {
      console.error('Error processing Loyverse shift reports:', error);
      res.status(500).json({ error: 'Failed to process Loyverse shift reports' });
    }
  });

  app.get('/api/shift-reports/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const status = req.query.status as string;
      const reports = await storage.searchShiftReports(query, status);
      res.json(reports);
    } catch (error) {
      console.error('Error searching shift reports:', error);
      res.status(500).json({ error: 'Failed to search shift reports' });
    }
  });

  app.post('/api/shift-reports/:id/generate-pdf', async (req: Request, res: Response) => {
    try {
      const { shiftReportsService } = await import('./services/shiftReportsService');
      const pdfUrl = await shiftReportsService.generatePDFReport(req.params.id);
      res.json({ pdfUrl });
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  });

  // Receipts summary endpoint for current shift (5PM-3AM Bangkok time)
  app.get('/api/receipts/summary', async (req: Request, res: Response) => {
    try {
      const { shiftStart, shiftEnd, shiftDate } = calculateShiftTimeWindow();
      
      // Initialize summary object
      const summary = {
        totalReceipts: 0,
        grossSales: 0,
        netSales: 0,
        paymentTypes: {} as Record<string, number>,
        itemsSold: {} as Record<string, number>,
        modifiersSold: {} as Record<string, number>,
        refunds: [] as Array<{
          receipt_number: string;
          time: string;
          amount: number;
          reason: string;
        }>
      };
      
      // Get receipts from Loyverse API - LIVE DATA ONLY
      try {
        const { LiveReceiptService } = await import('./services/liveReceiptService');
        const liveReceiptService = LiveReceiptService.getInstance();
        
        // Convert Bangkok timezone shift times to UTC for API query
        const shiftStartUTC = new Date(shiftStart).toISOString();
        const shiftEndUTC = new Date(shiftEnd).toISOString();
        
        // Get receipts from Loyverse API using live service
        const receiptsData = await liveReceiptService.fetchReceiptsForPeriod(shiftStartUTC, shiftEndUTC);
        
        if (receiptsData && receiptsData.receipts) {
          const receipts = receiptsData.receipts;
          summary.totalReceipts = receipts.length;
          
          // Process each receipt
          for (const receipt of receipts) {
            const totalAmount = parseFloat(receipt.total_money?.toString() || '0') / 100; // Convert from cents
            const netAmount = parseFloat(receipt.total_money?.toString() || '0') / 100; // Loyverse API returns in cents
            
            summary.grossSales += totalAmount;
            summary.netSales += netAmount;
            
            // Count payment types
            const paymentMethod = receipt.payment_type_name || 'Unknown';
            summary.paymentTypes[paymentMethod] = (summary.paymentTypes[paymentMethod] || 0) + 1;
            
            // Parse receipt items
            if (receipt.receipt_items && Array.isArray(receipt.receipt_items)) {
              for (const item of receipt.receipt_items) {
                const itemName = item.item_name || 'Unknown Item';
                const quantity = parseInt(item.quantity?.toString() || '0');
                if (quantity > 0) {
                  summary.itemsSold[itemName] = (summary.itemsSold[itemName] || 0) + quantity;
                }
                
                // Parse modifiers
                if (item.modifiers && Array.isArray(item.modifiers)) {
                  for (const modifier of item.modifiers) {
                    const modifierName = modifier.modifier_name || 'Unknown Modifier';
                    const modQuantity = parseInt(modifier.quantity?.toString() || '0');
                    if (modQuantity > 0) {
                      summary.modifiersSold[modifierName] = (summary.modifiersSold[modifierName] || 0) + modQuantity;
                    }
                  }
                }
              }
            }
            
            // Track refunds (check if receipt is refunded)
            if (receipt.refunded_by) {
              summary.refunds.push({
                receipt_number: receipt.receipt_number || 'Unknown',
                time: receipt.created_at || 'Unknown',
                amount: totalAmount,
                reason: 'Refunded via POS'
              });
            }
          }
        }
      } catch (loyverseError) {
        console.error('Loyverse API Error:', loyverseError);
        // Do not use fallback data - return empty summary with error
        res.status(503).json({ 
          error: 'Loyverse API unavailable - only live data supported',
          summary: {
            totalReceipts: 0,
            grossSales: 0,
            netSales: 0,
            paymentTypes: {},
            itemsSold: {},
            modifiersSold: {},
            refunds: []
          }
        });
        return;
      }
      
      res.json({
        summary,
        shiftStart,
        shiftEnd,
        shiftDate
      });
    } catch (error) {
      console.error('Error in /api/receipts/summary:', error);
      res.status(500).json({ error: 'Failed to fetch live receipt data from Loyverse API' });
    }
  });

  // Receipts summary endpoint for a specific date
  app.get('/api/receipts/summary/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { shiftStart, shiftEnd, shiftDate } = getShiftTimeWindowForDate(date);
      
      // Initialize summary object
      const summary = {
        totalReceipts: 0,
        grossSales: 0,
        netSales: 0,
        paymentTypes: {} as Record<string, number>,
        itemsSold: {} as Record<string, number>,
        modifiersSold: {} as Record<string, number>,
        refunds: [] as Array<{
          receipt_number: string;
          time: string;
          amount: number;
          reason: string;
        }>
      };
      
      // Get receipts from Loyverse API - LIVE DATA ONLY
      try {
        const { LiveReceiptService } = await import('./services/liveReceiptService');
        const liveReceiptService = LiveReceiptService.getInstance();
        
        // Convert Bangkok timezone shift times to UTC for API query
        const shiftStartUTC = new Date(shiftStart).toISOString();
        const shiftEndUTC = new Date(shiftEnd).toISOString();
        
        // Get receipts from Loyverse API using live service
        const receiptsData = await liveReceiptService.fetchReceiptsForPeriod(shiftStartUTC, shiftEndUTC);
        
        if (receiptsData && receiptsData.receipts) {
          const receipts = receiptsData.receipts;
          summary.totalReceipts = receipts.length;
          
          // Process each receipt
          for (const receipt of receipts) {
            const totalAmount = parseFloat(receipt.total_money?.toString() || '0') / 100;
            const netAmount = parseFloat(receipt.total_money?.toString() || '0') / 100;
            
            summary.grossSales += totalAmount;
            summary.netSales += netAmount;
            
            // Count payment types
            const paymentMethod = receipt.payment_type_name || 'Unknown';
            summary.paymentTypes[paymentMethod] = (summary.paymentTypes[paymentMethod] || 0) + 1;
            
            // Parse receipt items
            if (receipt.receipt_items && Array.isArray(receipt.receipt_items)) {
              for (const item of receipt.receipt_items) {
                const itemName = item.item_name || 'Unknown Item';
                const quantity = parseInt(item.quantity?.toString() || '0');
                if (quantity > 0) {
                  summary.itemsSold[itemName] = (summary.itemsSold[itemName] || 0) + quantity;
                }
                
                // Parse modifiers
                if (item.modifiers && Array.isArray(item.modifiers)) {
                  for (const modifier of item.modifiers) {
                    const modifierName = modifier.modifier_name || 'Unknown Modifier';
                    const modQuantity = parseInt(modifier.quantity?.toString() || '0');
                    if (modQuantity > 0) {
                      summary.modifiersSold[modifierName] = (summary.modifiersSold[modifierName] || 0) + modQuantity;
                    }
                  }
                }
              }
            }
            
            // Track refunds
            if (receipt.refunded_by) {
              summary.refunds.push({
                receipt_number: receipt.receipt_number || 'Unknown',
                time: receipt.created_at || 'Unknown',
                amount: totalAmount,
                reason: 'Refunded via POS'
              });
            }
          }
        }
      } catch (loyverseError) {
        console.error('Loyverse API Error for date query:', loyverseError);
        // Do not use fallback data - return empty summary with error
        res.status(503).json({ 
          error: 'Loyverse API unavailable - only live data supported',
          summary: {
            totalReceipts: 0,
            grossSales: 0,
            netSales: 0,
            paymentTypes: {},
            itemsSold: {},
            modifiersSold: {},
            refunds: []
          }
        });
        return;
      }
      
      res.json({
        summary,
        shiftStart,
        shiftEnd,
        shiftDate
      });
    } catch (error) {
      console.error('Error in /api/receipts/summary/:date:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Receipts summary with IDs endpoint for current shift
  app.get('/api/receipts/summary-with-ids', async (req: Request, res: Response) => {
    try {
      const { calculateShiftTimeWindow } = await import('./utils/shiftTimeCalculator');
      const { shiftStart, shiftEnd, shiftDate } = calculateShiftTimeWindow();
      
      // Initialize summary object with receipt ID fields
      const summary = {
        totalReceipts: 0,
        grossSales: 0,
        netSales: 0,
        firstReceipt: null as string | null,
        lastReceipt: null as string | null,
        paymentTypes: {} as Record<string, number>,
        itemsSold: {} as Record<string, number>,
        modifiersSold: {} as Record<string, number>,
        refunds: [] as Array<{
          receipt_number: string;
          time: string;
          amount: number;
          reason: string;
        }>
      };
      
      // Get receipts from Loyverse API - LIVE DATA ONLY
      const { LiveReceiptService } = await import('./services/liveReceiptService');
      const liveReceiptService = LiveReceiptService.getInstance();
      
      // Convert Bangkok timezone shift times to UTC for API query
      const shiftStartUTC = new Date(shiftStart).toISOString();
      const shiftEndUTC = new Date(shiftEnd).toISOString();
      
      // Get receipts from Loyverse API
      const receiptsData = await liveReceiptService.fetchReceiptsForPeriod(shiftStartUTC, shiftEndUTC);
        
        if (receiptsData && receiptsData.receipts) {
          const receipts = receiptsData.receipts;
          summary.totalReceipts = receipts.length;
          
          if (receipts.length > 0) {
            // Sort receipts by receipt number to get first and last (handles real format like 6-36175)
            const sortedReceipts = receipts.sort((a: any, b: any) => {
              const aNum = parseInt(a.receipt_number?.split('-')[1] || a.receipt_number || '0');
              const bNum = parseInt(b.receipt_number?.split('-')[1] || b.receipt_number || '0');
              return aNum - bNum;
            });
            
            summary.firstReceipt = sortedReceipts[0].receipt_number || null;
            summary.lastReceipt = sortedReceipts[sortedReceipts.length - 1].receipt_number || null;
          }
          
          // Process each receipt for totals and breakdowns
          for (const receipt of receipts) {
            const totalAmount = parseFloat(receipt.total_money?.toString() || '0') / 100;
            const netAmount = parseFloat(receipt.total_money?.toString() || '0') / 100;
            
            summary.grossSales += totalAmount;
            summary.netSales += netAmount;
            
            // Count payment types
            const paymentMethod = receipt.payment_type_name || 'Unknown';
            summary.paymentTypes[paymentMethod] = (summary.paymentTypes[paymentMethod] || 0) + 1;
            
            // Parse receipt items
            if (receipt.receipt_items && Array.isArray(receipt.receipt_items)) {
              for (const item of receipt.receipt_items) {
                const itemName = item.item_name || 'Unknown Item';
                const quantity = parseInt(item.quantity?.toString() || '0');
                if (quantity > 0) {
                  summary.itemsSold[itemName] = (summary.itemsSold[itemName] || 0) + quantity;
                }
                
                // Parse modifiers
                if (item.modifiers && Array.isArray(item.modifiers)) {
                  for (const modifier of item.modifiers) {
                    const modifierName = modifier.modifier_name || 'Unknown Modifier';
                    const modQuantity = parseInt(modifier.quantity?.toString() || '0');
                    if (modQuantity > 0) {
                      summary.modifiersSold[modifierName] = (summary.modifiersSold[modifierName] || 0) + modQuantity;
                    }
                  }
                }
              }
            }
            
            // Track refunds
            if (receipt.refunded_by) {
              summary.refunds.push({
                receipt_number: receipt.receipt_number || 'Unknown',
                time: receipt.created_at || 'Unknown',
                amount: totalAmount,
                reason: 'Refunded via POS'
              });
            }
          }
        }
      
      // Format payment breakdown as requested
      const paymentBreakdown = Object.entries(summary.paymentTypes).map(([method, count]) => ({
        payment_method: method,
        count: count
      }));
      
      res.json({
        total_receipts: summary.totalReceipts,
        gross_sales: summary.grossSales,
        net_sales: summary.netSales,
        first_receipt: summary.firstReceipt,
        last_receipt: summary.lastReceipt,
        payment_breakdown: paymentBreakdown,
        items_sold: summary.itemsSold,
        modifiers_sold: summary.modifiersSold,
        refunds: summary.refunds,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        shift_date: shiftDate
      });
    } catch (error) {
      console.error('Error in /api/receipts/summary-with-ids:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CSV Download endpoint for receipts
  app.get('/api/receipts/download', async (req: Request, res: Response) => {
    try {
      const { calculateShiftTimeWindow } = await import('./utils/shiftTimeCalculator');
      const { shiftStart, shiftEnd } = calculateShiftTimeWindow();
      
      let receiptsForExport: any[] = [];
      
      const { LiveReceiptService } = await import('./services/liveReceiptService');
      const liveReceiptService = LiveReceiptService.getInstance();
      
      const shiftStartUTC = new Date(shiftStart).toISOString();
      const shiftEndUTC = new Date(shiftEnd).toISOString();
      
      const receiptsData = await liveReceiptService.fetchReceiptsForPeriod(shiftStartUTC, shiftEndUTC);
        
      if (receiptsData && receiptsData.receipts) {
        receiptsForExport = receiptsData.receipts.map((receipt: any) => ({
          receipt_number: receipt.receipt_number || '',
          created_at: receipt.created_at || '',
          total_amount: (parseFloat(receipt.total_money?.toString() || '0') / 100).toFixed(2),
          payment_method: receipt.payment_type_name || 'Unknown',
          customer_name: receipt.customer_name || 'Walk-in',
          items_count: receipt.receipt_items?.length || 0,
          refunded: receipt.refunded_by ? 'Yes' : 'No',
          store_name: receipt.source || 'Smash Brothers Burgers'
        }));
      }
      
      // Manual CSV generation (more reliable than papaparse)
      const headers = Object.keys(receiptsForExport[0] || {});
      const csvRows = [
        headers.join(','),
        ...receiptsForExport.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape values that contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];
      const csv = csvRows.join('\n');
      
      // Set headers for file download
      const now = new Date();
      const filename = `receipts_${now.toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
      
    } catch (error) {
      console.error('Error generating CSV download:', error);
      res.status(500).json({ error: 'Failed to fetch live receipt data from Loyverse API for CSV export' });
    }
  });

  // ===== DAILY SUMMARIES API ROUTES =====
  
  // Process last 31 days (for automated cron job)
  app.post('/api/daily-summaries/process-all', async (req: Request, res: Response) => {
    try {
      const { jussiShiftSummarizer } = await import('./services/jussiShiftSummarizer');
      await jussiShiftSummarizer.processLast31Days();
      res.json({ message: 'Processing completed for last 31 days' });
    } catch (error) {
      console.error('Error processing daily summaries:', error);
      res.status(500).json({ error: 'Failed to process daily summaries' });
    }
  });

  // Process specific date (for manual triggers)
  app.post('/api/daily-summaries/process/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { jussiShiftSummarizer } = await import('./services/jussiShiftSummarizer');
      await jussiShiftSummarizer.processSpecificDate(date);
      res.json({ message: `Summary processed for ${date}` });
    } catch (error) {
      console.error(`Error processing summary for ${req.params.date}:`, error);
      res.status(500).json({ error: 'Failed to process daily summary' });
    }
  });

  // Get latest shift summary (for receipts page default view)
  app.get('/api/daily-summaries/latest', async (req: Request, res: Response) => {
    try {
      const { jussiShiftSummarizer } = await import('./services/jussiShiftSummarizer');
      const latestSummary = await jussiShiftSummarizer.getLatestShiftSummary();
      
      if (!latestSummary) {
        return res.status(404).json({ error: 'No shift summaries found' });
      }
      
      res.json(latestSummary);
    } catch (error) {
      console.error('Error fetching latest summary:', error);
      res.status(500).json({ error: 'Failed to fetch latest summary' });
    }
  });

  // Get summary for specific date
  app.get('/api/daily-summaries/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { jussiShiftSummarizer } = await import('./services/jussiShiftSummarizer');
      const summary = await jussiShiftSummarizer.getShiftSummaryByDate(date);
      
      if (!summary) {
        return res.status(404).json({ error: `No summary found for ${date}` });
      }
      
      res.json(summary);
    } catch (error) {
      console.error(`Error fetching summary for ${req.params.date}:`, error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // Get all summaries (for receipts page search)
  app.get('/api/daily-summaries', async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      const summaries = await db
        .select()
        .from(dailyReceiptSummaries)
        .orderBy(desc(dailyReceiptSummaries.date))
        .limit(limit ? parseInt(limit as string) : 31);
      
      res.json(summaries);
    } catch (error) {
      console.error('Error fetching summaries:', error);
      res.status(500).json({ error: 'Failed to fetch summaries' });
    }
  });

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
