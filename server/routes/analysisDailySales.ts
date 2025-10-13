import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

const router = Router();

// ---------- CSV EXPORT ----------
// GET /api/analysis/daily-sales/export.csv?id=<uuid>
// GET /api/analysis/daily-sales/export.csv?date=YYYY-MM-DD

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/export.csv", async (req: Request, res: Response) => {
  const id = (req.query.id as string) || "";
  const date = (req.query.date as string) || "";

  if (!id && !date) {
    return res.status(400).json({ error: "Provide id or date (YYYY-MM-DD)" });
  }

  // 1) Load drink label map (stable order)
  const lblRows = await db.execute(sql.raw(`
    SELECT col_name, label FROM daily_shift_drink_labels ORDER BY label ASC, col_name ASC
  `));
  const labels = (lblRows as any).rows || [];

  // 2) Build fixed columns (in order)
  const fixedCols = [
    "shift_date", "completed_by", "total_sales",
    "cash_sales", "qr_sales", "grab_sales", "aroi_sales",
    "shopping_total", "wages_total", "others_total", "total_expenses",
    "rolls_end", "meat_end_g"
  ];

  // Build SELECT column list dynamically: fixed + drink cols
  const drinkCols = labels.map((l: any) => l.col_name);
  const selectCols = ["id", ...fixedCols, ...drinkCols];

  // 3) Fetch rows
  let qText = `SELECT ${selectCols.map(c => `"${c}"`).join(",")}
               FROM daily_shift_summary
               WHERE deleted_at IS NULL `;
  const args: any[] = [];
  if (id) { qText += ` AND id = $1`; args.push(id); }
  if (date) { qText += id ? ` AND shift_date = $2` : ` AND shift_date = $1`; args.push(date); }
  qText += ` ORDER BY shift_date DESC, created_at DESC`;

  const resRows = await db.execute(sql.raw(qText, args));
  const rows = (resRows as any).rows || [];
  if (!rows.length) {
    return res.status(404).json({ error: "No matching rows" });
  }

  // 4) CSV header: friendly labels
  const header = [
    "ID", "Date", "Completed By", "Total",
    "Cash", "QR", "Grab", "Aroi",
    "Shopping", "Wages", "Other", "Expenses",
    "Rolls", "Meat (g)",
    ...labels.map((l: any) => l.label)
  ];

  // 5) Build CSV lines
  const out: string[] = [];
  out.push(header.map(csvEscape).join(","));

  for (const r of rows) {
    const line = [
      r.id,
      r.shift_date,
      r.completed_by,
      r.total_sales,
      r.cash_sales,
      r.qr_sales,
      r.grab_sales,
      r.aroi_sales,
      r.shopping_total,
      r.wages_total,
      r.others_total,
      r.total_expenses,
      r.rolls_end,
      r.meat_end_g,
      ...drinkCols.map((c: string) => r[c] ?? 0)
    ];
    out.push(line.map(csvEscape).join(","));
  }

  const csv = out.join("\n");
  const fname = id ? `daily_shift_${id}.csv` : `daily_shift_${date}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  return res.send(csv);
});

// Main analysis endpoint - GET /api/analysis/daily-sales
router.get("/", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await db.execute(sql.raw(`
    SELECT id, shift_date, completed_by, total_sales, 
           cash_sales, qr_sales, grab_sales, aroi_sales,
           shopping_total, wages_total, others_total, total_expenses,
           rolls_end, meat_end_g
    FROM daily_shift_summary
    WHERE deleted_at IS NULL
    ORDER BY shift_date DESC, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `));

  const rows = (result as any).rows || [];
  return res.json(rows);
});

export default router;
