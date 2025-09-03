import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { db } from "../db";
import { expenses } from "../../shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { expenseMappings } from "../config/expenseMappings";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Utility: map supplier + category
function mapExpense(description: string) {
  for (const rule of expenseMappings) {
    if (rule.keywords.some(k => description.includes(k))) {
      return { supplier: rule.supplier, category: rule.category };
    }
  }
  return { supplier: "Other", category: "Uncategorised" };
}

// Manual entry
router.post("/", async (req, res) => {
  try {
    const { date, supplier, amount, category, items, notes } = req.body;

    const inserted = await db.insert(expenses).values({
      date: new Date(date),
      supplier,
      category,
      description: items,
      amount: String(Number(amount)),
      amountMinor: Math.round(Number(amount) * 100), // store in cents
      currency: "THB",
      source: "MANUAL",
      descriptionRaw: items,
      notes,
    }).returning();

    res.json({ ok: true, expense: inserted[0] });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// Upload + parse
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let lines: string[] = [];

    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(fs.readFileSync(req.file.path));
      lines = pdfData.text.split("\n").filter(l => l.match(/^\d{2}\/\d{2}\/\d{2}/)); // only rows with date
    } else if (req.file.mimetype.includes("csv")) {
      const content = fs.readFileSync(req.file.path, "utf8");
      const records = csvParse(content, { columns: false, skip_empty_lines: true });
      lines = records.map((r: string[]) => r.join(" "));
    }

    const parsed = lines.map((line, idx) => {
      const parts = line.split(" ");
      const date = parts[0];
      const amount = parts.find(p => /^\d+(\.\d{1,2})?$/.test(p)) || "0";
      const description = parts.slice(4).join(" ");
      const { supplier, category } = mapExpense(description);
      return {
        id: idx,
        date,
        supplier,
        category,
        description,
        amount,
        notes: "",
        status: "pending",
      };
    });

    res.json({ ok: true, parsed });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Approve
router.post("/approve", async (req, res) => {
  try {
    const { date, supplier, amount, category, description, notes } = req.body;

    const inserted = await db.insert(expenses).values({
      date: new Date(date),
      supplier,
      category,
      description,
      amount: String(Number(amount)),
      amountMinor: Math.round(Number(amount) * 100),
      currency: "THB",
      source: "UPLOAD",
      descriptionRaw: description,
      notes,
    }).returning();

    res.json({ ok: true, expense: inserted[0] });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Failed to approve expense" });
  }
});

// List
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    let results;

    if (month && year) {
      results = await db.select().from(expenses).where(sql`
        EXTRACT(MONTH FROM date) = ${month} 
        AND EXTRACT(YEAR FROM date) = ${year}
      `);
    } else {
      results = await db.select().from(expenses);
    }

    const total = results.reduce((sum, r) => sum + (r.amountMinor || 0), 0);

    res.json({ ok: true, expenses: results, total });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list expenses" });
  }
});

export { router as expensesV2Router };