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
      otherSales,
      expenses,
      wages,
      closingCash, // staff entry
      requisition,
      rollsEnd,
      meatEnd,
    } = req.body;

    const id = uuidv4();
    const shiftDate = new Date().toISOString().split("T")[0];
    const createdAt = new Date();
    const submittedAtISO = new Date();

    // Totals
    const totalSales =
      toCents(cashSales) +
      toCents(qrSales) +
      toCents(grabSales) +
      toCents(otherSales);

    const totalExpenses =
      (expenses || []).reduce((s: number, e: any) => s + toCents(e.cost), 0) +
      (wages || []).reduce((s: number, w: any) => s + toCents(w.amount), 0);

    // Expected register = Starting + Cash – Expenses
    const expectedClosingCash =
      toCents(startingCash) + toCents(cashSales) - totalExpenses;

    const closingCashCents = toCents(closingCash);

    // Balanced check ±30
    const diff = Math.abs(expectedClosingCash - closingCashCents);
    const balanced = diff <= toCents(30);

    // Banked = Closing – Starting
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

    // Save to database first (critical operation)
    await pool.query(
      `INSERT INTO daily_sales_v2 (
        id, "createdAt", "shiftDate", "submittedAtISO", "completedBy",
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales",
        "grabSales", "aroiSales", "totalSales", "shoppingTotal", "wagesTotal",
        "othersTotal", "totalExpenses", payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        id, 
        createdAt,
        shiftDate, 
        submittedAtISO,
        completedBy,
        toCents(startingCash || 0),
        closingCashCents,
        cashBanked < 0 ? 0 : cashBanked,
        toCents(cashSales || 0),
        toCents(qrSales || 0),
        toCents(grabSales || 0),
        toCents(otherSales || 0),
        totalSales,
        (expenses || []).reduce((s: number, e: any) => s + toCents(e.cost || 0), 0),
        (wages || []).reduce((s: number, w: any) => s + toCents(w.amount || 0), 0),
        0,
        totalExpenses,
        JSON.stringify(payload)
      ]
    );

    // Build shopping list
    const shoppingItems = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0)
      .map((i: any) => `${i.name} – ${i.qty} ${i.unit}`);

    // Build email HTML
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
          .map((e: any) => `<li>${e.item} – ฿${fromCents(toCents(e.cost))} (${e.shop})</li>`)
          .join("")}
        ${(wages || [])
          .map((w: any) => `<li>${w.staff} – ฿${fromCents(toCents(w.amount))} (${w.type})</li>`)
          .join("")}
      </ul>
      <p><strong>Total Expenses:</strong> ฿${fromCents(totalExpenses)}</p>
      <h3>Banking</h3>
      <ul>
        <li>Total Cash in Register: ฿${fromCents(closingCashCents)}</li>
        <li>Expected Register: ฿${fromCents(expectedClosingCash)}</li>
        <li>Balanced: ${
          balanced
            ? '<span style="color:green;font-weight:bold">YES ✅</span>'
            : '<span style="color:red;font-weight:bold">NO ❌</span>'
        }</li>
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

    // Try to send email (non-critical operation)
    if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MANAGEMENT_EMAIL) {
      try {
        await transporter.sendMail({
          from: `"SBB Dashboard" <${process.env.SMTP_USER}>`,
          to: process.env.MANAGEMENT_EMAIL,
          cc: "smashbrothersburgersth@gmail.com",
          subject: `Daily Sales & Stock – ${shiftDate}`,
          html,
        });
        console.log("Email sent successfully");
      } catch (emailError) {
        console.log("Email sending failed but record saved successfully:", emailError);
      }
    } else {
      console.log("Email not sent - SMTP credentials not configured");
    }

    // Always return success if database save worked
    res.json({ ok: true, id, shiftId: id });
    
  } catch (err) {
    console.error("Daily Sales V2 error", err);
    res.status(500).json({ ok: false, error: "Failed to save record" });
  }
}

export async function getDailySalesV2(_req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, "createdAt" as date, "completedBy" as staff, 
       "startingCash", "endingCash", "totalSales", payload
       FROM daily_sales_v2 
       WHERE "deletedAt" IS NULL 
       ORDER BY "createdAt" DESC`
    );

    const records = result.rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      staff: row.staff,
      cashStart: row.startingCash / 100, // Convert from cents
      cashEnd: row.endingCash / 100, // Convert from cents
      totalSales: row.totalSales / 100, // Convert from cents
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