import express from "express";
import type { Request, Response } from "express";
import { db, pool } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

// A) Add helpers (top of file)
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};
const fromCents = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n / 100 : 0;
const num = (v: unknown, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

export const dailySalesV2Router = express.Router();

// B) POST /api/forms/daily-sales/v2 (map legacy keys → DB)
dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};

    // Accept both variants from UI
    const shiftDate     = b.shiftDate ?? b.date;
    const staffName     = b.staffName ?? b.completedBy;
    const startingCash  = b.startingCash ?? b.cashStart;
    const closingCash   = b.closingCash  ?? b.cashEnd ?? b.endingCash;
    const cashSales     = b.cashSales;
    const qrSales       = b.qrSales ?? b.qrTransferred;      // legacy->new
    const grabSales     = b.grabSales;
    const aroiSales     = b.aroiSales ?? b.aroiDeeSales;      // legacy->new
    const cashBanked    = b.cashBanked;
    const qrTransfer    = b.qrTransfer ?? b.qrTransferred;    // legacy->new
    const totalSales    = b.totalSales;
    const totalExpenses = b.totalExpenses;

    // Step-2 additions (optional on first submit)
    const rollsEnd      = b.rollsEnd ?? b.burgerBunsEnd;
    const meatEndGrams  = b.meatEndGrams ?? b.meatEnd;

    // Optional shopping list (can arrive later)
    const shoppingList  = Array.isArray(b.shoppingList) ? b.shoppingList : [];

    const row = {
      shiftDate: String(shiftDate ?? ""),
      completedBy: String(staffName ?? ""),
      startingCash:  toCents(startingCash),
      endingCash:    toCents(closingCash),
      cashSales:     toCents(cashSales),
      qrSales:       toCents(qrSales),
      grabSales:     toCents(grabSales),
      aroiSales:     toCents(aroiSales),
      cashBanked:    toCents(cashBanked),
      qrTransfer:    toCents(qrTransfer),
      totalSales:    toCents(totalSales),
      totalExpenses: toCents(totalExpenses),
      payload: {
        rollsEnd:     num(rollsEnd, 0),
        meatEndGrams: num(meatEndGrams, 0),
        shoppingList,
      },
    };

    // Generate UUID for ID
    const id = crypto.randomUUID();
    
    // Insert using raw SQL to match existing daily_sales_v2 table structure
    const query = `
      INSERT INTO daily_sales_v2 (
        id, "createdAt", "shiftDate", "submittedAtISO", "completedBy", 
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales",
        "grabSales", "aroiSales", "totalSales", "totalExpenses", "qrTransfer", "payload"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;
    
    const values = [
      id,
      new Date(),
      row.shiftDate,
      new Date(),
      row.completedBy,
      row.startingCash,
      row.endingCash,
      row.cashBanked,
      row.cashSales,
      row.qrSales,
      row.grabSales,
      row.aroiSales,
      row.totalSales,
      row.totalExpenses,
      row.qrTransfer,
      JSON.stringify(row.payload)
    ];

    const result = await pool.query(query, values);
    
    // Hooks: keep them as console logs for now so we can verify trigger
    console.log("HOOK: summary email, shopping list, jussi", { id });
    
    res.json({ ok: true, id });
  } catch (err: any) {
    console.error("Daily Sales Save Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "save_failed" });
  }
});

// C) PATCH stock data after Step-2 (no schema change)
dailySalesV2Router.patch("/daily-sales/v2/:id/stock", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body ?? {};
    const rollsEnd     = num(b.rollsEnd ?? b.burgerBunsEnd, 0);
    const meatEndGrams = num(b.meatEndGrams ?? b.meatEnd, 0);
    const shoppingList = Array.isArray(b.shoppingList) ? b.shoppingList : [];

    const selectQuery = `SELECT * FROM daily_sales_v2 WHERE id = $1`;
    const selectResult = await pool.query(selectQuery, [id]);
    
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    
    const row = selectResult.rows[0];
    const payload = { ...(row.payload ?? {}), rollsEnd, meatEndGrams, shoppingList };
    
    const updateQuery = `UPDATE daily_sales_v2 SET payload = $1 WHERE id = $2`;
    await pool.query(updateQuery, [JSON.stringify(payload), id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Daily Sales Stock Update Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "update_failed" });
  }
});

// D) GET list → return display-ready numbers and stock
dailySalesV2Router.get("/daily-sales/v2", async (_req: Request, res: Response) => {
  try {
    const listQuery = `
      SELECT id, "createdAt", "shiftDate", "completedBy", "startingCash", 
             "endingCash", "totalSales", "cashBanked", "qrTransfer", "grabSales", 
             "aroiSales", "totalExpenses", "payload"
      FROM daily_sales_v2 
      ORDER BY "createdAt" DESC 
      LIMIT 100
    `;
    const result = await pool.query(listQuery);
    const rows = result.rows;
    res.json({
      ok: true,
      rows: rows.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        shiftDate: r.shiftDate,
        completedBy: r.completedBy,
        cashStart:  fromCents(r.startingCash),
        cashEnd:    fromCents(r.endingCash),
        totalSales: fromCents(r.totalSales),
        cashBanked: fromCents(r.cashBanked),
        qrTransfer: fromCents(r.qrTransfer),
        grabSales:  fromCents(r.grabSales),
        aroiSales:  fromCents(r.aroiSales),
        rollsEnd:   r.payload?.rollsEnd ?? 0,
        meatEndGrams: r.payload?.meatEndGrams ?? 0,
        shoppingList: r.payload?.shoppingList ?? [],
      })),
    });
  } catch (err: any) {
    console.error("Daily Sales List Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "list_failed" });
  }
});

/** GET /api/forms/daily-sales/v2/:id - Individual record for View component */
dailySalesV2Router.get("/daily-sales/v2/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const singleQuery = `
      SELECT id, "createdAt", "shiftDate", "completedBy", "startingCash", 
             "endingCash", "totalSales", "cashBanked", "qrTransfer", "grabSales", 
             "aroiSales", "totalExpenses", "payload"
      FROM daily_sales_v2 
      WHERE id = $1
    `;
    const result = await pool.query(singleQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }
    
    const row = result.rows[0];
    
    // Map fields to match View component expectations with display-ready numbers
    const record = {
      id: row.id,
      createdAt: row.createdAt,
      shiftDate: row.shiftDate,
      completedBy: row.completedBy,
      cashStart: fromCents(row.startingCash),
      cashEnd: fromCents(row.endingCash),
      totalSales: fromCents(row.totalSales),
      cashBanked: fromCents(row.cashBanked),
      qrTransfer: fromCents(row.qrTransfer),
      grabSales: fromCents(row.grabSales),
      aroiSales: fromCents(row.aroiSales),
      totalExpenses: fromCents(row.totalExpenses),
      rollsEnd: row.payload?.rollsEnd ?? 0,
      meatEndGrams: row.payload?.meatEndGrams ?? 0,
      shoppingList: row.payload?.shoppingList ?? [],
      variance: fromCents(row.totalSales) - fromCents(row.totalExpenses),
    };
    
    return res.json(record);
  } catch (err: any) {
    console.error("Daily Sales Get Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "fetch_failed" });
  }
});