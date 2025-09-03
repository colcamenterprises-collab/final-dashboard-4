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

    const result = await db.execute(sql`
      INSERT INTO expenses (
        "restaurantId", "shiftDate", "item", "costCents", 
        "supplier", "expenseType", "source", "meta"
      ) VALUES (
        'restaurant-1', ${new Date(date)}, ${items}, ${Math.round(Number(amount) * 100)},
        ${supplier}, 'MANUAL_ENTRY', 'MANUAL', ${JSON.stringify({ category, notes, originalAmount: amount })}
      ) RETURNING *
    `);

    res.json({ ok: true, expense: result.rows[0] });
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
      const regex = /^(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+\S+\s+\S+\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.+)$/;

      lines = pdfData.text
        .split("\n")
        .map(l => l.trim())
        .filter(l => regex.test(l));

      const parsed = lines.map((line, idx) => {
        const match = line.match(regex);
        if (!match) return null;

        const [, date, time, amountStr, , description] = match;
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
      }).filter(Boolean);

      return res.json({ ok: true, parsed });
    } else if (req.file.mimetype.includes("csv")) {
      const content = fs.readFileSync(req.file.path, "utf8");
      const records = csvParse(content, { columns: false, skip_empty_lines: true });
      lines = records.map((r: string[]) => r.join(" "));
      
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
    }
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// Approve
router.post("/approve", async (req, res) => {
  try {
    const { date, supplier, amount, category, description, notes } = req.body;

    const result = await db.execute(sql`
      INSERT INTO expenses (
        "restaurantId", "shiftDate", "item", "costCents", 
        "supplier", "expenseType", "source", "meta"
      ) VALUES (
        'restaurant-1', ${new Date(date)}, ${description}, ${Math.round(Number(amount) * 100)},
        ${supplier}, 'UPLOAD_APPROVAL', 'UPLOAD', ${JSON.stringify({ category, notes, originalAmount: amount })}
      ) RETURNING *
    `);

    res.json({ ok: true, expense: result.rows[0] });
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
      results = await db.execute(sql`
        SELECT * FROM expenses 
        WHERE EXTRACT(MONTH FROM "shiftDate") = ${month} 
        AND EXTRACT(YEAR FROM "shiftDate") = ${year}
        ORDER BY "shiftDate" DESC
      `);
    } else {
      results = await db.execute(sql`
        SELECT * FROM expenses 
        ORDER BY "shiftDate" DESC
        LIMIT 100
      `);
    }

    const expenses = results.rows;
    const total = expenses.reduce((sum: number, r: any) => sum + (r.costCents || 0), 0);

    res.json({ ok: true, expenses, total });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list expenses" });
  }
});

export { router as expensesV2Router };