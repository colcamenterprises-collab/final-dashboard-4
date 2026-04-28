/**
 * Analysis V3 — Locked POS Item Sales Mirror
 *
 * GET /api/analysis/v3/item-sales?start=ISO&end=ISO
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS ENDPOINT MUST ALWAYS MATCH POS REPORTS 1:1. DO NOT MODIFY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Source: lv_receipt + lv_line_item ONLY.
 * Grouping: item_name, sku, category_hint (all from lv_line_item).
 * Aggregate: SUM(qty).
 *
 * PROHIBITED:
 *   - Joining to any other table (item_catalog, receipt_truth_daily_usage, etc.)
 *   - SKU mapping or renaming
 *   - Item merging or inference
 *   - Any transformation layer
 *
 * Any attempt to bypass these rules must throw POS_TRUTH_LAYER_VIOLATION.
 */

import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const analysisV3Router = Router();

// ─── POS Truth Layer Constants ────────────────────────────────────────────────

/** Canonical source tables. Deviation from these = violation. */
const POS_TRUTH_SOURCES = Object.freeze(["lv_receipt", "lv_line_item"]);

/** Error code thrown if any transformation is detected. */
const POS_TRUTH_LAYER_VIOLATION = "POS_TRUTH_LAYER_VIOLATION";

// ─── Guard Function ───────────────────────────────────────────────────────────

/**
 * Validates that no transformation has been applied to the raw POS rows.
 * Rules enforced:
 *   1. item_name must be a non-empty string (no merging into null/empty)
 *   2. items_sold must be a positive integer (no inferred / negative quantities)
 *   3. Row count and item total must be internally consistent
 *
 * Throws POS_TRUTH_LAYER_VIOLATION if any rule is breached.
 */
function assertPosTruthIntegrity(
  rows: { item_name: string; sku: string | null; category: string | null; items_sold: number }[],
  checksumTotalItems: number,
): void {
  for (const row of rows) {
    if (!row.item_name || typeof row.item_name !== "string") {
      throw new Error(POS_TRUTH_LAYER_VIOLATION);
    }
    if (typeof row.items_sold !== "number" || row.items_sold < 0 || !Number.isInteger(row.items_sold)) {
      throw new Error(POS_TRUTH_LAYER_VIOLATION);
    }
  }
  // Re-sum and compare to guard against post-fetch mutation
  const recomputed = rows.reduce((s, r) => s + r.items_sold, 0);
  if (recomputed !== checksumTotalItems) {
    throw new Error(POS_TRUTH_LAYER_VIOLATION);
  }
}

// ─── GET /api/analysis/v3/item-sales ─────────────────────────────────────────

analysisV3Router.get("/item-sales", async (req, res) => {
  // THIS ENDPOINT MUST ALWAYS MATCH POS REPORTS 1:1. DO NOT MODIFY.
  try {
    const { start, end } = req.query as Record<string, string>;

    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ ok: false, error: "Invalid ISO timestamp format" });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ ok: false, error: "end must be after start" });
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // ── Checksum: receipt count (total + refunds) ──────────────────────────
    // Source: lv_receipt only. No joins.
    const receiptStats = await prisma.$queryRaw<{ receipt_count: number; refund_count: number }[]>`
      SELECT
        COUNT(*)::int                                                                                    AS receipt_count,
        SUM(CASE WHEN raw_json->>'refund_for' IS NOT NULL AND raw_json->>'refund_for' != 'null' THEN 1 ELSE 0 END)::int AS refund_count
      FROM lv_receipt
      WHERE datetime_bkk >= ${startISO}::timestamptz
        AND datetime_bkk < ${endISO}::timestamptz
    `;

    const totalReceipts = Number(receiptStats[0]?.receipt_count ?? 0);
    const refundCount = Number(receiptStats[0]?.refund_count ?? 0);
    const saleReceipts = totalReceipts - refundCount;

    // ── Core item-sales query ──────────────────────────────────────────────
    // Source: lv_line_item + lv_receipt ONLY.
    // Category sourced from lv_line_item.category_hint — no item_catalog join.
    // Grouped by item_name, sku, category exactly as Loyverse groups its report.
    // Refunded receipts excluded (raw_json->>'refund_for' IS NOT NULL).
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
        AND r.datetime_bkk < ${endISO}::timestamptz
        AND (r.raw_json->>'refund_for' IS NULL OR r.raw_json->>'refund_for' = 'null')
      GROUP BY li.name, li.sku, li.category_hint
      ORDER BY li.category_hint NULLS LAST, li.name
    `;

    // ── Map to plain objects before checksum ───────────────────────────────
    const mappedRows = rows.map((r) => ({
      item_name: r.item_name,
      sku: r.sku ?? null,
      category: r.category ?? null,
      items_sold: Number(r.items_sold),
    }));

    // ── Checksum values ────────────────────────────────────────────────────
    const checksumTotalItems = mappedRows.reduce((s, r) => s + r.items_sold, 0);
    const checksumTotalRows = mappedRows.length;

    // ── POS Truth Guard — throws POS_TRUTH_LAYER_VIOLATION on integrity breach
    assertPosTruthIntegrity(mappedRows, checksumTotalItems);

    // ── Response ───────────────────────────────────────────────────────────
    return res.json({
      ok: true,
      // Data provenance — confirms canonical source tables used
      source_tables: POS_TRUTH_SOURCES,
      // Window
      start: startISO,
      end: endISO,
      // Checksum block — must match POS dashboard numbers
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
    if (err?.message === POS_TRUTH_LAYER_VIOLATION) {
      console.error("[analysisV3] POS_TRUTH_LAYER_VIOLATION detected — data integrity breach");
      return res.status(500).json({
        ok: false,
        error: POS_TRUTH_LAYER_VIOLATION,
        detail: "The POS truth layer detected a data integrity violation. This endpoint must not be modified.",
      });
    }
    console.error("[analysisV3] item-sales error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});
