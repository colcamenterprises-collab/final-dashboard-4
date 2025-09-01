// Do not do this:
// – Do not rename, move, or split this file
// – Do not change schema, DB, or table names
// – Do not add dependencies
// – Only apply exactly what is written below

import { Request, Response } from "express";
import express from "express";
import { pool } from "../db";

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

// Existing createDailySalesV2 unchanged

// Register routes
dailySalesV2Router.get("/daily-sales/v2", listDailySalesV2);
dailySalesV2Router.get("/daily-sales/v2/:id", getDailySalesV2);

export async function listDailySalesV2(req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, created_at, payload FROM daily_sales_v2 ORDER BY created_at DESC LIMIT 100`
    );

    const mapped = result.rows.map((row: any) => {
      const p = row.payload || {};
      return {
        id: row.id,
        date: row.created_at,
        staff: p.completedBy || "",
        cashStart: fromCents(p.startingCash || 0),
        cashEnd: fromCents(p.closingCash || 0),
        totalSales: fromCents(p.totalSales || 0),
        rolls: p.rollsEnd || "-",
        meat: p.meatEnd || "-",
        status: "Submitted",
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
      `SELECT id, created_at, payload FROM daily_sales_v2 WHERE id = $1 LIMIT 1`,
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
        date: row.created_at,
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