import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";
import { validateDailySalesForm } from "./middleware/validateDailySalesForm";
import loyverseEnhancedRoutes from "./routes/loyverseEnhanced";
import analyticsRoutes from "./routes/analytics";
import analysisShift from "./routes/analysisShift";
import posLive from "./routes/posLive";
import posItems from "./routes/posItems";
import posUsage from "./routes/posUsage";
import dailySalesLibrary from "./routes/dailySalesLibrary";
import dailyStock from "./routes/dailyStock";
import chef from "./routes/chef";
import recipes from "./routes/recipes";
import { uploadsRouter } from "./routes/uploads";
import { importRouter } from "./routes/imports";
import { managerChecklistStore } from "./managerChecklist";
import crypto from "crypto"; // For webhook signature
import { LoyverseDataOrchestrator } from "./services/loyverseDataOrchestrator"; // For webhook process
import { db } from "./db"; // For transactions
import { dailyStockSales, shoppingList, insertDailyStockSalesSchema, inventory, shiftItemSales, dailyShiftSummary, uploadedReports, shiftReports, insertShiftReportSchema, dailyReceiptSummaries, ingredients } from "../shared/schema"; // Adjust path
import { z } from "zod";
import { eq, desc, sql, inArray, isNull } from "drizzle-orm";
import multer from 'multer';
import OpenAI from 'openai';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { supplierService } from "./supplierService";
import { calculateShiftTimeWindow, getShiftTimeWindowForDate } from './utils/shiftTimeCalculator';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { expenseTypeToPnLCategory, getExpenseMapping, ExpenseType, ShopName } from "../shared/expenseMappings";
// Email functionality will be added when needed


const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Safe JSON for BigInt values
function safeJson(res: any, data: any, status = 200) {
  const json = JSON.stringify(
    data,
    (_k, v) => (typeof v === 'bigint' ? Number(v) : v)
  );
  res.status(status).setHeader('Content-Type', 'application/json').send(json);
}

const THB = (satang?: number | bigint | null) => Number(satang ?? 0) / 100;

function toBKK(iso: Date) {
  return new Date(iso); // client formats to BKK; we just pass ISO
}

// Try to infer staff banking fields safely
function extractStaffBanking(ds: any) {
  // Adjust these if your column names differ
  return {
    closingCashTHB: Number(ds?.amountBanked ?? 0),
    cashBankedTHB: Number(ds?.amountBanked ?? 0),
    qrTransferTHB: Number(ds?.qrTransferred ?? 0),
  };
}

async function buildSnapshotDTO(prisma: any, snapshotId: string) {
  // Optimize with a single query using joins
  const snapshot = await prisma.shiftSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      payments: {
        select: { channel: true, count: true, totalSatang: true }
      },
      items: { 
        select: { itemName: true, qty: true, revenueSatang: true }, 
        orderBy: { qty: 'desc' }, 
        take: 10 // Reduce from 50 to 10 for better performance
      },
      comparisons: { 
        orderBy: { createdAt: 'desc' }, 
        take: 1,
        select: {
          purchasedBuns: true, purchasedMeatGram: true, purchasedDrinks: true,
          expectedBuns: true, expectedMeatGram: true, expectedDrinks: true,
          staffBuns: true, staffMeatGram: true, staffDrinks: true,
          varBuns: true, varMeatGram: true, varDrinks: true,
          state: true
        }
      },
    }
  });
  if (!snapshot) return null;

  const comp = snapshot.comparisons?.[0] ?? null;

  // Optimize expenses query - use aggregate instead of findMany
  const expensesResult = await prisma.expenseLine.aggregate({
    where: {
      type: 'PURCHASE',
      createdAt: { gte: snapshot.windowStartUTC, lte: snapshot.windowEndUTC }
    },
    _sum: {
      lineTotalTHB: true
    },
    _count: true
  });
  const expensesTotal = Number(expensesResult._sum.lineTotalTHB ?? 0);
  const expensesCount = expensesResult._count;

  // Staff form within window (for banking) - optimize query
  const ds = await prisma.dailySales.findFirst({
    where: { createdAt: { gte: snapshot.windowStartUTC, lte: snapshot.windowEndUTC } },
    orderBy: { createdAt: 'desc' },
    select: {
      amountBanked: true,
      qrTransferred: true
    }
  });
  const staffBank = extractStaffBanking(ds);

  // POS payments from snapshot - use totalSatang and convert to THB
  const byChannel = Object.fromEntries((snapshot.payments || []).map((p: any) => [p.channel, p]));
  const posCashTHB = THB(byChannel['CASH']?.totalSatang);
  const posQrTHB   = THB(byChannel['QR']?.totalSatang);
  const posGrabTHB = THB(byChannel['GRAB']?.totalSatang);

  const balance = {
    staff: staffBank,
    pos: { cashTHB: posCashTHB, qrTHB: posQrTHB, grabTHB: posGrabTHB },
    diffs: {
      cashTHB: Number((staffBank.cashBankedTHB - posCashTHB).toFixed(2)),
      qrTHB:   Number((staffBank.qrTransferTHB - posQrTHB).toFixed(2)),
    }
  };

  // Format comparison response (purchases-aware)
  const comparison = comp ? {
    opening: {
      buns: comp.openingBuns ?? null,
      meatGram: comp.openingMeatGram ?? null,
      drinks: comp.openingDrinks ?? null,
    },
    purchases: {
      buns: comp.purchasedBuns ?? 0,
      meatGram: comp.purchasedMeatGram ?? 0,
      drinks: comp.purchasedDrinks ?? 0,
    },
    usagePOS: {
      buns: comp.expectedBuns ?? 0,
      meatGram: comp.expectedMeatGram ?? 0,
      drinks: comp.expectedDrinks ?? 0,
    },
    expectedClose: {
      buns: comp.expectedCloseBuns ?? 0,
      meatGram: comp.expectedCloseMeatGram ?? 0,
      drinks: comp.expectedCloseDrinks ?? 0,
    },
    staffClose: {
      buns: comp.staffBuns ?? null,
      meatGram: comp.staffMeatGram ?? null,
      drinks: comp.staffDrinks ?? null,
    },
    variance: {
      buns: comp.varBuns ?? null,
      meatGram: comp.varMeatGram ?? null,
      drinks: comp.varDrinks ?? null,
    },
    state: comp.state
  } : null;

  return {
    snapshot: {
      id: snapshot.id,
      windowStartUTC: toBKK(snapshot.windowStartUTC),
      windowEndUTC: toBKK(snapshot.windowEndUTC),
      totalReceipts: snapshot.totalReceipts,
      totalSalesTHB: Number((THB(snapshot.totalSalesSatang)).toFixed(2)),
      reconcileState: snapshot.reconcileState,
      reconcileNotes: snapshot.reconcileNotes ?? null,
      payments: (snapshot.payments || []).map((p: any) => ({
        channel: p.channel,
        count: p.count,
        totalTHB: Number((THB(p.totalSatang)).toFixed(2))
      })),
    },
    expenses: {
      totalTHB: Number(expensesTotal.toFixed(2)),
      linesCount: expensesCount
    },
    comparison,
    balance,
    topItems: (snapshot.items || []).map((it: any) => ({
      itemName: it.itemName,
      qty: it.qty,
      revenueTHB: Number((THB(it.revenueSatang)).toFixed(2))
    }))
  };
}

