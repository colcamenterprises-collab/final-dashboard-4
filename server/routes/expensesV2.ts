import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { db } from "../db";
import { expenses } from "../../shared/schema";
import { sql } from "drizzle-orm";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Manual entry: stock + general
router.post("/", async (req, res) => {
  try {
    const { date, type, supplier, description, amount, category } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const inserted = await db
      .insert(expenses)
      .values({
        date: new Date(date),
        typeOfExpense: type,
        supplier,
        description,
        amount: String(Number(amount)), // store as decimal string
        category,
        source: "MANUAL",
        descriptionRaw: description || `${type} - ${supplier}`,
        amountMinor: Math.round(Number(amount) * 100), // store in minor units
        currency: "THB"
      })
      .returning();

    res.json({ ok: true, expense: inserted[0] });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// File upload + parse (PDF, CSV, Images)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // PDF
    if (req.file.mimetype === "application/pdf") {
      const fs = require('fs');
      const pdfBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(pdfBuffer);
      const lines = pdfData.text.split("\n").filter(l => l.trim() !== "");
      return res.json({ ok: true, type: "pdf", parsed: lines });
    }

    // CSV
    if (req.file.mimetype === "text/csv") {
      const csv = require("csv-parse/sync");
      const fs = require("fs");
      const content = fs.readFileSync(req.file.path, "utf8");
      const records = csv.parse(content, { columns: true, skip_empty_lines: true });
      return res.json({ ok: true, type: "csv", parsed: records });
    }

    // Images (PNG/JPG)
    if (req.file.mimetype.startsWith("image/")) {
      return res.json({ ok: true, type: "image", path: req.file.path });
    }

    res.json({ ok: false, error: "Unsupported file type" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// List expenses with filters + totals
router.get("/", async (req, res) => {
  try {
    const { start, end } = req.query;

    let results;
    if (start && end) {
      results = await db.select().from(expenses).where(sql`date BETWEEN ${start} AND ${end}`);
    } else {
      results = await db.select().from(expenses);
    }

    const total = results.reduce((sum, r) => sum + (r.amountMinor || 0), 0);

    res.json({ ok: true, expenses: results, total });
  } catch (err) {
    console.error("List expenses error:", err);
    res.status(500).json({ error: "Failed to list expenses" });
  }
});

export { router as expensesV2Router };