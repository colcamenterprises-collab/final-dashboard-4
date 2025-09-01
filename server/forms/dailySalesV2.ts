// Do not do this:
// – Do not rename, move, or split this file
// – Do not drop or recreate daily_sales_v2
// – Do not strip out toCents/fromCents/thb
// – Only apply exactly what is written below

import { Request, Response } from "express";
import express from "express";
import { pool } from "../db";
import nodemailer from "nodemailer";

// Helper functions
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

const fromCents = (cents: number) => {
  return (cents / 100).toFixed(2);
};

// Reuse transporter config
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
      aroiDeeSales,
      expenses,
      wages,
      closingCash,
      requisition,
      rollsEnd,
      meatEnd,
    } = req.body;

    const totalSales =
      toCents(cashSales) +
      toCents(qrSales) +
      toCents(grabSales) +
      toCents(aroiDeeSales);

    const totalExpenses =
      (expenses || []).reduce((sum: number, e: any) => sum + toCents(e.cost), 0) +
      (wages || []).reduce((sum: number, w: any) => sum + toCents(w.amount), 0);

    const cashBanked = toCents(cashSales) - totalExpenses;
    const qrTransfer = toCents(qrSales);

    const payload = {
      completedBy,
      startingCash: toCents(startingCash),
      cashSales: toCents(cashSales),
      qrSales: toCents(qrSales),
      grabSales: toCents(grabSales),
      aroiDeeSales: toCents(aroiDeeSales),
      expenses,
      wages,
      closingCash: toCents(closingCash),
      totalSales,
      totalExpenses,
      cashBanked: cashBanked < 0 ? 0 : cashBanked,
      qrTransfer,
      requisition,
      rollsEnd,
      meatEnd,
    };

    const result = await pool.query(
      `INSERT INTO daily_sales_v2 (payload) VALUES ($1) RETURNING id, "createdAt"`,
      [payload]
    );

    // Build shopping list (qty > 0)
    const shoppingItems = (requisition || [])
      .filter((i: any) => (i.qty || 0) > 0)
      .map((i: any) => `${i.name} – ${i.qty} ${i.unit}`);

    // Email summary
    const html = `
      <h2>Daily Sales & Stock Report</h2>
      <p><strong>Date:</strong> ${new Date(result.rows[0].createdAt).toLocaleDateString()}</p>
      <p><strong>Completed By:</strong> ${completedBy}</p>

      <h3>Sales</h3>
      <ul>
        <li>Cash Sales: ฿${fromCents(toCents(cashSales))}</li>
        <li>QR Sales: ฿${fromCents(toCents(qrSales))}</li>
        <li>Grab Sales: ฿${fromCents(toCents(grabSales))}</li>
        <li>Aroi Dee Sales: ฿${fromCents(toCents(aroiDeeSales))}</li>
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
        <li>Cash Banked: ฿${fromCents(cashBanked)}</li>
        <li>QR Transfer: ฿${fromCents(qrTransfer)}</li>
        <li>Closing Cash: ฿${fromCents(toCents(closingCash))}</li>
        <li>Starting Cash: ฿${fromCents(toCents(startingCash))}</li>
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
      cc: "smashbrothersburgersth@gmail.com", // Always CC Cam
      subject: `Daily Sales & Stock – ${new Date(result.rows[0].createdAt).toLocaleDateString()}`,
      html,
    });

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Daily Sales V2 create error", err);
    res.status(500).json({ ok: false, error: "Failed to create record" });
  }
}

export async function getDailySalesV2Records(req: Request, res: Response) {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const query = includeArchived
      ? `SELECT id, payload, "createdAt", "deletedAt" FROM daily_sales_v2 ORDER BY "createdAt" DESC`
      : `SELECT id, payload, "createdAt", "deletedAt" FROM daily_sales_v2 WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC`;

    const result = await pool.query(query);

    const records = result.rows.map((row) => {
      const p = row.payload || {};
      return {
        id: row.id,
        date: row.createdAt,
        staff: p.completedBy || "Unknown",
        totalSales: p.totalSales || 0,
        rolls: p.rollsEnd || "N/A",
        meat: p.meatEnd || "N/A",
        status: "submitted",
        deletedAt: row.deletedAt,
      };
    });

    res.json({ ok: true, records });
  } catch (err) {
    console.error("Get Daily Sales V2 records error", err);
    res.status(500).json({ ok: false, error: "Failed to fetch records" });
  }
}

export async function getDailySalesV2Record(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, payload, "createdAt", "deletedAt" FROM daily_sales_v2 WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};

    // Build shopping list for the modal
    const shoppingList = (p.requisition || [])
      .filter((i: any) => (i.qty || 0) > 0)
      .map((i: any) => ({
        name: i.name,
        qty: i.qty,
        unit: i.unit || "",
      }));

    const record = {
      id: row.id,
      date: row.createdAt,
      staff: p.completedBy || "Unknown",
      sales: {
        cash: p.cashSales || 0,
        qr: p.qrSales || 0,
        grab: p.grabSales || 0,
        aroiDee: p.aroiDeeSales || 0,
        total: p.totalSales || 0,
      },
      expenses: {
        items: p.expenses || [],
        wages: p.wages || [],
        total: p.totalExpenses || 0,
      },
      banking: {
        startingCash: p.startingCash || 0,
        closingCash: p.closingCash || 0,
        cashBanked: p.cashBanked || 0,
        qrTransfer: p.qrTransfer || 0,
      },
      stock: {
        rolls: p.rollsEnd || "N/A",
        meat: p.meatEnd || "N/A",
      },
      shoppingList,
    };

    res.json({ ok: true, record });
  } catch (err) {
    console.error("Get Daily Sales V2 record error", err);
    res.status(500).json({ ok: false, error: "Failed to fetch record" });
  }
}

export async function generateDailySalesV2PDF(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, payload, "createdAt" FROM daily_sales_v2 WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};

    // Build shopping list
    const shoppingList = (p.requisition || [])
      .filter((i: any) => (i.qty || 0) > 0)
      .map((i: any) => `${i.name} – ${i.qty} ${i.unit}`)
      .join(", ");

    const reportContent = `
