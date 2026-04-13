import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "../db";
import { sql } from "drizzle-orm";
import axios from "axios";

const router = Router();

const MODULES = [
  // ── Core health & maps ──────────────────────────────────────────
  "system-health",
  "system-map",
  "module-status",
  "build-status",
  // ── Forms ───────────────────────────────────────────────────────
  "forms/daily-sales",
  "forms/daily-stock",
  // ── Shift ───────────────────────────────────────────────────────
  "shift-snapshot",
  "shift-report/latest",
  "roll-order",
  // ── Analysis ────────────────────────────────────────────────────
  "receipts/truth",
  "usage/truth",
  "analysis/stock-usage",
  "analysis/daily-comparison",
  "analysis/prime-cost",
  "analysis/finance",
  "analysis/shift-analysis",
  // ── Purchasing ──────────────────────────────────────────────────
  "purchasing/items",
  "purchasing/tally",
  "purchasing/shift-log",
  "purchasing/shopping-list",
  // ── Operations ──────────────────────────────────────────────────
  "operations/expenses",
  "operations/balance",
  "operations/stock-review",
  // ── Catalog / orders / reports ──────────────────────────────────
  "catalog",
  "orders",
  "issues",
  "reports/item-sales",
  "reports/modifier-sales",
  "reports/category-totals",
  // ── Universal passthrough proxy ──────────────────────────────────
  "proxy",
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
        { page: "/daily-stock-sales", purpose: "Daily forms", endpoint: "/api/bob/read/forms/daily-sales,/api/bob/read/forms/daily-stock,/api/bob/read/roll-order", service: "forms", table: "daily_sales_v2,daily_stock_v2,roll_order", canonical_source: "daily_sales_v2 + daily_stock_v2 + roll_order" },
        { page: "/sales-shift-analysis", purpose: "Shift diagnostics snapshot", endpoint: "/api/bob/read/shift-snapshot", service: "analysisBuildOrchestrator", table: "receipt_truth_line,receipt_truth_daily_usage,analysis_reports", canonical_source: "receipt_truth_* + analysis_reports" },
        { page: "/sales-shift-analysis,/shift-report", purpose: "Compiled shift report (POS+sales+stock+variances)", endpoint: "/api/bob/read/shift-report/latest", service: "shiftReportBuilder", table: "shift_report_v2", canonical_source: "shift_report_v2" },
        { page: "/analysis/daily-review", purpose: "Daily comparison vs targets", endpoint: "/api/bob/read/analysis/daily-comparison", service: "analysisDailyReview", table: "daily_sales_v2,analysis_reports", canonical_source: "daily_sales_v2 + analysis_reports" },
        { page: "/analysis/prime-cost", purpose: "Food & labour cost metrics", endpoint: "/api/bob/read/analysis/prime-cost", service: "primeCost", table: "receipt_truth_daily_usage,purchasing_items", canonical_source: "metrics/prime-cost" },
        { page: "/finance", purpose: "Financial summary (MTD + today)", endpoint: "/api/bob/read/analysis/finance", service: "finance", table: "daily_sales_v2,expenses,bank_statements", canonical_source: "finance/summary" },
        { page: "/analysis/shift", purpose: "Shift-level analysis", endpoint: "/api/bob/read/analysis/shift-analysis", service: "shiftAnalysis", table: "daily_sales_v2,receipt_truth_line", canonical_source: "analysisDailyReview" },
        { page: "/receipts-analysis", purpose: "Receipts truth", endpoint: "/api/bob/read/receipts/truth", service: "receipt truth pipeline", table: "receipt_truth_line,lv_receipt", canonical_source: "receipt_truth_line" },
        { page: "/issue-register", purpose: "Issue register", endpoint: "/api/bob/read/issues", service: "aiOps issues", table: "ai_issues", canonical_source: "ai_issues" },
        { page: "/catalog/menu", purpose: "Catalog and modifiers", endpoint: "/api/bob/read/catalog", service: "menu/catalog", table: "item_catalog,modifier_group,modifier,online_catalog_items", canonical_source: "item_catalog + online_catalog_items" },
        { page: "/online-orders", purpose: "Order read model", endpoint: "/api/bob/read/orders", service: "online orders", table: "orders_online,order_lines_online", canonical_source: "orders_online" },
        { page: "/purchasing", purpose: "Purchasing items (supplier prices, stock)", endpoint: "/api/bob/read/purchasing/items", service: "purchasingItems", table: "purchasing_items", canonical_source: "purchasing_items" },
        { page: "/purchasing/shift-log", purpose: "Roll/meat/drinks purchase tally log", endpoint: "/api/bob/read/purchasing/tally", service: "purchaseTally", table: "purchase_tally,purchase_tally_drink", canonical_source: "purchase_tally + purchase_tally_drink" },
        { page: "/purchasing/shift-log", purpose: "Purchasing shift breakdown matrix", endpoint: "/api/bob/read/purchasing/shift-log", service: "purchasingShiftLog", table: "purchasing_items,purchase_tally", canonical_source: "purchasingShiftLog" },
        { page: "/shopping-list", purpose: "Current shopping list items", endpoint: "/api/bob/read/purchasing/shopping-list", service: "shoppingList", table: "shopping_list_items", canonical_source: "shopping_list_items" },
        { page: "/expenses", purpose: "Expense records", endpoint: "/api/bob/read/operations/expenses", service: "expenses", table: "expenses", canonical_source: "expenses" },
        { page: "/operations/balance", purpose: "Cash & balance reconciliation", endpoint: "/api/bob/read/operations/balance", service: "balance", table: "daily_sales_v2,cash_balance", canonical_source: "balance" },
        { page: "/operations/stock", purpose: "Stock review data", endpoint: "/api/bob/read/operations/stock-review", service: "stockReview", table: "stock_received_log,stock_baseline", canonical_source: "stock_received_log" },
        { page: "/ai-ops-control", purpose: "Bob governance + integrations", endpoint: "/api/bob/read/system-health", service: "ai-ops", table: "bob_documents,bob_read_logs", canonical_source: "bob_documents + bob_read_logs" },
        { page: "*", purpose: "Universal GET passthrough to any /api/* endpoint", endpoint: "/api/bob/read/proxy?path=/api/ENDPOINT&queryParams=...", service: "all", table: "any", canonical_source: "any internal GET route" },
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


router.get("/roll-order", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 20, 100);

  if (date && !isValidDate(date)) {
    await logRequest("/roll-order", { date, limit }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "roll-order", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "roll_order.shift_date" }] }));
  }

  const rows = date
    ? await pool.query(`SELECT * FROM roll_order WHERE shift_date = $1::date ORDER BY updated_at DESC LIMIT $2`, [date, limit]).catch(() => ({ rows: [] } as any))
    : await pool.query(`SELECT * FROM roll_order ORDER BY shift_date DESC, updated_at DESC LIMIT $1`, [limit]).catch(() => ({ rows: [] } as any));

  const payload = envelope({ source: "roll_order", scope: date ? `date:${date}` : `limit:${limit}`, date, status: rows.rows.length ? "ok" : "missing", data: { count: rows.rows.length, rows: rows.rows }, blockers: rows.rows.length ? [] : [{ code: "ROLL_ORDER_MISSING", message: date ? `No roll order found for ${date}` : "No roll orders found", where: "roll_order", canonical_source: "roll_order.shift_date", auto_build_attempted: false }] });
  await logRequest("/roll-order", { date, limit }, 200, true, elapsed());
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

  const [sales, stock, rollOrder, receipts, usage, build, issueCounts] = await Promise.all([
    pool.query(`SELECT id, "shiftDate", "totalSales", "cashSales", "qrSales", "grabSales", "submittedAtISO" FROM daily_sales_v2 WHERE "shiftDate" = $1 ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT s.id, s."salesId", s."burgerBuns", s."meatWeightG", s."drinksJson", s."createdAt" FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id = s."salesId" WHERE d."shiftDate" = $1 ORDER BY s."createdAt" DESC LIMIT 1`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT * FROM roll_order WHERE shift_date = $1::date ORDER BY updated_at DESC LIMIT 1`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, MIN(datetime_bkk)::text AS first_ts, MAX(datetime_bkk)::text AS last_ts FROM lv_receipt WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`, [`${date} 00:00:00+07`, `${nextDay(date)} 00:00:00+07`]).catch(() => ({ rows: [{ c: 0, first_ts: null, last_ts: null }] } as any)),
    pool.query(`SELECT COUNT(*)::int AS c, SUM(COALESCE(buns_used,0)) AS buns, SUM(COALESCE(beef_grams_used,0)) AS beef_grams FROM receipt_truth_daily_usage WHERE business_date = $1::date`, [date]).catch(() => ({ rows: [{ c: 0, buns: 0, beef_grams: 0 }] } as any)),
    pool.query(`SELECT analysis_type, status, summary, created_at::text FROM analysis_reports WHERE shift_date = $1::date ORDER BY created_at DESC LIMIT 20`, [date]).catch(() => ({ rows: [] } as any)),
    pool.query(`SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS c FROM ai_issues WHERE shift_date = $1::date GROUP BY 1 ORDER BY 1`, [date]).catch(() => ({ rows: [] } as any)),
  ]);

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (!sales.rows.length) blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate", auto_build_attempted: false });
  if (!stock.rows.length) blockers.push({ code: "STOCK_FORM_MISSING", message: `No daily_stock_v2 row linked to ${date}`, where: "daily_stock_v2", canonical_source: "daily_stock_v2.salesId -> daily_sales_v2.id", auto_build_attempted: false });
  if (!rollOrder.rows.length) blockers.push({ code: "ROLL_ORDER_MISSING", message: `No roll order created for ${date}`, where: "roll_order", canonical_source: "roll_order.shift_date", auto_build_attempted: false });
  if (rollOrder.rows[0]?.status === "FAILED") blockers.push({ code: "ROLL_ORDER_FAILED", message: `Roll order failed for ${date}`, where: "roll_order.status", canonical_source: "roll_order", auto_build_attempted: false });
  if (rollOrder.rows[0]?.status !== "SENT") blockers.push({ code: "ROLL_ORDER_NOT_SENT", message: `Roll order not sent for ${date}`, where: "roll_order.status", canonical_source: "roll_order", auto_build_attempted: false });
  if (rollOrder.rows[0]?.was_overridden) blockers.push({ code: "ROLL_ORDER_OVERRIDDEN", message: `Roll order override was used for ${date}`, where: "roll_order.was_overridden", canonical_source: "roll_order", auto_build_attempted: false });
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
      forms_summary: { daily_sales: sales.rows[0] ?? null, daily_stock: stock.rows[0] ?? null, roll_order: rollOrder.rows[0] ?? null },
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

