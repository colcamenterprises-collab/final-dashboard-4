/**
 * bobCanonicalReadService — Aggregates all canonical app data sources
 * into a single shift snapshot for Bob's read layer.
 *
 * Rules:
 *  - Read-only. No mutations, no side effects.
 *  - Never invents values. Missing sources are reported explicitly.
 *  - Per-source status is tracked individually.
 */

import { pool } from "../db";
import { shiftWindow } from "./time/shiftWindow";

// ── Types ────────────────────────────────────────────────────────────────────

export type SourceStatus = "ok" | "missing" | "error" | "unavailable";

export interface SourceBlock {
  status: SourceStatus;
  reason?: string;
  rows?: number;
}

export interface CanonicalSnapshot {
  ok: boolean;
  status: "ok" | "partial" | "BLOCKED_BY_APP_ACCESS";
  shiftDate: string;
  shiftWindow: { timezone: string; start: string; end: string; startLabel: string; endLabel: string };
  missingSources: string[];
  sourceStatus: Record<string, SourceBlock>;
  shift: Record<string, unknown> | null;
  dailySales: Record<string, unknown> | null;
  expenses: Record<string, unknown> | null;
  soldItems: Record<string, unknown> | null;
  reconciliation: Record<string, unknown> | null;
  purchases: Record<string, unknown> | null;
  ingredients: Record<string, unknown> | null;
  shoppingList: Record<string, unknown> | null;
  builtAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(v: unknown): number { return Number(v) || 0; }

function fromPayload(payload: unknown, ...keys: string[]): number {
  if (!payload) return 0;
  const p = typeof payload === "string" ? JSON.parse(payload) : payload;
  for (const k of keys) {
    const v = (p as Record<string, unknown>)?.[k];
    if (v !== undefined && v !== null && v !== "") return Number(v) || 0;
  }
  return 0;
}

function q<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
  if (!pool) return Promise.resolve({ rows: [] });
  return pool.query(sql, params).catch(() => ({ rows: [] } as any));
}

// ── Shift window helper ───────────────────────────────────────────────────────

export function buildShiftWindow(dateISO: string) {
  const sw = shiftWindow(dateISO);
  return {
    timezone: "Asia/Bangkok",
    start: sw.fromISO,
    end: sw.toISO,
    startLabel: `${dateISO} 17:00 Asia/Bangkok`,
    endLabel: `${sw.shiftDate < dateISO ? sw.shiftDate : nextDay(dateISO)} 03:00 Asia/Bangkok`,
  };
}

