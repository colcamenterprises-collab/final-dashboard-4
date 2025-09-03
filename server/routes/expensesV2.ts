import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { db } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { expenseMappings } from "../config/expenseMappings";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Helper: map supplier + category
function mapExpense(description: string) {
  for (const rule of expenseMappings) {
    if (rule.keywords.some(k => description.includes(k))) {
      return { supplier: rule.supplier, category: rule.category };
    }
  }
  return { supplier: "Other", category: "Uncategorised" };
}

// ---------- CREATE (manual + modal) ----------
router.post("/", async (req, res) => {
  try {
    const { date, supplier, amount, category, description, notes } = req.body;

    const result = await db.execute(sql`
      INSERT INTO expenses (id, restaurantId, shiftDate, supplier, costCents, item, expenseType, meta, source, createdAt)
      VALUES (
        gen_random_uuid(),
        'default',
        ${date},
        ${supplier},
        ${Math.round(Number(amount) * 100)},
        ${description},
        ${category},
        jsonb_build_object('notes', ${notes}),
        'business',
        NOW()
      )
      RETURNING 
        id,
        shiftDate as date,
        supplier,
        costCents as amount,
        item as description,
        expenseType as category,
        meta->>'notes' as notes
    `);

    res.json({ ok: true, expense: result.rows[0] });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// ---------- UPLOAD & PARSE ----------
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let parsed: any[] = [];

    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(fs.readFileSync(req.file.path));
      const regex = /^(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+\S+\s+\S+\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.+)$/;

      parsed = pdfData.text
        .split("\n")
        .map(l => l.trim())
        .filter(l => regex.test(l))
        .map((line, idx) => {
          const [, date, time, amountStr, , description] = line.match(regex)!;
          const cleanAmount = parseFloat(amountStr.replace(/,/g, ""));
          const { supplier, category } = mapExpense(description);
          return {
            id: idx,
            date,
            time,
            supplier,
            category,
            description,
            amount: cleanAmount,
            notes: "",
            status: "pending",
          };
        });
    }

    if (req.file.mimetype.includes("csv")) {
      const content = fs.readFileSync(req.file.path, "utf8");
      const records = csvParse(content, { skip_empty_lines: true });
      parsed = records.map((r: string[], i: number) => ({
        id: i,
        date: "",
        supplier: "",
        category: "Uncategorised",
        description: r.join(" "),
        amount: 0,
        notes: "",
        status: "pending",
      }));
    }

    res.json({ ok: true, parsed });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// ---------- APPROVE (save parsed line) ----------
router.post("/approve", async (req, res) => {
  try {
    const { date, supplier, amount, category, description, notes } = req.body;

    const result = await db.execute(sql`
      INSERT INTO expenses (id, restaurantId, shiftDate, supplier, costCents, item, expenseType, meta, source, createdAt)
      VALUES (
        gen_random_uuid(),
        'default',
        ${date},
        ${supplier},
        ${Math.round(Number(amount) * 100)},
        ${description},
        ${category},
        jsonb_build_object('notes', ${notes}),
        'business',
        NOW()
      )
      RETURNING 
        id,
        shiftDate as date,
        supplier,
        costCents as amount,
        item as description,
        expenseType as category,
        meta->>'notes' as notes
    `);

    res.json({ ok: true, expense: result.rows[0] });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Failed to approve expense" });
  }
});

// ---------- LIST ----------
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;

    const results = await db.execute(sql`
      SELECT 
        expenses.id,
        expenses.shiftDate as date,
        expenses.supplier,
        expenses.costCents as amount,
        expenses.item as description,
        expenses.expenseType as category,
        expenses.meta->>'notes' as notes
      FROM expenses
      WHERE EXTRACT(MONTH FROM expenses.shiftDate) = ${month}
      AND EXTRACT(YEAR FROM expenses.shiftDate) = ${year}
      AND expenses.source = 'business'
      ORDER BY expenses.shiftDate DESC
    `);

    const total = results.rows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    res.json({ ok: true, expenses: results.rows, total });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list expenses" });
  }
});

export { router as expensesV2Router };