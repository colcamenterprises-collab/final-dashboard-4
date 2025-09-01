// Do not do this:
// – Do not rename, move, or split this file
// – Do not change schema, DB, or table names
// – Do not add dependencies
// – Only apply exactly what is written below

import { Request, Response } from "express";
import { pool } from "../db"; // using pool.query after agent change

// Helper functions
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

const fromCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x / 100 : 0;
};

// Existing createDailySalesV2 stays unchanged

import express from "express";
export const dailySalesV2Router = express.Router();

// GET endpoint for the Library
dailySalesV2Router.get("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, "createdAt", payload FROM daily_sales_v2 ORDER BY "createdAt" DESC LIMIT 100`
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
        buns: p.bunsEnd || "-",  // expects Form 2 integration
        meat: p.meatEnd || "-",  // expects Form 2 integration
        status: "Submitted",
      };
    });

    res.json({ ok: true, records: mapped });
  } catch (err) {
    console.error("Daily Sales V2 list error", err);
    res.status(500).json({ ok: false, error: "Failed to list records" });
  }
});

export async function listDailySalesV2(req: Request, res: Response) {
  // This function is kept for backward compatibility but the router handles the endpoint
  return dailySalesV2Router.get("/daily-sales/v2", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT id, "createdAt", payload FROM daily_sales_v2 ORDER BY "createdAt" DESC LIMIT 100`
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
          buns: p.bunsEnd || "-",  // expects Form 2 integration
          meat: p.meatEnd || "-",  // expects Form 2 integration
          status: "Submitted",
        };
      });

      res.json({ ok: true, records: mapped });
    } catch (err) {
      console.error("Daily Sales V2 list error", err);
      res.status(500).json({ ok: false, error: "Failed to list records" });
    }
  });
}