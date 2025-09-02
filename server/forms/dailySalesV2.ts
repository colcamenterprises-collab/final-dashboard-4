import { Request, Response } from "express";
import { pool } from "../db.js";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

// Utility functions (matching @/lib/utils interface)
const toCents = (n: unknown) => {
  if (typeof n === "number") return Math.round(n * 100);
  if (typeof n === "string") return Math.round(parseFloat(n) * 100);
  return 0;
};

const fromCents = (n: number) => {
  return (n / 100).toFixed(2);
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function createDailySalesV2(req: Request, res: Response) {
  try {
    const {
      completedBy,
      startingCash,
      cashSales,
      qrSales,
      grabSales,
      otherSales, // renamed
      expenses,
      wages,
      closingCash,
      requisition,
      rollsEnd,
      meatEnd,
    } = req.body;

    const id = uuidv4();
    const shiftDate = new Date().toISOString().split("T")[0];
    const createdAt = new Date().toISOString();
    const submittedAt = new Date().toISOString();

    // Totals
    const totalSales =
      toCents(cashSales) +
      toCents(qrSales) +
      toCents(grabSales) +
      toCents(otherSales);

    const totalExpenses =
      (expenses || []).reduce((s: number, e: any) => s + toCents(e.cost), 0) +
      (wages || []).reduce((s: number, w: any) => s + toCents(w.amount), 0);

    // Expected closing cash
    const expectedClosingCash =
      toCents(startingCash) + toCents(cashSales) - totalExpenses;

    const closingCashCents = toCents(closingCash);

    // Balanced check ±30
    const diff = Math.abs(expectedClosingCash - closingCashCents);
    const balanced = diff <= toCents(30);

    // Banked amounts
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
      `INSERT INTO daily_sales_v2 (
        id, "createdAt", "shiftDate", "completedBy", "submittedAtISO",
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales", 
        "grabSales", "aroiSales", "totalSales", "shoppingTotal", "wagesTotal", 
        "othersTotal", "totalExpenses", "qrTransfer", payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        id, createdAt, shiftDate, completedBy, submittedAt,
        toCents(startingCash), closingCashCents, (cashBanked < 0 ? 0 : cashBanked), 
        toCents(cashSales), toCents(qrSales), toCents(grabSales), toCents(otherSales), 
        totalSales, 0, 0, 0, totalExpenses, qrTransfer, JSON.stringify(payload)
      ]
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
        <li>Cash Banked: ฿${fromCents(cashBanked)}</li>
        <li>QR Banked: ฿${fromCents(qrTransfer)}</li>
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

import express from "express";
export const dailySalesV2Router = express.Router();
dailySalesV2Router.post("/daily-sales/v2", createDailySalesV2);