import { Request, Response } from "express";
import pool from "@/server/db";
import { toCents, fromCents } from "@/lib/utils";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

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

    await pool.query(
      `INSERT INTO daily_sales_v2 (id, shiftdate, completedby, created_at, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, shiftDate, completedBy, createdAt, payload]
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
        <li>Total Cash in Register (Closing Cash): ฿${fromCents(closingCashCents)}</li>
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
          : `<ul>${shoppingItems.map((s) => `<li>${s}</li>`).join("")}</ul>`
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
      `SELECT id, shiftdate, completedby, created_at, payload
       FROM daily_sales_v2 
       ORDER BY created_at DESC`
    );

    const records = result.rows.map((row: any) => ({
      id: row.id,
      date: row.created_at,
      staff: row.completedby,
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