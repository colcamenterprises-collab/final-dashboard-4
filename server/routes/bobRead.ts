import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

const MODULES = [
  "system-health",
  "system-map",
  "module-status",
  "build-status",
  "shift-snapshot",
  "forms/daily-sales",
  "forms/daily-stock",
  "receipts/truth",
  "usage/truth",
  "issues",
  "catalog",
  "orders",
  "reports/item-sales",
  "reports/modifier-sales",
  "reports/category-totals",
  "analysis/stock-usage",
] as const;

type BobEnvelope<T> = {
  ok: boolean;
  source: string;
  scope: string;
  date?: string;
  status: "ok" | "partial" | "missing" | "error";
  data: T;
  warnings: string[];
  blockers: Array<{ code: string; message: string; where: string; canonical_source: string; auto_build_attempted?: boolean }>;
  last_updated: string;
};

let logTableReady = false;
async function ensureLogTable() {
  if (logTableReady) return;
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bob_read_logs (
      id SERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      route TEXT NOT NULL,
      params JSONB,
      status INTEGER NOT NULL,
      ok BOOLEAN NOT NULL,
      duration_ms INTEGER
    )
  `);
  logTableReady = true;
}

void ensureLogTable().catch((e) => console.error("[bobRead] log table bootstrap failed", e));

async function logRequest(route: string, params: Record<string, unknown>, status: number, ok: boolean, durationMs: number) {
  try {
    if (!pool) return;
    await pool.query(
      `INSERT INTO bob_read_logs (route, params, status, ok, duration_ms) VALUES ($1, $2::jsonb, $3, $4, $5)`,
      [route, JSON.stringify(params), status, ok, durationMs],
    );
  } catch {
    // no-op
  }
}

function timed() {
  const started = Date.now();
  return () => Date.now() - started;
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function safeLimit(raw: unknown, def = 50, max = 200): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function envelope<T>(input: Partial<BobEnvelope<T>> & Pick<BobEnvelope<T>, "source" | "scope" | "status" | "data">): BobEnvelope<T> {
  return {
    ok: input.ok ?? (input.status !== "error"),
    source: input.source,
    scope: input.scope,
    date: input.date,
    status: input.status,
    data: input.data,
    warnings: input.warnings ?? [],
    blockers: input.blockers ?? [],
    last_updated: input.last_updated ?? new Date().toISOString(),
  };
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [name]);
  return Boolean(r.rows?.[0]?.reg);
}

function bobAuth(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.BOB_READONLY_TOKEN;
  if (!expectedToken) {
    return res.status(503).json(envelope({
      source: "env:BOB_READONLY_TOKEN",
      scope: "auth",
      status: "error",
      data: { authorized: false },
      blockers: [{ code: "TOKEN_NOT_CONFIGURED", message: "BOB_READONLY_TOKEN missing", where: "server env", canonical_source: "BOB_READONLY_TOKEN" }],
    }));
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== expectedToken) {
    return res.status(401).json(envelope({
      source: "auth:bearer",
      scope: "auth",
      status: "error",
      data: { authorized: false },
      blockers: [{ code: "UNAUTHORIZED", message: "valid Bearer token required", where: "Authorization header", canonical_source: "BOB_READONLY_TOKEN" }],
    }));
  }
  return next();
}

router.use((req, res, next) => {
  if (req.method !== "GET") {
    return res.status(405).json(envelope({
      source: "router-guard",
      scope: "read-only",
      status: "error",
      data: { method: req.method },
      blockers: [{ code: "READ_ONLY_ENFORCED", message: "Only GET is allowed under /api/bob/read", where: req.path, canonical_source: "bobRead router" }],
    }));
  }
  return next();
});

router.use(bobAuth);

router.use((req, res, next) => {
  if (!pool) {
    return res.status(503).json(envelope({
      source: "db",
      scope: "database",
      status: "error",
      data: { available: false },
      blockers: [{ code: "DATABASE_UNAVAILABLE", message: "Database pool is not available", where: req.path, canonical_source: "DATABASE_URL" }],
    }));
  }
  return next();
});

router.get("/health", async (_req, res) => {
  const elapsed = timed();
  const body = envelope({
    source: "bob-read-router",
    scope: "global",
    status: "ok",
    data: {
      available_modules: MODULES,
      auth: "bearer-validated",
    },
  });
  await logRequest("/health", {}, 200, true, elapsed());
  return res.json(body);
});

router.get("/system-health", async (_req, res) => {
  const elapsed = timed();
  const blockers: BobEnvelope<any>["blockers"] = [];

  const [routeCount, logRow, latestBuildRow] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS c FROM information_schema.routines WHERE routine_schema = 'public'`),
    pool.query(`SELECT ts FROM bob_read_logs ORDER BY ts DESC LIMIT 1`).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT shift_date::text AS shift_date, status, created_at::text FROM analysis_reports ORDER BY created_at DESC LIMIT 1`).catch(() => ({ rows: [] } as any)),
  ]);

  const payload = envelope({
    source: "db+runtime",
    scope: "system",
    status: "ok",
    data: {
      app_version: process.env.npm_package_version ?? null,
      app_commit: process.env.REPLIT_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
      environment_label: process.env.NODE_ENV ?? "unknown",
      enabled_modules: MODULES,
      api_health: "ok",
      route_registry_estimate: Number(routeCount.rows?.[0]?.c ?? 0),
      latest_background_build: latestBuildRow.rows?.[0] ?? null,
      latest_bob_read_at: logRow.rows?.[0]?.ts ?? null,
    },
    blockers,
  });

  await logRequest("/system-health", {}, 200, true, elapsed());
  return res.json(payload);
});

router.get("/system-map", async (_req, res) => {
  const elapsed = timed();
  const payload = envelope({
    source: "curated-map:v1",
    scope: "whole-app",
    status: "ok",
    data: {
      namespace: "/api/bob/read",
      routes: [
        { page: "/", purpose: "Homepage modules", endpoint: "/api/bob/read/module-status", service: "bobRead", table: "daily_sales_v2,daily_stock_v2,analysis_reports", canonical_source: "daily_sales_v2 + derived analysis" },
        { page: "/daily-stock-sales", purpose: "Daily forms", endpoint: "/api/bob/read/forms/daily-sales,/api/bob/read/forms/daily-stock", service: "forms", table: "daily_sales_v2,daily_stock_v2", canonical_source: "daily_sales_v2 + daily_stock_v2" },
        { page: "/sales-shift-analysis", purpose: "Shift diagnostics", endpoint: "/api/bob/read/shift-snapshot", service: "analysisBuildOrchestrator + shift analytics", table: "receipt_truth_line,receipt_truth_daily_usage,analysis_reports", canonical_source: "receipt_truth_* tables + analysis_reports" },
        { page: "/receipts-analysis", purpose: "Receipts truth", endpoint: "/api/bob/read/receipts/truth", service: "receipt truth pipeline", table: "receipt_truth_line,lv_receipt", canonical_source: "receipt_truth_line" },
        { page: "/issue-register", purpose: "Issue register", endpoint: "/api/bob/read/issues", service: "aiOps issues", table: "ai_issues", canonical_source: "ai_issues" },
        { page: "/catalog/menu", purpose: "Catalog and modifiers", endpoint: "/api/bob/read/catalog", service: "menu/catalog", table: "item_catalog,modifier_group,modifier,online_catalog_items", canonical_source: "item_catalog + online_catalog_items" },
        { page: "/online-orders", purpose: "Order read model", endpoint: "/api/bob/read/orders", service: "online orders", table: "orders_online,order_lines_online", canonical_source: "orders_online" },
        { page: "/purchasing,/shopping-list,/stock-order-history,/ingredient-purchasing", purpose: "Purchasing chain visibility", endpoint: "/api/bob/read/module-status", service: "purchasing", table: "purchasing_items,purchasing_shift_items", canonical_source: "purchasing_items" },
        { page: "/ai-ops-control", purpose: "Bob governance + integrations", endpoint: "/api/bob/read/system-health", service: "ai-ops", table: "bob_documents,bob_read_logs", canonical_source: "bob_documents + bob_read_logs" },
      ],
    },
  });
  await logRequest("/system-map", {}, 200, true, elapsed());
  return res.json(payload);
});

router.get("/build-status", async (req, res) => {
  const elapsed = timed();
  const date = (req.query.date as string | undefined) ?? null;
  if (date && !isValidDate(date)) {
    await logRequest("/build-status", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "build-status", status: "error", date: date ?? undefined, data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "request" }] }));
  }

  const where = date ? `WHERE shift_date = $1::date` : "";
  const vals = date ? [date] : [];
  const reports = await pool.query(
    `SELECT shift_date::text AS shift_date, analysis_type, status, summary, created_by, created_at::text
     FROM analysis_reports ${where}
     ORDER BY created_at DESC LIMIT 50`,
    vals,
  ).catch(() => ({ rows: [] } as any));

  const usageBuilt = date
    ? await pool.query(`SELECT COUNT(*)::int AS c FROM receipt_truth_daily_usage WHERE business_date = $1::date`, [date]).catch(() => ({ rows: [{ c: 0 }] } as any))
    : { rows: [{ c: null }] };

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (date && Number(usageBuilt.rows[0]?.c ?? 0) === 0) {
    blockers.push({
      code: "USAGE_NOT_BUILT",
      message: `No receipt_truth_daily_usage rows found for ${date}`,
      where: "receipt_truth_daily_usage",
      canonical_source: "receipt_truth_daily_usage.business_date",
      auto_build_attempted: false,
    });
  }

  const payload = envelope({
    source: "analysis_reports + usage",
    scope: date ? `date:${date}` : "latest",
    date: date ?? undefined,
    status: blockers.length ? "partial" : "ok",
    data: {
      reports: reports.rows,
      usage_rows_for_date: date ? Number(usageBuilt.rows[0]?.c ?? 0) : null,
      auto_build_used: reports.rows.some((r: any) => String(r.created_by || "").toLowerCase().includes("auto")),
      latest_error: reports.rows.find((r: any) => String(r.status || "").toLowerCase().includes("fail")) ?? null,
    },
    blockers,
    warnings: date ? [] : ["No date specified; returning latest build records only."],
  });

  await logRequest("/build-status", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/forms/daily-sales", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 10, 100);
  if (date && !isValidDate(date)) {
    await logRequest("/forms/daily-sales", { date, limit }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "forms/daily-sales", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "daily_sales_v2.shiftDate" }] }));
  }

  const result = date
    ? await pool.query(`SELECT * FROM daily_sales_v2 WHERE "shiftDate" = $1 ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT $2`, [date, limit])
    : await pool.query(`SELECT * FROM daily_sales_v2 ORDER BY "shiftDate" DESC, "submittedAtISO" DESC NULLS LAST LIMIT $1`, [limit]);

  const payload = envelope({ source: "daily_sales_v2", scope: date ? `date:${date}` : `limit:${limit}`, date, status: "ok", data: { count: result.rows.length, rows: result.rows } });
  await logRequest("/forms/daily-sales", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/forms/daily-stock", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 10, 100);
  if (date && !isValidDate(date)) {
    await logRequest("/forms/daily-stock", { date, limit }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "forms/daily-stock", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "daily_sales_v2.shiftDate" }] }));
  }

  const result = date
    ? await pool.query(
      `SELECT s.*, d."shiftDate" FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id = s."salesId" WHERE d."shiftDate" = $1 ORDER BY s."createdAt" DESC LIMIT $2`,
      [date, limit],
    )
    : await pool.query(
      `SELECT s.*, d."shiftDate" FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id = s."salesId" ORDER BY d."shiftDate" DESC, s."createdAt" DESC LIMIT $1`,
      [limit],
    );

  const payload = envelope({ source: "daily_stock_v2", scope: date ? `date:${date}` : `limit:${limit}`, date, status: "ok", data: { count: result.rows.length, rows: result.rows } });
  await logRequest("/forms/daily-stock", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/receipts/truth", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/receipts/truth", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "receipts-truth", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "receipt_truth_line.receipt_date" }] }));
  }

  const [lineAgg, receiptWindow] = await Promise.all([
    pool.query(
      `SELECT COALESCE(pos_category_name, 'UNCATEGORIZED') AS category,
              COALESCE(item_name, 'UNKNOWN_ITEM') AS item,
              SUM(CASE WHEN receipt_type = 'SALE' THEN quantity ELSE 0 END)::int AS sale_qty,
              SUM(CASE WHEN receipt_type = 'REFUND' THEN ABS(quantity) ELSE 0 END)::int AS refund_qty
       FROM receipt_truth_line
       WHERE receipt_date = $1::date
       GROUP BY 1,2
       ORDER BY sale_qty DESC, item`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT MIN(datetime_bkk)::text AS first_ts, MAX(datetime_bkk)::text AS last_ts, COUNT(*)::int AS raw_count
       FROM lv_receipt
       WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
      [`${date} 00:00:00+07`, `${nextDay(date)} 00:00:00+07`],
    ).catch(() => ({ rows: [{ first_ts: null, last_ts: null, raw_count: 0 }] } as any)),
  ]);

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (lineAgg.rows.length === 0) {
    blockers.push({ code: "NO_NORMALIZED_RECEIPT_TRUTH", message: `No receipt_truth_line rows for ${date}`, where: "receipt_truth_line", canonical_source: "receipt_truth_line.receipt_date", auto_build_attempted: false });
  }

  const payload = envelope({
    source: "receipt_truth_line + lv_receipt",
    scope: `date:${date}`,
    date,
    status: blockers.length ? "partial" : "ok",
    data: {
      raw_receipts: receiptWindow.rows[0],
      normalized_count: lineAgg.rows.length,
      aggregates: lineAgg.rows,
    },
    blockers,
  });
  await logRequest("/receipts/truth", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/usage/truth", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/usage/truth", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "usage-truth", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "receipt_truth_daily_usage.business_date" }] }));
  }

  const summary = await pool.query(
    `SELECT COUNT(*)::int AS row_count,
            SUM(COALESCE(buns_used,0)) AS buns,
            SUM(COALESCE(beef_serves_used,0)) AS patties,
            SUM(COALESCE(beef_grams_used,0)) AS beef_grams,
            SUM(COALESCE(chicken_grams_used,0)) AS chicken_grams,
            SUM(COALESCE(fries_used,0)) AS fries,
            SUM(COALESCE(coke_used,0)+COALESCE(coke_zero_used,0)+COALESCE(sprite_used,0)+COALESCE(water_used,0)+COALESCE(fanta_orange_used,0)+COALESCE(fanta_strawberry_used,0)+COALESCE(schweppes_manao_used,0)) AS total_drinks
     FROM receipt_truth_daily_usage
     WHERE business_date = $1::date`,
    [date],
  ).catch(() => ({ rows: [{ row_count: 0 }] } as any));

  const rows = await pool.query(
    `SELECT shift_key, category_name, sku, item_name, quantity_sold,
            buns_used, beef_serves_used, beef_grams_used, chicken_grams_used,
            fries_used, coke_used, coke_zero_used, sprite_used, water_used,
            fanta_orange_used, fanta_strawberry_used, schweppes_manao_used,
            COALESCE(is_modifier_estimated,false) AS is_modifier_estimated
     FROM receipt_truth_daily_usage
     WHERE business_date = $1::date
     ORDER BY category_name, item_name`,
    [date],
  ).catch(() => ({ rows: [] } as any));

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (Number(summary.rows[0]?.row_count ?? 0) === 0) {
    blockers.push({
      code: "USAGE_TRUTH_MISSING",
      message: `No usage truth rows for ${date}`,
      where: "receipt_truth_daily_usage",
      canonical_source: "receipt_truth_daily_usage.business_date",
      auto_build_attempted: false,
    });
  }

  const payload = envelope({
    source: "receipt_truth_daily_usage",
    scope: `date:${date}`,
    date,
    status: blockers.length ? "missing" : "ok",
    data: { summary: summary.rows[0], rows: rows.rows },
    blockers,
  });

  await logRequest("/usage/truth", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/issues", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const status = req.query.status as string | undefined;
  const severity = req.query.severity as string | undefined;
  const issueType = req.query.type as string | undefined;
  const limit = safeLimit(req.query.limit, 100, 500);

  const clauses: string[] = [];
  const vals: any[] = [];
  if (date && isValidDate(date)) { vals.push(date); clauses.push(`shift_date = $${vals.length}::date`); }
  if (status) { vals.push(status); clauses.push(`status = $${vals.length}`); }
  if (severity) { vals.push(severity); clauses.push(`severity = $${vals.length}`); }
  if (issueType) { vals.push(issueType); clauses.push(`issue_type = $${vals.length}`); }
  vals.push(limit);

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const issues = await pool.query(
    `SELECT id, shift_date::text AS shift_date, issue_type, severity, status, title, summary, source, created_at::text, updated_at::text
     FROM ai_issues ${where}
     ORDER BY created_at DESC LIMIT $${vals.length}`,
    vals,
  ).catch(() => ({ rows: [] } as any));

  const counts = await pool.query(
    `SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS count FROM ai_issues GROUP BY 1 ORDER BY 1`,
  ).catch(() => ({ rows: [] } as any));

  const payload = envelope({
    source: "ai_issues",
    scope: date ? `date:${date}` : "all",
    date,
    status: "ok",
    data: { count: issues.rows.length, issues: issues.rows, status_counts: counts.rows },
  });

  await logRequest("/issues", { date, status, severity, type: issueType, limit }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/catalog", async (req, res) => {
  const elapsed = timed();
  const includeHidden = String(req.query.includeHidden ?? "true") === "true";

  const [hasModifierGroup, hasModifier] = await Promise.all([tableExists("modifier_group"), tableExists("modifier")]);
  const [items, onlineItems, modifierGroups, modifiers] = await Promise.all([
    pool.query(`SELECT sku, name, category, kind, active FROM item_catalog ORDER BY category, name LIMIT 2000`).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT id, name, category, status, hidden FROM online_catalog_items ORDER BY updated_at DESC LIMIT 2000`).catch(() => ({ rows: [] } as any)),
    hasModifierGroup ? pool.query(`SELECT id::text, name, is_active, created_at::text FROM modifier_group ORDER BY created_at DESC LIMIT 500`) : Promise.resolve({ rows: [] } as any),
    hasModifier ? pool.query(`SELECT id::text, modifier_group_id::text, name, is_active FROM modifier ORDER BY name LIMIT 2000`) : Promise.resolve({ rows: [] } as any),
  ]);

  const visibleOnline = includeHidden ? onlineItems.rows : onlineItems.rows.filter((r: any) => !r.hidden);
  const payload = envelope({
    source: "item_catalog + online_catalog_items + modifier_*",
    scope: includeHidden ? "all" : "visible-only",
    status: "ok",
    data: {
      item_catalog_count: items.rows.length,
      online_catalog_count: visibleOnline.length,
      modifier_group_count: modifierGroups.rows.length,
      modifier_count: modifiers.rows.length,
      item_catalog: items.rows,
      online_catalog: visibleOnline,
      modifier_groups: modifierGroups.rows,
      modifiers: modifiers.rows,
    },
  });

  await logRequest("/catalog", { includeHidden }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/orders", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 100, 500);
  if (date && !isValidDate(date)) {
    await logRequest("/orders", { date, limit }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "orders", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "orders_online.createdAt" }] }));
  }

  const orders = date
    ? await pool.query(
      `SELECT id, ref, status, name, phone, type, payment, subtotal, "vatAmount", total, "createdAt"::text AS created_at
       FROM orders_online
       WHERE "createdAt" >= $1::date AND "createdAt" < ($1::date + INTERVAL '1 day')
       ORDER BY "createdAt" DESC LIMIT $2`,
      [date, limit],
    ).catch(() => ({ rows: [] } as any))
    : await pool.query(
      `SELECT id, ref, status, name, phone, type, payment, subtotal, "vatAmount", total, "createdAt"::text AS created_at
       FROM orders_online ORDER BY "createdAt" DESC LIMIT $1`,
      [limit],
    ).catch(() => ({ rows: [] } as any));

  const refs = orders.rows.map((r: any) => r.id);
  const lines = refs.length
    ? await pool.query(
      `SELECT id, "orderId" AS order_id, sku, name, qty, "basePrice" AS base_price, modifiers, note, "lineTotal" AS line_total
       FROM order_lines_online
       WHERE "orderId" = ANY($1::text[])
       ORDER BY "orderId", id`,
      [refs],
    ).catch(() => ({ rows: [] } as any))
    : { rows: [] };

  const payload = envelope({
    source: "orders_online + order_lines_online",
    scope: date ? `date:${date}` : "latest",
    date,
    status: "ok",
    data: { count: orders.rows.length, orders: orders.rows, lines: lines.rows },
  });

  await logRequest("/orders", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/module-status", async (_req, res) => {
  const elapsed = timed();
  const [sales, stock, receipts, usage, issues, catalog, orders, bobDocs] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS c, MAX("shiftDate")::text AS latest FROM daily_sales_v2`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX("createdAt")::text AS latest FROM daily_stock_v2`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX(receipt_date)::text AS latest FROM receipt_truth_line`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX(business_date)::text AS latest FROM receipt_truth_daily_usage`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX(created_at)::text AS latest FROM ai_issues`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX(updated_at)::text AS latest FROM online_catalog_items`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX("createdAt")::text AS latest FROM orders_online`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MAX(updated_at)::text AS latest FROM bob_documents`).catch(() => ({ rows: [{ c: 0, latest: null }] } as any)),
  ]);

  const toMod = (name: string, row: any, source: string) => ({
    module: name,
    status: Number(row.c) > 0 ? "ok" : "missing",
    records: Number(row.c),
    latest: row.latest,
    source,
  });

  const modules = [
    toMod("daily forms", sales.rows[0], "daily_sales_v2,daily_stock_v2"),
    toMod("receipts truth", receipts.rows[0], "receipt_truth_line"),
    toMod("daily usage", usage.rows[0], "receipt_truth_daily_usage"),
    toMod("shift analysis", usage.rows[0], "analysis_reports + receipt_truth_daily_usage"),
    toMod("issue register", issues.rows[0], "ai_issues"),
    toMod("catalog", catalog.rows[0], "item_catalog + online_catalog_items"),
    toMod("online orders", orders.rows[0], "orders_online"),
    toMod("bob integrations", bobDocs.rows[0], "bob_documents + bob_read_logs"),
  ];

  const blockers = modules.filter((m) => m.status === "missing").map((m) => ({
    code: "MODULE_EMPTY",
    message: `${m.module} has no rows`,
    where: m.module,
    canonical_source: m.source,
    auto_build_attempted: false,
  }));

  const payload = envelope({
    source: "module-probes:v1",
    scope: "whole-app",
    status: blockers.length ? "partial" : "ok",
    data: { modules },
    blockers,
  });

  await logRequest("/module-status", {}, 200, true, elapsed());
  return res.json(payload);
});