// ── ANALYSIS: daily comparison ───────────────────────────────────────────────
router.get("/analysis/daily-comparison", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (date && !isValidDate(date)) {
    await logRequest("/analysis/daily-comparison", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "analysis/daily-comparison", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "daily_sales_v2.shiftDate" }] }));
  }
  const targetDate = date ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [sales, stock, receipts, analysis] = await Promise.all([
    pool.query(
      `SELECT id, "shiftDate"::text AS shift_date, "totalSales", "cashSales", "qrSales", "grabSales",
              "totalExpenses", "cashFloat", "managerName", "submittedAtISO"::text AS submitted_at
       FROM daily_sales_v2 WHERE "shiftDate" = $1 ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
      [targetDate],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT s."burgerBuns", s."meatWeightG", s."createdAt"::text AS created_at
       FROM daily_stock_v2 s JOIN daily_sales_v2 d ON d.id = s."salesId" WHERE d."shiftDate" = $1 LIMIT 1`,
      [targetDate],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT COUNT(DISTINCT r.receipt_id)::int AS receipt_count,
              SUM(CASE WHEN r.receipt_type='SALE' THEN r.total_money ELSE 0 END)::numeric(12,2) AS pos_gross
       FROM lv_receipt r
       WHERE r.datetime_bkk >= $1::timestamptz AND r.datetime_bkk < $2::timestamptz`,
      [`${targetDate} 00:00:00+07`, `${nextDay(targetDate)} 00:00:00+07`],
    ).catch(() => ({ rows: [{ receipt_count: 0, pos_gross: 0 }] } as any)),
    pool.query(
      `SELECT analysis_type, status, summary, created_at::text FROM analysis_reports WHERE shift_date = $1::date ORDER BY created_at DESC LIMIT 10`,
      [targetDate],
    ).catch(() => ({ rows: [] } as any)),
  ]);
  const salesRow = sales.rows[0] ?? null;
  const blockers: BobEnvelope<any>["blockers"] = [];
  if (!salesRow) blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${targetDate}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate", auto_build_attempted: false });
  const payload = envelope({
    source: "daily_sales_v2 + lv_receipt + analysis_reports",
    scope: `date:${targetDate}`,
    date: targetDate,
    status: blockers.length ? "partial" : "ok",
    data: {
      sales_form: salesRow,
      stock_form: stock.rows[0] ?? null,
      pos_receipts: receipts.rows[0],
      analysis_builds: analysis.rows,
    },
    blockers,
  });
  await logRequest("/analysis/daily-comparison", { date: targetDate }, 200, true, elapsed());
  return res.json(payload);
});

// ── ANALYSIS: prime cost ─────────────────────────────────────────────────────
router.get("/analysis/prime-cost", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const port = process.env.PORT || 5000;
  try {
    const qs = date ? `?date=${date}` : "";
    const r = await axios.get(`http://127.0.0.1:${port}/api/metrics/prime-cost${qs}`, { timeout: 8000 });
    const payload = envelope({
      source: "metrics/prime-cost (internal proxy)",
      scope: date ? `date:${date}` : "latest",
      date,
      status: r.data?.ok === false ? "partial" : "ok",
      data: r.data,
    });
    await logRequest("/analysis/prime-cost", { date }, 200, true, elapsed());
    return res.json(payload);
  } catch (err: any) {
    await logRequest("/analysis/prime-cost", { date }, 502, false, elapsed());
    return res.status(502).json(envelope({
      source: "metrics/prime-cost (internal proxy)",
      scope: date ? `date:${date}` : "latest",
      status: "error",
      data: {},
      blockers: [{ code: "PROXY_FETCH_FAILED", message: err?.message ?? "Internal fetch failed", where: "/api/metrics/prime-cost", canonical_source: "primeCost route" }],
    }));
  }
});

