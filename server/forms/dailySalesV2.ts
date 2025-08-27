import express from "express";
import type { Request, Response } from "express";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { dailyStockSales } from "../../shared/schema";
import { desc } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Using existing Drizzle schema - no table setup needed

export const dailySalesV2Router = express.Router();

/** POST /api/forms/daily-sales/v2
 *  Body: the full form payload. We store it raw + a few top-level fields.
 */
dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const staffName = body?.staffName || body?.staff || body?.completedBy || 'Unknown';
    const shiftDate = new Date(body?.shiftDate || body?.date || new Date());

    // Insert using Drizzle ORM
    const [created] = await db.insert(dailyStockSales).values({
      completedBy: staffName,
      shiftType: 'EVENING', // Default to evening shift
      shiftDate: shiftDate,
      startingCash: body?.cashStart || body?.startingCash || 0,
      endingCash: body?.cashEnd || body?.endingCash || 0,
      totalSales: body?.totalSales || 0,
      totalExpenses: body?.totalExpenses || 0,
      cashSales: body?.cashSales || 0,
      qrScanSales: body?.qrSales || 0,
      grabSales: body?.grabSales || 0,
      aroiDeeSales: body?.aroiSales || 0,
      wageEntries: body?.wages || null,
      shoppingEntries: body?.shopping || null,
      notes: body?.notes || null,
      isDraft: false
    }).returning();

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
    if (prisma?.dailySales) {
      const rows = await prisma.dailySales.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return res.json({ ok: true, rows });
    } else {
      const r = await pool.query(
        `SELECT id, "createdAt", "shiftDate", "completedBy", "startingCash", "endingCash", 
         "totalSales", "totalExpenses", payload
         FROM daily_sales_v2 ORDER BY "createdAt" DESC LIMIT 100`
      );
      return res.json({ ok: true, rows: r.rows });
    }
  } catch (err:any) {
    console.error("Daily Sales List Error:", err);
    return res.status(500).json({ ok:false, error: err?.message || "list_failed" });
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