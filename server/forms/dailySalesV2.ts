import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";

// We try Prisma first (preferred). If not present, we fallback to direct SQL.
let prisma: any = null;
try { prisma = require("../../prisma").prisma || require("../prisma").prisma; } catch { /* ignore */ }

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Ensure table columns exist so we never lose submissions
 *  NOTE: The table already exists, we just ensure our columns are there
 */
async function ensureTable() {
  try {
    // Table already exists, just ensure our specific columns are there
    await pool.query(`ALTER TABLE daily_sales_v2 ADD COLUMN IF NOT EXISTS staff TEXT;`);
    await pool.query(`ALTER TABLE daily_sales_v2 ADD COLUMN IF NOT EXISTS shift_date DATE;`);
    await pool.query(`ALTER TABLE daily_sales_v2 ADD COLUMN IF NOT EXISTS payload JSONB;`);
  } catch (e) {
    console.warn("Daily Sales V2 table setup warning (non-blocking):", e);
  }
}
ensureTable().catch(console.error);

export const dailySalesV2Router = express.Router();

/** POST /api/forms/daily-sales/v2
 *  Body: the full form payload. We store it raw + a few top-level fields.
 */
dailySalesV2Router.post("/daily-sales/v2", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const staff = body?.staffName || body?.staff || null;

    // try Prisma typed create if a model exists, else raw JSON bucket
    if (prisma?.dailySales) {
      const created = await prisma.dailySales.create({ data: body });
      // Hooks after successful save
      queueHooksSafely(created);
      return res.json({ ok: true, id: created?.id, record: created });
    } else {
      const shiftDate = body?.shiftDate || body?.date || null;
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO daily_sales_v2 (id, staff, shift_date, payload, "createdAt")
         VALUES ($1, $2, $3, $4, NOW()) RETURNING id, "createdAt"`,
        [id, staff, shiftDate, JSON.stringify(body)]
      );
      const created = { id: result.rows[0].id, createdAt: result.rows[0].createdAt, staff, shiftDate, payload: body };
      queueHooksSafely(created);
      return res.json({ ok: true, id: created.id, record: created });
    }
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
        `SELECT id, "createdAt", staff, shift_date as "shiftDate", payload
         FROM daily_sales_v2 ORDER BY id DESC LIMIT 100`
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