router.get("/shift-snapshot", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/shift-snapshot", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "shift-snapshot", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "all date-scoped sources" }] }));
  }

  const [sales, stock, receipts, usage, build, issueCounts] = await Promise.all([
    pool.query(`SELECT id, "shiftDate", "totalSales", "cashSales", "qrSales", "grabSales", "submittedAtISO" FROM daily_sales_v2 WHERE "shiftDate" = $1 ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT s.id, s."salesId", s."burgerBuns", s."meatWeightG", s."drinksJson", s."createdAt" FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id = s."salesId" WHERE d."shiftDate" = $1 ORDER BY s."createdAt" DESC LIMIT 1`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MIN(datetime_bkk)::text AS first_ts, MAX(datetime_bkk)::text AS last_ts FROM lv_receipt WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`, [`${date} 00:00:00+07`, `${nextDay(date)} 00:00:00+07`]).catch(() => ({ rows: [{ c: 0, first_ts: null, last_ts: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, SUM(COALESCE(buns_used,0)) AS buns, SUM(COALESCE(beef_grams_used,0)) AS beef_grams FROM receipt_truth_daily_usage WHERE business_date = $1::date`, [date]).catch(() => ({ rows: [{ c: 0, buns: 0, beef_grams: 0 }] } as any)),
    pool.query(`SELECT analysis_type, status, summary, created_at::text FROM analysis_reports WHERE shift_date = $1::date ORDER BY created_at DESC LIMIT 20`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS c FROM ai_issues WHERE shift_date = $1::date GROUP BY 1 ORDER BY 1`, [date]).catch(() => ({ rows: [] } as any)),
  ]);

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (!sales.rows.length) blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate", auto_build_attempted: false });
  if (!stock.rows.length) blockers.push({ code: "STOCK_FORM_MISSING", message: `No daily_stock_v2 row linked to ${date}`, where: "daily_stock_v2", canonical_source: "daily_stock_v2.salesId -> daily_sales_v2.id", auto_build_attempted: false });
  if (Number(usage.rows[0]?.c ?? 0) === 0) blockers.push({ code: "USAGE_TRUTH_MISSING", message: `No usage truth for ${date}`, where: "receipt_truth_daily_usage", canonical_source: "receipt_truth_daily_usage.business_date", auto_build_attempted: false });

  const confidenceSignals = {
    forms_ready: Boolean(sales.rows.length && stock.rows.length),
    receipts_ready: Number(receipts.rows[0]?.c ?? 0) > 0,
    usage_ready: Number(usage.rows[0]?.c ?? 0) > 0,
    analysis_ready: build.rows.length > 0,
  };

  const payload = envelope({
    source: "multi-source snapshot",
    scope: `date:${date}`,
    date,
    status: blockers.length ? "partial" : "ok",
    data: {
      forms_summary: { daily_sales: sales.rows[0] ?? null, daily_stock: stock.rows[0] ?? null },
      receipts_truth_availability: receipts.rows[0],
      usage_truth_availability: usage.rows[0],
      build_statuses: build.rows,
      shift_analysis_summary: build.rows[0] ?? null,
      issue_counts: issueCounts.rows,
      blockers,
      confidence_signals: confidenceSignals,
    },
    blockers,
  });

  await logRequest("/shift-snapshot", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/reports/item-sales", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/reports/item-sales", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "reports/item-sales", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "receipt_truth_line.receipt_date" }] }));
  }
  const result = await db.execute(sql`
    SELECT COALESCE(sku, '') AS sku, item_name AS name, COALESCE(pos_category_name, 'UNCATEGORIZED') AS category,
           SUM(CASE WHEN receipt_type = 'SALE' THEN quantity ELSE 0 END)::int AS sold,
           SUM(CASE WHEN receipt_type = 'REFUND' THEN ABS(quantity) ELSE 0 END)::int AS refunds
    FROM receipt_truth_line
    WHERE receipt_date = ${date}::date
    GROUP BY sku, item_name, pos_category_name
    ORDER BY sold DESC, item_name
  `);
  const rows = (result.rows as any[]).map((r) => ({ ...r, net: Number(r.sold) - Number(r.refunds) }));
  const payload = envelope({ source: "receipt_truth_line", scope: `date:${date}`, date, status: "ok", data: { count: rows.length, items: rows } });
  await logRequest("/reports/item-sales", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/reports/modifier-sales", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/reports/modifier-sales", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "reports/modifier-sales", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "lv_modifier/lv_receipt shift range" }] }));
  }
  const result = await db.execute(sql`
    SELECT m.raw_json->>'name' AS modifier_group, m.name AS modifier, SUM(m.qty)::int AS count
    FROM lv_modifier m
    JOIN lv_receipt r ON r.receipt_id = m.receipt_id
    WHERE r.datetime_bkk >= ${`${date} 17:00:00+07`}::timestamptz
      AND r.datetime_bkk < ${`${nextDay(date)} 03:00:00+07`}::timestamptz
      AND (r.raw_json->>'refund_for') IS NULL
    GROUP BY modifier_group, modifier
    ORDER BY count DESC, modifier_group, modifier
  `);
  const payload = envelope({ source: "lv_modifier+lv_receipt", scope: `date:${date}`, date, status: "ok", data: { count: result.rows.length, modifiers: result.rows } });
  await logRequest("/reports/modifier-sales", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/reports/category-totals", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/reports/category-totals", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "reports/category-totals", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "receipt_truth_line.receipt_date" }] }));
  }
  const result = await db.execute(sql`
    SELECT COALESCE(pos_category_name, 'UNCATEGORIZED') AS category, SUM(quantity)::int AS total
    FROM receipt_truth_line
    WHERE receipt_date = ${date}::date AND receipt_type = 'SALE'
    GROUP BY COALESCE(pos_category_name, 'UNCATEGORIZED')
    ORDER BY total DESC
  `);
  const payload = envelope({ source: "receipt_truth_line", scope: `date:${date}`, date, status: "ok", data: { totals: result.rows } });
  await logRequest("/reports/category-totals", { date }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/analysis/stock-usage", async (req, res) => {
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const suffix = qs ? `?${qs}` : "";
  return res.redirect(307, `/api/bob/read/usage/truth${suffix}`);
});

export default router;
