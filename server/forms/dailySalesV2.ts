// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Backend (V2)

import { Request, Response } from "express";
import { pool } from "../db";
import { workingEmailService } from "../services/workingEmailService";
import { v4 as uuidv4 } from "uuid";
import { v4 as uuid } from "uuid";
import { insertDirectExpensesFromShift } from "../utils/expenseLedger";
import { computeBankingAuto } from "../services/bankingAuto.js";

// Utility functions for THB values (no cents conversion)
const toTHB = (v: any) => Math.round(Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const formatTHB = (thb: number) => thb.toLocaleString();

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
    const requiredFields = ['completedBy', 'startingCash', 'cashSales', 'qrSales', 'grabSales', 'otherSales'];
    const missing = requiredFields.filter(field => {
      const value = body[field];
      if (field === 'completedBy') return !value || value.toString().trim() === '';
      return value == null || isNaN(Number(value)) || Number(value) < 0;
    });
    
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

    const id = uuidv4();
    const shiftDate = new Date().toISOString().split("T")[0];
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

    // Banking
    const cashBanked = closingCashTHB - toTHB(startingCash);
    const qrTransfer = toTHB(qrSales);

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
      expenses,
      wages,
      closingCash: closingCashTHB,
      totalSales,
      totalExpenses,
      expectedClosingCash,
      balanced,
      cashBanked: cashBanked < 0 ? 0 : cashBanked,
      qrTransfer,
      requisition,
      rollsEnd,
      meatEnd,
    };

    const __bankingAuto = computeBankingAuto({
      ...payload,
      shoppingTotal,
      wagesTotal,
      othersTotal
    });
    payload.bankingAuto = __bankingAuto;

    await pool.query(
      `INSERT INTO daily_sales_v2 (id, "shiftDate", "completedBy", "createdAt", "submittedAtISO", payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, shiftDate, completedBy, createdAt, createdAt, payload]
    );

    // Log shift expenses to expenses table
    const savedRowCreatedAt = new Date(createdAt);
    const directExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    await insertDirectExpensesFromShift(savedRowCreatedAt, directExpenses);

    // Build shopping list for email
    const shoppingList = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0);
    const shoppingItems = shoppingList
      .map((i: any) => `${i.name} – ${i.qty} ${i.unit}`);

    // Email
    const html = `
      <h2>Daily Sales & Stock Report</h2>
      <p><strong>Date:</strong> ${shiftDate}</p>
      <p><strong>Completed By:</strong> ${completedBy}</p>

      <h3>Sales</h3>
      <ul>
        <li>Cash Sales: ฿${formatTHB(toTHB(cashSales))}</li>
        <li>QR Sales: ฿${formatTHB(toTHB(qrSales))}</li>
        <li>Grab Sales: ฿${formatTHB(toTHB(grabSales))}</li>
        <li>Other Sales: ฿${formatTHB(toTHB(otherSales))}</li>
        <li><strong>Total Sales:</strong> ฿${formatTHB(totalSales)}</li>
      </ul>

      <h3>Expenses</h3>
      <ul>
        ${(expenses || [])
          .map(
            (e: any) =>
              `<li>${e.item} – ฿${formatTHB(toTHB(e.cost))} (${e.shop})</li>`
          )
          .join("")}
        ${(wages || [])
          .map(
            (w: any) =>
              `<li>${w.staff} – ฿${formatTHB(toTHB(w.amount))} (${w.type})</li>`
          )
          .join("")}
      </ul>
      <p><strong>Total Expenses:</strong> ฿${formatTHB(totalExpenses)}</p>

      <h3>Banking</h3>
      <ul>
        <li>Starting Cash: ฿${formatTHB(startingCash)}</li>
        <li>Total Cash in Register: ฿${formatTHB(closingCashTHB)}</li>
        <li>Expected Register: ฿${formatTHB(expectedClosingCash)}</li>
        <li>
          Balanced: ${
            balanced
              ? '<span style="color:green;font-weight:bold">YES ✅</span>'
              : '<span style="color:red;font-weight:bold">NO ❌</span>'
          }
        </li>
        <li>Cash to Bank: ฿${formatTHB(cashBanked)}</li>
        <li>QR to Bank: ฿${formatTHB(qrTransfer)}</li>
      </ul>

      <h3>Expected Bank Deposits (Auto)</h3>
      ${payload.bankingAuto 
        ? `<ul>
            <li>Cash to bank: ฿${Number(payload.bankingAuto.expectedCashBank).toLocaleString()}</li>
            <li>QR to bank: ฿${Number(payload.bankingAuto.expectedQRBank).toLocaleString()}</li>
            <li><strong>Total to bank: ฿${Number(payload.bankingAuto.expectedTotalBank).toLocaleString()}</strong></li>
          </ul>`
        : '<p style="color:#6b7280">No auto-banking data</p>'}

      <h3>Stock Levels</h3>
      <ul>
        <li>Rolls Remaining: ${rollsEnd || "Not specified"}</li>
        <li>Meat Remaining: ${meatEnd || "Not specified"}</li>
      </ul>

      <h3>Drinks Stock</h3>
      ${
        typeof finalDrinkStock === 'object' && !Array.isArray(finalDrinkStock) && Object.keys(finalDrinkStock).length > 0
          ? `<ul>
               ${Object.entries(finalDrinkStock).map(([name, qty]) => `<li><strong>${name}</strong>: ${qty}</li>`).join('')}
             </ul>`
          : Array.isArray(finalDrinkStock) && finalDrinkStock.length > 0
          ? `<ul>
               ${finalDrinkStock.map((drink: any) => `<li><strong>${drink.name}</strong>: ${drink.quantity} ${drink.unit}</li>`).join('')}
             </ul>`
          : '<p style="color: #6c757d;">No drinks counted.</p>'
      }

      <h3>Shopping List - Items to Purchase</h3>
      ${
        shoppingList.length === 0
          ? '<p style="color: #6c757d;">No shopping items required.</p>'
          : `<div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 10px 0;">
               <ul style="margin: 0; padding-left: 20px;">
                 ${shoppingList.map((item: any) => `<li><strong>${item.name}</strong> – ${item.qty} ${item.unit}</li>`).join('')}
               </ul>
             </div>`
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
    
    console.log(`📧 Email sending result: ${emailSent ? 'SUCCESS' : 'FAILED'}`);

    res.json({ ok: true, id });
  } catch (err) {
    console.error("Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to save record" });
  }
}

