import { Router } from "express";
import { db } from "../lib/prisma";
import { db as drizzleDb } from "../db"; // MEGA PATCH V3: Import Drizzle for payload support
import { dailySalesV2 } from "../../shared/schema"; // MEGA PATCH V3: Import schema
import { sql } from "drizzle-orm"; // MEGA V3: For SQL operations
import { buildDailyReportPDF } from "../lib/pdf";
import { sendDailyReportEmail } from "../lib/email";
import fs from "fs";
import crypto from "crypto"; // MEGA PATCH V3: For UUID generation

const router = Router();

// GET /api/forms - List all submitted forms for the library
router.get("/", async (req, res) => {
  try {
    const forms = await db().dailySalesV2.findMany({
      where: {
        deletedAt: null
      },
      include: {
        shopping: true,
        wages: true,
        others: true,
        stock: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(forms);
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/forms/library - Get forms library (MUST be before /:id to avoid shadowing)
router.get("/library", async (req, res) => {
  try {
    // MEGA V3: Use Drizzle to get payload data with raw SQL for testing
    const forms = await drizzleDb.execute<{
      id: string;
      shiftDate: string | null;
      completedBy: string | null;
      createdAt: Date | null;
      totalSales: number | null;
      payload: any;
    }>(sql`
      SELECT id, "shiftDate", "completedBy", "createdAt", "totalSales", payload
      FROM daily_sales_v2
      WHERE "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 500
    `);

    // Extract rows from result
    const rows = (forms as any).rows || forms;
    console.log(`[GET /api/forms/library] Query returned ${rows.length} rows`);
    console.log(`[GET /api/forms/library] First row payload:`, rows[0]?.payload);
    
    // Normalize for frontend compatibility with payload support
    const normalized = rows.map((form: any) => {
      const payload = (form.payload as any) || {};
      return {
        id: form.id,
        shiftDate: form.shiftDate,
        completedBy: form.completedBy,
        createdAt: form.createdAt,
        totalSales: form.totalSales || 0,
        balanced: (form as any).balanced || false,
        // V3 payload fields
        rollsEnd: payload.rollsEnd,
        meatEnd: payload.meatEnd,
        drinkStock: payload.drinkStock || {},
        requisition: payload.requisition || [],
        payload // Include full payload for debugging
      };
    });

    console.log(`[GET /api/forms/library] Returning ${normalized.length} forms, first payload:`, normalized[0]?.payload);
    res.json(normalized);
  } catch (error) {
    console.error('Forms library error:', error);
    res.status(500).json({ error: 'Failed to fetch forms library: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

// GET /api/forms/:id - Get specific form with all details
router.get("/:id", async (req, res) => {
  try {
    // MEGA V3: Use Drizzle to get payload data
    const [form] = await drizzleDb
      .select()
      .from(dailySalesV2)
      .where(sql`id = ${req.params.id}`)
      .limit(1);

    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Return form with payload included
    res.json({
      ...form,
      payload: form.payload || {}
    });
  } catch (error) {
    console.error("Error fetching form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Redirect to canonical endpoint for consistency
router.post("/daily-sales", (req, res) => {
  res.redirect(307, "/api/daily-sales");
});

// MEGA V3 PATCH: POST /api/forms/daily-stock with drinkStock object support
router.post("/daily-stock", async (req, res) => {
  try {
    const { salesId, rollsEnd, meatEnd, drinkStock, requisition } = req.body;
    
    // Strong validation
    const errors = [];
    
    if (!salesId) {
      errors.push('salesId: required');
    }
    
    if (rollsEnd == null || isNaN(Number(rollsEnd)) || Number(rollsEnd) < 0) {
      errors.push('rollsEnd: must be a non-negative number');
    }
    
    if (meatEnd == null || isNaN(Number(meatEnd)) || Number(meatEnd) < 0) {
      errors.push('meatEnd: must be a non-negative number');
    }
    
    if (!drinkStock || typeof drinkStock !== 'object') {
      errors.push('drinkStock: must be an object');
    }
    
    if (!Array.isArray(requisition)) {
      errors.push('requisition: must be an array');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid stock data: ' + errors.join('; '),
        details: errors
      });
    }
    
    // Update DailySalesV2 payload with stock data
    const stockData = {
      rollsEnd: Number(rollsEnd),
      meatEnd: Number(meatEnd),
      drinkStock,
      requisition: requisition.filter((r: any) => (r.qty || 0) > 0)
    };
    
    const [updated] = await drizzleDb
      .update(dailySalesV2)
      .set({
        payload: sql`COALESCE(payload, '{}'::jsonb) || ${JSON.stringify(stockData)}::jsonb`
      })
      .where(sql`id = ${salesId}`)
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Sales record not found' });
    }
    
    console.log(`[POST /api/forms/daily-stock] Stock saved: rolls=${rollsEnd}, meat=${meatEnd}, drinks=${Object.keys(drinkStock).length}`);
    
    res.json({ 
      ok: true, 
      success: true,
      message: 'Stock data saved successfully',
      salesId
    });
  } catch (error) {
    console.error('Stock validation error:', error);
    res.status(500).json({ 
      error: 'Failed to process stock data: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// POST /api/forms/daily-sales-v2 - Create new daily sales form (Form 1) - V2 Model
router.post("/daily-sales-v2", async (req, res) => {
  try {
    const body = req.body;
    
    // Extract data from new payload structure
    const shoppingItems = body.expenses?.shopping || [];
    const wageItems = body.expenses?.wages || [];
    const otherItems = body.expenses?.others || [];

    const shoppingTotal = Math.round(shoppingItems.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0));
    const wagesTotal = Math.round(wageItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0));
    const othersTotal = Math.round(otherItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0));
    const totalExpenses = shoppingTotal + wagesTotal + othersTotal;
    const totalSales = Math.round(Number(body.sales?.totalSales) || 0);

    // MEGA PATCH V3: Build payload with stock data
    const payload = deepMergePayload({}, {
      rollsEnd: body.rollsEnd || 0,
      meatEnd: body.meatEnd || 0,
      drinkStock: (typeof body.drinkStock === "object" && body.drinkStock) || {},
      requisition: Array.isArray(body.requisition) ? body.requisition : [],
      cashSales: body.cashSales || 0,
      qrSales: body.qrSales || 0,
      grabSales: body.grabSales || 0,
      otherSales: body.otherSales || 0,
      totalSales: body.totalSales || 0,
      startingCash: body.startingCash || 0,
      closingCash: body.closingCash || 0,
      cashBanked: body.cashBanked || 0,
      qrTransfer: body.qrTransfer || 0,
      completedBy: body.completedBy
    });

    // MEGA PATCH V3: Use Drizzle to insert with payload support
    const [form] = await drizzleDb.insert(dailySalesV2).values({
      id: crypto.randomUUID(),
      shiftDate: body.shiftDate || new Date().toISOString().split('T')[0],
      submittedAtISO: new Date(),
      completedBy: body.completedBy,
      startingCash: body.cashManagement?.startingCash || 0,
      endingCash: Number(
        body.banking?.closingCash ??
        body.cashManagement?.endingCash ??
        0
      ),
      cashBanked: body.banking?.cashBanked || 0,
      cashSales: body.sales?.cashSales || 0,
      qrSales: body.sales?.qrSales || 0,
      grabSales: body.sales?.grabSales || 0,
      aroiSales: body.sales?.aroiSales || 0,
      totalSales,
      shoppingTotal,
      wagesTotal,
      othersTotal,
      totalExpenses,
      qrTransfer: body.banking?.qrTransfer || 0,
      payload // MEGA PATCH V3: Save payload as JSONB
    }).returning();

    // Create related records
    if (shoppingItems.length > 0) {
      await db().shoppingPurchaseV2.createMany({
        data: shoppingItems.map((item: any) => ({
          item: item.item,
          cost: Math.round(Number(item.cost) || 0),
          shop: item.shop,
          salesId: form.id
        }))
      });
    }

    if (wageItems.length > 0) {
      await db().wageEntryV2.createMany({
        data: wageItems.map((item: any) => ({
          staff: item.staff,
          amount: Math.round(Number(item.amount) || 0),
          type: item.type,
          salesId: form.id
        }))
      });
    }

    if (otherItems.length > 0) {
      await db().otherExpenseV2.createMany({
        data: otherItems.map((item: any) => ({
          label: item.label,
          amount: Math.round(Number(item.amount) || 0),
          salesId: form.id
        }))
      });
    }

    // Return the expected format for the frontend workflow
    res.status(201).json({ ok: true, shiftId: form.id, salesId: form.id, message: "Form 1 saved successfully" });
  } catch (error) {
    console.error("Error creating sales form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/forms/:id - Update existing form
router.put("/:id", async (req, res) => {
  try {
    const salesData = req.body;
    const formId = req.params.id;

    // Calculate totals from related data
    const shoppingItems = salesData.shopping || [];
    const wageItems = salesData.wages || [];
    const otherItems = salesData.others || [];

    const shoppingTotal = shoppingItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    const wagesTotal = wageItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const othersTotal = otherItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalExpenses = shoppingTotal + wagesTotal + othersTotal;
    const totalSales = (salesData.cashSales || 0) + (salesData.qrSales || 0) + (salesData.grabSales || 0) + (salesData.aroiSales || 0);

    // Delete existing related records
    await db().shoppingPurchase.deleteMany({ where: { salesId: formId } });
    await db().wageEntry.deleteMany({ where: { salesId: formId } });
    await db().otherExpense.deleteMany({ where: { salesId: formId } });

    // Update main form
    const form = await db().dailySales.update({
      where: { id: formId },
      data: {
        status: salesData.status || "draft",
        shiftDate: salesData.shiftDate || new Date().toISOString().split('T')[0],
        completedBy: salesData.completedBy,
        startingCash: salesData.startingCash || 0,
        endingCash: salesData.endingCash || 0,
        cashBanked: salesData.cashBanked || 0,
        cashSales: salesData.cashSales || 0,
        qrSales: salesData.qrSales || 0,
        grabSales: salesData.grabSales || 0,
        aroiSales: salesData.aroiSales || 0,
        totalSales,
        shoppingTotal,
        wagesTotal,
        othersTotal,
        totalExpenses,
        closingCash: salesData.closingCash || 0,
        qrTransfer: salesData.qrTransfer || 0,
        notes: salesData.notes || null
      }
    });

    // Create new related records
    if (shoppingItems.length > 0) {
      await db().shoppingPurchase.createMany({
        data: shoppingItems.map((item: any) => ({
          item: item.item,
          cost: item.cost,
          shop: item.shop,
          salesId: form.id
        }))
      });
    }

    if (wageItems.length > 0) {
      await db().wageEntry.createMany({
        data: wageItems.map((item: any) => ({
          staff: item.staff,
          amount: item.amount,
          type: item.type,
          salesId: form.id
        }))
      });
    }

    if (otherItems.length > 0) {
      await db().otherExpense.createMany({
        data: otherItems.map((item: any) => ({
          label: item.label,
          amount: item.amount,
          salesId: form.id
        }))
      });
    }

    // Fetch the complete updated form with relations
    const completeForm = await db().dailySales.findUnique({
      where: { id: form.id },
      include: {
        shopping: true,
        wages: true,
        others: true,
        stock: true
      }
    });

    res.json(completeForm);
  } catch (error) {
    console.error("Error updating sales form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/forms/:id/stock - Add stock form (Form 2) to existing sales form
router.post("/:id/stock", async (req, res) => {
  try {
    const salesId = req.params.id;
    const stockData = req.body;

    // Check if a stock form already exists for this sales form
    const existingStock = await db().dailyStock.findUnique({
      where: { salesId }
    });

    if (existingStock) {
      // Update existing stock form
      const stock = await db().dailyStock.update({
        where: { salesId },
        data: {
          status: stockData.status || "submitted",
          burgerBuns: stockData.burgerBuns || 0,
          meatWeightG: stockData.meatWeightG || 0,
          drinksJson: stockData.drinksJson || {},
          purchasingJson: stockData.purchasingJson || {},
          notes: stockData.notes || null
        }
      });
      res.json(stock);
    } else {
      // Create new stock form
      const stock = await db().dailyStock.create({
        data: {
          status: stockData.status || "submitted",
          salesId,
          burgerBuns: stockData.burgerBuns || 0,
          meatWeightG: stockData.meatWeightG || 0,
          drinksJson: stockData.drinksJson || {},
          purchasingJson: stockData.purchasingJson || {},
          notes: stockData.notes || null
        }
      });
      res.status(201).json(stock);
    }
  } catch (error) {
    console.error("Error creating/updating stock form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/forms/:id/complete - Complete the full workflow: PDF generation + email + library save
router.post("/:id/complete", async (req, res) => {
  try {
    const formId = req.params.id;

    // Get the full form data with all relations
    const salesForm = await db().dailySales.findUnique({
      where: { id: formId },
      include: {
        shopping: true,
        wages: true,
        others: true,
        stock: true
      }
    });

    if (!salesForm) {
      return res.status(404).json({ error: "Sales form not found" });
    }

    // Transform data for PDF generation
    const pdfData = {
      id: salesForm.id,
      shiftDate: salesForm.shiftDate,
      completedBy: salesForm.completedBy,
      submittedAtISO: new Date(),
      cashSales: salesForm.cashSales,
      qrSales: salesForm.qrSales,
      grabSales: salesForm.grabSales,
      aroiSales: salesForm.aroiSales,
      totalSales: salesForm.totalSales,
      startingCash: salesForm.startingCash,
      endingCash: salesForm.endingCash,
      cashBanked: salesForm.cashBanked,
      qrTransfer: salesForm.qrTransfer,
      shoppingTotal: salesForm.shoppingTotal,
      wagesTotal: salesForm.wagesTotal,
      othersTotal: salesForm.othersTotal,
      totalExpenses: salesForm.totalExpenses,
      shopping: salesForm.shopping.map(item => ({
        item: item.item,
        cost: item.cost,
        shop: item.shop
      })),
      wages: salesForm.wages.map(wage => ({
        staff: wage.staff,
        amount: wage.amount,
        type: wage.type
      })),
      others: salesForm.others.map(other => ({
        label: other.label,
        amount: other.amount
      }))
    };

    const stockData = salesForm.stock ? {
      burgerBuns: salesForm.stock.burgerBuns,
      meatWeightG: salesForm.stock.meatWeightG,
      drinksJson: salesForm.stock.drinksJson,
      purchasingJson: salesForm.stock.purchasingJson,
      notes: salesForm.stock.notes
    } : null;

    // Generate PDF
    const pdfPath = await buildDailyReportPDF({
      sales: pdfData,
      stock: stockData
    });

    // Send email with PDF attachment
    await sendDailyReportEmail({
      pdfPath,
      salesData: {
        id: salesForm.id,
        shiftDate: salesForm.shiftDate,
        completedBy: salesForm.completedBy,
        totalSales: salesForm.totalSales,
        totalExpenses: salesForm.totalExpenses
      }
    });

    // Update form status to completed
    await db().dailySales.update({
      where: { id: formId },
      data: {
        status: "completed",
        submittedAtISO: new Date(),
        updatedAt: new Date()
      }
    });

    // Clean up PDF file after sending
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    } catch (cleanupError) {
      console.warn("Failed to clean up PDF file:", cleanupError);
    }

    res.json({
      success: true,
      message: "Daily report completed successfully",
      formId,
      emailSent: true,
      pdfGenerated: true
    });

  } catch (error) {
    console.error("Error completing form workflow:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});


// MEGA PATCH: safe JSON merge
function deepMergePayload(base:any, add:any){
  try { const a = (base&&typeof base==='object')?base:{}; const b=(add&&typeof add==='object')?add:{}; return {...a,...b}; }
  catch { return add ?? base ?? {}; }
}

/** MEGA PATCH: guard legacy daily-sales endpoints */
router.all(["/daily-sales","/api/forms/daily-sales"], (_req, res) => {
  res.status(410).json({ error: "Gone: use /api/forms/daily-sales-v2" });
});

export default router;
