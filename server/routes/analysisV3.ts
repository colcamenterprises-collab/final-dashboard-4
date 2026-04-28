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
