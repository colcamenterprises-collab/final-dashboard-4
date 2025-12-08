// PATCH 1+2 — SHIFT REPORT ROUTES
// Business logic added in Patch 2.

import { Router } from "express";
import { db } from "../lib/prisma";
import { buildShiftReport } from "../services/shiftReportBuilder";
import { generateShiftReportPDF } from "../services/shiftReportPDF";

const router = Router();

// Generate manually (later auto-scheduled)
router.post("/generate", async (req, res) => {
  try {
    const { shiftDate } = req.body;

    if (!shiftDate) {
      return res.status(400).json({ error: "shiftDate is required" });
    }

    const date = new Date(shiftDate);

    const report = await buildShiftReport(date);
    return res.json({ success: true, report });
  } catch (err) {
    console.error("Shift Report generation error:", err);
    res.status(500).json({ error: "Failed to generate shift report" });
  }
});

// Fetch latest shift report
router.get("/latest", async (req, res) => {
  try {
    const prisma = db();
    const report = await prisma.shift_report_v2.findFirst({
      orderBy: { createdAt: "desc" },
    });

    res.json(report || null);
  } catch (err) {
    console.error("Fetch latest shift report error:", err);
    res.status(500).json({ error: "Failed to fetch latest shift report" });
  }
});

// Fetch history
router.get("/history", async (req, res) => {
  try {
    const prisma = db();
    const list = await prisma.shift_report_v2.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({ reports: list });
  } catch (err) {
    console.error("Fetch shift report history error:", err);
    res.status(500).json({ error: "Failed to fetch report history" });
  }
});

// Fetch by ID
router.get("/view/:id", async (req, res) => {
  try {
    const prisma = db();
    const report = await prisma.shift_report_v2.findUnique({
      where: { id: req.params.id },
    });

    res.json(report || null);
  } catch (err) {
    console.error("Fetch report error:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// PDF Export
router.get("/pdf/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const pdfStream = await generateShiftReportPDF(id);

    if (!pdfStream) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=shift-report-${id}.pdf`
    );

    pdfStream.pipe(res);
  } catch (err) {
    console.error("Shift Report PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;