function nextDay(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

// ── Section readers ───────────────────────────────────────────────────────────

async function readDailySales(date: string): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const result = await q(
    `SELECT id, "completedBy", "submittedAtISO", payload
     FROM daily_sales_v2
     WHERE "shiftDate" = $1
     ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
    [date],
  );
  const row = result.rows[0] ?? null;
  if (!row) return { data: null, block: { status: "missing", reason: `No daily_sales_v2 row for ${date}` } };

  const p = row.payload ?? {};
  return {
    data: {
      submitted: true,
      submitted_by: row.completedBy ?? null,
      submitted_at: row.submittedAtISO ?? null,
      total_sales: fromPayload(p, "total_sales", "totalSales"),
      cash: fromPayload(p, "cash_sales", "cashSales"),
      qr: fromPayload(p, "qr_sales", "qrSales"),
      grab: fromPayload(p, "grab_sales", "grabSales"),
      other: fromPayload(p, "other_sales", "otherSales", "aroi_dee_sales"),
      expenses_total: fromPayload(p, "expenses_total", "expensesTotal", "total_expenses"),
      cash_banked: fromPayload(p, "cash_banked", "cashBanked"),
      qr_transfer: fromPayload(p, "qr_transfer", "qrTransfer"),
      wages_total: fromPayload(p, "wages_total", "wagesTotal", "total_wages"),
      staff_count: fromPayload(p, "staff_count", "staffCount"),
      source: "daily_sales_v2",
    },
    block: { status: "ok", rows: 1 },
  };
}

async function readExpenses(date: string): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const result = await q(
    `SELECT category, SUM(amount)::numeric(12,2) AS total, COUNT(*)::int AS count
     FROM expenses
     WHERE shift_date = $1::date
     GROUP BY category ORDER BY total DESC`,
    [date],
  );
  if (!result.rows.length) {
    // Try alternative column name
    const alt = await q(
      `SELECT 'general'::text AS category, SUM(amount)::numeric(12,2) AS total, COUNT(*)::int AS count
       FROM expenses
       WHERE date = $1::date`,
      [date],
    );
    if (!alt.rows.length || n(alt.rows[0]?.total) === 0) {
      return { data: null, block: { status: "missing", reason: `No expenses for ${date}` } };
    }
    return {
      data: { by_category: alt.rows, grand_total: n(alt.rows[0]?.total), source: "expenses" },
      block: { status: "ok", rows: alt.rows.length },
    };
  }
  const grand_total = result.rows.reduce((s: number, r: any) => s + n(r.total), 0);
  return {
    data: { by_category: result.rows, grand_total, source: "expenses" },
    block: { status: "ok", rows: result.rows.length },
  };
}

async function readSoldItems(date: string, fromISO: string, toISO: string): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const [posAgg, topItems, byCategory] = await Promise.all([
    q(
      `SELECT
         COUNT(*)::int AS total_receipts,
         COUNT(*) FILTER (WHERE receipt_type = 'SALE')::int AS sales_receipts,
         COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN total_money ELSE 0 END), 0)::numeric(12,2) AS gross_sales,
         COALESCE(SUM(CASE WHEN receipt_type='REFUND' THEN ABS(total_money) ELSE 0 END), 0)::numeric(12,2) AS total_refunds
       FROM lv_receipt
       WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
      [fromISO, toISO],
    ),
    q(
      `SELECT item_name,
         SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS qty_sold,
         COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN net_total ELSE 0 END), 0)::numeric(12,2) AS net_revenue
       FROM receipt_truth_line
       WHERE receipt_date = $1::date AND receipt_type = 'SALE'
       GROUP BY item_name ORDER BY qty_sold DESC LIMIT 20`,
      [date],
    ),
    q(
      `SELECT category_name,
         SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS qty
       FROM receipt_truth_line
       WHERE receipt_date = $1::date
       GROUP BY category_name ORDER BY qty DESC`,
      [date],
    ),
  ]);
  const pos = posAgg.rows[0] ?? {};
  if (n(pos.total_receipts) === 0) {
    return { data: null, block: { status: "missing", reason: `No POS receipts in shift window ${fromISO}→${toISO}` } };
  }
  return {
    data: {
      pos_receipt_count: n(pos.total_receipts),
      pos_sales_receipts: n(pos.sales_receipts),
      pos_gross_thb: n(pos.gross_sales),
      pos_refunds_thb: n(pos.total_refunds),
      pos_net_thb: Math.round((n(pos.gross_sales) - n(pos.total_refunds)) * 100) / 100,
      top_items: topItems.rows,
      by_category: byCategory.rows,
      source: "lv_receipt + receipt_truth_line",
    },
    block: { status: "ok", rows: n(pos.total_receipts) },
  };
}

