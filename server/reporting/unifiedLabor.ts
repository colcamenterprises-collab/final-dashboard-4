import { pool } from "../db";
import type { ResolvedReportingRange } from "./unifiedLedger";

const LABOR_TYPES = new Set(["WAGES", "OVERTIME", "BONUS"]);
const STAFFED_TYPES = new Set(["WAGES", "OVERTIME"]);

export const LABOUR_EFFICIENCY_DEFAULTS = {
  breakMinutesPerStaff: 30,
  prepAndCleaningMinutesPerShift: 105,
} as const;

export type LabourEfficiencyInput = {
  itemCount: number;
  staffCount: number;
  shiftCount?: number;
  shiftMinutes: number;
  breakMinutesPerStaff?: number;
  prepAndCleaningMinutesPerShift?: number;
};

const nonNegative = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/**
 * V1 operational productivity calculation.
 *
 * Staff is sourced from itemised paid wage rows, demand from canonical POS item
 * quantities, and the shift length from the exact reporting window. Allowances
 * are deliberately explicit so the result remains explainable and portable.
 */
export function calculateLabourEfficiency(input: LabourEfficiencyInput) {
  const itemCount = nonNegative(input.itemCount);
  const staffCount = Math.floor(nonNegative(input.staffCount));
  const shiftCount = Math.floor(nonNegative(input.shiftCount ?? (staffCount > 0 ? 1 : 0)));
  const shiftMinutes = nonNegative(input.shiftMinutes);
  const breakMinutesPerStaff = nonNegative(
    input.breakMinutesPerStaff ?? LABOUR_EFFICIENCY_DEFAULTS.breakMinutesPerStaff,
  );
  const prepAndCleaningMinutesPerShift = nonNegative(
    input.prepAndCleaningMinutesPerShift ?? LABOUR_EFFICIENCY_DEFAULTS.prepAndCleaningMinutesPerShift,
  );

  const grossLabourMinutes = staffCount * shiftMinutes;
  const breakAllowanceMinutes = staffCount * breakMinutesPerStaff;
  const prepAndCleaningMinutes = shiftCount * prepAndCleaningMinutesPerShift;
  const totalAllowanceMinutes = breakAllowanceMinutes + prepAndCleaningMinutes;
  const availableProductionMinutes = Math.max(0, grossLabourMinutes - totalAllowanceMinutes);
  const availableProductionHours = availableProductionMinutes / 60;
  const itemsPerLabourHour = availableProductionHours > 0
    ? itemCount / availableProductionHours
    : null;

  const warnings: string[] = [];
  if (staffCount === 0) warnings.push("No itemised paid staff rows were recorded for this shift.");
  if (itemCount === 0) warnings.push("No paid POS items were recorded in this shift window.");
  if (grossLabourMinutes > 0 && totalAllowanceMinutes >= grossLabourMinutes) {
    warnings.push("Allowances consume all recorded labour time; review the shift or allowance settings.");
  }

  return {
    itemCount,
    staffCount,
    shiftCount,
    shiftMinutes,
    grossLabourMinutes,
    breakAllowanceMinutes,
    prepAndCleaningMinutes,
    totalAllowanceMinutes,
    availableProductionMinutes,
    availableProductionHours,
    itemsPerLabourHour,
    warnings,
  };
}

export function summarizeRecordedLabor(rows: Array<{ payload?: any }>) {
  let laborCost = 0;
  const staff = new Set<string>();
  let staffShiftCount = 0;
  let recordedShiftCount = 0;

  for (const row of rows) {
    const wages = Array.isArray(row?.payload?.wages) ? row.payload.wages : [];
    const shiftStaff = new Set<string>();
    for (const wage of wages) {
      const type = String(wage?.type || "WAGES").toUpperCase();
      if (!LABOR_TYPES.has(type)) continue;
      const amount = Number(wage?.amount || 0);
      if (Number.isFinite(amount) && amount > 0) laborCost += amount;
      const name = String(wage?.staff || "").trim().toLocaleLowerCase();
      if (name && amount > 0 && STAFFED_TYPES.has(type)) {
        staff.add(name);
        shiftStaff.add(name);
      }
    }
    staffShiftCount += shiftStaff.size;
    if (shiftStaff.size > 0) recordedShiftCount += 1;
  }

  return { laborCost, paidStaffCount: staff.size, staffShiftCount, recordedShiftCount };
}

export async function queryRecordedLabor(range: ResolvedReportingRange) {
  if (!pool) throw new Error("Database unavailable");
  // Overnight shift ranges end on the following calendar day, but the form is
  // owned by the business date on which the shift opened.
  const inclusiveEndDate = range.toTime <= range.fromTime ? range.fromDate : range.toDate;
  const result = await pool.query(
    `SELECT DISTINCT ON (shift_date) payload
       FROM daily_sales_v2
      WHERE shift_date >= $1::date
        AND shift_date <= $2::date
        AND "deletedAt" IS NULL
      ORDER BY shift_date, COALESCE("submittedAtISO", "createdAt") DESC NULLS LAST`,
    [range.fromDate, inclusiveEndDate],
  );
  return summarizeRecordedLabor(result.rows);
}
