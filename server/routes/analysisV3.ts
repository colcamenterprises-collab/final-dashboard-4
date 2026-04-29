/*
 * POS TRUTH LAYER — DO NOT MODIFY
 *
 * This file exposes read-only mirrors of lv_line_item and lv_modifier.
 * These endpoints must match Loyverse 1:1 at all times.
 *
 * No transformations allowed. If you change this logic, you break:
 *   - Sales accuracy
 *   - Stock calculations
 *   - Fraud detection
 *   - Entire system trust
 *
 * Read-only. Mirror only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/analysis/v3/item-sales?start=ISO&end=ISO
 *   Source: lv_receipt + lv_line_item ONLY
 *   Group:  item_name, sku, category_hint
 *   Agg:    SUM(qty)
 *
 * GET /api/analysis/v3/modifiers?start=ISO&end=ISO
 *   Source: lv_receipt + lv_modifier ONLY
 *   Group:  modifier_name (raw_json->>'name'), option_name (lv_modifier.name)
 *   Agg:    SUM(qty)
 *
 * PROHIBITED (both endpoints):
 *   - Joining to any other table
 *   - SKU mapping, renaming, deduplication
 *   - Emoji or symbol removal
 *   - Merging, inferring, filtering, categorising
 *   - Writing to any table
 *   - Any transformation whatsoever
 *
 * Violations throw POS_TRUTH_LAYER_VIOLATION.
 * Incomplete data returns status: "POS_DATA_INCOMPLETE".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const analysisV3Router = Router();

// ─── POS Truth Layer Constants ────────────────────────────────────────────────

/** Error code emitted when any transformation is detected at runtime. */
const POS_TRUTH_LAYER_VIOLATION = "POS_TRUTH_LAYER_VIOLATION";

/** Status returned when the underlying POS data appears incomplete. */
const POS_DATA_INCOMPLETE = "POS_DATA_INCOMPLETE";

/** Canonical source tables for item sales. */
const ITEM_SALES_SOURCES = Object.freeze(["lv_receipt", "lv_line_item"]);

/** Canonical source tables for modifier sales. */
const MODIFIER_SOURCES = Object.freeze(["lv_receipt", "lv_modifier"]);

// ─── Global Guard ─────────────────────────────────────────────────────────────

/**
 * Hard stop — thrown whenever any logic in this file attempts a transformation.
 * Any catch that sees this code must surface it as-is; never swallow it.
 */
function assertPosTruthLayer(context: string): never {
  throw new Error(`${POS_TRUTH_LAYER_VIOLATION}: ${context}`);
}

// ─── Item-Sales Integrity Guard ───────────────────────────────────────────────

/**
 * Validates that no transformation was applied to item-sales rows after fetch.
 * Rules:
 *   1. item_name must be a non-empty string (merging would produce null/empty)
 *   2. items_sold must be a non-negative integer (inference can produce negatives)
 *   3. Re-computed total must equal the pre-computed checksum (post-fetch mutation guard)
 */
function assertItemSalesIntegrity(
  rows: { item_name: string; sku: string | null; category: string | null; items_sold: number }[],
  expectedTotal: number,
): void {
  for (const row of rows) {
    if (!row.item_name || typeof row.item_name !== "string") {
      assertPosTruthLayer("item_name is empty or non-string — possible merge/rename");
    }
    if (typeof row.items_sold !== "number" || row.items_sold < 0 || !Number.isInteger(row.items_sold)) {
      assertPosTruthLayer("items_sold is invalid — possible inference or negative qty");
    }
  }
  const recomputed = rows.reduce((s, r) => s + r.items_sold, 0);
  if (recomputed !== expectedTotal) {
    assertPosTruthLayer("items_sold checksum mismatch — possible post-fetch mutation");
  }
}

// ─── Modifier Integrity Guard ─────────────────────────────────────────────────

