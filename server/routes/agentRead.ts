/**
 * /api/agent/read — Governed canonical read-only surface for Bob + future agents.
 *
 * Auth:    Bearer token (agent_tokens table or BOB_READONLY_TOKEN env fallback)
 * Method:  GET only (405 on all others)
 * Scope:   Tenant-aware, shift-window aware
 * Shape:   Stable AgentEnvelope<T> JSON on every response
 *
 * Endpoints:
 *   GET /api/agent/read/shift-summary?date=YYYY-MM-DD
 *   GET /api/agent/read/daily-operations?date=YYYY-MM-DD
 *   GET /api/agent/read/receipt-summary?date=YYYY-MM-DD
 *   GET /api/agent/read/purchasing-summary?date=YYYY-MM-DD
 *   GET /api/agent/read/finance-summary?date=YYYY-MM-DD
 *   GET /api/agent/read/reconciliation-summary?date=YYYY-MM-DD
 */

import { Router } from "express";
import { pool } from "../db";
import { shiftWindow } from "../services/time/shiftWindow";
import {
  envelope,
  isValidDate,
  timed,
  agentAuthMiddleware,
  readOnlyGuard,
  dbGuard,
} from "../middleware/agentAuth";

const router = Router();

// ── Guards (order matters) ─────────────────────────────────────────────────
router.use(readOnlyGuard);
router.use(agentAuthMiddleware);
router.use(dbGuard);

// ── Helpers ────────────────────────────────────────────────────────────────

function badDate(res: any, scope: string) {
  return res.status(400).json(
    envelope({
      source: "request",
      scope,
      status: "error",
      data: {},
      blockers: [{ code: "INVALID_DATE", message: "date must be YYYY-MM-DD", where: "query.date", canonical_source: scope }],
    }),
  );
}

function missingDate(res: any, scope: string) {
  return res.status(400).json(
    envelope({
      source: "request",
      scope,
      status: "error",
      data: {},
      blockers: [{ code: "DATE_REQUIRED", message: "date query param required (YYYY-MM-DD)", where: "query.date", canonical_source: scope }],
    }),
  );
}

// Safe numeric coerce from string/null
function num(v: unknown): number { return Number(v) || 0; }

