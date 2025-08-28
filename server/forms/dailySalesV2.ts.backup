import express from "express";
import type { Request, Response } from "express";
import { pool } from "../db";
import crypto from "crypto";

// --- currency helpers (store in cents, display in units) ---
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};
const fromCents = (n: number | null | undefined) =>
  (typeof n === "number" && Number.isFinite(n)) ? n / 100 : 0;

export const dailySalesV2Router = express.Router();

/** POST /api/forms/daily-sales/v2
 *  Body: the full form payload. We store it raw + a few top-level fields.
 */
dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    // EXPECTED payload fields from the form (step 1 and step 2)
    const {
      shiftDate,
      staffName,
      startingCash,
      closingCash, // UI uses closingCash, DB is "endingCash"
      cashSales, qrSales, grabSales, aroiSales,
      cashBanked, qrTransfer,
      totalSales, totalExpenses,
      // step 2 (stock)
      rollsEnd,        // pcs
      meatEndGrams,    // grams
      shoppingList     // array/object optional
    } = req.body ?? {};

    // Generate UUID for ID  
    const id = crypto.randomUUID();
    
    // Insert using raw SQL to match existing daily_sales_v2 table structure
    const query = `
      INSERT INTO daily_sales_v2 (
        id, "createdAt", "shiftDate", "submittedAtISO", "completedBy", 
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales",
        "grabSales", "aroiSales", "totalSales", "totalExpenses", "qrTransfer", "payload"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      id,
      new Date(),
      String(shiftDate ?? ""),
      new Date(),
      String(staffName ?? ""),
      toCents(startingCash),
      toCents(closingCash),
      toCents(cashBanked),
      toCents(cashSales),
      toCents(qrSales),
      toCents(grabSales),
      toCents(aroiSales),
      toCents(totalSales),
      toCents(totalExpenses),
      toCents(qrTransfer),
      JSON.stringify({
        rollsEnd: Number(rollsEnd) || 0,
        meatEndGrams: Number(meatEndGrams) || 0,
        shoppingList: shoppingList ?? [],
      })
    ];

    const result = await pool.query(query, values);
    const inserted = result.rows[0];

    // Post-submit hooks (non-blocking) — after successful insert, fire and forget:
    try {
      await Promise.all([
        Email?.sendDailySalesSummary?.().catch(()=>{}),
        ShoppingList?.updateFromSubmission?.().catch(()=>{}),
        Jussi?.analyzeDailySubmission?.().catch(()=>{}),
      ]);
    } catch (e) {
      console.warn("Post-submit hooks failed:", e);
    }

    res.json({ ok: true, id: inserted.id });
  } catch (err:any) {
    console.error("Daily Sales Save Error:", err);
    return res.status(500).json({ ok:false, error: err?.message || "save_failed" });
  }
});

/** GET /api/forms/daily-sales/v2
 *  Returns 100 most recent submissions for the Library table.
 */
dailySalesV2Router.get("/daily-sales/v2", async (_req: Request, res: Response) => {
  try {
    // Get latest 100 records using raw SQL with all available fields
    const query = `
      SELECT id, "createdAt", "shiftDate", "completedBy", "startingCash", 
             "endingCash", "totalSales", "cashSales", "qrSales", "grabSales", 
             "aroiSales", "cashBanked", "totalExpenses", "qrTransfer", "payload"
      FROM daily_sales_v2 
      ORDER BY "createdAt" DESC 
      LIMIT 100
    `;
    
    const result = await pool.query(query);
    
    const data = result.rows.map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      shiftDate: r.shiftDate,
      completedBy: r.completedBy,
      cashStart: fromCents(r.startingCash),
      cashEnd: fromCents(r.endingCash),
      totalSales: fromCents(r.totalSales),
      cashBanked: fromCents(r.cashBanked),
      qrTransfer: fromCents(r.qrTransfer),
      grabSales: fromCents(r.grabSales),
      aroiSales: fromCents(r.aroiSales),
      rollsEnd: r.payload?.rollsEnd ?? 0,
      meatEndGrams: r.payload?.meatEndGrams ?? 0,
    }));

    res.json({ ok: true, rows: data });
  } catch (err:any) {
    console.error("Daily Sales List Error:", err);
    return res.status(500).json({ ok:false, error: err?.message || "list_failed" });
  }
});

/** GET /api/forms/daily-sales/v2/:id
 *  Returns individual record for View/Modal components.
 */
dailySalesV2Router.get("/daily-sales/v2/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT id, "createdAt", "shiftDate", "completedBy", "startingCash", 
             "endingCash", "totalSales", "cashSales", "qrSales", "grabSales", 
             "aroiSales", "cashBanked", "totalExpenses", "qrTransfer", "payload"
      FROM daily_sales_v2 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }
    
    const r = result.rows[0];
    
    // Map fields to match View component expectations
    const record = {
      ...r,
      cashStart: fromCents(r.startingCash),
      cashEnd: fromCents(r.endingCash),
      totalSales: fromCents(r.totalSales),
      cashBanked: fromCents(r.cashBanked),
      qrTransfer: fromCents(r.qrTransfer),
      grabSales: fromCents(r.grabSales),
      aroiSales: fromCents(r.aroiSales),
      totalExpenses: fromCents(r.totalExpenses),
      rollsEnd: r.payload?.rollsEnd ?? 0,
      meatEndGrams: r.payload?.meatEndGrams ?? 0,
    };
    
    return res.json(record);
  } catch (err: any) {
    console.error("Daily Sales Get Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "fetch_failed" });
  }
});

const Email = { sendDailySalesSummary: async () => {} };
const ShoppingList = { updateFromSubmission: async () => {} };
const Jussi = { analyzeDailySubmission: async () => {} };