Daily Sales & Stock Report

Date: ${new Date(row.createdAt).toLocaleDateString()}
Staff: ${p.completedBy || "Unknown"}

SALES:
Cash Sales: ฿${fromCents(p.cashSales || 0)}
QR Sales: ฿${fromCents(p.qrSales || 0)}
Grab Sales: ฿${fromCents(p.grabSales || 0)}
Aroi Dee Sales: ฿${fromCents(p.aroiDeeSales || 0)}
Total Sales: ฿${fromCents(p.totalSales || 0)}

EXPENSES:
${(p.expenses || [])
  .map((e: any) => `${e.item} – ฿${fromCents(toCents(e.cost))} (${e.shop})`)
  .join("\n")}
${(p.wages || [])
  .map((w: any) => `${w.staff} – ฿${fromCents(toCents(w.amount))} (${w.type})`)
  .join("\n")}
Total Expenses: ฿${fromCents(p.totalExpenses || 0)}

BANKING:
Starting Cash: ฿${fromCents(p.startingCash || 0)}
Closing Cash: ฿${fromCents(p.closingCash || 0)}
Cash Banked: ฿${fromCents(p.cashBanked || 0)}
QR Transfer: ฿${fromCents(p.qrTransfer || 0)}

STOCK:
Rolls: ${p.rollsEnd || "N/A"}
Meat: ${p.meatEnd || "N/A"}

SHOPPING LIST:
${shoppingList || "No items to purchase"}
`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="daily-sales-${row.id}.pdf"`);
    res.send(reportContent);
  } catch (err) {
    console.error("Generate PDF error", err);
    res.status(500).json({ ok: false, error: "Failed to generate PDF" });
  }
}

export async function deleteDailySalesV2Record(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE daily_sales_v2 SET "deletedAt" = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete Daily Sales V2 record error", err);
    res.status(500).json({ ok: false, error: "Failed to delete record" });
  }
}

export async function restoreDailySalesV2Record(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE daily_sales_v2 SET "deletedAt" = NULL WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Restore Daily Sales V2 record error", err);
    res.status(500).json({ ok: false, error: "Failed to restore record" });
  }
}

// Router setup
export const dailySalesV2Router = express.Router();

// Register routes
dailySalesV2Router.post("/daily-sales/v2", createDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2", getDailySalesV2Records);
dailySalesV2Router.get("/daily-sales/v2/:id", getDailySalesV2Record);
dailySalesV2Router.get("/daily-sales/v2/:id/pdf", generateDailySalesV2PDF);
dailySalesV2Router.delete("/daily-sales/v2/:id", deleteDailySalesV2Record);
dailySalesV2Router.patch("/daily-sales/v2/:id/restore", restoreDailySalesV2Record);