export async function getDailySalesV2(_req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, "shiftDate", "completedBy", "createdAt", payload
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL
       ORDER BY "createdAt" DESC`
    );

    const records = result.rows.map((row: any) => ({
      id: row.id,
      date: row.shiftDate || row.createdAt,
      staff: row.completedBy,
      cashStart: row.payload?.startingCash || 0,
      cashEnd: row.payload?.closingCash || 0,
      totalSales: row.payload?.totalSales || 0,
      buns: row.payload?.rollsEnd || "-",
      meat: row.payload?.meatEnd || "-",
      status: "Submitted",
      payload: row.payload || {}
    }));

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
      `SELECT id, "shiftDate", "completedBy", "createdAt", "deletedAt", payload
       FROM daily_sales_v2 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};
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
      deletedAt: row.deletedAt
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

    // Update the existing record with stock data including drinks
    const result = await pool.query(
      `UPDATE daily_sales_v2 
       SET payload = payload || $1
       WHERE id = $2
       RETURNING id, "shiftDate", "completedBy", payload`,
      [JSON.stringify({ rollsEnd, meatEnd, requisition, drinkStock }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

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
      <ul>
        <li>Cash Sales: ฿${formatTHB(payload.cashSales || 0)}</li>
        <li>QR Sales: ฿${formatTHB(payload.qrSales || 0)}</li>
        <li>Grab Sales: ฿${formatTHB(payload.grabSales || 0)}</li>
        <li>Other Sales: ฿${formatTHB(payload.otherSales || 0)}</li>
        <li><strong>Total Sales:</strong> ฿${formatTHB(payload.totalSales || 0)}</li>
      </ul>

      <h3>Banking</h3>
      <ul>
        <li>Starting Cash: ฿${formatTHB(payload.startingCash || 0)}</li>
        <li>Total Cash in Register: ฿${formatTHB(payload.closingCash || 0)}</li>
        <li>Expected Register: ฿${formatTHB(payload.expectedClosingCash || 0)}</li>
        <li>
          Balanced: ${
            payload.balanced
              ? '<span style="color:green;font-weight:bold">YES ✅</span>'
              : '<span style="color:red;font-weight:bold">NO ❌</span>'
          }
        </li>
        <li>Cash to Bank: ฿${formatTHB(payload.cashBanked || 0)}</li>
        <li>QR to Bank: ฿${formatTHB(payload.qrTransfer || 0)}</li>
      </ul>

      <h3>Stock Levels</h3>
      <ul>
        <li>Rolls Remaining: ${rollsEnd || "Not specified"}</li>
        <li>Meat Remaining: ${meatEnd ? `${meatEnd}g (${(meatEnd/1000).toFixed(1)}kg)` : "Not specified"}</li>
      </ul>

      <h3>Drinks Stock</h3>
      ${
        typeof finalDrinkStock === 'object' && !Array.isArray(finalDrinkStock) && Object.keys(finalDrinkStock).length > 0
          ? `<ul>
               ${Object.entries(finalDrinkStock).map(([name, qty]) => `<li><strong>${name}</strong>: ${qty}</li>`).join('')}
             </ul>`
          : Array.isArray(finalDrinkStock) && finalDrinkStock.length > 0
          ? `<ul>
               ${finalDrinkStock.map((drink: any) => `<li><strong>${drink.name}</strong>: ${drink.quantity} ${drink.unit}</li>`).join('')}
             </ul>`
          : '<p style="color: #6c757d;">No drinks counted.</p>'
      }

      <h3>Shopping List - Items to Purchase</h3>
      ${
        shoppingList.length === 0
          ? '<p style="color: #6c757d;">No shopping items required.</p>'
          : `<div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 10px 0;">
               <ul style="margin: 0; padding-left: 20px;">
                 ${shoppingList.map((item: any) => `<li><strong>${item.name}</strong> – ${item.qty} ${item.unit}</li>`).join('')}
               </ul>
             </div>`
      }
    `;
    
    try {
      console.log('Attempting to send updated email...');
      const emailResult = await workingEmailService.sendEmail(
        "smashbrothersburgersth@gmail.com",
        `Daily Sales & Stock COMPLETE – ${shiftDate}`,
        updatedHtml
      );
      console.log(`📧 Updated email result: ${emailResult ? 'SUCCESS' : 'FAILED'}`);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
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
      `SELECT id, "shiftDate", "completedBy", "createdAt", payload
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
        
        <h2>Banking & Cash</h2>
        <table>
          <tr><th>Description</th><th>Amount (฿)</th></tr>
          <tr><td>Starting Cash</td><td>${formatTHB(p.startingCash || 0)}</td></tr>
          <tr><td>Closing Cash</td><td>${formatTHB(p.closingCash || 0)}</td></tr>
          <tr><td>Expected Closing</td><td>${formatTHB(p.expectedClosingCash || 0)}</td></tr>
          <tr><td>Balanced</td><td>${p.balanced ? 'YES ✅' : 'NO ❌'}</td></tr>
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
      `SELECT id, "shiftDate", "completedBy", "createdAt", payload
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