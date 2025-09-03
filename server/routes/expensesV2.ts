import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { db } from "../db";
import { expenses } from "../../shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import { parse as csvParse } from "csv-parse/sync";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Manual entry (Business + Stock)
router.post("/", async (req, res) => {
  try {
    const { date, supplier, amount, category, items, notes, type, qty, paid, weightKg, weightG, drinkType, meatType } = req.body;

    const values: any = {
      date: new Date(date || new Date()),
      supplier,
      category,
      description: items || type || "",
      amount: String(Number(amount || 0)),
      amountMinor: Math.round(Number(amount || 0) * 100), // THB → cents
      currency: "THB",
      source: "MANUAL",
      descriptionRaw: items || type || "",
    };

    // Add stock-specific fields into notes for traceability
    if (type === "Rolls") {
      values.notes = `Qty: ${qty}, Paid: ${paid}, Amount: ${amount} ${notes || ""}`;
    }
    if (type === "Meat") {
      values.notes = `Type: ${meatType}, ${weightKg}kg ${weightG}g, Supplier: ${supplier} ${notes || ""}`;
    }
    if (type === "Drinks") {
      values.notes = `Type: ${drinkType}, Qty: ${qty} ${notes || ""}`;
    }

    const inserted = await db.insert(expenses).values(values).returning();
    res.json({ ok: true, expense: inserted[0] });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// Upload + parse (PDF, CSV, Image)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // PDF
    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(fs.readFileSync(req.file.path));
      const lines = pdfData.text.split("\n").filter(l => l.trim() !== "");
      return res.json({ ok: true, type: "pdf", parsed: lines.map((l, i) => ({ id: i, raw: l })) });
    }

    // CSV
    if (req.file.mimetype.includes("csv")) {
      const content = fs.readFileSync(req.file.path, "utf8");
      const records = csvParse(content, { columns: true, skip_empty_lines: true });
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

// Approve parsed item → save to DB
router.post("/approve", async (req, res) => {
  try {
    const { date, supplier, amount, category, items, notes } = req.body;

    const inserted = await db.insert(expenses).values({
      date: new Date(date),
      supplier,
      category,
      description: items,
      amount: String(Number(amount)),
      amountMinor: Math.round(Number(amount) * 100),
      currency: "THB",
      source: "UPLOAD",
      descriptionRaw: items,
      notes,
    }).returning();

    res.json({ ok: true, expense: inserted[0] });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Failed to approve expense" });
  }
});

// List expenses with totals
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    let results;

    if (month && year) {
      results = await db.select().from(expenses).where(sql`EXTRACT(MONTH FROM date) = ${month} AND EXTRACT(YEAR FROM date) = ${year}`);
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