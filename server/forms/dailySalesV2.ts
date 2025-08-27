import express from "express";
import type { Request, Response } from "express";
import { pool } from "../db";
import crypto from "crypto";

// Using existing Drizzle schema - no table setup needed

export const dailySalesV2Router = express.Router();

/** POST /api/forms/daily-sales/v2
 *  Body: the full form payload. We store it raw + a few top-level fields.
 */
dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const staffName = body?.staffName || body?.staff || body?.completedBy || 'Unknown';
    const shiftDate = body?.shiftDate || body?.date || new Date().toISOString().split('T')[0];

    // Generate UUID for ID  
    const id = crypto.randomUUID();
    
    // Insert using raw SQL to match existing daily_sales_v2 table structure
    const query = `
      INSERT INTO daily_sales_v2 (
        id, "createdAt", "shiftDate", "submittedAtISO", "completedBy", 
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales",
        "grabSales", "aroiSales", "totalSales"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      id,
      new Date(),
      shiftDate,
      new Date(),
      staffName,
      parseInt(body?.cashStart || body?.startingCash || '0'),
      parseInt(body?.cashEnd || body?.endingCash || '0'),
      parseInt(body?.cashBanked || '0'),
      parseInt(body?.cashSales || '0'),
      parseInt(body?.qrSales || '0'),
      parseInt(body?.grabSales || '0'),
      parseInt(body?.aroiSales || body?.aroiDeeSales || '0'),
      parseInt(body?.totalSales || '0')
    ];

    const result = await pool.query(query, values);
    const created = result.rows[0];

    queueHooksSafely(created);
    return res.json({ ok: true, id: created.id, record: created });
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
             "aroiSales", "cashBanked", "totalExpenses", "qrTransfer"
      FROM daily_sales_v2 
      ORDER BY "createdAt" DESC 
      LIMIT 100
    `;
    
    const result = await pool.query(query);
    
    // Map fields to match frontend expectations with proper defaults
    const rows = result.rows.map(row => ({
      ...row,
      closingCash: row.endingCash || 0, // Frontend expects closingCash
      qrTransferred: row.qrTransfer || row.qrSales || 0,  // Use qrTransfer field if available
      totalExpenses: row.totalExpenses || 0, // Use actual field
      cashBanked: row.cashBanked || 0,
      variance: (row.totalSales || 0) - (row.startingCash || 0) - (row.endingCash || 0) // Fixed variance calc
    }));
    
    return res.json({ ok: true, rows });
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
             "aroiSales", "cashBanked", "totalExpenses", "qrTransfer"
      FROM daily_sales_v2 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Record not found" });
    }
    
    const row = result.rows[0];
    
    // Map fields to match View component expectations
    // Note: View component divides by 100 in THB formatter, so we multiply here
    const record = {
      ...row,
      startingCash: (row.startingCash || 0) * 100,
      closingCash: (row.endingCash || 0) * 100,
      cashBanked: (row.cashBanked || 0) * 100,
      qrTransferred: (row.qrTransfer || row.qrSales || 0) * 100,
      totalSales: (row.totalSales || 0) * 100,
      totalExpenses: (row.totalExpenses || 0) * 100,
      aroiDeeSales: (row.aroiSales || 0) * 100,
      variance: ((row.totalSales || 0) - (row.startingCash || 0) - (row.endingCash || 0)) * 100,
      // Set default values since these columns don't exist in daily_sales_v2 table
      burgerBunsCount: 0,
      meatCount: 0
    };
    
    return res.json(record);
  } catch (err: any) {
    console.error("Daily Sales Get Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "fetch_failed" });
  }
});

/** Fire-and-forget hooks: email + shopping list.
 *  We do not throw if these fail; persistence already succeeded.
 */
function queueHooksSafely(record: any) {
  try {
    // Prefer existing services if present; otherwise no-op.
    try {
      const mailer = require("../services/mailer");
      if (mailer?.sendDailySalesSummary) mailer.sendDailySalesSummary(record);
    } catch {}
    try {
      const purchasing = require("../services/purchasing");
      if (purchasing?.generateShoppingListFromDailySales) purchasing.generateShoppingListFromDailySales(record);
    } catch {}
  } catch (e) {
    console.warn("DailySales hooks failed (non-blocking):", e);
  }
}