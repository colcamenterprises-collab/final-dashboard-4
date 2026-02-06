import { Router } from "express";
import { DateTime } from "luxon";
import { getShiftReport } from "../utils/loyverse";

const router = Router();
const TZ = "Asia/Bangkok";

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

router.get("/shift-report", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Provide date=YYYY-MM-DD" });
  }

  const start = DateTime.fromISO(date, { zone: TZ }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const end = start.plus({ days: 1 }).set({ hour: 3, minute: 0, second: 0, millisecond: 0 });

  try {
    const storeId = process.env.LOYVERSE_STORE_ID;
    const result = await getShiftReport({ date, storeId });
    const shift = result?.shifts?.[0] ?? null;

    if (!shift) {
      return res.json({
        date,
        shiftWindow: "17:00-03:00",
        shiftReport: null
      });
    }

    const shiftReport = {
      totalSales: toNumberOrNull(shift.gross_sales ?? shift.net_sales ?? shift.total_sales),
      startingCash: toNumberOrNull(shift.starting_cash),
      cashPayments: toNumberOrNull(shift.cash_sales ?? shift.cash_payments),
      grab: toNumberOrNull(shift.grab_sales),
      scan: toNumberOrNull(shift.qr_sales),
      expenses: toNumberOrNull(shift.paid_out ?? shift.expenses),
      expectedCash: toNumberOrNull(shift.expected_cash),
      actualCash: toNumberOrNull(shift.actual_cash),
      difference: toNumberOrNull(shift.cash_difference ?? shift.difference)
    };

    return res.json({
      date,
      shiftWindow: "17:00-03:00",
      shiftReport
    });
  } catch (error: any) {
    console.error("[LOYVERSE_SHIFT_REPORT_FAIL]", error?.message || error);
    return res.status(500).json({
      error: "Shift report unavailable",
      message: error?.message || "Failed to fetch shift report"
    });
  }
});

export default router;