// ── ANALYSIS: finance summary ─────────────────────────────────────────────────
router.get("/analysis/finance", async (req, res) => {
  const elapsed = timed();
  const port = process.env.PORT || 5000;
  try {
    const [today, summary] = await Promise.all([
      axios.get(`http://127.0.0.1:${port}/api/finance/summary/today`, { timeout: 8000 }).catch(() => null),
      axios.get(`http://127.0.0.1:${port}/api/finance/summary`, { timeout: 8000 }).catch(() => null),
    ]);
    const payload = envelope({
      source: "finance/summary + finance/summary/today (internal proxy)",
      scope: "mtd+today",
      status: "ok",
      data: {
        today: today?.data ?? null,
        monthly_summary: summary?.data ?? null,
      },
    });
    await logRequest("/analysis/finance", {}, 200, true, elapsed());
    return res.json(payload);
  } catch (err: any) {
    await logRequest("/analysis/finance", {}, 502, false, elapsed());
    return res.status(502).json(envelope({
      source: "finance (internal proxy)",
      scope: "mtd+today",
      status: "error",
      data: {},
      blockers: [{ code: "PROXY_FETCH_FAILED", message: err?.message ?? "Internal fetch failed", where: "/api/finance/summary", canonical_source: "finance route" }],
    }));
  }
});

