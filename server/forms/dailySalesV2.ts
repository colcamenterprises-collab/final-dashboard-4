// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Backend (V2)

import { Request, Response } from "express";
import { pool } from "../db";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

// Utility functions for cent conversion
const toCents = (v: any) => Math.round((Number(String(v).replace(/[^\d.-]/g, '')) || 0) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    // Totals
    const totalSales =
      toCents(cashSales) +
      toCents(qrSales) +
      toCents(grabSales) +
      toCents(otherSales);

    const totalExpenses =
      (expenses || []).reduce((s: number, e: any) => s + toCents(e.cost), 0) +
      (wages || []).reduce((s: number, w: any) => s + toCents(w.amount), 0);

    // Expected closing = start + cash - expenses
    const expectedClosingCash =
      toCents(startingCash) + toCents(cashSales) - totalExpenses;

    const closingCashCents = toCents(closingCash);

    // Balanced check ±30
    const diff = Math.abs(expectedClosingCash - closingCashCents);
    const balanced = diff <= toCents(30);

    // Banking
    const cashBanked = closingCashCents - toCents(startingCash);
    const qrTransfer = toCents(qrSales);

    const payload = {
      completedBy,
      startingCash: toCents(startingCash),
      cashSales: toCents(cashSales),
      qrSales: toCents(qrSales),
      grabSales: toCents(grabSales),
      otherSales: toCents(otherSales),
      expenses,
      wages,
      closingCash: closingCashCents,
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
        <li>Cash Sales: ฿${fromCents(toCents(cashSales))}</li>
        <li>QR Sales: ฿${fromCents(toCents(qrSales))}</li>
        <li>Grab Sales: ฿${fromCents(toCents(grabSales))}</li>
        <li>Other Sales: ฿${fromCents(toCents(otherSales))}</li>
        <li><strong>Total Sales:</strong> ฿${fromCents(totalSales)}</li>
      </ul>

      <h3>Expenses</h3>
      <ul>
        ${(expenses || [])
          .map(
            (e: any) =>
              `<li>${e.item} – ฿${fromCents(toCents(e.cost))} (${e.shop})</li>`
          )
          .join("")}
        ${(wages || [])
          .map(
            (w: any) =>
              `<li>${w.staff} – ฿${fromCents(toCents(w.amount))} (${w.type})</li>`
          )
          .join("")}
      </ul>
      <p><strong>Total Expenses:</strong> ฿${fromCents(totalExpenses)}</p>

      <h3>Banking</h3>
      <ul>
        <li>Total Cash in Register: ฿${fromCents(closingCashCents)}</li>
        <li>Expected Register: ฿${fromCents(expectedClosingCash)}</li>
        <li>
          Balanced: ${
            balanced
              ? '<span style="color:green;font-weight:bold">YES ✅</span>'
              : '<span style="color:red;font-weight:bold">NO ❌</span>'
          }
        </li>
        <li>Cash to Bank: ฿${fromCents(cashBanked)}</li>
        <li>QR to Bank: ฿${fromCents(qrTransfer)}</li>
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

    await transporter.sendMail({
      from: `"SBB Dashboard" <${process.env.SMTP_USER}>`,
      to: process.env.MANAGEMENT_EMAIL,
      cc: "smashbrothersburgersth@gmail.com",
      subject: `Daily Sales & Stock – ${shiftDate}`,
      html,
    });

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
      cashStart: row.payload?.startingCash ? row.payload.startingCash / 100 : 0,
      cashEnd: row.payload?.closingCash ? row.payload.closingCash / 100 : 0,
      totalSales: row.payload?.totalSales ? row.payload.totalSales / 100 : 0,
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

import express from "express";
export const dailySalesV2Router = express.Router();
dailySalesV2Router.post("/daily-sales/v2", createDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2", getDailySalesV2);