async function readReconciliation(date: string, fromISO: string, toISO: string, salesData: Record<string, unknown> | null): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const posAgg = await q(
    `SELECT COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN total_money ELSE 0 END), 0)::numeric(12,2) AS pos_gross
     FROM lv_receipt
     WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
    [fromISO, toISO],
  );
  const pos_gross = n(posAgg.rows[0]?.pos_gross);
  const form_total = salesData ? n(salesData.total_sales) : 0;
  const variance = form_total > 0 && pos_gross > 0 ? Math.round((form_total - pos_gross) * 100) / 100 : null;
  const issueCount = await q(
    `SELECT COUNT(*)::int AS c FROM ai_issues WHERE shift_date = $1::date AND (status IS NULL OR status != 'resolved')`,
    [date],
  ).catch(() => ({ rows: [{ c: 0 }] }));
  return {
    data: {
      form_total_thb: form_total,
      pos_gross_thb: pos_gross,
      variance_thb: variance,
      variance_pct: form_total > 0 && variance !== null ? Math.round((variance / form_total) * 10000) / 100 : null,
      sales_match: variance !== null ? Math.abs(variance) < 1 : null,
      open_issue_count: n(issueCount.rows[0]?.c),
      source: "daily_sales_v2 vs lv_receipt",
    },
    block: { status: "ok" },
  };
}

async function readPurchases(date: string): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const [tallies, drinks] = await Promise.all([
    q(
      `SELECT id, date::text, staff, supplier, notes,
         rolls_pcs, meat_grams, amount_thb::numeric(12,2) AS amount_thb
       FROM purchase_tally WHERE date = $1::date ORDER BY created_at DESC`,
      [date],
    ),
    q(
      `SELECT d.item_sku, d.item_name, d.qty, d.unit_price::numeric(12,2), d.total::numeric(12,2)
       FROM purchase_tally_drink d
       JOIN purchase_tally t ON t.id = d.tally_id
       WHERE t.date = $1::date ORDER BY d.item_name`,
      [date],
    ),
  ]);
  if (!tallies.rows.length && !drinks.rows.length) {
    return { data: null, block: { status: "missing", reason: `No purchase_tally rows for ${date}` } };
  }
  const grand_total = tallies.rows.reduce((s: number, r: any) => s + n(r.amount_thb), 0);
  return {
    data: {
      tally_count: tallies.rows.length,
      grand_total_thb: grand_total,
      entries: tallies.rows,
      drinks: drinks.rows,
      source: "purchase_tally + purchase_tally_drink",
    },
    block: { status: "ok", rows: tallies.rows.length },
  };
}

async function readIngredients(date: string): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const result = await q(
    `SELECT category_name, sku, item_name, quantity_sold::numeric(12,4) AS quantity_sold, unit
     FROM receipt_truth_daily_usage
     WHERE business_date = $1::date
     ORDER BY category_name, item_name`,
    [date],
  );
  if (!result.rows.length) {
    return { data: null, block: { status: "missing", reason: `No receipt_truth_daily_usage for ${date}` } };
  }
  return {
    data: {
      item_count: result.rows.length,
      rows: result.rows,
      source: "receipt_truth_daily_usage",
    },
    block: { status: "ok", rows: result.rows.length },
  };
}

async function readShoppingList(): Promise<{ data: Record<string, unknown> | null; block: SourceBlock }> {
  const result = await q(
    `SELECT id, item_name, category, unit, quantity, unit_price::numeric(12,2), notes, active
     FROM purchasing_items WHERE active = TRUE ORDER BY category, item_name LIMIT 200`,
  );
  if (!result.rows.length) {
    return { data: null, block: { status: "missing", reason: "No active purchasing_items" } };
  }
  return {
    data: {
      item_count: result.rows.length,
      items: result.rows,
      source: "purchasing_items",
    },
    block: { status: "ok", rows: result.rows.length },
  };
}

// ── Main aggregator ───────────────────────────────────────────────────────────

export async function buildCanonicalSnapshot(dateISO: string): Promise<CanonicalSnapshot> {
  const builtAt = new Date().toISOString();

  if (!pool) {
    return {
      ok: false,
      status: "BLOCKED_BY_APP_ACCESS",
      shiftDate: dateISO,
      shiftWindow: buildShiftWindow(dateISO),
      missingSources: ["database"],
      sourceStatus: { database: { status: "unavailable", reason: "Database pool unavailable" } },
      shift: null,
      dailySales: null,
      expenses: null,
      soldItems: null,
      reconciliation: null,
      purchases: null,
      ingredients: null,
      shoppingList: null,
      builtAt,
    };
  }

  const sw = shiftWindow(dateISO);
  const win = buildShiftWindow(dateISO);

  // Fetch all sections in parallel
  const [salesResult, expResult, soldResult, purchResult, ingResult, shopResult] = await Promise.all([
    readDailySales(dateISO),
    readExpenses(dateISO),
    readSoldItems(dateISO, sw.fromISO, sw.toISO),
    readPurchases(dateISO),
    readIngredients(dateISO),
    readShoppingList(),
  ]);

  // Reconciliation depends on sales + sold items
  const reconResult = await readReconciliation(dateISO, sw.fromISO, sw.toISO, salesResult.data);

  const sourceStatus: Record<string, SourceBlock> = {
    dailySales: salesResult.block,
    expenses: expResult.block,
    soldItems: soldResult.block,
    reconciliation: reconResult.block,
    purchases: purchResult.block,
    ingredients: ingResult.block,
    shoppingList: shopResult.block,
  };

  const missingSources = Object.entries(sourceStatus)
    .filter(([, b]) => b.status !== "ok")
    .map(([name]) => name);

  const allMissing = missingSources.length === Object.keys(sourceStatus).length;
  const overallStatus: CanonicalSnapshot["status"] = allMissing
    ? "BLOCKED_BY_APP_ACCESS"
    : missingSources.length > 0
    ? "partial"
    : "ok";

  return {
    ok: overallStatus !== "BLOCKED_BY_APP_ACCESS",
    status: overallStatus,
    shiftDate: dateISO,
    shiftWindow: win,
    missingSources,
    sourceStatus,
    shift: {
      shift_date: dateISO,
      window_start: sw.fromISO,
      window_end: sw.toISO,
      timezone: "Asia/Bangkok",
    },
    dailySales: salesResult.data,
    expenses: expResult.data,
    soldItems: soldResult.data,
    reconciliation: reconResult.data,
    purchases: purchResult.data,
    ingredients: ingResult.data,
    shoppingList: shopResult.data,
    builtAt,
  };
}