// ── ANALYSIS: shift analysis ─────────────────────────────────────────────────
router.get("/analysis/shift-analysis", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string;
  if (!date || !isValidDate(date)) {
    await logRequest("/analysis/shift-analysis", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "shift-analysis", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: "daily_sales_v2.shiftDate" }] }));
  }
  const [salesShift, categoryBreakdown, topItems] = await Promise.all([
    pool.query(
      `SELECT d.id, d."shiftDate"::text AS shift_date, d."totalSales", d."cashSales", d."qrSales", d."grabSales",
              d."totalExpenses", d."cashFloat", d."managerName", d."submittedAtISO"::text AS submitted_at,
              s."burgerBuns", s."meatWeightG"
       FROM daily_sales_v2 d
       LEFT JOIN daily_stock_v2 s ON s."salesId" = d.id
       WHERE d."shiftDate" = $1
       ORDER BY d."submittedAtISO" DESC NULLS LAST LIMIT 1`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT COALESCE(pos_category_name,'UNCATEGORIZED') AS category,
              SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS units,
              SUM(CASE WHEN receipt_type='REFUND' THEN ABS(quantity) ELSE 0 END)::int AS refunds
       FROM receipt_truth_line WHERE receipt_date = $1::date
       GROUP BY 1 ORDER BY units DESC`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT item_name, pos_category_name AS category,
              SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS qty
       FROM receipt_truth_line WHERE receipt_date = $1::date AND receipt_type='SALE'
       GROUP BY item_name, pos_category_name ORDER BY qty DESC LIMIT 20`,
      [date],
    ).catch(() => ({ rows: [] } as any)),
  ]);
  const blockers: BobEnvelope<any>["blockers"] = [];
  if (!salesShift.rows.length) blockers.push({ code: "SHIFT_DATA_MISSING", message: `No shift data for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate", auto_build_attempted: false });
  const payload = envelope({
    source: "daily_sales_v2 + receipt_truth_line",
    scope: `date:${date}`,
    date,
    status: blockers.length ? "partial" : "ok",
    data: { shift: salesShift.rows[0] ?? null, category_breakdown: categoryBreakdown.rows, top_items: topItems.rows },
    blockers,
  });
  await logRequest("/analysis/shift-analysis", { date }, 200, true, elapsed());
  return res.json(payload);
});

// ── PURCHASING: items ────────────────────────────────────────────────────────
router.get("/purchasing/items", async (req, res) => {
  const elapsed = timed();
  const category = req.query.category as string | undefined;
  const activeOnly = (req.query.active ?? "true") === "true";
  const limit = safeLimit(req.query.limit, 500, 1000);
  const clauses: string[] = [];
  const vals: any[] = [];
  if (activeOnly) clauses.push(`active = true`);
  if (category) { vals.push(category); clauses.push(`category = $${vals.length}`); }
  vals.push(limit);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const items = await pool.query(
    `SELECT id, item, category, "supplierName" AS supplier, brand, "orderUnit" AS order_unit,
            "unitDescription" AS unit_desc, "unitCost" AS unit_cost_thb,
            is_ingredient, active, "lastReviewDate"::text AS last_review_date
     FROM purchasing_items ${where}
     ORDER BY category, item LIMIT $${vals.length}`,
    vals,
  ).catch(() => ({ rows: [] } as any));
  const cats = await pool.query(`SELECT DISTINCT category, COUNT(*)::int AS count FROM purchasing_items WHERE active=true GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] } as any));
  const payload = envelope({
    source: "purchasing_items",
    scope: category ? `category:${category}` : activeOnly ? "active" : "all",
    status: "ok",
    data: {
      count: items.rows.length,
      categories: cats.rows,
      items: items.rows,
    },
  });
  await logRequest("/purchasing/items", { category, activeOnly, limit }, 200, true, elapsed());
  return res.json(payload);
});