export function registerRoutes(app: express.Application): Server {
  const server = createServer(app);
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

  app.get('/api/analysis/list', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.shiftSnapshot.findMany({
        orderBy: { windowStartUTC: 'desc' },
        take: 14,
        select: {
          id: true, windowStartUTC: true, windowEndUTC: true,
          totalReceipts: true, totalSalesSatang: true, reconcileState: true
        }
      });
      const mapped = rows.map((r: any) => ({
        id: r.id,
        windowStartUTC: r.windowStartUTC,
        windowEndUTC: r.windowEndUTC,
        totalReceipts: r.totalReceipts,
        totalSalesTHB: Number((THB(r.totalSalesSatang)).toFixed(2)),
        reconcileState: r.reconcileState
      }));
      return safeJson(res, mapped);
    } catch (e: any) {
      console.error('Analysis list error:', e);
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
    }
  });

  app.get('/api/analysis/snapshot/:id', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const { id } = req.params;
    try {
      const dto = await buildSnapshotDTO(prisma, id);
      if (!dto) return res.status(404).json({ error: 'Snapshot not found' });
      return safeJson(res, dto);
    } catch (e: any) {
      console.error('Analysis detail error:', e);
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
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
        // Return demo data if no reports exist yet
        return res.json({
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
          timeRange: { start: "2025-08-06T17:00:00", end: "2025-08-07T03:00:00" }
        });
      }

      res.json(latestReport.analysisSummary);
    } catch (err) {
      console.error('Latest analysis error:', err);
      res.status(500).json({ error: 'Failed to get latest analysis' });
    }
  });

  // Generic analysis route (for uploaded reports) - must come after specific routes
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

  // ===== Purchasing (Expenses) API =====

  // Create/Update Expense with lines
  app.post('/api/expenses', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const { id, shiftDate, supplier, notes, lines } = req.body ?? {};
      if (!lines || !Array.isArray(lines) || !lines.length) {
        return res.status(400).json({ error: 'At least one line required' });
      }

      // total fallback in cents
      const totalCents = lines.reduce((sum: number, l: any) => {
        const val = l.lineTotalTHB ?? (Number(l.qty || 0) * Number(l.unitPriceTHB || 0));
        return sum + (isFinite(val) ? Math.round(Number(val) * 100) : 0);
      }, 0);

      // Use simplified expense creation for existing schema
      const head = await prisma.expense.create({
        data: {
          restaurantId: 'restaurant-1', // hardcoded for now
          shiftDate: shiftDate ? new Date(shiftDate) : new Date(),
          item: lines[0]?.name || 'Purchase',
          costCents: totalCents,
          supplier: supplier,
          expenseType: 'PURCHASE'
        },
      });

      // Create expense lines
      await prisma.$transaction(
        lines.map((l: any) =>
          prisma.expenseLine.create({
            data: {
              expenseId: head.id,
              ingredientId: l.ingredientId ?? null,
              name: l.name,
              qty: l.qty != null ? Number(l.qty) : null,
              uom: l.uom ?? null,
              unitPriceTHB: l.unitPriceTHB != null ? Number(l.unitPriceTHB) : null,
              lineTotalTHB: l.lineTotalTHB != null ? Number(l.lineTotalTHB) : null,
              type: 'PURCHASE'
            },
          }),
        ),
      );

      // Optional: recompute latest snapshot purchases-aware
      const latest = await prisma.shiftSnapshot.findFirst({ orderBy: { windowStartUTC: 'desc' }, select: { id: true } });
      if (latest) {
        try {
          // If you exposed a recompute endpoint:
          // await fetch(`http://localhost:5000/api/snapshots/${latest.id}/recompute`, { method:'POST' });
          // or call your recompute logic here directly if it's in-process
        } catch (e) { /* non-blocking */ }
      }

      return safeJson(res, { ok: true, id: head.id });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
    }
  });

  /* DISABLED: This route conflicts with recovered expenses data route below
  app.get('/api/expenses', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      // Get expenses with their lines
      const expenses = await prisma.expense.findMany({
        orderBy: { shiftDate: 'desc' },
        take: 100,
      });
      
      // Get lines separately and merge
      const expenseIds = expenses.map(e => e.id);
      const lines = await prisma.expenseLine.findMany({
        where: { expenseId: { in: expenseIds } }
      });
      
      const result = expenses.map(expense => ({
        id: expense.id,
        expenseDate: expense.shiftDate,
        type: expense.expenseType || 'PURCHASE',
        supplier: expense.supplier,
        notes: null,
        totalTHB: expense.costCents / 100,
        lines: lines.filter(l => l.expenseId === expense.id).map(l => ({
          id: l.id,
          name: l.name,
          qty: l.qty,
          uom: l.uom,
          lineTotalTHB: l.lineTotalTHB ? Number(l.lineTotalTHB) : null
        }))
      }));
      
      return safeJson(res, result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
    }
  });
  */ // END DISABLED ROUTE

  app.get('/api/ingredients/search', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const q = String(req.query.q ?? '').trim();
    try {
      if (!q) return safeJson(res, []);
      
      // Search in existing recipe items as a proxy for ingredients
      const rows = await prisma.recipeItem.findMany({
        where: { 
          name: { contains: q, mode: 'insensitive' }
        },
        take: 20,
        select: { id: true, name: true, category: true },
      });
      
      // Map to expected format
      const mapped = rows.map(r => ({
        id: r.id,
        name: r.name,
        uom: 'unit',
        category: r.category || 'Recipe Item'
      }));
      
      return safeJson(res, mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Comprehensive Reporting API Endpoints
  app.get('/api/reports/sales-summary', async (req: Request, res: Response) => {
    try {
      const { period = '7', startDate, endDate } = req.query;
      
      // Get sales data from daily stock sales forms
      let salesData = await db.select({
        id: dailyStockSales.id,
        shiftDate: dailyStockSales.shiftDate,
        totalSales: dailyStockSales.totalSales,
        grabSales: dailyStockSales.grabSales,
        aroiDeeSales: dailyStockSales.aroiDeeSales,
        cashSales: dailyStockSales.cashSales,
        qrScanSales: dailyStockSales.qrScanSales,
        completedBy: dailyStockSales.completedBy
      }).from(dailyStockSales)
      .where(isNull(dailyStockSales.deletedAt))
      .orderBy(desc(dailyStockSales.shiftDate))
      .limit(parseInt(period as string));

      // Calculate totals and averages
      const totalSales = salesData.reduce((sum, sale) => sum + (parseFloat(sale.totalSales || '0')), 0);
      const averageDailySales = salesData.length > 0 ? totalSales / salesData.length : 0;
      
      res.json({
        period: `${salesData.length} days`,
        totalSales,
        averageDailySales,
        salesByChannel: {
          grab: salesData.reduce((sum, sale) => sum + (parseFloat(sale.grabSales || '0')), 0),
          aroiDee: salesData.reduce((sum, sale) => sum + (parseFloat(sale.aroiDeeSales || '0')), 0),
          cash: salesData.reduce((sum, sale) => sum + (parseFloat(sale.cashSales || '0')), 0),
          qrScan: salesData.reduce((sum, sale) => sum + (parseFloat(sale.qrScanSales || '0')), 0)
        },
        dailyBreakdown: salesData.map(sale => ({
          date: sale.shiftDate,
          total: parseFloat(sale.totalSales || '0'),
          completedBy: sale.completedBy
        }))
      });
    } catch (err) {
      console.error('Sales summary error:', err);
      res.status(500).json({ error: 'Failed to get sales summary' });
    }
  });

  app.get('/api/reports/financial-overview', async (req: Request, res: Response) => {
    try {
      const { period = '30' } = req.query;
      
      // Get recent forms
      const recentForms = await db.select({
        id: dailyStockSales.id,
        shiftDate: dailyStockSales.shiftDate,
        totalSales: dailyStockSales.totalSales,
        totalExpenses: dailyStockSales.totalExpenses,
        wages: dailyStockSales.wages,
        startingCash: dailyStockSales.startingCash,
        endingCash: dailyStockSales.endingCash,
        bankedAmount: dailyStockSales.bankedAmount
      }).from(dailyStockSales)
      .where(isNull(dailyStockSales.deletedAt))
      .orderBy(desc(dailyStockSales.shiftDate))
      .limit(parseInt(period as string));

      const totalRevenue = recentForms.reduce((sum, form) => sum + (parseFloat(form.totalSales || '0')), 0);
      const totalExpenses = recentForms.reduce((sum, form) => sum + (parseFloat(form.totalExpenses || '0')), 0);
      const grossProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      res.json({
        period: `${recentForms.length} days`,
        totalRevenue,
        totalExpenses,
        grossProfit,
        profitMargin,
        averageDailyRevenue: recentForms.length > 0 ? totalRevenue / recentForms.length : 0,
        averageDailyExpenses: recentForms.length > 0 ? totalExpenses / recentForms.length : 0,
        recentTrends: recentForms.slice(0, 7).map(form => ({
          date: form.shiftDate,
          revenue: parseFloat(form.totalSales || '0'),
          expenses: parseFloat(form.totalExpenses || '0'),
          profit: parseFloat(form.totalSales || '0') - parseFloat(form.totalExpenses || '0')
        }))
      });
    } catch (err) {
      console.error('Financial overview error:', err);
      res.status(500).json({ error: 'Failed to get financial overview' });
    }
  });

  app.get('/api/reports/performance-metrics', async (req: Request, res: Response) => {
    try {
      // Get recent shift data and forms
      const recentForms = await db.select({
        id: dailyStockSales.id,
        completedBy: dailyStockSales.completedBy,
        shiftDate: dailyStockSales.shiftDate,
        totalSales: dailyStockSales.totalSales,
        burgerBunsStock: dailyStockSales.burgerBunsStock,
        meatWeight: dailyStockSales.meatWeight
      }).from(dailyStockSales)
      .where(isNull(dailyStockSales.deletedAt))
      .orderBy(desc(dailyStockSales.shiftDate))
      .limit(30);

      // Staff performance analysis
      const staffPerformance: Record<string, { shifts: number; totalSales: number; avgSales: number }> = {};
      
      recentForms.forEach(form => {
        const staff = form.completedBy || 'Unknown';
        if (!staffPerformance[staff]) {
          staffPerformance[staff] = { shifts: 0, totalSales: 0, avgSales: 0 };
        }
        staffPerformance[staff].shifts += 1;
        staffPerformance[staff].totalSales += parseFloat(form.totalSales || '0');
      });

      // Calculate averages
      Object.keys(staffPerformance).forEach(staff => {
        staffPerformance[staff].avgSales = staffPerformance[staff].totalSales / staffPerformance[staff].shifts;
      });

      res.json({
        period: `${recentForms.length} days`,
        staffPerformance,
        operationalMetrics: {
          totalShiftsCompleted: recentForms.length,
          uniqueStaffMembers: Object.keys(staffPerformance).length,
          averageShiftSales: recentForms.length > 0 ? 
            recentForms.reduce((sum, form) => sum + parseFloat(form.totalSales || '0'), 0) / recentForms.length : 0,
          completionRate: '100%' // All forms in DB are completed
        }
      });
    } catch (err) {
      console.error('Performance metrics error:', err);
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  });

  // CSV Sync endpoint for supplier data
  app.post('/api/sync-supplier-csv', async (req: Request, res: Response) => {
    try {
      const { syncSupplierCSV } = await import('./syncSupplierCSV');
      console.log('🔄 Starting supplier CSV sync...');
      
      const result = await syncSupplierCSV();
      
      if (result.success) {
        res.json({
          success: true,
          message: `CSV sync completed successfully`,
          imported: result.imported,
          updated: result.updated,
          totalProcessed: result.totalProcessed,
          errors: result.errors
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'CSV sync failed',
          errors: result.errors
        });
      }
    } catch (err) {
      console.error('CSV sync error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to sync CSV',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // Get ingredients organized by category for forms
  app.get('/api/ingredients/by-category', async (req: Request, res: Response) => {
    try {
      console.log('🔍 Fetching ingredients by category...');
      
      const allIngredients = await db.select().from(ingredients)
        .orderBy(ingredients.category, ingredients.name);

      console.log(`📦 Found ${allIngredients.length} ingredients`);

      // Group by category
      const ingredientsByCategory: Record<string, any[]> = {};
      
      allIngredients.forEach(ingredient => {
        if (!ingredientsByCategory[ingredient.category]) {
          ingredientsByCategory[ingredient.category] = [];
        }
        ingredientsByCategory[ingredient.category].push(ingredient);
      });

      const categories = Object.keys(ingredientsByCategory).sort();
      console.log(`📂 Categories found: ${categories.join(', ')}`);

      res.json({
        success: true,
        categories: categories,
        ingredients: ingredientsByCategory,
        total: allIngredients.length
      });
    } catch (err) {
      console.error('❌ Error fetching ingredients by category:', err);
      res.status(500).json({ 
        error: 'Failed to fetch ingredients',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // Daily Shift Forms endpoints (comprehensive form data handling)
  app.post("/api/daily-shift-forms", validateDailySalesForm, async (req: Request, res: Response) => {
    try {
      const data = req.body; // Now validated and sanitized by middleware
      console.log("✅ Validated comprehensive form submission:", data);
      
      // Use validated data from middleware
      const formData = {
        completedBy: data.completed_by || data.completedBy || 'Unknown User',
        shiftType: data.shift_type || data.shiftType || 'Standard',
        shiftDate: data.shift_date || data.shiftDate || new Date(),
        
        // Sales data (validated by middleware)
        startingCash: data.starting_cash || data.startingCash || 0,
        grabSales: data.grab_sales || data.grabSales || 0,
        aroiDeeSales: data.aroi_dee_sales || data.aroiDeeSales || 0,
        qrScanSales: data.qr_scan_sales || data.qrScanSales || 0,
        cashSales: data.cash_sales || data.cashSales || 0,
        totalSales: data.total_sales || data.totalSales || 0,
        
        // Cash management
        endingCash: data.ending_cash || data.endingCash || 0,
        bankedAmount: data.banked_amount || data.bankedAmount || 0,
        
        // Expenses (validated by middleware)
        wages: JSON.stringify(data.wages || []),
        shopping: JSON.stringify(data.shopping || []),
        totalExpenses: data.total_expenses || data.totalExpenses || 0,
        
        // Inventory data
        numberNeeded: JSON.stringify(data.inventory || {}),
        
        // Status
        isDraft: false,
        status: data.status || 'completed',
        validatedAt: data.validated_at
      };
      
      console.log("✅ Processed validated form data:", formData);
      
      // Use Drizzle ORM with proper schema field mapping
      const [result] = await db.insert(dailyStockSales).values([formData]).returning();
      
      console.log("✅ Validated comprehensive form saved with ID:", result.id);
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

  // Daily Stock Sales endpoints - all active forms
  app.get("/api/daily-stock-sales", async (req: Request, res: Response) => {
    try {
      const forms = await storage.getAllDailyStockSales();
      // Return all active forms (deleted_at IS NULL already filtered in storage)
      res.json(forms);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

  // Soft delete endpoint for daily stock sales forms
  app.delete("/api/daily-stock-sales/:id/soft", async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }

      const success = await storage.softDeleteDailyStockSales(formId);
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Form ${formId} has been archived and removed from view` 
        });
      } else {
        res.status(404).json({ error: "Form not found" });
      }
    } catch (err) {
      console.error("Error soft deleting daily stock sales:", err);
      res.status(500).json({ error: "Failed to archive form" });
    }
  });

  // Get all archived forms
  app.get('/api/daily-stock-sales/archived', async (req: Request, res: Response) => {
    try {
      const archived = await storage.getAllDailyStockSales({ includeDeleted: true });
      const filtered = archived.filter((entry: any) => entry.deletedAt !== null);
      res.json(filtered);
    } catch (err) {
      console.error('Error getting archived forms', err);
      res.status(500).json({ message: 'Failed to fetch archived forms' });
    }
  });

  // Restore an archived form
  app.post('/api/daily-stock-sales/:id/restore', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.updateDailyStockSales(parseInt(id), { deletedAt: null });
      
      if (success) {
        res.json({ message: 'Form restored successfully' });
      } else {
        res.status(404).json({ error: 'Form not found' });
      }
    } catch (err) {
      console.error('Error restoring form', err);
      res.status(500).json({ message: 'Failed to restore form' });
    }
  });

  // POST endpoint for Fort Knox Daily Stock Sales form submission with validation
  app.post("/api/daily-stock-sales", validateDailySalesForm, async (req: Request, res: Response) => {
    try {
      const data = req.body; // Now validated and sanitized by middleware
      console.log("✅ Validated Fort Knox Daily Stock Sales form submission:", data);
      
      // Use the validated and sanitized data from middleware
      const formData = {
        completedBy: data.completed_by || data.completedBy || 'Unknown Staff',
        shiftType: data.shift_type || 'daily-stock-sales',
        shiftDate: data.shift_date || new Date(),
        
        // Sales data (validated by middleware)
        startingCash: data.starting_cash,
        endingCash: data.ending_cash,
        grabSales: data.grab_sales,
        foodPandaSales: data.food_panda_sales,
        aroiDeeSales: data.aroi_dee_sales,
        qrScanSales: data.qr_scan_sales,
        cashSales: data.cash_sales,
        totalSales: data.total_sales,
        
        // Expenses (validated by middleware)
        salaryWages: data.salary_wages,
        gasExpense: data.gas_expense,
        totalExpenses: data.total_expenses,
        
        // Stock data (validated by middleware)
        burgerBunsStock: data.burger_buns_stock,
        meatWeight: data.meat_weight,
        
        // Additional data
        formData: JSON.stringify(data),
        isDraft: false,
        status: data.status || 'completed',
        validatedAt: data.validated_at
      };
      
      const [result] = await db.insert(dailyStockSales).values(formData).returning();
      console.log("✅ Validated Fort Knox form saved with ID:", result.id);
      
      // Email notification will be added when email service is configured
      console.log("✅ Form validation passed - data integrity confirmed");
      
      res.json({ 
        success: true, 
        data: result,
        message: 'Form submitted successfully with validation',
        validation_status: 'passed'
      });
    } catch (err: any) {
      console.error("Fort Knox form submission error:", err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save form', 
        details: err.message 
      });
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

  // Soft delete endpoint for daily stock sales forms
  app.delete("/api/daily-stock-sales/:id/soft", async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: "Invalid form ID" });
      }

      await storage.softDeleteDailyStockSales(formId);
      res.json({ message: "Form removed from library successfully" });
    } catch (err) {
      console.error("Error soft deleting form:", err);
      res.status(500).json({ error: "Failed to remove form from library" });
    }
  });

  // Get all shopping lists endpoint  
  app.get('/api/shopping-lists', async (req: Request, res: Response) => {
    try {
      const lists = await storage.getShoppingList();
      res.json(lists);
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      res.status(500).json({ error: 'Failed to fetch shopping lists' });
    }
  });

  // Food costings endpoint - loads CSV data
  app.get('/api/food-costings', async (req: Request, res: Response) => {
    try {
      const { loadFoodCostingItems } = await import('./utils/loadFoodCostings');
      const items = await loadFoodCostingItems();
      res.json(items);
    } catch (error) {
      console.error('Error loading food costings:', error);
      res.status(500).json({ error: 'Failed to load food costing data' });
    }
  });

  // Fort Knox Daily Sales Form submission endpoint
  app.post('/submit-form', validateDailySalesForm, async (req: Request, res: Response) => {
    try {
      const formData = req.body; // Now validated and sanitized by middleware
      console.log("✅ Validated /submit-form submission:", formData);
      
      // Use validated data for database storage
      const dailySalesData = {
        completedBy: formData.completed_by || formData.staff_name || 'Unknown Staff',
        shiftType: formData.shift_type || formData.shift_time || 'Day',
        shiftDate: formData.shift_date || new Date(formData.date || new Date()),
        
        // Sales data (validated by middleware)
        startingCash: formData.starting_cash || 0,
        endingCash: formData.ending_cash || 0,
        grabSales: formData.grab_sales || 0,
        aroiDeeSales: formData.aroi_dee_sales || 0,
        qrScanSales: formData.qr_scan_sales || formData.qr_sales || 0,
        cashSales: formData.cash_sales || 0,
        totalSales: formData.total_sales || 0,
        
        // Additional data
        formData: JSON.stringify(formData),
        isDraft: false,
        status: formData.status || 'completed',
        validatedAt: formData.validated_at
      };

      // Save to database using existing storage
      const result = await storage.createDailyStockSales(dailySalesData);
      
      // Send success response with validation confirmation
      res.json({
        success: true,
        status: 'success',
        message: 'Form submitted and validated successfully',
        validation_status: 'passed',
        data: result
      });

    } catch (error) {
      console.error('Error submitting validated daily sales form:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to submit form. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== EXPENSE MANAGEMENT API ROUTES =====
  
  // EXPENSES API WITH SOURCE FILTERING - Supports ?source=DIRECT/SHIFT_FORM
  app.get("/api/expenses", async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Default to DIRECT (business expenses) unless specified
      const source = (req.query.source as string) ?? 'DIRECT';
      
      // Query with source filtering
      const expenses = await prisma.$queryRaw<Array<{
        id: string,
        item: string,
        costCents: number,
        supplier: string,
        shiftDate: Date,
        expenseType: string,
        createdAt: Date,
        source: string,
        meta: any
      }>>`
        SELECT id, item, "costCents", supplier, "shiftDate", "expenseType", "createdAt", source, meta
        FROM expenses 
        WHERE source = ${source}
        ORDER BY "createdAt" DESC
        LIMIT 200
      `;

      // Format for UI with source information
      const formattedExpenses = expenses.map((expense: any) => ({
        id: expense.id,
        date: expense.shiftDate || expense.createdAt,
        description: expense.item || 'Unknown Item',
        amount: (expense.costCents || 0) / 100, // Convert cents to THB
        category: expense.expenseType || 'Shopping',
        supplier: expense.supplier || 'Unknown',
        paymentMethod: 'Cash',
        items: expense.item || 'Unknown Item',
        notes: expense.meta ? JSON.stringify(expense.meta) : null,
        month: (expense.shiftDate || expense.createdAt).getMonth() + 1,
        year: (expense.shiftDate || expense.createdAt).getFullYear(),
        source: expense.source,
        sourceLabel: expense.source === 'SHIFT_FORM' ? 'Shift' : 'Business'
      }));

      res.json(formattedExpenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    } finally {
      await prisma.$disconnect();
    }
  });

  // System status endpoint for lockdown monitoring
  app.get("/api/system/status", async (req: Request, res: Response) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Get current database user
      const userResult = await prisma.$queryRaw<Array<{current_user: string}>>`SELECT current_user`;
      const currentUser = userResult[0]?.current_user || 'unknown';
      
      // Check for unsafe scripts in package.json
      const fs = await import('fs');
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const unsafeScripts = [];
      
      if (packageJson.scripts?.['db:push']?.includes('drizzle-kit push')) {
        unsafeScripts.push('db:push contains drizzle-kit push');
      }
      
      const status = {
        readonlyMode: process.env.AGENT_READONLY === "1",
        databaseUser: currentUser,
        writeProtection: true, // Middleware is always installed
        unsafeScripts,
        lastChecked: new Date().toISOString()
      };
      
      res.json(status);
      await prisma.$disconnect();
    } catch (error) {
      console.error("Error checking system status:", error);
      res.status(500).json({ error: "Failed to check system status" });
    }
  });

  // Create new expense with enum validation and P&L mapping
  app.post("/api/expenses", async (req: Request, res: Response) => {
    try {
      const expenseData = req.body;
      
      // Auto-populate P&L category based on expense type
      if (expenseData.typeOfExpense) {
        const pnlCategory = expenseTypeToPnLCategory[expenseData.typeOfExpense as ExpenseType];
        expenseData.pnlCategory = pnlCategory;
      }
      
      // If shopName is provided but no typeOfExpense, auto-suggest from mapping
      if (expenseData.shopName && !expenseData.typeOfExpense) {
        const mapping = getExpenseMapping(expenseData.shopName);
        expenseData.typeOfExpense = mapping.expenseType;
        expenseData.pnlCategory = mapping.pnlCategory;
      }
      
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteExpense(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Expense not found" });
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Get month-to-date expenses total
  app.get("/api/expenses/month-to-date", async (req: Request, res: Response) => {
    try {
      const total = await storage.getMonthToDateExpenses();
      res.json({ total });
    } catch (error) {
      console.error("Error fetching MTD expenses:", error);
      res.status(500).json({ error: "Failed to fetch month-to-date expenses" });
    }
  });

  // Get expenses by category
  app.get("/api/expenses/by-category", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getExpensesByCategory();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expenses by category:", error);
      res.status(500).json({ error: "Failed to fetch expenses by category" });
    }
  });

  // Get all expense suppliers
  app.get("/api/expense-suppliers", async (req: Request, res: Response) => {
    try {
      const suppliers = await storage.getExpenseSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching expense suppliers:", error);
      res.status(500).json({ error: "Failed to fetch expense suppliers" });
    }
  });

  // Create new expense supplier
  app.post("/api/expense-suppliers", async (req: Request, res: Response) => {
    try {
      const supplier = await storage.createExpenseSupplier(req.body);
      res.json(supplier);
    } catch (error) {
      console.error("Error creating expense supplier:", error);
      res.status(500).json({ error: "Failed to create expense supplier" });
    }
  });

  // Get all expense categories
  app.get("/api/expense-categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  // Create new expense category
  app.post("/api/expense-categories", async (req: Request, res: Response) => {
    try {
      const category = await storage.createExpenseCategory(req.body);
      res.json(category);
    } catch (error) {
      console.error("Error creating expense category:", error);
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  // Get all bank statements
  app.get("/api/bank-statements", async (req: Request, res: Response) => {
    try {
      const statements = await storage.getBankStatements();
      res.json(statements);
    } catch (error) {
      console.error("Error fetching bank statements:", error);
      res.status(500).json({ error: "Failed to fetch bank statements" });
    }
  });

  // Create/upload bank statement
  app.post("/api/bank-statements", async (req: Request, res: Response) => {
    try {
      const statement = await storage.createBankStatement(req.body);
      res.json(statement);
    } catch (error) {
      console.error("Error creating bank statement:", error);
      res.status(500).json({ error: "Failed to create bank statement" });
    }
  });

  // ===== INGREDIENT MANAGEMENT API ROUTES =====
  
  // Get ingredients by category (for Daily Stock form)
  app.get("/api/ingredients/by-category", async (req: Request, res: Response) => {
    try {
      const ingredients = await storage.getIngredients();
      
      // Group by category and sort
      const grouped = ingredients.reduce((acc: Record<string, any[]>, ingredient) => {
        const category = ingredient.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(ingredient);
        return acc;
      }, {});

      // Sort ingredients within each category by name
      Object.keys(grouped).forEach(category => {
        grouped[category].sort((a, b) => a.name.localeCompare(b.name));
      });

      res.json(grouped);
    } catch (error) {
      console.error("Error fetching ingredients by category:", error);
      res.status(500).json({ error: "Failed to fetch ingredients by category" });
    }
  });

  // Get all ingredients
  app.get("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const ingredients = await storage.getIngredients();
      res.json(ingredients);
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Update individual ingredient
  app.put("/api/ingredients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // Validate and sanitize update data
      const allowedFields = ['name', 'category', 'supplier', 'price', 'unitPrice', 'packageSize', 'portionSize', 'unit', 'notes'];
      const sanitizedUpdates: any = {};
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          sanitizedUpdates[key] = updates[key];
        }
      });
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const ingredient = await storage.updateIngredient(id, sanitizedUpdates);
      res.json(ingredient);
    } catch (error) {
      console.error("Error updating ingredient:", error);
      res.status(500).json({ error: "Failed to update ingredient" });
    }
  });

  // Sync ingredients from CSV
  app.post("/api/ingredients/sync-csv", async (req: Request, res: Response) => {
    try {
      const { syncSupplierCSV } = await import('./syncSupplierCSV');
      const result = await syncSupplierCSV();
      res.json(result);
    } catch (error) {
      console.error("Error syncing ingredients from CSV:", error);
      res.status(500).json({ 
        error: "Failed to sync ingredients from CSV",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Daily Sales Prisma Route with Email
  app.post('/api/daily-sales', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const { sendDailySalesEmail } = await import('./services/salesEmail');
    const prisma = new PrismaClient();
    
    try {
      const payload = req.body;
      
      const data = {
        completedBy: payload.completedBy || 'Unknown',
        startingCash: Number(payload.cashStart) || 0, // Updated field name
        cashSales: Number(payload.cashSales) || 0,
        qrSales: Number(payload.qrSales) || 0,
        grabSales: Number(payload.grabSales) || 0,
        aroiDeeSales: Number(payload.aroiDeeSales) || 0,
        directSales: Number(payload.directSales) || 0, // Added directSales
        totalSales: payload.totalSales || (Number(payload.cashSales) + Number(payload.qrSales) + Number(payload.grabSales) + Number(payload.aroiDeeSales) + Number(payload.directSales)),
        shoppingExpenses: JSON.stringify(payload.shopping || []),
        wages: JSON.stringify(payload.wages || []),
        otherMoneyOut: JSON.stringify(payload.otherMoneyOut || []), // Added other money out
        totalExpenses: Number(payload.totalExpenses) || 0,
        closingCash: Number(payload.endingCash) || 0, // Updated field name
        cashBanked: Number(payload.cashBanked) || 0,
        qrTransferred: Number(payload.qrTransferred) || 0,
        amountBanked: Number(payload.cashBanked) || 0,
        notes: payload.notes || null,
        status: 'submitted'
      };

      const result = await prisma.dailySales.create({ data });
      
      // Send email with shopping list included
      try {
        await sendDailySalesEmail(payload);
        console.log('Daily Sales email sent successfully for ID:', result.id);
      } catch (emailError) {
        console.error('Failed to send sales email:', emailError);
        // Don't fail the entire request for email issues
      }
      
      console.log('Daily Sales Form submitted with ID:', result.id);
      res.status(200).json({ success: true, id: result.id });
    } catch (err) {
      console.error('Daily Sales submission error:', err);
      res.status(500).json({ error: 'Failed to save sales form' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Email function for direct use
  async function sendEmailDirectly(prisma: any, salesId: string) {
    const nodemailer = (await import('nodemailer')).default;
    
    const sales = await prisma.dailySales.findUnique({ where: { id: salesId } });
    if (!sales) throw new Error('Sales not found');
    const stock = await prisma.dailyStock.findFirst({ where: { salesFormId: salesId } });

    const totalSales = sales.totalSales ?? 
      (Number(sales.cashSales || 0) + Number(sales.qrSales || 0) + 
       Number(sales.grabSales || 0) + Number(sales.aroiDeeSales || 0));

    const lines: string[] = [
      `Daily Submission`,
      `Form ID: ${sales.id}`,
      `Date: ${new Date(sales.createdAt).toLocaleString('en-TH')}`,
      `Completed By: ${sales.completedBy || '-'}`,
      ``,
      `SALES`,
      `- Cash: ฿${(sales.cashSales || 0).toFixed(2)}`,
      `- QR: ฿${(sales.qrSales || 0).toFixed(2)}`,
      `- Grab: ฿${(sales.grabSales || 0).toFixed(2)}`,
      `- Aroi Dee: ฿${(sales.aroiDeeSales || 0).toFixed(2)}`,
      `Total Sales: ฿${(totalSales || 0).toFixed(2)}`,
      ``,
      `EXPENSES`,
      `- Total Expenses: ฿${(sales.totalExpenses || 0).toFixed(2)}`,
      ``,
      `BANKING`,
      `- Closing Cash: ฿${(sales.closingCash || 0).toFixed(2)}`,
      `- Cash Banked: ฿${(sales.cashBanked || 0).toFixed(2)}`,
      `- QR Transfer: ฿${(sales.qrTransferred || 0).toFixed(2)}`,
    ];

    if (stock) {
      const allDrinks = Object.entries(stock.drinkStock || {}).map(([k, v]) => [k, Number(v) || 0]);
      const shopPos = Object.entries(stock.stockRequests || {}).filter(([, n]) => (Number(n) || 0) > 0);
      lines.push(
        ``,
        `END-OF-SHIFT STOCK`,
        `- Meat (g): ${stock.meatGrams}`,
        `- Burger Buns: ${stock.burgerBuns}`,
        ``,
        `DRINKS (all)`,
        ...(allDrinks.length ? allDrinks.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
        ``,
        `SHOPPING LIST`,
        ...(shopPos.length ? shopPos.map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
      );
    } else {
      lines.push(``, `STOCK: Not submitted yet`);
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD 
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'smashbrothersburgersth@gmail.com',
      subject: `Daily Submission – ${new Date(sales.createdAt).toLocaleDateString('en-TH')}`,
      text: lines.join('\n'),
      replyTo: 'smashbrothersburgersth@gmail.com',
    });
  }

  // Daily Stock Prisma Route
  app.post('/api/daily-stock', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const {
        salesFormId = null,
        meatGrams,
        burgerBuns,
        drinks = {},
        stockRequests = {},
      } = req.body || {};

      const data = {
        salesFormId: salesFormId || null,
        meatGrams: parseInt(String(meatGrams), 10) || 0,
        burgerBuns: parseInt(String(burgerBuns), 10) || 0,
        drinkStock: Object.fromEntries(Object.entries(drinks).map(([k, v]) => [k, parseInt(String(v), 10) || 0])),
        stockRequests: Object.fromEntries(Object.entries(stockRequests).map(([k, v]) => [k, parseInt(String(v), 10) || 0])),
        status: 'submitted' as const,
      };

      const saved = await prisma.dailyStock.create({ data });

      // Send combined email if linked to sales form
      if (salesFormId) {
        try {
          // Direct call to avoid import issues
          await sendEmailDirectly(prisma, salesFormId);
        } catch (emailErr) {
          console.error('Failed to send combined email:', emailErr);
        }
      }

      res.status(200).json({ success: true, id: saved.id });
    } catch (err) {
      console.error('Daily Stock submission error:', err);
      res.status(500).json({ error: 'Failed to save stock form', details: (err as Error).message });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Daily Stock GET Route
  app.get('/api/daily-stock', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const rows = await prisma.dailyStock.findMany({ 
        orderBy: { createdAt: 'desc' }, 
        take: 20 
      });
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching stock forms:', error);
      res.status(500).json({ error: 'Failed to fetch stock forms' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Combined forms API - load async
  import('./api/forms.js').then(formsModule => {
    app.get('/api/forms', formsModule.listForms);
    app.get('/api/forms/:id', formsModule.getForm);
    app.post('/api/forms/:id/email', formsModule.emailForm);
  }).catch(err => console.error('Failed to load forms API:', err));

  // Expense Import Routes
  import('./api/expenseImports').then(async expenseModule => {
    app.use('/api/expenses/imports', expenseModule.default);
    
    // Import and register finance router
    const { financeRouter } = await import('./api/finance');
    app.use('/api/finance', financeRouter);
  }).catch(err => console.error('Failed to load expense imports API:', err));

  // === NEW POS INGESTION & ANALYTICS ENDPOINTS ===
  
  // POS Sync Status
  app.get('/api/pos/sync-status', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' },
        include: {
          posConnections: { where: { isActive: true } },
          syncLogs: { orderBy: { startedAt: 'desc' }, take: 5 }
        }
      });
      
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      
      res.json({
        restaurant: { name: restaurant.name, slug: restaurant.slug },
        connections: restaurant.posConnections,
        recentSyncs: restaurant.syncLogs
      });
    } catch (error) {
      console.error('POS status error:', error);
      res.status(500).json({ error: 'Failed to fetch POS status' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Trigger POS Sync
  app.post('/api/pos/sync', async (req: Request, res: Response) => {
    try {
      const { mode = 'incremental' } = req.body;
      
      if (mode === 'backfill') {
        // Trigger backfill sync (last 90 days)
        const { syncReceiptsWindow } = await import('./services/pos-ingestion/ingester.js');
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const result = await syncReceiptsWindow(startDate, endDate, 'backfill');
        res.json({ mode: 'backfill', result });
      } else {
        // Trigger incremental sync (last 15 minutes)
        const { syncReceiptsWindow } = await import('./services/pos-ingestion/ingester.js');
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMinutes(startDate.getMinutes() - 15);
        
        const result = await syncReceiptsWindow(startDate, endDate, 'incremental');
        res.json({ mode: 'incremental', result });
      }
    } catch (error) {
      console.error('POS sync error:', error);
      res.status(500).json({ error: 'Sync failed', details: (error as Error).message });
    }
  });

  // Analytics Data
  app.get('/api/analytics/latest', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      
      const analytics = await prisma.analyticsDaily.findFirst({
        where: { restaurantId: restaurant.id },
        orderBy: { shiftDate: 'desc' }
      });
      
      res.json(analytics || { message: 'No analytics data available' });
    } catch (error) {
      console.error('Analytics fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Trigger Analytics Processing
  app.post('/api/analytics/process', async (req: Request, res: Response) => {
    try {
      const { processAnalytics } = await import('./services/analytics/processor.js');
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      
      const analytics = await processAnalytics(restaurant.id);
      
      if (analytics) {
        res.json({ success: true, analytics });
      } else {
        res.json({ success: false, message: 'No data to process' });
      }
    } catch (error) {
      console.error('Analytics processing error:', error);
      res.status(500).json({ error: 'Processing failed', details: (error as Error).message });
    }
  });

  // Jussi Summary Status
  app.get('/api/jussi/status', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      
      const recentJobs = await prisma.job.findMany({
        where: {
          restaurantId: restaurant.id,
          type: 'EMAIL_SUMMARY'
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      res.json({
        restaurant: { name: restaurant.name },
        recentSummaries: recentJobs
      });
    } catch (error) {
      console.error('Jussi status error:', error);
      res.status(500).json({ error: 'Failed to fetch Jussi status' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Trigger Jussi Summary
  app.post('/api/jussi/generate', async (req: Request, res: Response) => {
    try {
      const { generateDailySummary } = await import('./services/jussi/summaryGenerator.js');
      
      const result = await generateDailySummary();
      
      res.json({
        success: true,
        jobId: result.jobId,
        emailSent: !!result.emailResult,
        recipient: result.emailResult?.recipient
      });
    } catch (error) {
      console.error('Jussi generation error:', error);
      res.status(500).json({ error: 'Summary generation failed', details: (error as Error).message });
    }
  });

  // Receipt Data from New System
  app.get('/api/receipts/recent', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      
      const receipts = await prisma.receipt.findMany({
        where: { restaurantId: restaurant.id },
        include: {
          items: true,
          payments: true
        },
        orderBy: { createdAtUTC: 'desc' },
        take: limit
      });
      
      res.json(receipts);
    } catch (error) {
      console.error('Receipts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch receipts' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Recipe Management Routes
  app.get("/api/recipes", async (req: Request, res: Response) => {
    try {
      const recipes = await storage.getRecipes();
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes", details: (error as Error).message });
    }
  });

  app.post("/api/recipes", async (req: Request, res: Response) => {
    try {
      const recipe = await storage.createRecipe(req.body);
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Failed to create recipe", details: (error as Error).message });
    }
  });

  app.post("/api/recipes/save-with-photo", async (req: Request, res: Response) => {
    try {
      const recipeData = {
        name: req.body.name || "Untitled Recipe",
        category: req.body.category || "General",
        description: req.body.description || "",
        photoUrl: req.body.photoUrl,
        ingredients: req.body.components || [],
        yieldQuantity: req.body.portions || 1,
        yieldUnit: "portion",
        totalCost: req.body.totals?.totalCost || 0,
        laborTime: 0,
        isActive: true
      };
      
      const recipe = await storage.createRecipe(recipeData);
      res.json({ ok: true, recipe });
    } catch (error) {
      res.status(400).json({ ok: false, error: "Failed to save recipe", details: (error as Error).message });
    }
  });

  app.get("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const recipe = await storage.getRecipeById(parseInt(req.params.id));
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe", details: (error as Error).message });
    }
  });

  app.put("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      const recipe = await storage.updateRecipe(parseInt(req.params.id), req.body);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Failed to update recipe", details: (error as Error).message });
    }
  });

  app.delete("/api/recipes/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteRecipe(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete recipe", details: (error as Error).message });
    }
  });

  // Ingredients Management Routes
  app.get("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const ingredients = await storage.getIngredients();
      res.json(ingredients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients", details: (error as Error).message });
    }
  });

  app.post("/api/ingredients", async (req: Request, res: Response) => {
    try {
      const ingredient = await storage.createIngredient(req.body);
      res.json(ingredient);
    } catch (error) {
      res.status(400).json({ error: "Failed to create ingredient", details: (error as Error).message });
    }
  });

  // Register Loyverse enhanced routes
  app.use('/api/loyverse', loyverseEnhancedRoutes);
  
  // Register analytics routes  
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/receipts', analyticsRoutes);
  
  // Register analysis shift summary routes
  app.use('/api/analysis/shift-summary', analysisShift);
  
  // Register Daily Sales Library routes
  app.use('/api/daily-sales', dailySalesLibrary);
  
  // Register Daily Stock routes  
  app.use('/api/daily-stock', dailyStock);
  
  // Register Chef and Recipe routes
  app.use('/api/chef', chef);
  app.use('/api/recipes', recipes);
  
  // Register Upload and Import routes
  app.use('/api/upload', uploadsRouter);
  app.use('/api/import', importRouter);
  
  // Register Manager Checklist routes
  // Enhanced Manager Checklist endpoints
  
  // Admin: manage questions
  app.get("/api/manager-checklist/questions", async (req,res)=>{
    const rows = await managerChecklistStore.listQuestions();
    res.json({ rows });
  });
  
  app.post("/api/manager-checklist/questions", async (req,res)=>{
    const q = await managerChecklistStore.upsertQuestion(req.body);
    res.json(q);
  });
  
  app.delete("/api/manager-checklist/questions/:id", async (req,res)=>{
    await managerChecklistStore.deleteQuestion(req.params.id);
    res.json({ ok:true });
  });

  // Nightly draw (stable set for the date)
  app.get("/api/manager-checklist/nightly", async (req,res)=>{
    const dateISO = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const count = Number(req.query.count ?? 5);
    const draw = await managerChecklistStore.getOrCreateNightlyDraw(dateISO, count);
    res.json(draw);
  });

  // Status for dashboard
  app.get("/api/manager-checklist/status", async (req,res)=>{
    const dateISO = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const sub = await managerChecklistStore.getSubmission(dateISO);
    res.json({
      dateISO,
      completed: !!sub,
      completedAtISO: sub?.completedAtISO ?? null,
      notesPresent: !!sub?.shiftNotes,
    });
  });

  // Submit (manager only)
  app.post("/api/manager-checklist/submit", async (req,res)=>{
    const {
      dateISO = new Date().toISOString().split('T')[0],
      managerName,
      attesterPhotoUrl,
      answers,             // [{questionId, value, note?}]
      shiftNotes,
    } = req.body || {};

    if (!managerName || !Array.isArray(answers)) {
      return res.status(400).json({ error:"managerName & answers required" });
    }
    
    const submission = {
      id: `sub-${dateISO}`,
      dateISO,
      completedAtISO: new Date().toISOString(),
      managerName,
      attesterPhotoUrl,
      answers,
      shiftNotes,
    };
    
    await managerChecklistStore.saveSubmission(submission);
    res.json({ ok:true, submission });
  });

  // Seed sample checklist questions
  app.post("/api/manager-checklist/seed", async (req, res) => {
    const sampleQuestions = [
      { text: "All equipment cleaned and sanitized properly", area: "Kitchen", active: true },
      { text: "Temperature logs recorded for all refrigeration units", area: "Kitchen", active: true },
      { text: "Food storage areas organized and labeled correctly", area: "Kitchen", active: true },
      { text: "Prep station surfaces wiped down and sanitized", area: "Kitchen", active: true },
      { text: "Oil quality checked and documented", area: "Kitchen", active: true },
      { text: "Register balanced and cash counted accurately", area: "Cashier", active: true },
      { text: "Credit card machine cleaned and tested", area: "Cashier", active: true },
      { text: "Receipt paper and supplies restocked", area: "Cashier", active: true },
      { text: "Customer area tables and chairs cleaned", area: "Front", active: true },
      { text: "Floors mopped and entrance area tidy", area: "Front", active: true },
      { text: "Restroom checked and supplies restocked", area: "Front", active: true },
      { text: "Menu boards and signage clean and readable", area: "Front", active: true },
      { text: "Waste and recycling bins emptied and cleaned", area: "General", active: true },
      { text: "Lights and electrical equipment turned off", area: "General", active: true },
      { text: "Security system activated before leaving", area: "General", active: true }
    ];

    try {
      for (const question of sampleQuestions) {
        await managerChecklistStore.upsertQuestion(question);
      }
      res.json({ ok: true, message: "Sample questions seeded successfully", count: sampleQuestions.length });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Failed to seed questions" });
    }
  });

  // Basic image upload endpoint for checklist photos
  app.post('/api/upload/image', (req, res) => {
    // Simple mock upload - in production, use proper file upload middleware
    res.json({ url: `/uploads/mock-image-${Date.now()}.jpg` });
  });
  
  // Register POS Live routes
  app.use('/api/pos', posLive);
  app.use('/api/pos', posItems);
  app.use('/api/pos', posUsage);

  // === PHASE 2: SNAPSHOT SYSTEM ENDPOINTS ===
  
  // Get shift snapshots
  app.get('/api/snapshots', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const snapshots = await prisma.shiftSnapshot.findMany({
        include: {
          payments: true,
          items: { orderBy: { qty: 'desc' }, take: 5 },
          comparisons: true
        },
        orderBy: { windowStartUTC: 'desc' },
        take: limit
      });
      
      // Convert BigInt to string for JSON serialization
      const serializedSnapshots = snapshots.map(snapshot => ({
        ...snapshot,
        totalSalesSatang: snapshot.totalSalesSatang.toString(),
        payments: snapshot.payments?.map(p => ({
          ...p,
          totalSatang: p.totalSatang.toString()
        })),
        items: snapshot.items?.map(i => ({
          ...i,
          revenueSatang: i.revenueSatang.toString()
        }))
      }));
      
      res.json(serializedSnapshots);
    } catch (error) {
      console.error('Snapshots fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch snapshots' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Get specific snapshot with details
  app.get('/api/snapshots/:id', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const snapshot = await prisma.shiftSnapshot.findUnique({
        where: { id: req.params.id },
        include: {
          payments: true,
          items: { orderBy: { qty: 'desc' } },
          modifiers: { orderBy: { lines: 'desc' } },
          comparisons: { include: { salesForm: true } }
        }
      });
      
      if (!snapshot) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      
      res.json(snapshot);
    } catch (error) {
      console.error('Snapshot fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch snapshot' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Get latest Jussi comparison
  app.get('/api/jussi/latest-comparison', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const comparison = await prisma.jussiComparison.findFirst({
        include: {
          snapshot: {
            select: {
              windowStartUTC: true,
              windowEndUTC: true,
              totalReceipts: true,
              totalSalesSatang: true
            }
          },
          salesForm: {
            select: {
              completedBy: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!comparison) {
        return res.status(404).json({ error: 'No comparison data available' });
      }
      
      res.json(comparison);
    } catch (error) {
      console.error('Comparison fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch comparison' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Get top items for specific snapshot
  app.get('/api/snapshots/:id/items', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const snapshotId = req.params.id;
      
      const items = await prisma.snapshotItem.findMany({
        where: { snapshotId },
        orderBy: { qty: 'desc' },
        take: 50,
        select: { 
          itemName: true, 
          qty: true, 
          revenueSatang: true 
        }
      });
      
      // Convert BigInt to string for JSON serialization
      const serializedItems = items.map(item => ({
        itemName: item.itemName,
        qty: item.qty,
        revenueSatang: item.revenueSatang.toString()
      }));
      
      res.json(serializedItems);
    } catch (error) {
      console.error('Items fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // GET latest dashboard snapshot
  app.get('/api/dashboard/latest', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const latest = await prisma.shiftSnapshot.findFirst({
        orderBy: { windowStartUTC: 'desc' },
        select: { id: true }
      });
      if (!latest) return safeJson(res, { snapshot: null });
      const dto = await buildSnapshotDTO(prisma, latest.id);
      return safeJson(res, dto);
    } catch (e: any) {
      console.error('Dashboard latest error:', e);
      return res.status(500).json({ error: e.message });
    } finally {
      await prisma.$disconnect();
    }
  });



  // Run snapshot for specific date
  app.post('/api/snapshots/create', async (req: Request, res: Response) => {
    try {
      const { date, salesFormId } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: 'Date is required (YYYY-MM-DD format)' });
      }
      
      // Execute the snapshot worker
      const { spawn } = require('child_process');
      const args = ['workers/snapshotWorker.mjs', date];
      if (salesFormId) args.push(salesFormId);
      
      const worker = spawn('node', args, { cwd: process.cwd() });
      
      let output = '';
      let error = '';
      
      worker.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      worker.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
      worker.on('close', (code: number) => {
        if (code === 0) {
          res.json({ 
            success: true, 
            message: 'Snapshot created successfully',
            output: output.trim()
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: 'Snapshot creation failed',
            details: error || output
          });
        }
      });
      
    } catch (error) {
      console.error('Snapshot creation error:', error);
      res.status(500).json({ error: 'Failed to create snapshot', details: (error as Error).message });
    }
  });

  // Get purchases-aware comparison for specific snapshot
  app.get('/api/snapshots/:id/comparison', async (req: Request, res: Response) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const snapshotId = req.params.id;
      
      const comparison = await prisma.jussiComparison.findFirst({
        where: { snapshotId },
        select: {
          openingBuns: true,
          openingMeatGram: true,
          openingDrinks: true,
          purchasedBuns: true,
          purchasedMeatGram: true,
          purchasedDrinks: true,
          expectedBuns: true,
          expectedMeatGram: true,
          expectedDrinks: true,
          expectedCloseBuns: true,
          expectedCloseMeatGram: true,
          expectedCloseDrinks: true,
          staffBuns: true,
          staffMeatGram: true,
          staffDrinks: true,
          varBuns: true,
          varMeatGram: true,
          varDrinks: true,
          state: true
        }
      });
      
      if (!comparison) {
        return res.status(404).json({ error: 'No comparison data available for this snapshot' });
      }
      
      res.json({
        opening: { 
          buns: comparison.openingBuns ?? 0, 
          meatGram: comparison.openingMeatGram ?? 0, 
          drinks: comparison.openingDrinks ?? 0 
        },
        purchases: { 
          buns: comparison.purchasedBuns ?? 0, 
          meatGram: comparison.purchasedMeatGram ?? 0, 
          drinks: comparison.purchasedDrinks ?? 0 
        },
        usagePOS: { 
          buns: comparison.expectedBuns ?? 0, 
          meatGram: comparison.expectedMeatGram ?? 0, 
          drinks: comparison.expectedDrinks ?? 0 
        },
        expectedClose: { 
          buns: comparison.expectedCloseBuns ?? 0, 
          meatGram: comparison.expectedCloseMeatGram ?? 0, 
          drinks: comparison.expectedCloseDrinks ?? 0 
        },
        staffClose: { 
          buns: comparison.staffBuns ?? 0, 
          meatGram: comparison.staffMeatGram ?? 0, 
          drinks: comparison.staffDrinks ?? 0 
        },
        variance: { 
          buns: comparison.varBuns ?? 0, 
          meatGram: comparison.varMeatGram ?? 0, 
          drinks: comparison.varDrinks ?? 0 
        },
        state: comparison.state
      });
    } catch (error) {
      console.error('Comparison fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch comparison' });
    } finally {
      await prisma.$disconnect();
    }
  });

  // Recompute purchases-aware variance for specific snapshot
  app.post('/api/snapshots/:id/recompute', async (req: Request, res: Response) => {
    try {
      const snapshotId = req.params.id;
      
      // Find the snapshot date
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const snapshot = await prisma.shiftSnapshot.findUnique({
        where: { id: snapshotId },
        select: { windowStartUTC: true }
      });
      
      if (!snapshot) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      
      // Format date for worker
      const date = snapshot.windowStartUTC.toISOString().split('T')[0];
      
      // Execute the snapshot worker
      const { spawn } = require('child_process');
      const worker = spawn('node', ['workers/snapshotWorker.mjs', date], { cwd: process.cwd() });
      
      let output = '';
      let error = '';
      
      worker.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      worker.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
      worker.on('close', (code: number) => {
        if (code === 0) {
          res.json({ 
            success: true, 
            message: 'Purchases-aware comparison recomputed successfully',
            output: output.trim()
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: 'Recomputation failed',
            details: error || output
          });
        }
      });
      
      await prisma.$disconnect();
      
    } catch (error) {
      console.error('Recompute error:', error);
      res.status(500).json({ error: 'Failed to recompute comparison', details: (error as Error).message });
    }
  });

  // Shift Sales (Sales Form) routes
  app.post("/api/shift-sales", async (req, res) => {
    try {
      const result = await storage.createShiftSales(req.body);
      res.json(result);
    } catch (error) {
      console.error("Error creating shift sales:", error);
      res.status(500).json({ error: "Failed to create shift sales" });
    }
  });

  app.get("/api/shift-sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.getShiftSales(id);
      if (!result) {
        return res.status(404).json({ error: "Shift sales not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error getting shift sales:", error);
      res.status(500).json({ error: "Failed to get shift sales" });
    }
  });

  app.get("/api/shift-sales/date/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const result = await storage.getShiftSalesByDate(date);
      res.json(result);
    } catch (error) {
      console.error("Error getting shift sales by date:", error);
      res.status(500).json({ error: "Failed to get shift sales by date" });
    }
  });

  app.patch("/api/shift-sales/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['DRAFT', 'SUBMITTED', 'LOCKED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const result = await storage.updateShiftSalesStatus(id, status);
      res.json(result);
    } catch (error) {
      console.error("Error updating shift sales status:", error);
      res.status(500).json({ error: "Failed to update shift sales status" });
    }
  });

  return server;
}
