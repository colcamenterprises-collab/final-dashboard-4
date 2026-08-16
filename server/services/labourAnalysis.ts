import { pool } from "../db";
import {
  calculateLabourEfficiency,
  LABOUR_EFFICIENCY_DEFAULTS,
  summarizeRecordedLabor,
} from "../reporting/unifiedLabor";

const SBB_SHIFT_MINUTES = 8 * 60 + 20;

/**
 * Compatibility entry point for the Daily Review/stock reconciliation response.
 * Reporting Overview uses the unified ledger, while this older date-based route
 * uses receipt_truth_line. Both paths use the same V1 formula and assumptions.
 */
export async function buildLabourAnalysis(date: string) {
  if (!pool) throw new Error("Database unavailable");

  const [formResult, itemResult] = await Promise.all([
    pool.query(
      `SELECT payload
         FROM daily_sales_v2
        WHERE shift_date = $1::date
          AND "deletedAt" IS NULL
        ORDER BY COALESCE("submittedAtISO", "createdAt") DESC NULLS LAST
        LIMIT 1`,
      [date],
    ),
    pool.query(
      `SELECT COALESCE(SUM(quantity), 0)::numeric AS item_count
         FROM receipt_truth_line
        WHERE receipt_date = $1::date
          AND receipt_type = 'SALE'`,
      [date],
    ),
  ]);

  const recordedLabor = summarizeRecordedLabor(formResult.rows);
  const efficiency = calculateLabourEfficiency({
    itemCount: Number(itemResult.rows[0]?.item_count ?? 0),
    staffCount: recordedLabor.staffShiftCount,
    shiftCount: recordedLabor.recordedShiftCount,
    shiftMinutes: SBB_SHIFT_MINUTES,
  });

  return {
    version: "v1",
    metric: "items_per_labour_hour",
    ...recordedLabor,
    efficiency,
    assumptions: {
      shiftStart: "17:55",
      shiftEnd: "02:15",
      shiftMinutes: SBB_SHIFT_MINUTES,
      breakMinutesPerStaff: LABOUR_EFFICIENCY_DEFAULTS.breakMinutesPerStaff,
      prepMinutesPerShift: LABOUR_EFFICIENCY_DEFAULTS.prepMinutesPerShift,
      cleaningMinutesPerShift: LABOUR_EFFICIENCY_DEFAULTS.cleaningMinutesPerShift,
      prepAndCleaningMinutesPerShift:
        LABOUR_EFFICIENCY_DEFAULTS.prepMinutesPerShift
        + LABOUR_EFFICIENCY_DEFAULTS.cleaningMinutesPerShift,
    },
    sources: {
      staff: "daily_sales_v2.payload.wages",
      items: "receipt_truth_line SALE quantity",
    },
  };
}