// ── PURCHASING: tally (rolls/meat + drinks) ───────────────────────────────────
router.get("/purchasing/tally", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 100, 500);
  if (date && !isValidDate(date)) {
    await logRequest("/purchasing/tally", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "purchasing/tally", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "purchase_tally.date" }] }));
  }
  const dateFilter = date ? `WHERE t.date = $1::date` : `WHERE t.date >= NOW() - INTERVAL '90 days'`;
  const dateVals = date ? [date] : [];
  const [rolls, drinks] = await Promise.all([
    pool.query(
      `SELECT t.id, t.date::text, t.staff, t.supplier, t.rolls_pcs, t.meat_grams, t.amount_thb, t.notes, t.created_at::text
       FROM purchase_tally t ${dateFilter} ORDER BY t.date DESC, t.created_at DESC LIMIT ${limit}`,
      dateVals,
    ).catch(() => ({ rows: [] } as any)),
    pool.query(
      `SELECT t.id, t.date::text, t.staff, t.supplier, t.amount_thb, t.notes, t.created_at::text,
              json_agg(json_build_object('item', d.item_name, 'qty', d.qty, 'unit', d.unit)) AS drink_lines
       FROM purchase_tally t
       JOIN purchase_tally_drink d ON d.tally_id = t.id
       ${dateFilter} GROUP BY t.id ORDER BY t.date DESC, t.created_at DESC LIMIT ${limit}`,
      dateVals,
    ).catch(() => ({ rows: [] } as any)),
  ]);
  const rollTotals = await pool.query(
    `SELECT SUM(rolls_pcs)::int AS total_rolls, SUM(meat_grams)::numeric AS total_meat_g, COUNT(*)::int AS events
     FROM purchase_tally ${dateFilter}`,
    dateVals,
  ).catch(() => ({ rows: [{}] } as any));
  const payload = envelope({
    source: "purchase_tally + purchase_tally_drink",
    scope: date ? `date:${date}` : "last-90d",
    date,
    status: "ok",
    data: {
      rolls_meat_entries: rolls.rows,
      drinks_entries: drinks.rows,
      totals: rollTotals.rows[0],
      count: { rolls_meat: rolls.rows.length, drinks: drinks.rows.length },
    },
  });
  await logRequest("/purchasing/tally", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

// ── PURCHASING: shift log ─────────────────────────────────────────────────────
router.get("/purchasing/shift-log", async (req, res) => {
  const elapsed = timed();
  const port = process.env.PORT || 5000;
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const suffix = qs ? `?${qs}` : "";
  try {
    const r = await axios.get(`http://127.0.0.1:${port}/api/purchasing-shift-log${suffix}`, { timeout: 10000 });
    const payload = envelope({
      source: "purchasing-shift-log (internal proxy)",
      scope: suffix || "all",
      status: "ok",
      data: r.data,
    });
    await logRequest("/purchasing/shift-log", Object.fromEntries(new URLSearchParams(qs)), 200, true, elapsed());
    return res.json(payload);
  } catch (err: any) {
    await logRequest("/purchasing/shift-log", {}, 502, false, elapsed());
    return res.status(502).json(envelope({
      source: "purchasing-shift-log (internal proxy)",
      scope: "all",
      status: "error",
      data: {},
      blockers: [{ code: "PROXY_FETCH_FAILED", message: err?.message ?? "Internal fetch failed", where: "/api/purchasing-shift-log", canonical_source: "purchasingShiftLog route" }],
    }));
  }
});

// ── PURCHASING: shopping list ─────────────────────────────────────────────────
router.get("/purchasing/shopping-list", async (req, res) => {
  const elapsed = timed();
  const lists = await pool.query(
    `SELECT sl.id, sl.created_at::text, sl.status, sl.notes,
            json_agg(json_build_object('id', si.id, 'item', si.ingredient_name, 'qty', si.requested_qty, 'unit', si.requested_unit, 'notes', si.notes) ORDER BY si.ingredient_name) AS items
     FROM shopping_list sl
     LEFT JOIN shopping_list_items si ON si.shopping_list_id = sl.id
     GROUP BY sl.id ORDER BY sl.created_at DESC LIMIT 10`,
  ).catch(() => ({ rows: [] } as any));
  const recentPurchases = await pool.query(
    `SELECT * FROM shopping_purchases ORDER BY created_at DESC LIMIT 20`,
  ).catch(() => ({ rows: [] } as any));
  const payload = envelope({
    source: "shopping_list + shopping_list_items + shopping_purchases",
    scope: "latest-10-lists",
    status: "ok",
    data: {
      lists: lists.rows,
      recent_purchases: recentPurchases.rows,
      active_list: lists.rows.find((l: any) => l.status === "active") ?? null,
    },
  });
  await logRequest("/purchasing/shopping-list", {}, 200, true, elapsed());
  return res.json(payload);
});

// ── OPERATIONS: expenses ──────────────────────────────────────────────────────
router.get("/operations/expenses", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 100, 500);
  if (date && !isValidDate(date)) {
    await logRequest("/operations/expenses", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "operations/expenses", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "expenses.shiftDate" }] }));
  }
  const where = date ? `WHERE "shiftDate" = $1` : `WHERE "shiftDate" >= NOW() - INTERVAL '30 days'`;
  const vals = date ? [date] : [];
  vals.push(limit);
  const rows = await pool.query(
    `SELECT id, "shiftDate"::text AS shift_date, item, "costCents", supplier,
            "expenseType" AS expense_type, wages, source, "createdAt"::text AS created_at
     FROM expenses ${where} ORDER BY "shiftDate" DESC, "createdAt" DESC LIMIT $${vals.length}`,
    vals,
  ).catch(() => ({ rows: [] } as any));
  const totals = await pool.query(
    `SELECT "expenseType" AS expense_type, SUM("costCents")::bigint AS total_cents, COUNT(*)::int AS count
     FROM expenses ${where.replace(`LIMIT $${vals.length}`, "")}
     GROUP BY 1 ORDER BY total_cents DESC`,
    date ? [date] : [],
  ).catch(() => ({ rows: [] } as any));
  const payload = envelope({
    source: "expenses",
    scope: date ? `date:${date}` : "last-30d",
    date,
    status: "ok",
    data: {
      count: rows.rows.length,
      expenses: rows.rows,
      by_type: totals.rows,
      total_thb: totals.rows.reduce((s: number, r: any) => s + Number(r.total_cents || 0) / 100, 0).toFixed(2),
    },
  });
  await logRequest("/operations/expenses", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

// ── OPERATIONS: balance ───────────────────────────────────────────────────────
router.get("/operations/balance", async (req, res) => {
  const elapsed = timed();
  const port = process.env.PORT || 5000;
  try {
    const [pos, forms, combined] = await Promise.all([
      axios.get(`http://127.0.0.1:${port}/api/balance/pos`, { timeout: 6000 }).catch(() => null),
      axios.get(`http://127.0.0.1:${port}/api/balance/forms`, { timeout: 6000 }).catch(() => null),
      axios.get(`http://127.0.0.1:${port}/api/balance/combined`, { timeout: 6000 }).catch(() => null),
    ]);
    const payload = envelope({
      source: "balance/pos + balance/forms + balance/combined (internal proxy)",
      scope: "current",
      status: "ok",
      data: {
        pos_balance: pos?.data ?? null,
        forms_balance: forms?.data ?? null,
        combined: combined?.data ?? null,
      },
    });
    await logRequest("/operations/balance", {}, 200, true, elapsed());
    return res.json(payload);
  } catch (err: any) {
    await logRequest("/operations/balance", {}, 502, false, elapsed());
    return res.status(502).json(envelope({
      source: "balance (internal proxy)",
      scope: "current",
      status: "error",
      data: {},
      blockers: [{ code: "PROXY_FETCH_FAILED", message: err?.message ?? "Internal fetch failed", where: "/api/balance/*", canonical_source: "balance routes" }],
    }));
  }
});

// ── OPERATIONS: stock review ──────────────────────────────────────────────────
router.get("/operations/stock-review", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  const limit = safeLimit(req.query.limit, 100, 500);
  if (date && !isValidDate(date)) {
    await logRequest("/operations/stock-review", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({ source: "request", scope: "operations/stock-review", status: "error", data: {}, blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "stock_received_log.shift_date" }] }));
  }
  const where = date ? `WHERE shift_date = $1::date` : `WHERE shift_date >= NOW() - INTERVAL '14 days'`;
  const vals = date ? [date] : [];
  const rows = await pool.query(
    `SELECT id, shift_date::text, item_type, item_name, qty, weight_g, paid, source, notes, created_at::text
     FROM stock_received_log ${where} ORDER BY shift_date DESC, created_at DESC LIMIT ${limit}`,
    vals,
  ).catch(() => ({ rows: [] } as any));
  const summary = await pool.query(
    `SELECT item_type, item_name, SUM(qty)::numeric AS total_qty, SUM(COALESCE(weight_g,0))::numeric AS total_weight_g, COUNT(*)::int AS events
     FROM stock_received_log ${where}
     GROUP BY item_type, item_name ORDER BY item_type, total_qty DESC`,
    vals,
  ).catch(() => ({ rows: [] } as any));
  const payload = envelope({
    source: "stock_received_log",
    scope: date ? `date:${date}` : "last-14d",
    date,
    status: "ok",
    data: { count: rows.rows.length, log: rows.rows, summary: summary.rows },
  });
  await logRequest("/operations/stock-review", { date, limit }, 200, true, elapsed());
  return res.json(payload);
});

