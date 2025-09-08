// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Backend (V2)

import { Request, Response } from "express";
import { pool } from "../db";
import { workingEmailService } from "../services/workingEmailService";
import { v4 as uuidv4 } from "uuid";

// Utility functions for THB values (no cents conversion)
const toTHB = (v: any) => Math.round(Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const formatTHB = (thb: number) => thb.toLocaleString();


export async function createDailySalesV2(req: Request, res: Response) {
  try {
    const body = req.body;

    // Normalize field names (frontend may send legacy keys)
    const otherSales = body.otherSales ?? body.aroiDeeSales ?? 0;
    const expenses = body.expenses ?? body.shiftExpenses ?? [];
    const wages = body.wages ?? body.staffWages ?? [];
    const requisition = body.requisition ?? [];
    const rollsEnd = body.rollsEnd ?? 0;
    const meatEnd = body.meatEnd ?? 0;

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

    const payload = {
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

    await pool.query(
      `INSERT INTO daily_sales_v2 (id, "shiftDate", "completedBy", "createdAt", "submittedAtISO", payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, shiftDate, completedBy, createdAt, createdAt, payload]
    );

    // Build shopping list
    const shoppingItems = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0)
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

      <h3>Stock</h3>
      <ul>
        <li>Rolls: ${rollsEnd || "-"}</li>
        <li>Meat: ${meatEnd || "-"}</li>
      </ul>

      <h3>Shopping List</h3>
      ${
        shoppingItems.length === 0
          ? "<p>No items to purchase</p>"
          : `<ul>${shoppingItems.map((s: string) => `<li>${s}</li>`).join("")}</ul>`
      }
    `;

    const emailSent = await workingEmailService.sendEmail(
      "smashbrothersburgersth@gmail.com",
      `Daily Sales & Stock – ${shiftDate}`,
      html
    );
    
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
    const { rollsEnd, meatEnd, requisition } = req.body;

    // Update the existing record with stock data
    const result = await pool.query(
      `UPDATE daily_sales_v2 
       SET payload = payload || $1
       WHERE id = $2
       RETURNING id`,
      [JSON.stringify({ rollsEnd, meatEnd, requisition }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    console.log(`✅ Updated daily sales record ${id} with stock data`);
    res.json({ ok: true, id });
  } catch (err) {
    console.error("Error updating daily sales with stock:", err);
    res.status(500).json({ ok: false, error: "Failed to update with stock data" });
  }
}

import express from "express";
export const dailySalesV2Router = express.Router();
dailySalesV2Router.post("/daily-sales/v2", createDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2", getDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id", getDailySalesV2ById);
dailySalesV2Router.patch("/daily-sales/v2/:id/stock", updateDailySalesV2WithStock);