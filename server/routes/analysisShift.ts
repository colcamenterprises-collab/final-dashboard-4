// server/routes/analysisShift.ts
import { Router } from "express";
import multer from "multer";
import { parseLoyverseFilesToSummary } from "../services/loyverseParsers";
import { getDailySalesByDate } from "../services/dailySalesAccess"; // stub below

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

/**
 * POST /api/analysis/shift-summary/upload
 * form-data: files[] (multiple CSVs: sales-summary, item-sales-summary, payment-type-sales,
 *                      receipts, modifier-sales, shifts)
 * query: date=YYYY-MM-DD (optional; inferred from files if not provided)
 */
router.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    const date = String(req.query.date || "");
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: "No files uploaded" });

    const summary = await parseLoyverseFilesToSummary(files, { dateHint: date });

    // OPTIONAL: cross-check vs daily sales form (same local date)
    const daily = await getDailySalesByDate(summary.dateLocal);
    const discrepancies = buildDiscrepancies(summary, daily);

    res.json({ ok: true, dateLocal: summary.dateLocal, summary, daily, discrepancies });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to parse" });
  }
});

export default router;

/** Compare POS vs Daily Sales form minimal set */
function buildDiscrepancies(summary: any, daily: any | null) {
  if (!daily) return [{ level: "info", field: "Daily Sales", message: "No Daily Sales submission found for this date." }];
  const out: any[] = [];

  const num = (x:any)=> Number(x||0);
  // POS (from uploads)
  const pos = summary.kpis;
  const pay = summary.paymentBreakdown; // {Cash, QR, Grab, Aroi Dee, Direct, Other, Card}

  // Daily Sales form fields
  const ds = {
    cashSales: num(daily.cashSales),
    qrSales: num(daily.qrSales),
    grabSales: num(daily.grabSales),
    aroiDeeSales: num(daily.aroiDeeSales),
    directSales: num(daily.directSales),
    totalSales: num(daily.totalSales)
  };

  // Simple deltas
  const checks = [
    ["Cash Sales", pay.Cash || 0, ds.cashSales],
    ["QR Sales", pay.QR || 0, ds.qrSales],
    ["Grab Sales", pay["Grab"] || 0, ds.grabSales],
    ["Aroi Dee Sales", pay["Aroi Dee"] || 0, ds.aroiDeeSales],
    ["Direct Sales", pay["Direct"] || 0, ds.directSales],
    ["Total Sales", pos.grossSales || 0, ds.totalSales]
  ];

  const THRESHOLD = 20; // THB tolerance
  for (const [label, posVal, dsVal] of checks) {
    const delta = Math.round((posVal - dsVal) * 100) / 100;
    if (Math.abs(delta) > THRESHOLD) {
      out.push({ level: "warn", field: label, message: `${label} mismatch: POS ${posVal.toFixed(0)} vs Daily ${dsVal.toFixed(0)} (Δ ${delta.toFixed(0)})` });
    }
  }
  if (!out.length) out.push({ level: "ok", field: "Reconciliation", message: "POS uploads match the Daily Sales sheet within tolerance." });
  return out;
}