// Do not do this:
// – Do not rename, move, or split this file
// – Do not change schema or add DB tables
// – Only apply exactly what is written below

import { Request, Response } from "express";
import express from "express";
import { pool } from "../db";
import PDFDocument from "pdfkit";
import stream from "stream";

// Helper functions
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

const fromCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x / 100 : 0;
};

export const dailySalesV2Router = express.Router();

// Register routes
dailySalesV2Router.get("/daily-sales/v2", listDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id", getDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id/pdf", getDailySalesV2PDF);
dailySalesV2Router.patch("/daily-sales/v2/:id", updateDailySalesV2);
dailySalesV2Router.delete("/daily-sales/v2/:id", deleteDailySalesV2);
dailySalesV2Router.patch("/daily-sales/v2/:id/restore", restoreDailySalesV2);

export async function listDailySalesV2(req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, "createdAt", payload, "deletedAt" FROM daily_sales_v2 ORDER BY "createdAt" DESC LIMIT 100`
    );

    const mapped = result.rows.map((row: any) => {
      const p = row.payload || {};
      return {
        id: row.id,
        date: row.createdAt,
        staff: p.completedBy || "",
        cashStart: fromCents(p.startingCash || 0),
        cashEnd: fromCents(p.closingCash || 0),
        totalSales: fromCents(p.totalSales || 0),
        rolls: p.rollsEnd || "-",
        meat: p.meatEnd || "-",
        status: "Submitted",
        deletedAt: row.deletedAt,
      };
    });

    res.json({ ok: true, records: mapped });
  } catch (err) {
    console.error("Daily Sales V2 list error", err);
    res.status(500).json({ ok: false, error: "Failed to list records" });
  }
}

export async function getDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, "createdAt", payload FROM daily_sales_v2 WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};

    // Build shopping list (items where qty > 1)
    const shoppingList = (p.requisition || [])
      .filter((i: any) => (i.qty || 0) > 1)
      .map((i: any) => ({
        name: i.name,
        qty: i.qty,
        unit: i.unit,
      }));

    res.json({
      ok: true,
      record: {
        id: row.id,
        date: row.createdAt,
        staff: p.completedBy || "",
        sales: {
          cashSales: fromCents(p.cashSales || 0),
          qrSales: fromCents(p.qrSales || 0),
          grabSales: fromCents(p.grabSales || 0),
          aroiDeeSales: fromCents(p.aroiDeeSales || 0),
          totalSales: fromCents(p.totalSales || 0),
        },
        expenses: {
          total: fromCents(p.totalExpenses || 0),
          items: p.expenses || [],
          wages: p.wages || [],
        },
        banking: {
          cashBanked: fromCents(p.cashBanked || 0),
          qrTransfer: fromCents(p.qrTransfer || 0),
          closingCash: fromCents(p.closingCash || 0),
          startingCash: fromCents(p.startingCash || 0),
        },
        stock: {
          rolls: p.rollsEnd || "-",
          meat: p.meatEnd || "-",
        },
        shoppingList,
      },
    });
  } catch (err) {
    console.error("Daily Sales V2 get error", err);
    res.status(500).json({ ok: false, error: "Failed to fetch record" });
  }
}

// PATCH – update payload
export async function updateDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { payload } = req.body;
    await pool.query(
      `UPDATE daily_sales_v2 SET payload = $1 WHERE id = $2`,
      [payload, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Daily Sales V2 update error", err);
    res.status(500).json({ ok: false, error: "Failed to update record" });
  }
}

// DELETE – soft delete (set deletedAt)
export async function deleteDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE daily_sales_v2 SET "deletedAt" = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Daily Sales V2 delete error", err);
    res.status(500).json({ ok: false, error: "Failed to delete record" });
  }
}

// RESTORE – undo delete
export async function restoreDailySalesV2(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE daily_sales_v2 SET "deletedAt" = NULL WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Daily Sales V2 restore error", err);
    res.status(500).json({ ok: false, error: "Failed to restore record" });
  }
}

export async function getDailySalesV2PDF(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, "createdAt", payload FROM daily_sales_v2 WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const row = result.rows[0];
    const p = row.payload || {};

    // Create PDF
    const doc = new PDFDocument();
    const filename = `daily-sales-${id}.pdf`;

    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    const pass = new stream.PassThrough();
    doc.pipe(pass);

    doc.fontSize(18).text("Daily Sales & Stock Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Date: ${new Date(row.createdAt).toLocaleDateString()}`);
    doc.text(`Staff: ${p.completedBy || ""}`);
    doc.moveDown();

    doc.fontSize(14).text("Sales");
    doc.fontSize(12).text(`Cash Sales: ฿${fromCents(p.cashSales || 0)}`);
    doc.text(`QR Sales: ฿${fromCents(p.qrSales || 0)}`);
    doc.text(`Grab Sales: ฿${fromCents(p.grabSales || 0)}`);
    doc.text(`Aroi Dee Sales: ฿${fromCents(p.aroiDeeSales || 0)}`);
    doc.text(`Total Sales: ฿${fromCents(p.totalSales || 0)}`);
    doc.moveDown();

    doc.fontSize(14).text("Expenses");
    (p.expenses || []).forEach((e: any) => {
      doc.fontSize(12).text(`- ${e.item} ฿${fromCents(e.cost || 0)} (${e.shop || ""})`);
    });
    doc.text(`Total Expenses: ฿${fromCents(p.totalExpenses || 0)}`);
    doc.moveDown();

    doc.fontSize(14).text("Wages");
    (p.wages || []).forEach((w: any) => {
      doc.fontSize(12).text(`- ${w.staff} ฿${fromCents(w.amount || 0)} (${w.type})`);
    });
    doc.moveDown();

    doc.fontSize(14).text("Banking");
    doc.fontSize(12).text(`Cash Banked: ฿${fromCents(p.cashBanked || 0)}`);
    doc.text(`QR Transfer: ฿${fromCents(p.qrTransfer || 0)}`);
    doc.text(`Closing Cash: ฿${fromCents(p.closingCash || 0)}`);
    doc.text(`Starting Cash: ฿${fromCents(p.startingCash || 0)}`);
    doc.moveDown();

    doc.fontSize(14).text("Stock");
    doc.fontSize(12).text(`Rolls: ${p.rollsEnd || "-"}`);
    doc.text(`Meat: ${p.meatEnd || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Shopping List");
    (p.requisition || [])
      .filter((i: any) => (i.qty || 0) > 1)
      .forEach((i: any) => {
        doc.fontSize(12).text(`- ${i.name} x${i.qty} ${i.unit}`);
      });

    doc.end();
    pass.pipe(res);
  } catch (err) {
    console.error("Daily Sales V2 PDF error", err);
    res.status(500).json({ ok: false, error: "Failed to generate PDF" });
  }
}