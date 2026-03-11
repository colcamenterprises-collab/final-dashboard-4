/**
 * Bob Read-Only API Layer
 * Base path: /api/bob/read
 *
 * Authentication: Bearer token via BOB_READONLY_TOKEN env var
 * All routes are GET only — no mutations allowed.
 *
 * Endpoints:
 *   GET /api/bob/read/health
 *   GET /api/bob/read/reports/item-sales?date=YYYY-MM-DD
 *   GET /api/bob/read/reports/modifier-sales?date=YYYY-MM-DD
 *   GET /api/bob/read/reports/category-totals?date=YYYY-MM-DD
 *   GET /api/bob/read/forms/daily-sales?date=YYYY-MM-DD&limit=N
 *   GET /api/bob/read/forms/daily-stock?date=YYYY-MM-DD&limit=N
 *   GET /api/bob/read/purchases?limit=N
 *   GET /api/bob/read/tasks?status=...&area=...&limit=N
 *   GET /api/bob/read/audits?type=baseline|snapshot&limit=N
 */

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { pool } from "../db";

const router = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const MODULES = [
  "reports/item-sales",
  "reports/modifier-sales",
  "reports/category-totals",
  "forms/daily-sales",
  "forms/daily-stock",
  "purchases",
  "tasks",
  "audits",
];

// ─── Log Table Bootstrap ──────────────────────────────────────────────────────

let logTableReady = false;