// Pull a numeric field from a daily_sales_v2 payload JSONB
// Payload keys use snake_case in the DB JSON object
function fromPayload(payload: any, ...keys: string[]): number {
  if (!payload) return 0;
  const p = typeof payload === "string" ? JSON.parse(payload) : payload;
  for (const k of keys) {
    const v = p?.[k];
    if (v !== undefined && v !== null && v !== "") return num(v);
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// A. SHIFT SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
router.get("/shift-summary", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "shift-summary");
  if (!isValidDate(date)) return badDate(res, "shift-summary");

  const { shiftDate, fromISO, toISO } = shiftWindow(date);
  const blockers: ReturnType<typeof envelope>["blockers"] = [];
  const warnings: string[] = [];

  const [salesRow, posCount, issueCount] = await Promise.all([
    pool
      .query(
        `SELECT id, "completedBy", "submittedAtISO", payload
         FROM daily_sales_v2
         WHERE "shiftDate" = $1
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE receipt_type = 'SALE')::int AS sales,
           COUNT(*) FILTER (WHERE receipt_type = 'REFUND')::int AS refunds,
           MIN(datetime_bkk)::text AS first_ts,
           MAX(datetime_bkk)::text AS last_ts,
           COALESCE(SUM(CASE WHEN receipt_type = 'SALE' THEN total_money ELSE 0 END), 0)::numeric(12,2) AS pos_gross
         FROM lv_receipt
         WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
        [fromISO, toISO],
      )
      .catch(() => ({ rows: [{ total: 0, sales: 0, refunds: 0, first_ts: null, last_ts: null, pos_gross: 0 }] } as any)),
    pool
      .query(
        `SELECT COUNT(*)::int AS c FROM ai_issues WHERE shift_date = $1::date AND (status IS NULL OR status != 'resolved')`,
        [date],
      )
      .catch(() => ({ rows: [{ c: 0 }] } as any)),
  ]);

  const form = salesRow.rows[0] ?? null;
  const payload = form?.payload ?? null;
  const pos = posCount.rows[0] ?? {};

  // Build status flags
  const form_connected = !!form;
  const pos_connected = num(pos.total) > 0;

  if (!form_connected) {
    blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate" });
  }
  if (!pos_connected) {
    warnings.push(`No lv_receipt rows found in shift window ${fromISO} → ${toISO}`);
  }

  // Parse payment channels from form payload
  const cash = fromPayload(payload, "cash_sales", "cashSales");
  const qr = fromPayload(payload, "qr_sales", "qrSales");
  const grab = fromPayload(payload, "grab_sales", "grabSales");
  const other = fromPayload(payload, "other_sales", "otherSales", "aroi_dee_sales");
  const total_sales = fromPayload(payload, "total_sales", "totalSales") || (cash + qr + grab + other) || 0;
  const expenses_total = fromPayload(payload, "expenses_total", "expensesTotal", "total_expenses");

  const open_issues = num(issueCount.rows[0]?.c);
  const status = !form_connected && !pos_connected ? "missing" : blockers.length > 0 ? "partial" : "ok";

  return res.json(
    envelope({
      source: "daily_sales_v2 + lv_receipt + ai_issues",
      scope: `shift:${shiftDate}`,
      date: shiftDate,
      status,
      data: {
        shift_date: shiftDate,
        shift_window: { start: fromISO, end: toISO },
        // Form-sourced sales breakdown
        sales: {
          total_sales,
          cash,
          qr,
          grab,
          other,
          expenses_total,
          source: form_connected ? "daily_sales_v2" : null,
          submitted_by: form?.completedBy ?? null,
          submitted_at: form?.submittedAtISO ?? null,
        },
        // POS-sourced receipt summary
        pos: {
          receipt_count_total: num(pos.total),
          receipt_count_sales: num(pos.sales),
          receipt_count_refunds: num(pos.refunds),
          pos_gross_thb: num(pos.pos_gross),
          first_receipt_at: pos.first_ts ?? null,
          last_receipt_at: pos.last_ts ?? null,
          source: "lv_receipt",
        },
        // Status flags
        status_flags: {
          form_connected,
          pos_connected,
          has_open_issues: open_issues > 0,
          open_issue_count: open_issues,
          labour_connected: form_connected && (fromPayload(payload, "wages_total", "wagesTotal", "total_wages") > 0 || fromPayload(payload, "staff_count", "staffCount") > 0),
        },
        reconciliation_state: {
          form_total: total_sales,
          pos_gross: num(pos.pos_gross),
          variance: total_sales > 0 && num(pos.pos_gross) > 0
            ? Math.round((total_sales - num(pos.pos_gross)) * 100) / 100
            : null,
          variance_source: form_connected && pos_connected ? "form vs POS gross" : null,
        },
      },
      warnings,
      blockers,
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// B. DAILY OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════
router.get("/daily-operations", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "daily-operations");
  if (!isValidDate(date)) return badDate(res, "daily-operations");

  const blockers: ReturnType<typeof envelope>["blockers"] = [];

  const [salesRow, stockRow] = await Promise.all([
    pool
      .query(
        `SELECT id, "completedBy", "submittedAtISO", payload
         FROM daily_sales_v2 WHERE "shiftDate" = $1
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT s.payload, s."createdAt"
         FROM daily_stock_v2 s
         JOIN daily_sales_v2 d ON d.id = s."salesId"
         WHERE d."shiftDate" = $1
         ORDER BY s."createdAt" DESC LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
  ]);

  const form = salesRow.rows[0] ?? null;
  const sp = form?.payload ?? null;
  const stockForm = stockRow.rows[0] ?? null;
  const sfp = stockForm?.payload ?? null;

  if (!form) blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate" });
  if (!stockForm) blockers.push({ code: "STOCK_FORM_MISSING", message: `No daily_stock_v2 row for ${date}`, where: "daily_stock_v2", canonical_source: "daily_stock_v2 → daily_sales_v2.id" });

  const status = !form && !stockForm ? "missing" : blockers.length > 0 ? "partial" : "ok";

  return res.json(
    envelope({
      source: "daily_sales_v2 + daily_stock_v2",
      scope: `date:${date}`,
      date,
      status,
      data: {
        shift_date: date,
        sales_form: {
          submitted: !!form,
          submitted_by: form?.completedBy ?? null,
          submitted_at: form?.submittedAtISO ?? null,
          total_sales: fromPayload(sp, "total_sales", "totalSales"),
          cash: fromPayload(sp, "cash_sales", "cashSales"),
          qr: fromPayload(sp, "qr_sales", "qrSales"),
          grab: fromPayload(sp, "grab_sales", "grabSales"),
          other: fromPayload(sp, "other_sales", "otherSales"),
          expenses_total: fromPayload(sp, "expenses_total", "expensesTotal", "total_expenses"),
          cash_banked: fromPayload(sp, "cash_banked", "cashBanked"),
          qr_transfer: fromPayload(sp, "qr_transfer", "qrTransfer"),
        },
        stock_form: {
          submitted: !!stockForm,
          buns_remaining: fromPayload(sfp, "buns_remaining", "bunsRemaining", "rolls_remaining"),
          meat_remaining_g: fromPayload(sfp, "meat_remaining_g", "meatRemainingG", "meat_remaining"),
          drinks_by_sku: sfp?.drinks ?? sfp?.drink_counts ?? null,
          burger_buns_count: fromPayload(sfp, "burger_buns_count", "burgerBunsCount"),
          meat_count: fromPayload(sfp, "meat_count", "meatCount"),
        },
        labour: {
          staff_count: fromPayload(sp, "staff_count", "staffCount"),
          total_wages: fromPayload(sp, "wages_total", "wagesTotal", "total_wages"),
          is_itemised: !!(sp?.staff_wages || sp?.staffWages || sp?.wages_breakdown),
        },
      },
      blockers,
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// C. RECEIPT SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
router.get("/receipt-summary", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "receipt-summary");
  if (!isValidDate(date)) return badDate(res, "receipt-summary");

  const { shiftDate, fromISO, toISO } = shiftWindow(date);
  const blockers: ReturnType<typeof envelope>["blockers"] = [];

  const [posAgg, topItems, categoryTotals] = await Promise.all([
    pool
      .query(
        `SELECT
           COUNT(*)::int AS total_receipts,
           COUNT(*) FILTER (WHERE receipt_type = 'SALE')::int AS sales_receipts,
           COUNT(*) FILTER (WHERE receipt_type = 'REFUND')::int AS refund_receipts,
           COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN total_money ELSE 0 END), 0)::numeric(12,2) AS gross_sales,
           COALESCE(SUM(CASE WHEN receipt_type='REFUND' THEN ABS(total_money) ELSE 0 END), 0)::numeric(12,2) AS total_refunds,
           MIN(datetime_bkk)::text AS first_receipt_at,
           MAX(datetime_bkk)::text AS last_receipt_at
         FROM lv_receipt
         WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
        [fromISO, toISO],
      )
      .catch(() => ({ rows: [{}] } as any)),
    pool
      .query(
        `SELECT
           item_name,
           SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS qty_sold,
           SUM(CASE WHEN receipt_type='REFUND' THEN ABS(quantity) ELSE 0 END)::int AS qty_refunded,
           COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN net_total ELSE 0 END), 0)::numeric(12,2) AS net_revenue
         FROM receipt_truth_line
         WHERE receipt_date = $1::date AND receipt_type = 'SALE'
         GROUP BY item_name
         ORDER BY qty_sold DESC LIMIT 20`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT
           category_name,
           SUM(CASE WHEN receipt_type='SALE' THEN quantity ELSE 0 END)::int AS qty
         FROM receipt_truth_line
         WHERE receipt_date = $1::date
         GROUP BY category_name
         ORDER BY qty DESC`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
  ]);

  const pos = posAgg.rows[0] ?? {};
  if (num(pos.total_receipts) === 0) {
    blockers.push({ code: "NO_POS_RECEIPTS", message: `No lv_receipt rows in shift window ${fromISO} → ${toISO}`, where: "lv_receipt", canonical_source: "lv_receipt.datetime_bkk" });
  }

  const status = num(pos.total_receipts) === 0 ? "missing" : "ok";

  return res.json(
    envelope({
      source: "lv_receipt + receipt_truth_line",
      scope: `shift:${shiftDate}`,
      date: shiftDate,
      status,
      data: {
        shift_date: shiftDate,
        shift_window: { start: fromISO, end: toISO },
        totals: {
          total_receipts: num(pos.total_receipts),
          sales_receipts: num(pos.sales_receipts),
          refund_receipts: num(pos.refund_receipts),
          gross_sales_thb: num(pos.gross_sales),
          total_refunds_thb: num(pos.total_refunds),
          net_sales_thb: Math.round((num(pos.gross_sales) - num(pos.total_refunds)) * 100) / 100,
        },
        timing: {
          first_receipt_at: pos.first_receipt_at ?? null,
          last_receipt_at: pos.last_receipt_at ?? null,
        },
        top_items: topItems.rows,
        by_category: categoryTotals.rows,
        receipt_evidence_source: "lv_receipt (Loyverse POS sync)",
      },
      blockers,
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// D. PURCHASING SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
router.get("/purchasing-summary", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "purchasing-summary");
  if (!isValidDate(date)) return badDate(res, "purchasing-summary");

  const blockers: ReturnType<typeof envelope>["blockers"] = [];

  const [tallies, drinks, expenses] = await Promise.all([
    pool
      .query(
        `SELECT
           t.id, t.date::text, t.staff, t.supplier, t.notes,
           t.rolls_pcs, t.meat_grams,
           t.amount_thb::numeric(12,2) AS amount_thb,
           t.created_at::text AS created_at
         FROM purchase_tally t
         WHERE t.date = $1::date
         ORDER BY t.created_at DESC`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT d.tally_id, d.item_name, d.qty, d.unit
         FROM purchase_tally_drink d
         JOIN purchase_tally t ON t.id = d.tally_id
         WHERE t.date = $1::date`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT category, supplier, SUM(amount_cents)::int AS total_cents, COUNT(*)::int AS items
         FROM expenses
         WHERE date = $1::date
         GROUP BY category, supplier
         ORDER BY total_cents DESC`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
  ]);

  const tallyRows = tallies.rows ?? [];
  const drinkRows = drinks.rows ?? [];

  // Aggregate tally totals
  let totalRolls = 0;
  let totalMeatG = 0;
  let totalSpend = 0;
  for (const t of tallyRows) {
    totalRolls += num(t.rolls_pcs);
    totalMeatG += num(t.meat_grams);
    totalSpend += num(t.amount_thb);
  }

  // Map drinks by tally_id
  const drinksByTally: Record<string, typeof drinkRows> = {};
  for (const d of drinkRows) {
    if (!drinksByTally[d.tally_id]) drinksByTally[d.tally_id] = [];
    drinksByTally[d.tally_id].push(d);
  }

  // Drink summary
  const drinkSummary: Record<string, number> = {};
  for (const d of drinkRows) {
    drinkSummary[d.item_name] = (drinkSummary[d.item_name] ?? 0) + num(d.qty);
  }

  const expenseRows = expenses.rows ?? [];
  const totalExpensesCents = expenseRows.reduce((s: number, r: any) => s + num(r.total_cents), 0);

  if (tallyRows.length === 0 && expenseRows.length === 0) {
    blockers.push({ code: "NO_PURCHASING_DATA", message: `No purchase_tally or expenses rows for ${date}`, where: "purchase_tally + expenses", canonical_source: "purchase_tally.date + expenses.date" });
  }

  const status = blockers.length > 0 ? (tallyRows.length === 0 && expenseRows.length === 0 ? "missing" : "partial") : "ok";

  return res.json(
    envelope({
      source: "purchase_tally + purchase_tally_drink + expenses",
      scope: `date:${date}`,
      date,
      status,
      data: {
        shift_date: date,
        tally_summary: {
          record_count: tallyRows.length,
          total_rolls_pcs: totalRolls,
          total_meat_g: totalMeatG,
          total_meat_kg: Math.round((totalMeatG / 1000) * 1000) / 1000,
          total_spend_thb: Math.round(totalSpend * 100) / 100,
          drinks_by_sku: drinkSummary,
        },
        tally_records: tallyRows.map((t: any) => ({
          ...t,
          drinks: drinksByTally[t.id] ?? [],
        })),
        expenses_by_category: expenseRows.map((e: any) => ({
          category: e.category,
          supplier: e.supplier,
          total_thb: Math.round(num(e.total_cents) / 100 * 100) / 100,
          item_count: num(e.items),
        })),
        total_expenses_thb: Math.round(totalExpensesCents / 100 * 100) / 100,
        source_status: {
          purchase_tally: tallyRows.length > 0 ? "ok" : "empty",
          expenses_table: expenseRows.length > 0 ? "ok" : "empty",
        },
      },
      blockers,
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// E. FINANCE SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
router.get("/finance-summary", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "finance-summary");
  if (!isValidDate(date)) return badDate(res, "finance-summary");

  const blockers: ReturnType<typeof envelope>["blockers"] = [];
  const warnings: string[] = [];

  const [salesRow, expensesAgg, purchaseAgg] = await Promise.all([
    pool
      .query(
        `SELECT id, "completedBy", "submittedAtISO", payload
         FROM daily_sales_v2 WHERE "shiftDate" = $1
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT
           COALESCE(SUM(amount_cents), 0)::int AS total_cents,
           COUNT(*)::int AS expense_count,
           json_agg(json_build_object('category', category, 'supplier', supplier, 'amount_thb', (amount_cents::numeric / 100))) AS breakdown
         FROM expenses
         WHERE date = $1::date`,
        [date],
      )
      .catch(() => ({ rows: [{ total_cents: 0, expense_count: 0, breakdown: null }] } as any)),
    pool
      .query(
        `SELECT
           COALESCE(SUM(amount_thb)::numeric(12,2), 0) AS total_thb,
           COUNT(*)::int AS records
         FROM purchase_tally
         WHERE date = $1::date`,
        [date],
      )
      .catch(() => ({ rows: [{ total_thb: 0, records: 0 }] } as any)),
  ]);

  const form = salesRow.rows[0] ?? null;
  const sp = form?.payload ?? null;

  if (!form) {
    blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate" });
  }

  const sales_total = fromPayload(sp, "total_sales", "totalSales");
  const wages_total = fromPayload(sp, "wages_total", "wagesTotal", "total_wages");
  const form_expenses = fromPayload(sp, "expenses_total", "expensesTotal", "total_expenses");

  const expRow = expensesAgg.rows[0] ?? {};
  const expenses_total_thb = Math.round(num(expRow.total_cents) / 100 * 100) / 100;

  const purchase_total_thb = Math.round(num(purchaseAgg.rows[0]?.total_thb) * 100) / 100;

  // Simple gross / net estimates
  const gross_profit = sales_total > 0 ? Math.round((sales_total - expenses_total_thb - purchase_total_thb) * 100) / 100 : null;
  const prime_cost_estimate = sales_total > 0 ? Math.round((purchase_total_thb / sales_total) * 10000) / 100 : null;
  const labour_cost_pct = sales_total > 0 && wages_total > 0 ? Math.round((wages_total / sales_total) * 10000) / 100 : null;

  if (!form && expenses_total_thb === 0) {
    warnings.push("No form or expenses data — financial metrics are incomplete");
  }

  const status = !form ? (expenses_total_thb === 0 ? "missing" : "partial") : "ok";

  return res.json(
    envelope({
      source: "daily_sales_v2 + expenses + purchase_tally",
      scope: `date:${date}`,
      date,
      status,
      data: {
        shift_date: date,
        sales: {
          total_thb: sales_total,
          source: form ? "daily_sales_v2" : null,
        },
        expenses: {
          total_thb: expenses_total_thb,
          record_count: num(expRow.expense_count),
          breakdown: expRow.breakdown ?? [],
          source: "expenses table",
        },
        purchasing: {
          total_thb: purchase_total_thb,
          record_count: num(purchaseAgg.rows[0]?.records),
          source: "purchase_tally",
        },
        labour: {
          wages_total_thb: wages_total,
          source: form ? "daily_sales_v2 payload" : null,
        },
        metrics: {
          gross_profit_thb: gross_profit,
          prime_cost_pct: prime_cost_estimate,
          labour_cost_pct,
          note: "Estimates derived from form + expenses + purchase tally. Use /api/bob/read/analysis/prime-cost for full analysis.",
        },
      },
      warnings,
      blockers,
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// F. RECONCILIATION SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
router.get("/reconciliation-summary", async (req, res) => {
  const elapsed = timed();
  const date = req.query.date as string | undefined;
  if (!date) return missingDate(res, "reconciliation-summary");
  if (!isValidDate(date)) return badDate(res, "reconciliation-summary");

  const { shiftDate, fromISO, toISO } = shiftWindow(date);
  const blockers: ReturnType<typeof envelope>["blockers"] = [];
  const warnings: string[] = [];

  const [salesRow, posAgg, issueRows, stockRow] = await Promise.all([
    pool
      .query(
        `SELECT id, "completedBy", payload
         FROM daily_sales_v2 WHERE "shiftDate" = $1
         ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT
           COUNT(*)::int AS receipt_count,
           COUNT(*) FILTER (WHERE receipt_type='SALE')::int AS sale_count,
           COALESCE(SUM(CASE WHEN receipt_type='SALE' THEN total_money ELSE 0 END), 0)::numeric(12,2) AS pos_gross
         FROM lv_receipt
         WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
        [fromISO, toISO],
      )
      .catch(() => ({ rows: [{ receipt_count: 0, sale_count: 0, pos_gross: 0 }] } as any)),
    pool
      .query(
        `SELECT id, issue_type, severity, status, title, description, created_at::text
         FROM ai_issues
         WHERE shift_date = $1::date
         ORDER BY created_at DESC`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
    pool
      .query(
        `SELECT s.payload
         FROM daily_stock_v2 s
         JOIN daily_sales_v2 d ON d.id = s."salesId"
         WHERE d."shiftDate" = $1 LIMIT 1`,
        [date],
      )
      .catch(() => ({ rows: [] } as any)),
  ]);

  const form = salesRow.rows[0] ?? null;
  const sp = form?.payload ?? null;
  const pos = posAgg.rows[0] ?? {};
  const sfp = stockRow.rows[0]?.payload ?? null;

  // Missing data blockers
  if (!form) blockers.push({ code: "SALES_FORM_MISSING", message: `No daily_sales_v2 row for ${date}`, where: "daily_sales_v2", canonical_source: "daily_sales_v2.shiftDate" });
  if (num(pos.receipt_count) === 0) warnings.push(`No POS receipts found in shift window ${fromISO} → ${toISO}`);

  const form_total = fromPayload(sp, "total_sales", "totalSales");
  const form_cash = fromPayload(sp, "cash_sales", "cashSales");
  const form_qr = fromPayload(sp, "qr_sales", "qrSales");
  const form_grab = fromPayload(sp, "grab_sales", "grabSales");
  const pos_gross = num(pos.pos_gross);

  // Sales comparison
  const sales_variance = form_total > 0 && pos_gross > 0 ? Math.round((form_total - pos_gross) * 100) / 100 : null;

  // Stock discrepancy from stock form
  const buns_remaining = fromPayload(sfp, "buns_remaining", "bunsRemaining", "rolls_remaining");
  const meat_remaining_g = fromPayload(sfp, "meat_remaining_g", "meatRemainingG", "meat_remaining");

  // Issue breakdown
  const openIssues = issueRows.rows.filter((i: any) => i.status !== "resolved");
  const resolvedIssues = issueRows.rows.filter((i: any) => i.status === "resolved");

  const hasCritical = openIssues.some((i: any) => i.severity === "critical" || i.severity === "high");
  if (hasCritical) blockers.push({ code: "CRITICAL_ISSUES_OPEN", message: `${openIssues.length} open issue(s) including critical/high severity`, where: "ai_issues", canonical_source: "ai_issues.shift_date" });

  const recon_status = !form ? "missing" : blockers.some((b) => b.code !== "CRITICAL_ISSUES_OPEN") ? "partial" : hasCritical ? "partial" : "ok";

  return res.json(
    envelope({
      source: "daily_sales_v2 + lv_receipt + ai_issues + daily_stock_v2",
      scope: `shift:${shiftDate}`,
      date: shiftDate,
      status: recon_status,
      data: {
        shift_date: shiftDate,
        shift_window: { start: fromISO, end: toISO },
        sales_comparison: {
          form_total_thb: form_total,
          pos_gross_thb: pos_gross,
          variance_thb: sales_variance,
          variance_pct: form_total > 0 && sales_variance !== null ? Math.round((sales_variance / form_total) * 10000) / 100 : null,
          channel_breakdown: {
            form_cash: form_cash,
            form_qr: form_qr,
            form_grab: form_grab,
          },
          source_a: form ? "daily_sales_v2" : null,
          source_b: num(pos.receipt_count) > 0 ? "lv_receipt" : null,
        },
        receipt_comparison: {
          pos_receipt_count: num(pos.receipt_count),
          pos_sale_transactions: num(pos.sale_count),
        },
        stock_discrepancy: {
          buns_remaining: buns_remaining || null,
          meat_remaining_g: meat_remaining_g || null,
          meat_remaining_kg: meat_remaining_g ? Math.round((meat_remaining_g / 1000) * 1000) / 1000 : null,
          source: sfp ? "daily_stock_v2" : null,
        },
        issues: {
          total: issueRows.rows.length,
          open: openIssues.length,
          resolved: resolvedIssues.length,
          critical_or_high: openIssues.filter((i: any) => ["critical", "high"].includes(i.severity)).length,
          issue_list: openIssues.map((i: any) => ({
            id: i.id,
            type: i.issue_type,
            severity: i.severity,
            title: i.title,
            created_at: i.created_at,
          })),
        },
        reconciliation_verdict: {
          sales_match: sales_variance !== null ? Math.abs(sales_variance) < 1 : null,
          has_blockers: blockers.length > 0,
          has_open_issues: openIssues.length > 0,
          overall: recon_status,
        },
        source_attribution: {
          sales_form: "daily_sales_v2",
          pos_receipts: "lv_receipt",
          stock_form: "daily_stock_v2",
          issues: "ai_issues",
        },
      },
      warnings,
      blockers,
    }),
  );
});

// ── Index route ────────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  return res.json(
    envelope({
      source: "agentRead:index",
      scope: "global",
      status: "ok",
      data: {
        namespace: "/api/agent/read",
        version: "1.0",
        endpoints: [
          { path: "/api/agent/read/shift-summary?date=YYYY-MM-DD", purpose: "Shift overview: form sales, POS receipts, status flags, variance" },
          { path: "/api/agent/read/daily-operations?date=YYYY-MM-DD", purpose: "Form-based operations: sales form, stock form, labour" },
          { path: "/api/agent/read/receipt-summary?date=YYYY-MM-DD", purpose: "POS receipt aggregates, top items, category breakdown" },
          { path: "/api/agent/read/purchasing-summary?date=YYYY-MM-DD", purpose: "Purchase tally: rolls, meat, drinks, expenses by category" },
          { path: "/api/agent/read/finance-summary?date=YYYY-MM-DD", purpose: "Financial metrics: sales, expenses, wages, gross profit, prime cost" },
          { path: "/api/agent/read/reconciliation-summary?date=YYYY-MM-DD", purpose: "Reconciliation: form vs POS variance, issues, stock discrepancy" },
        ],
        auth: "Bearer token required (BOB_READONLY_TOKEN or agent_tokens table)",
        governance: ".openclaw/workspace/core/APP_READ_SURFACE.md",
      },
    }),
  );
});

export default router;
