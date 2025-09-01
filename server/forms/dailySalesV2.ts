// Do not do this:
// – Do not rename, move, or split this file
// – Do not change schema, DB, or table names
// – Do not remove or alter toCents/fromCents conversions
// – Do not add any dependencies
// – Only apply exactly what is written below

import express from "express";
import { Request, Response } from "express";
import { db } from "../db";

// Helper function
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

export const dailySalesV2Router = express.Router();

dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
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
    } = req.body;

    // Calculate totals
    const totalSales =
      toCents(cashSales) +
      toCents(qrSales) +
      toCents(grabSales) +
      toCents(aroiDeeSales);

    const totalExpenses =
      (expenses || []).reduce((sum: number, e: any) => sum + toCents(e.cost), 0) +
      (wages || []).reduce((sum: number, w: any) => sum + toCents(w.amount), 0);

    // Final formula: Cash Banked = Cash Sales - Expenses
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
    };

    const result = await db.query(
      `INSERT INTO daily_sales_v2 (payload) VALUES ($1) RETURNING id`,
      [payload]
    );

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Daily Sales V2 create error", err);
    res.status(500).json({ ok: false, error: "Failed to create record" });
  }
});