async function ensureLogTable() {
  if (logTableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bob_read_logs (
        id        SERIAL PRIMARY KEY,
        ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        route     TEXT NOT NULL,
        params    JSONB,
        status    INTEGER NOT NULL,
        ok        BOOLEAN NOT NULL,
        duration_ms INTEGER
      )
    `);
    logTableReady = true;
  } catch (err) {
    console.error("[bobRead] Failed to ensure log table:", err);
  }
}

ensureLogTable().catch(() => {});

async function logRequest(
  route: string,
  params: Record<string, unknown>,
  status: number,
  ok: boolean,
  durationMs: number
) {
  try {
    await pool.query(
      `INSERT INTO bob_read_logs (route, params, status, ok, duration_ms) VALUES ($1, $2, $3, $4, $5)`,
      [route, JSON.stringify(params), status, ok, durationMs]
    );
  } catch (_) {}
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function bobAuth(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.BOB_READONLY_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ ok: false, error: "BOB_READONLY_TOKEN not configured on server" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== expectedToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized — valid Bearer token required" });
  }

  next();
}

// ─── Read-Only Guard ──────────────────────────────────────────────────────────
// Belt-and-suspenders: block any non-GET that somehow reaches this router.

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed — Bob routes are read-only" });
  }
  next();
});

// Apply auth to all routes
router.use(bobAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function safeLimit(val: unknown, def = 50, max = 200): number {
  const n = parseInt(val as string, 10);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

// Timing wrapper
function timed() {
  const start = Date.now();
  return () => Date.now() - start;
}

// ─── GET /api/bob/read/health ─────────────────────────────────────────────────

router.get("/health", async (req: Request, res: Response) => {
  const elapsed = timed();
  const status = 200;
  const body = {
    ok: true,
    timestamp: new Date().toISOString(),
    available_modules: MODULES,
    auth: "Bearer token validated",
  };
  await logRequest("/health", {}, status, true, elapsed());
  return res.status(status).json(body);
});

// ─── GET /api/bob/read/reports/item-sales?date=YYYY-MM-DD ────────────────────

router.get("/reports/item-sales", async (req: Request, res: Response) => {
  const elapsed = timed();
  const date = req.query.date as string;
  const params = { date };

  if (!date || !isValidDate(date)) {
    await logRequest("/reports/item-sales", params, 400, false, elapsed());
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(l.sku, '') AS sku,
        l.item_name AS name,
        COALESCE(l.pos_category_name, 'UNCATEGORIZED') AS category,
        SUM(CASE WHEN l.receipt_type = 'SALE' THEN l.quantity ELSE 0 END)::int AS sold,
        SUM(CASE WHEN l.receipt_type = 'REFUND' THEN ABS(l.quantity) ELSE 0 END)::int AS refunds
      FROM receipt_truth_line l
      WHERE l.receipt_date = ${date}::date
      GROUP BY l.sku, l.item_name, l.pos_category_name
      ORDER BY sold DESC, l.item_name
    `);

    const items = (result.rows as any[]).map((row) => ({
      sku: row.sku || null,
      name: row.name,
      category: row.category || "",
      sold: Number(row.sold),
      refunds: Number(row.refunds),
      net: Number(row.sold) - Number(row.refunds),
    }));

    await logRequest("/reports/item-sales", params, 200, true, elapsed());
    return res.json({ ok: true, date, count: items.length, items });
  } catch (err: any) {
    console.error("[bobRead/item-sales]", err);
    await logRequest("/reports/item-sales", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/reports/modifier-sales?date=YYYY-MM-DD ────────────────

router.get("/reports/modifier-sales", async (req: Request, res: Response) => {
  const elapsed = timed();
  const date = req.query.date as string;
  const params = { date };

  if (!date || !isValidDate(date)) {
    await logRequest("/reports/modifier-sales", params, 400, false, elapsed());
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  const shiftStart = `${date} 17:00:00+07`;
  const shiftEnd = `${nextDay(date)} 03:00:00+07`;

  try {
    const result = await db.execute(sql`
      SELECT
        m.raw_json->>'name' AS modifier_group,
        m.name AS modifier,
        SUM(m.qty)::int AS count
      FROM lv_modifier m
      JOIN lv_receipt r ON r.receipt_id = m.receipt_id
      WHERE r.datetime_bkk >= ${shiftStart}::timestamptz
        AND r.datetime_bkk < ${shiftEnd}::timestamptz
        AND (r.raw_json->>'refund_for') IS NULL
      GROUP BY modifier_group, modifier
      ORDER BY count DESC, modifier_group, modifier
    `);

    const modifiers = (result.rows as any[]).map((row) => ({
      modifier_group: row.modifier_group || "Unknown Group",
      modifier: row.modifier,
      count: Number(row.count),
    }));

    await logRequest("/reports/modifier-sales", params, 200, true, elapsed());
    return res.json({ ok: true, date, count: modifiers.length, modifiers });
  } catch (err: any) {
    console.error("[bobRead/modifier-sales]", err);
    await logRequest("/reports/modifier-sales", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/reports/category-totals?date=YYYY-MM-DD ───────────────

router.get("/reports/category-totals", async (req: Request, res: Response) => {
  const elapsed = timed();
  const date = req.query.date as string;
  const params = { date };

  if (!date || !isValidDate(date)) {
    await logRequest("/reports/category-totals", params, 400, false, elapsed());
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(pos_category_name, 'UNCATEGORIZED') AS category,
        SUM(quantity)::int AS total
      FROM receipt_truth_line
      WHERE receipt_date = ${date}::date
        AND receipt_type = 'SALE'
      GROUP BY COALESCE(pos_category_name, 'UNCATEGORIZED')
      ORDER BY total DESC
    `);

    const totals: Record<string, number> = {};
    for (const row of result.rows as any[]) {
      totals[row.category] = Number(row.total);
    }

    await logRequest("/reports/category-totals", params, 200, true, elapsed());
    return res.json({ ok: true, date, totals });
  } catch (err: any) {
    console.error("[bobRead/category-totals]", err);
    await logRequest("/reports/category-totals", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/forms/daily-sales?date=YYYY-MM-DD&limit=N ─────────────

router.get("/forms/daily-sales", async (req: Request, res: Response) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 10, 50);
  const params = { date, limit };

  try {
    let rows: any[];
    if (date && isValidDate(date)) {
      const result = await pool.query(
        `SELECT id, "shiftDate", "submittedAtISO", "completedBy",
                "totalSales", "cashSales", "qrSales", "grabSales",
                "cashBanked", "totalExpenses"
         FROM daily_sales_v2
         WHERE "shiftDate" = $1
         ORDER BY "submittedAtISO" DESC NULLS LAST
         LIMIT $2`,
        [date, limit]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT id, "shiftDate", "submittedAtISO", "completedBy",
                "totalSales", "cashSales", "qrSales", "grabSales",
                "cashBanked", "totalExpenses"
         FROM daily_sales_v2
         ORDER BY "shiftDate" DESC, "submittedAtISO" DESC NULLS LAST
         LIMIT $1`,
        [limit]
      );
      rows = result.rows;
    }

    await logRequest("/forms/daily-sales", params, 200, true, elapsed());
    return res.json({ ok: true, count: rows.length, forms: rows });
  } catch (err: any) {
    console.error("[bobRead/forms/daily-sales]", err);
    await logRequest("/forms/daily-sales", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/forms/daily-stock?date=YYYY-MM-DD&limit=N ─────────────

router.get("/forms/daily-stock", async (req: Request, res: Response) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 10, 50);
  const params = { date, limit };

  try {
    let rows: any[];
    if (date && isValidDate(date)) {
      const result = await pool.query(
        `SELECT s.id, s."salesId", s."createdAt",
                s."burgerBuns", s."meatWeightG", s."drinksJson", s."notes",
                d."shiftDate"
         FROM daily_stock_v2 s
         JOIN daily_sales_v2 d ON d.id = s."salesId"
         WHERE d."shiftDate" = $1
         ORDER BY s."createdAt" DESC
         LIMIT $2`,
        [date, limit]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT s.id, s."salesId", s."createdAt",
                s."burgerBuns", s."meatWeightG", s."drinksJson", s."notes",
                d."shiftDate"
         FROM daily_stock_v2 s
         JOIN daily_sales_v2 d ON d.id = s."salesId"
         ORDER BY d."shiftDate" DESC, s."createdAt" DESC
         LIMIT $1`,
        [limit]
      );
      rows = result.rows;
    }

    await logRequest("/forms/daily-stock", params, 200, true, elapsed());
    return res.json({ ok: true, count: rows.length, forms: rows });
  } catch (err: any) {
    console.error("[bobRead/forms/daily-stock]", err);
    await logRequest("/forms/daily-stock", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/purchases?limit=N ─────────────────────────────────────

router.get("/purchases", async (req: Request, res: Response) => {
  const elapsed = timed();
  const limit = safeLimit(req.query.limit, 50, 200);
  const params = { limit };

  try {
    const result = await pool.query(
      `SELECT id, item, category, "orderUnit", "unitCost", "purchase_unit_qty", active
       FROM purchasing_items
       WHERE active = true
       ORDER BY category, item
       LIMIT $1`,
      [limit]
    );

    await logRequest("/purchases", params, 200, true, elapsed());
    return res.json({ ok: true, count: result.rows.length, items: result.rows });
  } catch (err: any) {
    console.error("[bobRead/purchases]", err);
    await logRequest("/purchases", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/tasks?status=...&area=...&limit=N ─────────────────────

router.get("/tasks", async (req: Request, res: Response) => {
  const elapsed = timed();
  const status = req.query.status as string | undefined;
  const area = req.query.area as string | undefined;
  const limit = safeLimit(req.query.limit, 50, 200);
  const params = { status, area, limit };

  try {
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: any[] = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (area) {
      values.push(area);
      conditions.push(`area = $${values.length}`);
    }

    values.push(limit);
    const whereClause = conditions.join(" AND ");

    const result = await pool.query(
      `SELECT id, task_number, title, status, priority, area, assigned_to, due_at, created_at, updated_at
       FROM ai_tasks
       WHERE ${whereClause}
       ORDER BY
         CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         created_at DESC
       LIMIT $${values.length}`,
      values
    );

    await logRequest("/tasks", params, 200, true, elapsed());
    return res.json({ ok: true, count: result.rows.length, tasks: result.rows });
  } catch (err: any) {
    console.error("[bobRead/tasks]", err);
    await logRequest("/tasks", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/bob/read/audits?type=baseline|snapshot&limit=N ─────────────────

router.get("/audits", async (req: Request, res: Response) => {
  const elapsed = timed();
  const type = (req.query.type as string) || "both";
  const limit = safeLimit(req.query.limit, 20, 100);
  const params = { type, limit };

  try {
    const result: Record<string, any> = { ok: true, type };

    if (type === "baseline" || type === "both") {
      const r = await pool.query(
        `SELECT id, item_name, category, expected_qty, unit,
                warn_threshold, critical_threshold, created_at, updated_at
         FROM stock_baseline
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      result.baseline = r.rows;
    }

    if (type === "snapshot" || type === "both") {
      const r = await pool.query(
        `SELECT id, shift_id, shift_date, item_name, category,
                actual_qty, unit, source, created_at
         FROM stock_snapshot
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      result.snapshots = r.rows;
    }

    await logRequest("/audits", params, 200, true, elapsed());
    return res.json(result);
  } catch (err: any) {
    console.error("[bobRead/audits]", err);
    await logRequest("/audits", params, 500, false, elapsed());
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