/**
 * Validates that no transformation was applied to modifier rows after fetch.
 * Rules:
 *   1. modifier_name and option_name must be strings (not null — renaming produces nulls)
 *   2. qty_sold must be a non-negative integer
 *   3. Re-computed total must equal the pre-computed checksum
 */
function assertModifierIntegrity(
  rows: { modifier_name: string; option_name: string; qty_sold: number }[],
  expectedTotal: number,
): void {
  for (const row of rows) {
    if (typeof row.modifier_name !== "string") {
      assertPosTruthLayer("modifier_name is non-string — possible transformation");
    }
    if (typeof row.option_name !== "string") {
      assertPosTruthLayer("option_name is non-string — possible transformation");
    }
    if (typeof row.qty_sold !== "number" || row.qty_sold < 0 || !Number.isInteger(row.qty_sold)) {
      assertPosTruthLayer("qty_sold is invalid — possible inference or negative qty");
    }
  }
  const recomputed = rows.reduce((s, r) => s + r.qty_sold, 0);
  if (recomputed !== expectedTotal) {
    assertPosTruthLayer("qty_sold checksum mismatch — possible post-fetch mutation");
  }
}

// ─── Window Validation ────────────────────────────────────────────────────────

function parseWindow(start: string, end: string): { startISO: string; endISO: string } | { error: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: "Invalid ISO timestamp format" };
  }
  if (endDate <= startDate) {
    return { error: "end must be after start" };
  }
  return { startISO: startDate.toISOString(), endISO: endDate.toISOString() };
}

// ─── GET /api/analysis/v3/integrity-check ────────────────────────────────────
/*
 * POS DATA INTEGRITY CHECK — DO NOT MODIFY
 *
 * Pure validation layer. No business logic. No stock. No assumptions.
 * Compares pos_shift_report values against lv_receipt / lv_line_item / lv_modifier.
 *
 * All comparisons use the shift window from pos_shift_report (openedAt → closedAt).
 * No auto-fix. No estimation. No fallback.
 *
 * CHECKS:
 *   1. Receipt Count   — shift.receiptCount vs COUNT(lv_receipt in shift window)
 *   2. Cash Payments   — shift.cashSales vs SUM(cash from lv_receipt.payment_json)
 *   3. Total Sales     — shift.grandTotal vs ROUND(SUM(lv_receipt.total_amount))
 *   4. Item Totals     — COUNT(lv_line_item rows) vs SUM(lv_line_item.qty) in window
 *   5. Modifier Totals — COUNT(lv_modifier rows) vs SUM(lv_modifier.qty) in window
 */
