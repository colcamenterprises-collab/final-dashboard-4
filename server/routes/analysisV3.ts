/**
 * Analysis V3 — Raw POS Item Sales Mirror
 *
 * GET /api/analysis/v3/item-sales?start=ISO&end=ISO
 *
 * Source: lv_receipt + lv_line_item only.
 * No stock, no recipes, no variance, no modifiers, no inference.
 * Output must match Loyverse item sales report exactly.
 *
 * Cancelled/refunded receipts excluded (raw_json->>'refund_for' IS NOT NULL).
 * Category from item_catalog JOIN (null if catalog empty — shown as "—" in UI).
 */

import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const analysisV3Router = Router();

// ─── GET /api/analysis/v3/item-sales ──────────────────────────────────────────
analysisV3Router.get("/item-sales", async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;

    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start and end ISO timestamps required" });
    }

    // Validate ISO format
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

    // Count total receipts in window
    const receiptStats = await prisma.$queryRaw<{ receipt_count: number; refund_count: number }[]>`
      SELECT
        COUNT(*)::int AS receipt_count,
        SUM(CASE WHEN raw_json->>'refund_for' IS NOT NULL AND raw_json->>'refund_for' != 'null' THEN 1 ELSE 0 END)::int AS refund_count
      FROM lv_receipt
      WHERE datetime_bkk >= ${startISO}::timestamptz
        AND datetime_bkk < ${endISO}::timestamptz
    `;

    const receiptCount = Number(receiptStats[0]?.receipt_count ?? 0);
    const refundCount = Number(receiptStats[0]?.refund_count ?? 0);

    // Core query — source: lv_line_item + lv_receipt + item_catalog (LEFT JOIN)
    // Group by SKU + name + category to match Loyverse item sales report grouping.
    // Refunded receipts excluded (matches Loyverse exclusion behaviour).
    const rows = await prisma.$queryRaw<{
      item_name: string;
      sku: string | null;
      category: string | null;
      items_sold: number;
    }[]>`
      SELECT
        li.name        AS item_name,
        li.sku         AS sku,
        ic.category    AS category,
        SUM(li.qty)::int AS items_sold
      FROM lv_line_item li
      JOIN lv_receipt r ON li.receipt_id = r.receipt_id
      LEFT JOIN item_catalog ic ON ic.sku = li.sku
      WHERE r.datetime_bkk >= ${startISO}::timestamptz
        AND r.datetime_bkk < ${endISO}::timestamptz
        AND (r.raw_json->>'refund_for' IS NULL OR r.raw_json->>'refund_for' = 'null')
      GROUP BY li.name, li.sku, ic.category
      ORDER BY ic.category NULLS LAST, li.name
    `;

    const totalItems = rows.reduce((s, r) => s + Number(r.items_sold), 0);
    const categoryAvailable = rows.some((r) => r.category !== null);

    return res.json({
      ok: true,
      start: startISO,
      end: endISO,
      receipt_count: receiptCount,
      refund_count: refundCount,
      row_count: rows.length,
      total_items_sold: totalItems,
      category_available: categoryAvailable,
      data: rows.map((r) => ({
        item_name: r.item_name,
        sku: r.sku ?? null,
        category: r.category ?? null,
        items_sold: Number(r.items_sold),
      })),
    });
  } catch (err: any) {
    console.error("[analysisV3] item-sales error:", err.message);
    return res.status(500).json({ ok: false, error: err.message ?? "Internal error" });
  }
});
