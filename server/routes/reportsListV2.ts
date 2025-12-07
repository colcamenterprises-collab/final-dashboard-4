/**
 * DAILY REPORT V2 — LISTING & RETRIEVAL ROUTES
 *
 * Provides:
 *  - GET /api/reports/list               (list all reports)
 *  - GET /api/reports/:id/json           (get stored JSON)
 *  - GET /api/reports/:id/pdf            (regenerate PDF by ID)
 */

import { Router } from "express";
import { db as drizzleDb } from "../db";
import { sql } from "drizzle-orm";
import { dailyReportsV2 } from "../../shared/schema";
import { buildDailyReportPDF } from "../pdf/dailyReportV2.pdf";
import JSZip from "jszip";

const router = Router();

/**
 * GET /api/reports/list
 * Returns: [{ id, date, createdAt }]
 */
router.get("/list", async (_req, res) => {
  try {
    const rows = await drizzleDb
      .select({
        id: dailyReportsV2.id,
        date: dailyReportsV2.date,
        createdAt: dailyReportsV2.createdAt,
      })
      .from(dailyReportsV2)
      .orderBy(sql`"date" DESC`);

    return res.json({ ok: true, reports: rows });
  } catch (err) {
    console.error("reports/list error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports/:id/json
 * Returns stored JSON for UI viewer
 */
router.get("/:id/json", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [row] = await drizzleDb
      .select()
      .from(dailyReportsV2)
      .where(sql`id = ${id}`)
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ ok: true, report: row.json });
  } catch (err) {
    console.error("reports/:id/json error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports/:id/pdf
 * Regenerates PDF for this report
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [row] = await drizzleDb
      .select()
      .from(dailyReportsV2)
      .where(sql`id = ${id}`)
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Report not found" });
    }

    const pdf = await buildDailyReportPDF(row.json);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="SBB-Daily-${row.date}.pdf"`
    );

    return res.send(pdf);
  } catch (err) {
    console.error("reports/:id/pdf error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports/search
 * Search reports by date or variance flags
 */
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString();
    const list = await drizzleDb
      .select()
      .from(dailyReportsV2);
    
    const filtered = list.filter(r =>
      r.date.includes(q) ||
      JSON.stringify(r.variance || "").toLowerCase().includes(q.toLowerCase())
    );
    
    return res.json({ ok: true, reports: filtered });
  } catch (err) {
    console.error("reports/search error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports/export-range
 * Export reports in a date range as ZIP
 */
router.get("/export-range", async (req, res) => {
  try {
    const start = (req.query.start || "").toString();
    const end = (req.query.end || "").toString();
    
    const rows = await drizzleDb
      .select()
      .from(dailyReportsV2);
    
    const range = rows.filter(r => r.date >= start && r.date <= end);

    const zip = new JSZip();
    for (const r of range) {
      const pdf = await buildDailyReportPDF(r.json);
      zip.file(`${r.date}.pdf`, pdf);
    }
    
    const content = await zip.generateAsync({ type: "nodebuffer" });
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=reports.zip");
    return res.send(content);
  } catch (err) {
    console.error("reports/export-range error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
