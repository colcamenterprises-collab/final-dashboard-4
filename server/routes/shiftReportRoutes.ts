// PATCH 1 — SHIFT REPORT ROUTES SKELETON
// STRICT: No business logic yet.

import { Router } from "express";
import { db } from "../lib/prisma";
import { buildShiftReport } from "../services/shiftReportBuilder";

const router = Router();

// Generate manually (later auto-scheduled)
router.post("/generate", async (req, res) => {
  try {
    const { shiftDate } = req.body;

    if (!shiftDate) {
      return res.status(400).json({ error: "shiftDate is required" });
    }

    const report = await buildShiftReport(new Date(shiftDate));
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

export default router;
