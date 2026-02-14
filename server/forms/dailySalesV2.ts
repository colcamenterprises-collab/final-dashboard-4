/**
 * 🔐 PRODUCTION LOCK — DO NOT MODIFY
 * This file is part of the live Smash Brothers Burgers operations stack.
 * Changes here can break purchasing, P&L, shift analysis, or emails.
 *
 * Allowed actions:
 * - READ
 * - LOGGING ONLY (console.log)
 *
 * Any functional changes require owner approval.
 */
// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Backend (V2)

import { Request, Response } from "express";
import { pool } from "../db";
import { workingEmailService } from "../services/workingEmailService";
import { v4 as uuidv4 } from "uuid";
import { v4 as uuid } from "uuid";
// import { insertDirectExpensesFromShift } from "../utils/expenseLedger"; // REMOVED: Shift expenses tracked in payload only
import { computeBankingAuto } from "../services/bankingAuto.js";
import { validateStockRequired } from "../services/stockRequired.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Utility functions for THB values (no cents conversion)
const toTHB = (v: any) => Math.round(Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const formatTHB = (thb: number) => thb.toLocaleString();

// MEGA-PATCH: Normalize drinks + fix falsy zeroes
export type DrinkStockObject = Record<string, number | null | undefined>;

export function normalizeDrinkStock(stock: unknown): Array<{ name: string; quantity: number }> {
  if (!stock || typeof stock !== "object") return [];
  const obj = stock as DrinkStockObject;
  return Object.entries(obj)
    .filter(([_, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([name, quantity]) => ({ name, quantity: quantity as number }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mapLibraryRow(row: any) {
  // Preserve zeros with ?? instead of ||
  const rollsEnd = row?.payload?.rollsEnd ?? null;
  const meatEnd = row?.payload?.meatEnd ?? null;

  // Always deliver drinks as an array
  const drinks = normalizeDrinkStock(row?.payload?.drinkStock);
  const drinksCount = drinks.reduce((sum, d) => sum + d.quantity, 0);

  const grabReceiptCount = Number(row?.grab_receipt_count ?? row?.payload?.grabReceiptCount ?? 0);
  const cashReceiptCount = Number(row?.cash_receipt_count ?? row?.payload?.cashReceiptCount ?? 0);
  const qrReceiptCount = Number(row?.qr_receipt_count ?? row?.payload?.qrReceiptCount ?? 0);
  const totalReceipts = grabReceiptCount + cashReceiptCount + qrReceiptCount;

  return {
    id: row.id,
    date: row.shiftDate || row.createdAt,
    staff: row.completedBy,
    cashStart: row.payload?.startingCash || 0,
    cashEnd: row.payload?.closingCash || 0,
    totalSales: row.payload?.totalSales || 0,
    buns: rollsEnd ?? "-",   // 0 shows as 0, not "-"
    meat: meatEnd ?? "-",    // 0 shows as 0, not "-"
    drinks,                  // normalized array
    drinksCount,             // sum of all drink quantities
    status: "Submitted",
    payload: row.payload || {},
    grabReceiptCount,
    cashReceiptCount,
    qrReceiptCount,
    total_receipts: totalReceipts
  };
}

// TODO: Restore logDirectExpenses function when schema import is fixed
// async function logDirectExpenses(shiftDate: Date, expenses: any[]) {
//   for (const e of expenses) {
//     await db.insert(expensesV2).values({
//       id: uuid(),
//       shiftDate,
//       item: e.item || e.description,
//       costCents: e.costCents || 0,
//       supplier: e.shop || "Unknown",
//       expenseType: e.category || "Misc",
//       meta: {},
//       source: "SHIFT_FORM",
//       createdAt: new Date(),
//     });
//   }
// }


export async function createDailySalesV2(req: Request, res: Response) {
  try {
    const body = req.body;
    
    // EXACT VALIDATION from consolidated patch - FIXED to allow zero values
    const requiredFields = ['completedBy', 'startingCash', 'cashSales', 'qrSales', 'grabSales', 'otherSales', 'cashBanked', 'qrTransfer', 'grabReceiptCount', 'cashReceiptCount', 'qrReceiptCount'];
    const missing = requiredFields.filter(field => {
      const value = body[field];
      if (field === 'completedBy') return !value || value.toString().trim() === '';
      return value == null || isNaN(Number(value)) || Number(value) < 0;
    });
    
    const refunds = body.refunds ?? {
      status: body.refundStatus,
      refundReason: body.refundReason,
      refundChannel: body.refundChannel
    };
    
    const refundStatus = refunds?.status;
    if (!refundStatus) {
      missing.push('refundStatus');
    } else if (refundStatus === 'YES') {
      if (!refunds.refundReason || String(refunds.refundReason).trim() === '') {
        missing.push('refundReason');
      }
      if (!refunds.refundChannel || String(refunds.refundChannel).trim() === '') {
        missing.push('refundChannel');
      }
    }
    
    if (missing.length) {
      return res.status(400).json({ error: `Missing or invalid fields: ${missing.join(', ')}. Must be non-negative.` });
    }

    // Normalize field names (frontend may send legacy keys)
    const otherSales = body.otherSales ?? body.aroiDeeSales ?? 0;
    const expenses = body.expenses ?? body.shiftExpenses ?? [];
    const wages = body.wages ?? body.staffWages ?? [];
    const requisition = body.requisition ?? [];
    const rollsEnd = body.rollsEnd ?? 0;
    const meatEnd = body.meatEnd ?? 0;
    const finalDrinkStock = body.drinkStock ?? [];

    const {
      completedBy,
      startingCash,
      cashSales,
      qrSales,
      grabSales,
      closingCash,
    } = body;

    const grabReceiptCount = Number(body.grabReceiptCount);
    const cashReceiptCount = Number(body.cashReceiptCount);
    const qrReceiptCount = Number(body.qrReceiptCount);

    const invalidReceiptCounts = [grabReceiptCount, cashReceiptCount, qrReceiptCount].some((count) => !Number.isInteger(count) || count < 0);
    if (invalidReceiptCounts) {
      return res.status(400).json({ error: 'Missing or invalid fields: grabReceiptCount, cashReceiptCount, qrReceiptCount. Must be non-negative integers.' });
    }

    const id = uuidv4();
    const shiftDate = body.shiftDate || new Date().toISOString().split("T")[0];
    const createdAt = new Date().toISOString();

    // Totals (whole THB, no cents)
    const totalSales =
      toTHB(cashSales) +
      toTHB(qrSales) +
      toTHB(grabSales) +
      toTHB(otherSales);

    const totalExpenses =
      (expenses || []).reduce((s: number, e: any) => s + toTHB(e.cost), 0) +
      (wages || []).reduce((s: number, w: any) => s + toTHB(w.amount), 0);

    // Expected closing = start + cash - expenses
    const expectedClosingCash =
      toTHB(startingCash) + toTHB(cashSales) - totalExpenses;

    const closingCashTHB = toTHB(closingCash);

    // Balanced check ±30 THB
    const diff = Math.abs(expectedClosingCash - closingCashTHB);
    const balanced = diff <= 30;

    // Banking (staff-declared)
    const cashBanked = toTHB(body.cashBanked);
    const qrTransfer = toTHB(body.qrTransfer);

    const shoppingTotal = (expenses || []).reduce((s: number, e: any) => s + toTHB(e.cost), 0);
    const wagesTotal = (wages || []).reduce((s: number, w: any) => s + toTHB(w.amount), 0);
    const othersTotal = 0;
    
    const payload: any = {
      completedBy,
      startingCash: toTHB(startingCash),
      cashSales: toTHB(cashSales),
      qrSales: toTHB(qrSales),
      grabSales: toTHB(grabSales),
      otherSales: toTHB(otherSales),
      refunds: {
        status: refunds.status,
        refundReason: refunds.refundReason || "",
        refundChannel: refunds.refundChannel || ""
      },
      expenses,
      wages,
      closingCash: closingCashTHB,
      totalSales,
      totalExpenses,
      expectedClosingCash,
      balanced,
      cashBanked: cashBanked < 0 ? 0 : cashBanked,
      qrTransfer,
      grabReceiptCount,
      cashReceiptCount,
      qrReceiptCount,
      requisition,
      rollsEnd,
      meatEnd,
      drinkStock: finalDrinkStock
    };

    const __bankingAuto = computeBankingAuto({
      ...payload,
      shoppingTotal,
      wagesTotal,
      othersTotal
    });
    payload.bankingAuto = __bankingAuto;

    // PATCH A: Write BOTH shiftDate (TEXT for legacy) AND shift_date (DATE for analysis queries)
    const shiftDateAsDate = new Date(shiftDate);
    
    // PATCH 13: SHIFT DEDUPLICATION — Check for existing submission before insert
    const existingCheck = await pool.query(
      `SELECT id, "completedBy", "createdAt" FROM daily_sales_v2 
       WHERE shift_date = $1 AND "deletedAt" IS NULL 
       LIMIT 1`,
      [shiftDateAsDate]
    );
    
    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      console.log(`[PATCH_13_DEDUP] Blocked duplicate submission for ${shiftDate}. Existing ID: ${existing.id}`);
      return res.status(409).json({ 
        ok: false, 
        error: `Daily Sales already submitted for this shift (${shiftDate}). Only one authoritative submission is allowed per shift.`,
        existingId: existing.id,
        existingSubmittedBy: existing.completedBy,
        existingSubmittedAt: existing.createdAt
      });
    }
    
    await pool.query(
      `INSERT INTO daily_sales_v2 (
        id, "shiftDate", shift_date, "completedBy", "createdAt", "submittedAtISO", grab_receipt_count, cash_receipt_count, qr_receipt_count, payload
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id, shiftDate, shiftDateAsDate, completedBy, createdAt, createdAt, grabReceiptCount, cashReceiptCount, qrReceiptCount, payload
      ]
    );
    
    const linkedPurchases = (expenses || []).filter((e: any) => e.purchasingLinked);
    for (const expense of linkedPurchases) {
      await pool.query(
        `INSERT INTO purchase_tally (id, created_at, date, staff, supplier, amount_thb, notes)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [
          new Date(),
          shiftDateAsDate,
          completedBy || null,
          expense.shop || null,
          toTHB(expense.cost),
          expense.item || null
        ]
      );
    }

    // Build shopping list for email
    const shoppingList = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0);
    // Email
    const html = `
      <h2>Daily Sales & Stock Report</h2>
      <p><strong>Date:</strong> ${shiftDate}</p>
      <p><strong>Completed By:</strong> ${completedBy}</p>

      <h3>Sales</h3>
      <table>
        <tr><th>Channel</th><th>Sales (฿)</th></tr>
        <tr><td>Cash</td><td>${formatTHB(toTHB(cashSales))}</td></tr>
        <tr><td>QR</td><td>${formatTHB(toTHB(qrSales))}</td></tr>
        <tr><td>Grab</td><td>${formatTHB(toTHB(grabSales))}</td></tr>
        <tr><td>Other</td><td>${formatTHB(toTHB(otherSales))}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${formatTHB(totalSales)}</strong></td></tr>
      </table>

      <h3>Expenses</h3>
      <table>
        <tr><th>Item</th><th>Cost (฿)</th><th>Supplier</th></tr>
        ${(expenses || [])
          .map(
            (e: any) =>
              `<tr><td>${e.item}</td><td>${formatTHB(toTHB(e.cost))}</td><td>${e.shop}</td></tr>`
          )
          .join("")}
      </table>
      <h4>Wages & Other Payments</h4>
      <table>
        <tr><th>Staff</th><th>Amount (฿)</th><th>Type</th></tr>
        ${(wages || [])
          .map(
            (w: any) =>
              `<tr><td>${w.staff}</td><td>${formatTHB(toTHB(w.amount))}</td><td>${w.type}</td></tr>`
          )
          .join("")}
      </table>
      <p><strong>Total Expenses:</strong> ฿${formatTHB(totalExpenses)}</p>

      <h3>Receipt Summary</h3>
      <table>
        <tr><th>Channel</th><th>Count</th></tr>
        <tr><td>Grab Receipts</td><td>${grabReceiptCount}</td></tr>
        <tr><td>Cash Receipts</td><td>${cashReceiptCount}</td></tr>
        <tr><td>QR Receipts</td><td>${qrReceiptCount}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${grabReceiptCount + cashReceiptCount + qrReceiptCount}</strong></td></tr>
      </table>

      <h3>Banking</h3>
      <table>
        <tr><th>Description</th><th>Amount (฿)</th></tr>
        <tr><td>Starting Cash</td><td>${formatTHB(startingCash)}</td></tr>
        <tr><td>Total Cash in Register</td><td>${formatTHB(closingCashTHB)}</td></tr>
        <tr><td>Expected Register</td><td>${formatTHB(expectedClosingCash)}</td></tr>
        <tr><td>Balanced</td><td>${balanced ? 'YES' : 'NO'}</td></tr>
        <tr><td>Cash Banked</td><td>${formatTHB(cashBanked)}</td></tr>
        <tr><td>QR Banked</td><td>${formatTHB(qrTransfer)}</td></tr>
      </table>

      <h3>Expected Bank Deposits (Auto)</h3>
      ${payload.bankingAuto 
        ? `<table>
            <tr><th>Description</th><th>Amount (฿)</th></tr>
            <tr><td>Cash to bank</td><td>${Number(payload.bankingAuto.expectedCashBank).toLocaleString()}</td></tr>
            <tr><td>QR to bank</td><td>${Number(payload.bankingAuto.expectedQRBank).toLocaleString()}</td></tr>
            <tr><td><strong>Total to bank</strong></td><td><strong>${Number(payload.bankingAuto.expectedTotalBank).toLocaleString()}</strong></td></tr>
          </table>`
        : '<p style="color:#6b7280">No auto-banking data</p>'}

      <h3>Refunds</h3>
      <table>
        <tr><th>Status</th><th>Reason</th><th>Channel</th></tr>
        <tr>
          <td>${refunds.status || 'N/A'}</td>
          <td>${refunds.refundReason || ''}</td>
          <td>${refunds.refundChannel || ''}</td>
        </tr>
      </table>

      <h3>Stock Levels</h3>
      <table>
        <tr><th>Item</th><th>Count</th></tr>
        <tr><td>Rolls Remaining</td><td>${rollsEnd || "Not specified"}</td></tr>
        <tr><td>Meat Remaining</td><td>${meatEnd || "Not specified"}</td></tr>
      </table>

      <h3>Drinks Stock</h3>
      ${
        typeof finalDrinkStock === 'object' && !Array.isArray(finalDrinkStock) && Object.keys(finalDrinkStock).length > 0
          ? `<table>
               <tr><th>Drink</th><th>Qty</th></tr>
               ${Object.entries(finalDrinkStock).map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`).join('')}
             </table>`
          : Array.isArray(finalDrinkStock) && finalDrinkStock.length > 0
          ? `<table>
               <tr><th>Drink</th><th>Qty</th><th>Unit</th></tr>
               ${finalDrinkStock.map((drink: any) => `<tr><td>${drink.name}</td><td>${drink.quantity}</td><td>${drink.unit}</td></tr>`).join('')}
             </table>`
          : '<p style="color: #6c757d;">No drinks counted.</p>'
      }

      <h3>Shopping List - Items to Purchase</h3>
      ${
        shoppingList.length === 0
          ? '<p style="color: #6c757d;">No shopping items required.</p>'
          : `<table>
               <tr><th>Item</th><th>Qty</th><th>Unit</th></tr>
               ${shoppingList.map((item: any) => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.unit}</td></tr>`).join('')}
             </table>`
      }
    `;

    // Enhanced email with Bangkok timezone (from consolidated patch)
    const bangkokDate = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' });
    let emailSent = await workingEmailService.sendEmail(
      "smashbrothersburgersth@gmail.com", 
      `Daily Shift Report - ${bangkokDate}`,
      html
    );
    
    // Store the ID for potential stock updates
    res.locals.recordId = id;
    
    console.log(`Email sending result: ${emailSent ? 'SUCCESS' : 'FAILED'}`);

    res.json({ ok: true, id });
  } catch (err) {
    console.error("Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to save record" });
  }
}

export async function getDailySalesV2(_req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, "shiftDate", "completedBy", "createdAt", grab_receipt_count, cash_receipt_count, qr_receipt_count, payload
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL
       ORDER BY "createdAt" DESC`
    );

    // MEGA-PATCH: Use safe mapper that preserves zeros and normalizes drinks
    const records = result.rows.map(mapLibraryRow);

    res.json({ ok: true, records });
  } catch (err) {
    console.error("Get Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to fetch records" });
  }
}

export async function getDailySalesV2ById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, "shiftDate", "completedBy", "createdAt", "deletedAt", grab_receipt_count, cash_receipt_count, qr_receipt_count, payload
       FROM daily_sales_v2 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};
    const grabReceiptCount = Number(row.grab_receipt_count ?? p.grabReceiptCount ?? 0);
    const cashReceiptCount = Number(row.cash_receipt_count ?? p.cashReceiptCount ?? 0);
    const qrReceiptCount = Number(row.qr_receipt_count ?? p.qrReceiptCount ?? 0);

    const record = {
      id: row.id,
      date: row.shiftDate?.split('T')[0] || row.createdAt?.split('T')[0] || '',
      staff: row.completedBy || '',
      cashStart: p.startingCash || 0,
      cashEnd: p.closingCash || 0,
      totalSales: p.totalSales || 0,
      buns: p.rollsEnd?.toString() || '-',
      meat: p.meatEnd?.toString() || '-',
      status: 'Submitted',
      payload: p,
      deletedAt: row.deletedAt,
      grabReceiptCount,
      cashReceiptCount,
      qrReceiptCount,
      total_receipts: grabReceiptCount + cashReceiptCount + qrReceiptCount
    };

    res.json({ ok: true, record });
  } catch (err) {
    console.error("Error fetching daily sales V2 record:", err);
    res.status(500).json({ ok: false, error: "Database error" });
  }
}

export async function updateDailySalesV2WithStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { rollsEnd, meatEnd, requisition, drinkStock } = req.body;

    // __stock_required_guard__
    const stockPayload = { rollsEnd, meatEnd, drinkStock };
    const stockValidation = await validateStockRequired(stockPayload);
    if (!stockValidation.ok) {
      // Build missing array per spec format: { category, item }
      const missing: { category: string; item: string }[] = [];
      if (stockValidation.errors.drinksMissing) {
        for (const drink of stockValidation.errors.drinksMissing) {
          missing.push({ category: 'Drinks', item: drink });
        }
      }
      return res.status(400).json({ 
        success: false, 
        reason: "MISSING_REQUIRED_STOCK", 
        missing,
        details: stockValidation.errors // Keep details for rollsEnd/meatEnd errors
      });
    }

    // PATCH B: Purchasing item parity guard
    // Form 2 MUST match active purchasing_items count
    const activePurchasingCount = await prisma.purchasingItem.count({
      where: { active: true }
    });
    
    // Get unique item names from requisition (items with qty > 0 submitted)
    const submittedItemNames = new Set<string>();
    if (Array.isArray(requisition)) {
      for (const item of requisition) {
        if (item.name) {
          submittedItemNames.add(item.name);
        }
      }
    }
    
    // Note: We allow submission even if counts differ, but log warning
    // The sync will create rows for ALL active items (with 0 for missing)
    if (submittedItemNames.size !== activePurchasingCount) {
      console.warn(`[PATCH B] Item count mismatch: submitted ${submittedItemNames.size} vs master ${activePurchasingCount}`);
    }

    // Build purchasingJson - keyed by item name with qty for shopping list lookup
    const purchasingJson: Record<string, number> = {};
    if (Array.isArray(requisition)) {
      for (const item of requisition) {
        if (item.name && item.qty > 0) {
          purchasingJson[item.name] = item.qty;
        }
      }
    }

    // Update the existing record with stock data including drinks and purchasingJson
    const result = await pool.query(
      `UPDATE daily_sales_v2 
       SET payload = payload || $1
       WHERE id = $2
       RETURNING id, "shiftDate", "completedBy", payload`,
      [JSON.stringify({ rollsEnd, meatEnd, requisition, drinkStock, purchasingJson }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    // 🔐 WRITE-TIME FIELD BRIDGE (DO NOT REMOVE)
    // Map form fields to analytics columns for daily_stock_v2
    const burgerBuns = rollsEnd ?? 0;
    const meatWeightG = meatEnd ?? 0; // meatEnd already in grams from form
    
    // Upsert into daily_stock_v2 for purchasing/analytics systems
    await pool.query(
      `INSERT INTO daily_stock_v2 (id, "salesId", "burgerBuns", "meatWeightG", "drinksJson", "purchasingJson", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("salesId") 
       DO UPDATE SET 
         "burgerBuns" = EXCLUDED."burgerBuns",
         "meatWeightG" = EXCLUDED."meatWeightG",
         "drinksJson" = EXCLUDED."drinksJson",
         "purchasingJson" = EXCLUDED."purchasingJson"`,
      [id, burgerBuns, meatWeightG, JSON.stringify(drinkStock || {}), JSON.stringify(purchasingJson)]
    );
    console.log(`[FIELD BRIDGE] Synced daily_stock_v2: salesId=${id}, burgerBuns=${burgerBuns}, meatWeightG=${meatWeightG}`);
    
    // PATCH C: Sync ALL active purchasing items to purchasing_shift_items (including zero qty)
    // Get the daily_stock_v2 id for this salesId
    const stockResult = await pool.query(
      `SELECT id FROM daily_stock_v2 WHERE "salesId" = $1`,
      [id]
    );
    
    if (stockResult.rows.length === 0) {
      throw new Error(`daily_stock_v2 record not found after upsert for salesId ${id}`);
    }
    
    const dailyStockId = stockResult.rows[0].id;
    
    // Get ALL active purchasing items
    const allActiveItems = await prisma.purchasingItem.findMany({
      where: { active: true }
    });
    
    // Build quantity map from requisition
    const qtyMap: Record<string, number> = {};
    if (Array.isArray(requisition)) {
      for (const item of requisition) {
        if (item.name) {
          qtyMap[item.name] = item.qty || 0;
        }
      }
    }
    
    // Upsert ALL items (including zero qty) to purchasing_shift_items
    for (const pItem of allActiveItems) {
      const qty = qtyMap[pItem.item] || 0;
      await prisma.purchasingShiftItem.upsert({
        where: {
          dailyStockId_purchasingItemId: {
            dailyStockId: dailyStockId,
            purchasingItemId: pItem.id
          }
        },
        update: { quantity: qty },
        create: {
          dailyStockId: dailyStockId,
          purchasingItemId: pItem.id,
          quantity: qty
        }
      });
    }
    
    console.log(`[PATCH C] Synced ${allActiveItems.length} items to purchasing_shift_items (including zeros)`);

    console.log(`Updated daily sales record ${id} with stock data`);
    console.log('About to send updated email with complete data...');
    
    // Send updated email with complete data
    const record = result.rows[0];
    const payload = record.payload;
    const shiftDate = record.shiftDate;
    const completedBy = record.completedBy;
    
    // Build shopping list
    const shoppingList = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0);
    
    // Extract drinks from payload or request body
    const finalDrinkStock = drinkStock || payload.drinkStock || [];
    
    const updatedHtml = `
      <h2>Daily Sales & Stock Report - COMPLETE</h2>
      <p><strong>Date:</strong> ${shiftDate}</p>
      <p><strong>Completed By:</strong> ${completedBy}</p>

      <h3>Sales</h3>
      <table>
        <tr><th>Channel</th><th>Sales (฿)</th></tr>
        <tr><td>Cash</td><td>${formatTHB(payload.cashSales || 0)}</td></tr>
        <tr><td>QR</td><td>${formatTHB(payload.qrSales || 0)}</td></tr>
        <tr><td>Grab</td><td>${formatTHB(payload.grabSales || 0)}</td></tr>
        <tr><td>Other</td><td>${formatTHB(payload.otherSales || 0)}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${formatTHB(payload.totalSales || 0)}</strong></td></tr>
      </table>

      <h3>Banking</h3>
      <table>
        <tr><th>Description</th><th>Amount (฿)</th></tr>
        <tr><td>Starting Cash</td><td>${formatTHB(payload.startingCash || 0)}</td></tr>
        <tr><td>Total Cash in Register</td><td>${formatTHB(payload.closingCash || 0)}</td></tr>
        <tr><td>Expected Register</td><td>${formatTHB(payload.expectedClosingCash || 0)}</td></tr>
        <tr><td>Balanced</td><td>${payload.balanced ? 'YES' : 'NO'}</td></tr>
        <tr><td>Cash Banked</td><td>${formatTHB(payload.cashBanked || 0)}</td></tr>
        <tr><td>QR Banked</td><td>${formatTHB(payload.qrTransfer || 0)}</td></tr>
      </table>

      <h3>Receipt Summary</h3>
      <table>
        <tr><th>Channel</th><th>Count</th></tr>
        <tr><td>Grab Receipts</td><td>${payload.grabReceiptCount ?? 0}</td></tr>
        <tr><td>Cash Receipts</td><td>${payload.cashReceiptCount ?? 0}</td></tr>
        <tr><td>QR Receipts</td><td>${payload.qrReceiptCount ?? 0}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${(payload.grabReceiptCount ?? 0) + (payload.cashReceiptCount ?? 0) + (payload.qrReceiptCount ?? 0)}</strong></td></tr>
      </table>

      <h3>Refunds</h3>
      <table>
        <tr><th>Status</th><th>Reason</th><th>Channel</th></tr>
        <tr>
          <td>${payload.refunds?.status || 'N/A'}</td>
          <td>${payload.refunds?.refundReason || ''}</td>
          <td>${payload.refunds?.refundChannel || ''}</td>
        </tr>
      </table>

      <h3>Stock Levels</h3>
      <table>
        <tr><th>Item</th><th>Count</th></tr>
        <tr><td>Rolls Remaining</td><td>${rollsEnd || "Not specified"}</td></tr>
        <tr><td>Meat Remaining</td><td>${meatEnd ? `${meatEnd}g (${(meatEnd/1000).toFixed(1)}kg)` : "Not specified"}</td></tr>
      </table>

      <h3>Drinks Stock</h3>
      ${
        typeof finalDrinkStock === 'object' && !Array.isArray(finalDrinkStock) && Object.keys(finalDrinkStock).length > 0
          ? `<table>
               <tr><th>Drink</th><th>Qty</th></tr>
               ${Object.entries(finalDrinkStock).map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`).join('')}
             </table>`
          : Array.isArray(finalDrinkStock) && finalDrinkStock.length > 0
          ? `<table>
               <tr><th>Drink</th><th>Qty</th><th>Unit</th></tr>
               ${finalDrinkStock.map((drink: any) => `<tr><td>${drink.name}</td><td>${drink.quantity}</td><td>${drink.unit}</td></tr>`).join('')}
             </table>`
          : '<p style="color: #6c757d;">No drinks counted.</p>'
      }

      <h3>Shopping List - Items to Purchase</h3>
      ${
        shoppingList.length === 0
          ? '<p style="color: #6c757d;">No shopping items required.</p>'
          : `<table>
               <tr><th>Item</th><th>Qty</th><th>Unit</th></tr>
               ${shoppingList.map((item: any) => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.unit}</td></tr>`).join('')}
             </table>`
      }
    `;
    
    console.log('Attempting to send updated email...');
    try {
      const emailResult = await workingEmailService.sendEmail(
        "smashbrothersburgersth@gmail.com",
        `Daily Sales & Stock COMPLETE – ${shiftDate}`,
        updatedHtml
      );
      console.log(`Updated email result: ${emailResult ? 'SUCCESS' : 'FAILED'}`);
    } catch (emailErr) {
      console.error("Email send failed (non-blocking):", emailErr);
      // Continue - do not throw
    }
    
    res.json({ ok: true, id });
  } catch (err) {
    console.error("Error updating daily sales with stock:", err);
    res.status(500).json({ ok: false, error: "Failed to update with stock data" });
  }
}

// DELETE endpoint for library
export async function deleteDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE daily_sales_v2 SET "deletedAt" = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to delete record" });
  }
}

// PRINT endpoint for library  
export async function printDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, "shiftDate", "completedBy", "createdAt", grab_receipt_count, cash_receipt_count, qr_receipt_count, payload
       FROM daily_sales_v2 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Sales Report - ${row.shiftDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total { font-weight: bold; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>Daily Sales Report</h1>
        <p><strong>Date:</strong> ${row.shiftDate}</p>
        <p><strong>Completed By:</strong> ${row.completedBy}</p>
        
        <h2>Sales Breakdown</h2>
        <table>
          <tr><th>Type</th><th>Amount (฿)</th></tr>
          <tr><td>Cash Sales</td><td>${formatTHB(p.cashSales || 0)}</td></tr>
          <tr><td>QR Sales</td><td>${formatTHB(p.qrSales || 0)}</td></tr>
          <tr><td>Grab Sales</td><td>${formatTHB(p.grabSales || 0)}</td></tr>
          <tr><td>Other Sales</td><td>${formatTHB(p.otherSales || 0)}</td></tr>
          <tr class="total"><td>Total Sales</td><td>${formatTHB(p.totalSales || 0)}</td></tr>
        </table>
        
        <h2>Receipt Summary</h2>
        <table>
          <tr><th>Channel</th><th>Count</th></tr>
          <tr><td>Grab Receipts</td><td>${Number(row.grab_receipt_count ?? p.grabReceiptCount ?? 0)}</td></tr>
          <tr><td>Cash Receipts</td><td>${Number(row.cash_receipt_count ?? p.cashReceiptCount ?? 0)}</td></tr>
          <tr><td>QR Receipts</td><td>${Number(row.qr_receipt_count ?? p.qrReceiptCount ?? 0)}</td></tr>
          <tr class="total"><td>Total Receipts</td><td>${Number(row.grab_receipt_count ?? p.grabReceiptCount ?? 0) + Number(row.cash_receipt_count ?? p.cashReceiptCount ?? 0) + Number(row.qr_receipt_count ?? p.qrReceiptCount ?? 0)}</td></tr>
        </table>

        <h2>Banking & Cash</h2>
        <table>
          <tr><th>Description</th><th>Amount (฿)</th></tr>
          <tr><td>Starting Cash</td><td>${formatTHB(p.startingCash || 0)}</td></tr>
          <tr><td>Closing Cash</td><td>${formatTHB(p.closingCash || 0)}</td></tr>
          <tr><td>Expected Closing</td><td>${formatTHB(p.expectedClosingCash || 0)}</td></tr>
          <tr><td>Balanced</td><td>${p.balanced ? 'YES' : 'NO'}</td></tr>
        </table>
        
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error("Print Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to generate print view" });
  }
}

// PRINT-FULL endpoint with complete data
export async function printDailySalesV2Full(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, "shiftDate", "completedBy", "createdAt", grab_receipt_count, cash_receipt_count, qr_receipt_count, payload
       FROM daily_sales_v2 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Complete Daily Report - ${row.shiftDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; }
          h2 { color: #666; margin-top: 25px; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total { font-weight: bold; background-color: #f9f9f9; }
          @media print { .no-print { display: none; } body { margin: 10px; } }
        </style>
      </head>
      <body>
        <h1>Complete Daily Sales & Stock Report</h1>
        <p><strong>Date:</strong> ${row.shiftDate}</p>
        <p><strong>Completed By:</strong> ${row.completedBy}</p>
        
        <h2>Sales Breakdown</h2>
        <table>
          <tr><th>Type</th><th>Amount (฿)</th></tr>
          <tr><td>Cash Sales</td><td>${formatTHB(p.cashSales || 0)}</td></tr>
          <tr><td>QR Sales</td><td>${formatTHB(p.qrSales || 0)}</td></tr>
          <tr><td>Grab Sales</td><td>${formatTHB(p.grabSales || 0)}</td></tr>
          <tr><td>Other Sales</td><td>${formatTHB(p.otherSales || 0)}</td></tr>
          <tr class="total"><td>Total Sales</td><td>${formatTHB(p.totalSales || 0)}</td></tr>
        </table>
        
        <h2>Expenses</h2>
        <table>
          <tr><th>Item</th><th>Shop</th><th>Cost (฿)</th></tr>
          ${(p.expenses || []).map((e: any) => 
            `<tr><td>${e.item}</td><td>${e.shop || 'N/A'}</td><td>${formatTHB(e.cost || 0)}</td></tr>`
          ).join('')}
          <tr class="total"><td colspan="2">Total Expenses</td><td>${formatTHB((p.expenses || []).reduce((s: number, e: any) => s + (e.cost || 0), 0))}</td></tr>
        </table>
        
        <h2>Staff Wages</h2>
        <table>
          <tr><th>Staff</th><th>Type</th><th>Amount (฿)</th></tr>
          ${(p.wages || []).map((w: any) => 
            `<tr><td>${w.staff}</td><td>${w.type || 'WAGES'}</td><td>${formatTHB(w.amount || 0)}</td></tr>`
          ).join('')}
          <tr class="total"><td colspan="2">Total Wages</td><td>${formatTHB((p.wages || []).reduce((s: number, w: any) => s + (w.amount || 0), 0))}</td></tr>
        </table>
        
        <h2>Banking & Cash Management</h2>
        <table>
          <tr><th>Description</th><th>Amount (฿)</th></tr>
          <tr><td>Starting Cash</td><td>${formatTHB(p.startingCash || 0)}</td></tr>
          <tr><td>Closing Cash</td><td>${formatTHB(p.closingCash || 0)}</td></tr>
          <tr><td>Expected Closing</td><td>${formatTHB(p.expectedClosingCash || 0)}</td></tr>
          <tr><td>Cash Banked</td><td>${formatTHB(p.cashBanked || 0)}</td></tr>
          <tr><td>QR Transfer</td><td>${formatTHB(p.qrTransfer || 0)}</td></tr>
          <tr class="total" style="${p.balanced ? 'color: green;' : 'color: red;'}"><td>Balanced</td><td>${p.balanced ? 'YES' : 'NO'}</td></tr>
        </table>
        
        <h2>Receipt Summary</h2>
        <table>
          <tr><th>Description</th><th>Count</th></tr>
          <tr><td>Grab Receipts</td><td>${Number(row.grab_receipt_count ?? p.grabReceiptCount ?? 0)}</td></tr>
          <tr><td>Cash Receipts</td><td>${Number(row.cash_receipt_count ?? p.cashReceiptCount ?? 0)}</td></tr>
          <tr><td>QR Receipts</td><td>${Number(row.qr_receipt_count ?? p.qrReceiptCount ?? 0)}</td></tr>
          <tr class="total"><td>Total Receipts</td><td>${Number(row.grab_receipt_count ?? p.grabReceiptCount ?? 0) + Number(row.cash_receipt_count ?? p.cashReceiptCount ?? 0) + Number(row.qr_receipt_count ?? p.qrReceiptCount ?? 0)}</td></tr>
        </table>

        <h2>Stock Levels</h2>
        <table>
          <tr><th>Item</th><th>Count</th></tr>
          <tr><td>Rolls End</td><td>${p.rollsEnd || 'Not specified'}</td></tr>
          <tr><td>Meat End</td><td>${p.meatEnd ? `${p.meatEnd}g (${(p.meatEnd/1000).toFixed(1)}kg)` : 'Not specified'}</td></tr>
        </table>
        
        <h2>Shopping List / Requisition</h2>
        <table>
          <tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Category</th></tr>
          ${(p.requisition || []).map((item: any) => 
            `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.category || 'N/A'}</td></tr>`
          ).join('')}
        </table>
        
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error("Print Full Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to generate full print view" });
  }
}

import express from "express";
export const dailySalesV2Router = express.Router();
dailySalesV2Router.post("/daily-sales/v2", createDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2", getDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id", getDailySalesV2ById);
dailySalesV2Router.delete("/daily-sales/v2/:id", deleteDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id/print", printDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id/print-full", printDailySalesV2Full);
dailySalesV2Router.patch("/daily-sales/v2/:id/stock", updateDailySalesV2WithStock);