router.get("/shift-report/latest", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (date && !isValidDate(date)) {
    await logRequest("/shift-report/latest", { date }, 400, false, elapsed());
    return res.status(400).json(envelope({
      source: "request",
      scope: "shift-report/latest",
      status: "error",
      data: {},
      blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: "shift_report_v2.shiftDate" }],
    }));
  }

  const report = date
    ? await pool.query(
        `SELECT id, "shiftDate"::text AS shift_date, "salesId", "stockId",
                "posData", "salesData", "stockData", "variances", "aiInsights",
                "createdAt"::text AS created_at, "restaurantId"
         FROM shift_report_v2
         WHERE DATE("shiftDate" AT TIME ZONE 'Asia/Bangkok') = $1::date
         ORDER BY "createdAt" DESC LIMIT 1`,
        [date],
      ).catch(() => ({ rows: [] } as any))
    : await pool.query(
        `SELECT id, "shiftDate"::text AS shift_date, "salesId", "stockId",
                "posData", "salesData", "stockData", "variances", "aiInsights",
                "createdAt"::text AS created_at, "restaurantId"
         FROM shift_report_v2
         ORDER BY "createdAt" DESC LIMIT 1`,
      ).catch(() => ({ rows: [] } as any));

  const row = report.rows[0] ?? null;

  const blockers: BobEnvelope<any>["blockers"] = [];
  if (!row) {
    blockers.push({
      code: "SHIFT_REPORT_MISSING",
      message: date
        ? `No shift_report_v2 row found for date ${date}`
        : "No shift_report_v2 rows exist — run POST /api/shift-report/generate to build one",
      where: "shift_report_v2",
      canonical_source: "shift_report_v2.shiftDate",
      auto_build_attempted: false,
    });
  }

  const payload = envelope({
    source: "shift_report_v2",
    scope: date ? `date:${date}` : "latest",
    date: date ?? row?.shift_date?.slice(0, 10) ?? undefined,
    status: blockers.length ? "missing" : "ok",
    data: {
      found: Boolean(row),
      report: row
        ? {
            id: row.id,
            shift_date: row.shift_date,
            sales_id: row.salesId,
            stock_id: row.stockId,
            pos_data: row.posData,
            sales_data: row.salesData,
            stock_data: row.stockData,
            variances: row.variances,
            ai_insights: row.aiInsights,
            created_at: row.created_at,
            restaurant_id: row.restaurantId,
          }
        : null,
      generate_endpoint: "POST /api/shift-report/generate  body: { shiftDate: 'YYYY-MM-DD' }",
    },
    blockers,
    warnings: row ? [] : ["shift_report_v2 is empty. Trigger a report generation to populate it."],
  });

  await logRequest("/shift-report/latest", { date }, 200, true, elapsed());
  return res.json(payload);
});