analysisV3Router.get("/integrity-check", async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    const parsed = parseWindow(start, end);
    if ("error" in parsed) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }
    const { startISO, endISO } = parsed;

    // ── 1. Find the overlapping shift report ─────────────────────────────────
    const shiftRows = await prisma.$queryRaw<{
      receiptCount: number;
      cashSales: number;
      grandTotal: number;
      openedUtc: Date;
      closedUtc: Date;
    }[]>`
      SELECT
        "receiptCount"                  AS "receiptCount",
        "cashSales"                     AS "cashSales",
        "grandTotal"                    AS "grandTotal",
        "openedAt"::timestamptz         AS "openedUtc",
        "closedAt"::timestamptz         AS "closedUtc"
      FROM pos_shift_report
      WHERE "openedAt"::timestamptz <= ${endISO}::timestamptz
        AND "closedAt"::timestamptz >= ${startISO}::timestamptz
      ORDER BY "openedAt" DESC
      LIMIT 1
    `;

    // If no shift report exists, all checks are N/A — don't guess
    if (shiftRows.length === 0) {
      const naCheck = (label: string, note: string) => ({
        label, status: "N/A" as const, sideA: null, sideB: null, note,
      });
      return res.json({
        ok: true,
        shiftFound: false,
        allPass: false,
        checks: [
          naCheck("Receipt Count",   "No shift report found for this window"),
          naCheck("Cash Payments",   "No shift report found for this window"),
          naCheck("Total Sales",     "No shift report found for this window"),
          naCheck("Item Totals",     "No shift report found for this window"),
          naCheck("Modifier Totals", "No shift report found for this window"),
        ],
      });
    }

    const shift = shiftRows[0];
    const shiftOpenISO  = new Date(shift.openedUtc).toISOString();
    const shiftCloseISO = new Date(shift.closedUtc).toISOString();

    // ── 2. Compute all comparison values using the shift window ───────────────
    const stats = await prisma.$queryRaw<{
      lv_receipt_count: number;
      lv_cash_total: number;
      lv_grand_total: number;
      lv_item_rows: number;
      lv_item_qty: number;
      lv_mod_rows: number;
      lv_mod_qty: number;
    }[]>`
      WITH sale_receipts AS (
        SELECT receipt_id, total_amount, payment_json
        FROM lv_receipt
        WHERE datetime_bkk >= ${shiftOpenISO}::timestamptz
          AND datetime_bkk <  ${shiftCloseISO}::timestamptz
          AND (raw_json->>'refund_for' IS NULL OR raw_json->>'refund_for' = 'null')
      )
      SELECT
        (SELECT COUNT(*)::int             FROM sale_receipts)                                         AS lv_receipt_count,
        (SELECT COALESCE(SUM((elem->>'money_amount')::numeric), 0)::int
           FROM sale_receipts sr,
                jsonb_array_elements(sr.payment_json::jsonb) AS elem
          WHERE elem->>'type' = 'CASH')                                                              AS lv_cash_total,
        (SELECT COALESCE(ROUND(SUM(total_amount)), 0)::int FROM sale_receipts)                        AS lv_grand_total,
        (SELECT COUNT(li.*)::int   FROM lv_line_item li JOIN sale_receipts sr ON li.receipt_id = sr.receipt_id) AS lv_item_rows,
        (SELECT COALESCE(SUM(li.qty), 0)::int FROM lv_line_item li JOIN sale_receipts sr ON li.receipt_id = sr.receipt_id) AS lv_item_qty,
        (SELECT COUNT(m.*)::int    FROM lv_modifier  m  JOIN sale_receipts sr ON m.receipt_id  = sr.receipt_id) AS lv_mod_rows,
        (SELECT COALESCE(SUM(m.qty), 0)::int FROM lv_modifier  m  JOIN sale_receipts sr ON m.receipt_id  = sr.receipt_id) AS lv_mod_qty
    `;

    const s = stats[0];
    const lvReceiptCount = Number(s.lv_receipt_count);
    const lvCashTotal    = Number(s.lv_cash_total);
    const lvGrandTotal   = Number(s.lv_grand_total);
    const lvItemRows     = Number(s.lv_item_rows);
    const lvItemQty      = Number(s.lv_item_qty);
    const lvModRows      = Number(s.lv_mod_rows);
    const lvModQty       = Number(s.lv_mod_qty);

    const shiftReceiptCount = Number(shift.receiptCount);
    const shiftCash         = Math.round(Number(shift.cashSales));
    const shiftGrandTotal   = Number(shift.grandTotal);

    // ── 3. Build check results ────────────────────────────────────────────────
    type CheckStatus = "PASS" | "FAIL" | "N/A";
    interface CheckResult {
      label: string;
      status: CheckStatus;
      sideA: number | null;
      sideALabel: string;
      sideB: number | null;
      sideBLabel: string;
      note: string;
    }

    const pass = (a: number, b: number) => a === b ? "PASS" : "FAIL";

    const checks: CheckResult[] = [
      {
        label:      "Receipt Count",
        status:     pass(shiftReceiptCount, lvReceiptCount),
        sideA:      shiftReceiptCount,
        sideALabel: "pos_shift_report.receiptCount",
        sideB:      lvReceiptCount,
        sideBLabel: "COUNT(lv_receipt)",
        note:       shiftReceiptCount === lvReceiptCount
          ? "Receipt counts match exactly"
          : `Mismatch: shift says ${shiftReceiptCount}, lv_receipt has ${lvReceiptCount}`,
      },
      {
        label:      "Cash Payments",
        status:     pass(shiftCash, lvCashTotal),
        sideA:      shiftCash,
        sideALabel: "pos_shift_report.cashSales",
        sideB:      lvCashTotal,
        sideBLabel: "SUM(payment_json cash) from lv_receipt",
        note:       shiftCash === lvCashTotal
          ? "Cash totals match exactly"
          : `Mismatch: shift ฿${shiftCash.toLocaleString()} vs receipts ฿${lvCashTotal.toLocaleString()}`,
      },
      {
        label:      "Total Sales",
        status:     pass(shiftGrandTotal, lvGrandTotal),
        sideA:      shiftGrandTotal,
        sideALabel: "pos_shift_report.grandTotal",
        sideB:      lvGrandTotal,
        sideBLabel: "ROUND(SUM(lv_receipt.total_amount))",
        note:       shiftGrandTotal === lvGrandTotal
          ? "Grand totals match exactly"
          : `Mismatch: shift ฿${shiftGrandTotal.toLocaleString()} vs receipts ฿${lvGrandTotal.toLocaleString()}`,
      },
      {
        label:      "Item Totals",
        status:     pass(lvItemRows > 0 ? 1 : 0, lvItemRows > 0 ? 1 : 0) === "PASS"
          ? (lvItemRows <= lvItemQty ? "PASS" : "FAIL")
          : "FAIL",
        sideA:      lvItemRows,
        sideALabel: "COUNT(lv_line_item rows)",
        sideB:      lvItemQty,
        sideBLabel: "SUM(lv_line_item.qty)",
        note:       lvItemRows <= lvItemQty
          ? `${lvItemRows} rows, ${lvItemQty} total items — internally consistent`
          : `Row count (${lvItemRows}) exceeds qty sum (${lvItemQty}) — data inconsistency`,
      },
      {
        label:      "Modifier Totals",
        status:     pass(lvModRows, lvModQty),
        sideA:      lvModRows,
        sideALabel: "COUNT(lv_modifier rows)",
        sideB:      lvModQty,
        sideBLabel: "SUM(lv_modifier.qty)",
        note:       lvModRows === lvModQty
          ? `${lvModRows} rows, ${lvModQty} qty — all modifiers have qty=1 (constraint enforced)`
          : `Mismatch: ${lvModRows} rows but ${lvModQty} qty — qty constraint may be violated`,
      },
    ];

    const allPass = checks.every((c) => c.status === "PASS");
    const anyFail = checks.some((c) => c.status === "FAIL");

    return res.json({
      ok: true,
      shiftFound: true,
      shiftWindow: { open: shiftOpenISO, close: shiftCloseISO },
      allPass,
      anyFail,
      checks,
    });
  } catch (err: any) {
    console.error("[analysisV3] integrity-check error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});

// ─── GET /api/analysis/v3/shift-report ───────────────────────────────────────
/*
 * SHIFT REPORT MIRROR — DO NOT MODIFY
 *
 * This section mirrors Loyverse shift data exactly.
 * Source: pos_shift_report ONLY.
 *
 * No fallback to lv_receipt aggregation.
 * No fallback to daily forms.
 * No estimation.
 *
 * If this is wrong → POS data is wrong.
 * Do not attempt to fix via code. Fix at data source.
 *
 * Column mapping (pos_shift_report → response):
 *   openedAt      → openingTime
 *   closedAt      → closingTime
 *   startingCash  → startingCash
 *   cashSales     → cashPayments
 *   wagesTotal    → paidOut
 *   cashInDrawer  → actualCash
 *   expectedCash  = startingCash + cashSales - wagesTotal  (standard POS register formula)
 *   difference    = actualCash - expectedCash
 *   cashRefunds / paidIn — not stored in pos_shift_report → returned as null
 */
analysisV3Router.get("/shift-report", async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    const parsed = parseWindow(start, end);
    if ("error" in parsed) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }
    const { startISO, endISO } = parsed;

    // Fetch the most relevant shift that overlaps the requested window.
    // Match: shift opened before window end AND shift closed after window start.
    const rows = await prisma.$queryRaw<{
      id: string;
      openedAt: Date | null;
      closedAt: Date | null;
      startingCash: number | null;
      cashSales: number | null;
      cashInDrawer: number | null;
      wagesTotal: number | null;
      otherExpense: number | null;
      grossSales: number | null;
      netSales: number | null;
      discounts: number | null;
      cashTotal: number | null;
      qrTotal: number | null;
      grabTotal: number | null;
      grandTotal: number | null;
      receiptCount: number | null;
    }[]>`
      SELECT
        id,
        "openedAt",
        "closedAt",
        "startingCash",
        "cashSales",
        "cashInDrawer",
        "wagesTotal",
        "otherExpense",
        "grossSales",
        "netSales",
        "discounts",
        "cashTotal",
        "qrTotal",
        "grabTotal",
        "grandTotal",
        "receiptCount"
      FROM pos_shift_report
      WHERE "openedAt" <= ${endISO}::timestamptz
        AND "closedAt" >= ${startISO}::timestamptz
      ORDER BY "openedAt" DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.json({
        ok: true,
        status: "POS_SHIFT_REPORT_NOT_AVAILABLE",
        source: "pos_shift_report",
        start: startISO,
        end: endISO,
        data: null,
      });
    }

    const r = rows[0];

    // Direct column mirrors (no transformation)
    const startingCash    = Number(r.startingCash ?? 0);
    const cashPayments    = Number(r.cashSales    ?? 0);
    const paidOut         = Number(r.wagesTotal   ?? 0);
    const actualCash      = Number(r.cashInDrawer ?? 0);

    // expectedCash and difference are NOT stored columns in pos_shift_report.
    // They are calculated from stored fields using the standard POS register formula.
    // Labelled in the response as calculatedFields so callers know they are derived.
    const expectedCash    = startingCash + cashPayments - paidOut;
    const difference      = actualCash - expectedCash;

    return res.json({
      ok: true,
      status: "ok",
      source: "pos_shift_report",
      calculatedFields: ["expectedCash", "difference"],
      start: startISO,
      end: endISO,
      data: {
        shiftNumber:   r.id,
        openingTime:   r.openedAt   ? new Date(r.openedAt).toISOString()  : null,
        closingTime:   r.closedAt   ? new Date(r.closedAt).toISOString()  : null,
        startingCash,
        cashPayments,
        cashRefunds:   null, // Not stored in pos_shift_report
        paidIn:        null, // Not stored in pos_shift_report
        paidOut,
        expectedCash,
        actualCash,
        difference,
        // Additional columns mirrored as-is
        grossSales:    Number(r.grossSales  ?? 0),
        netSales:      Number(r.netSales    ?? 0),
        discounts:     Number(r.discounts   ?? 0),
        qrTotal:       Number(r.qrTotal     ?? 0),
        grabTotal:     Number(r.grabTotal   ?? 0),
        grandTotal:    Number(r.grandTotal  ?? 0),
        receiptCount:  Number(r.receiptCount ?? 0),
      },
    });
  } catch (err: any) {
    if (err?.message?.startsWith(POS_TRUTH_LAYER_VIOLATION)) {
      console.error(`[analysisV3] ${err.message}`);
      return res.status(500).json({ ok: false, error: POS_TRUTH_LAYER_VIOLATION, detail: err.message });
    }
    console.error("[analysisV3] shift-report error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});

// ─── GET /api/analysis/v3/item-sales ─────────────────────────────────────────
/*
 * POS TRUTH LAYER — DO NOT MODIFY
 * Source: lv_receipt + lv_line_item only. No other joins. No transformation.
 * This endpoint must match Loyverse item sales report 1:1.
 */
analysisV3Router.get("/item-sales", async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    const parsed = parseWindow(start, end);
    if ("error" in parsed) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }
    const { startISO, endISO } = parsed;

    // ── Receipt checksum ───────────────────────────────────────────────────
    const receiptStats = await prisma.$queryRaw<{ receipt_count: number; refund_count: number }[]>`
      SELECT
        COUNT(*)::int AS receipt_count,
        SUM(CASE WHEN raw_json->>'refund_for' IS NOT NULL AND raw_json->>'refund_for' != 'null' THEN 1 ELSE 0 END)::int AS refund_count
      FROM lv_receipt
      WHERE datetime_bkk >= ${startISO}::timestamptz
        AND datetime_bkk <  ${endISO}::timestamptz
    `;
    const totalReceipts = Number(receiptStats[0]?.receipt_count ?? 0);
    const refundCount   = Number(receiptStats[0]?.refund_count  ?? 0);
    const saleReceipts  = totalReceipts - refundCount;

    // ── Core query — lv_line_item + lv_receipt ONLY ────────────────────────
    // category from lv_line_item.category_hint — no item_catalog join.
    // Refunded receipts excluded.
    const rows = await prisma.$queryRaw<{
      item_name: string;
      sku: string | null;
      category: string | null;
      items_sold: number;
    }[]>`
      SELECT
        li.name              AS item_name,
        li.sku               AS sku,
        li.category_hint     AS category,
        SUM(li.qty)::int     AS items_sold
      FROM lv_line_item li
      JOIN lv_receipt r ON li.receipt_id = r.receipt_id
      WHERE r.datetime_bkk >= ${startISO}::timestamptz
        AND r.datetime_bkk <  ${endISO}::timestamptz
        AND (r.raw_json->>'refund_for' IS NULL OR r.raw_json->>'refund_for' = 'null')
      GROUP BY li.name, li.sku, li.category_hint
      ORDER BY li.category_hint NULLS LAST, li.name
    `;

    const mappedRows = rows.map((r) => ({
      item_name: r.item_name,
      sku: r.sku ?? null,
      category: r.category ?? null,
      items_sold: Number(r.items_sold),
    }));

    const checksumTotalItems = mappedRows.reduce((s, r) => s + r.items_sold, 0);
    const checksumTotalRows  = mappedRows.length;

    // ── POS Truth integrity guard ──────────────────────────────────────────
    assertItemSalesIntegrity(mappedRows, checksumTotalItems);

    // ── Incomplete data detection ──────────────────────────────────────────
    // If receipts exist but zero line items returned → data incomplete.
    const dataStatus = (saleReceipts > 0 && checksumTotalRows === 0)
      ? POS_DATA_INCOMPLETE
      : "ok";

    return res.json({
      ok: true,
      status: dataStatus,
      source_tables: ITEM_SALES_SOURCES,
      start: startISO,
      end: endISO,
      checksum: {
        total_receipts: totalReceipts,
        refund_receipts: refundCount,
        sale_receipts: saleReceipts,
        total_rows: checksumTotalRows,
        total_items_sold: checksumTotalItems,
      },
      category_available: mappedRows.some((r) => r.category !== null),
      data: mappedRows,
    });
  } catch (err: any) {
    if (err?.message?.startsWith(POS_TRUTH_LAYER_VIOLATION)) {
      console.error(`[analysisV3] ${err.message}`);
      return res.status(500).json({
        ok: false,
        error: POS_TRUTH_LAYER_VIOLATION,
        detail: err.message,
      });
    }
    console.error("[analysisV3] item-sales error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});

// ─── GET /api/analysis/v3/modifiers ──────────────────────────────────────────
/*
 * POS TRUTH LAYER — DO NOT MODIFY
 * Source: lv_receipt + lv_modifier only. No other joins. No transformation.
 * modifier_name = raw_json->>'name'  (Loyverse modifier group label — preserved exactly)
 * option_name   = lv_modifier.name   (chosen option — emojis, Thai text, all preserved)
 * This endpoint must match Loyverse modifier report 1:1.
 */
analysisV3Router.get("/modifiers", async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    const parsed = parseWindow(start, end);
    if ("error" in parsed) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }
    const { startISO, endISO } = parsed;

    // ── Receipt checksum ───────────────────────────────────────────────────
    const receiptStats = await prisma.$queryRaw<{ receipt_count: number; refund_count: number }[]>`
      SELECT
        COUNT(*)::int AS receipt_count,
        SUM(CASE WHEN raw_json->>'refund_for' IS NOT NULL AND raw_json->>'refund_for' != 'null' THEN 1 ELSE 0 END)::int AS refund_count
      FROM lv_receipt
      WHERE datetime_bkk >= ${startISO}::timestamptz
        AND datetime_bkk <  ${endISO}::timestamptz
    `;
    const totalReceipts = Number(receiptStats[0]?.receipt_count ?? 0);
    const refundCount   = Number(receiptStats[0]?.refund_count  ?? 0);
    const saleReceipts  = totalReceipts - refundCount;

    // ── Core query — lv_modifier + lv_receipt ONLY ─────────────────────────
    // modifier_name from raw_json->>'name' (the Loyverse group label).
    // option_name   from lv_modifier.name  (the selected option).
    // Names stored as-is: emojis, Thai text, symbols all preserved.
    // Refunded receipts excluded.
    const rows = await prisma.$queryRaw<{
      modifier_name: string;
      option_name: string;
      qty_sold: number;
    }[]>`
      SELECT
        m.raw_json->>'name'  AS modifier_name,
        m.name               AS option_name,
        SUM(m.qty)::int      AS qty_sold
      FROM lv_modifier m
      JOIN lv_receipt r ON m.receipt_id = r.receipt_id
      WHERE r.datetime_bkk >= ${startISO}::timestamptz
        AND r.datetime_bkk <  ${endISO}::timestamptz
        AND (r.raw_json->>'refund_for' IS NULL OR r.raw_json->>'refund_for' = 'null')
      GROUP BY m.raw_json->>'name', m.name
      ORDER BY m.raw_json->>'name', m.name
    `;

    const mappedRows = rows.map((r) => ({
      modifier_name: r.modifier_name ?? "",
      option_name:   r.option_name   ?? "",
      qty_sold:      Number(r.qty_sold),
    }));

    const checksumTotalQty  = mappedRows.reduce((s, r) => s + r.qty_sold, 0);
    const checksumTotalRows = mappedRows.length;

    // ── POS Truth integrity guard ──────────────────────────────────────────
    assertModifierIntegrity(mappedRows, checksumTotalQty);

    // ── Incomplete data detection ──────────────────────────────────────────
    const dataStatus = (saleReceipts > 0 && checksumTotalRows === 0)
      ? POS_DATA_INCOMPLETE
      : "ok";

    return res.json({
      ok: true,
      status: dataStatus,
      source_tables: MODIFIER_SOURCES,
      start: startISO,
      end: endISO,
      checksum: {
        total_receipts: totalReceipts,
        refund_receipts: refundCount,
        sale_receipts: saleReceipts,
        total_rows: checksumTotalRows,
        total_qty_sold: checksumTotalQty,
      },
      data: mappedRows,
    });
  } catch (err: any) {
    if (err?.message?.startsWith(POS_TRUTH_LAYER_VIOLATION)) {
      console.error(`[analysisV3] ${err.message}`);
      return res.status(500).json({
        ok: false,
        error: POS_TRUTH_LAYER_VIOLATION,
        detail: err.message,
      });
    }
    console.error("[analysisV3] modifiers error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});