// ── UNIVERSAL PASSTHROUGH PROXY ───────────────────────────────────────────────
// Lets Bob read any GET endpoint in the app via /api/bob/read/proxy?path=/api/...
// Blocklisted paths cannot be proxied (auth mutations, payment processing, admin ops).

const PROXY_BLOCKLIST = [
  "/api/auth",
  "/api/payment",
  "/api/admin",
  "/api/bob/read/proxy", // prevent self-loop
];

router.get("/proxy", async (req, res) => {
  const elapsed = timed();
  const path = req.query.path as string | undefined;
  if (!path) {
    await logRequest("/proxy", { path }, 400, false, elapsed());
    return res.status(400).json(envelope({
      source: "request",
      scope: "proxy",
      status: "error",
      data: {},
      blockers: [{ code: "PATH_REQUIRED", message: "?path=/api/... query param is required", where: "query.path", canonical_source: "any GET /api/* route" }],
    }));
  }
  if (!path.startsWith("/api/")) {
    await logRequest("/proxy", { path }, 400, false, elapsed());
    return res.status(400).json(envelope({
      source: "request",
      scope: "proxy",
      status: "error",
      data: {},
      blockers: [{ code: "INVALID_PATH", message: "path must start with /api/", where: "query.path", canonical_source: "any GET /api/* route" }],
    }));
  }
  const blocked = PROXY_BLOCKLIST.find((b) => path.startsWith(b));
  if (blocked) {
    await logRequest("/proxy", { path }, 403, false, elapsed());
    return res.status(403).json(envelope({
      source: "request",
      scope: "proxy",
      status: "error",
      data: {},
      blockers: [{ code: "PATH_BLOCKED", message: `${path} is blocked from Bob read proxy`, where: "query.path", canonical_source: "PROXY_BLOCKLIST" }],
    }));
  }
  // Forward all query params except 'path' to the target
  const forwardParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "path") forwardParams.append(k, v as string);
  }
  const paramStr = forwardParams.toString();
  const targetUrl = `http://127.0.0.1:${process.env.PORT || 5000}${path}${paramStr ? `?${paramStr}` : ""}`;
  try {
    const r = await axios.get(targetUrl, { timeout: 12000, validateStatus: () => true });
    const payload = envelope({
      source: `proxy:${path}`,
      scope: path,
      status: r.status >= 400 ? "error" : "ok",
      data: {
        proxied_path: path,
        http_status: r.status,
        response: r.data,
      },
      warnings: r.status >= 400 ? [`Upstream returned HTTP ${r.status}`] : [],
    });
    await logRequest("/proxy", { path }, r.status, r.status < 400, elapsed());
    return res.status(r.status < 400 ? 200 : r.status).json(payload);
  } catch (err: any) {
    await logRequest("/proxy", { path }, 502, false, elapsed());
    return res.status(502).json(envelope({
      source: `proxy:${path}`,
      scope: path,
      status: "error",
      data: { proxied_path: path },
      blockers: [{ code: "PROXY_FETCH_FAILED", message: err?.message ?? "Internal fetch failed", where: targetUrl, canonical_source: path }],
    }));
  }
});

export default router;
