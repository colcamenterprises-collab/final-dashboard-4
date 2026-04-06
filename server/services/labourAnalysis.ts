import { pool } from "../db";

export type LabourStatus = "Underutilised" | "Steady" | "Busy" | "Overloaded";
export type StaffingStatus = "Overstaffed" | "Understaffed" | "On Target";

const SHIFT_HOURS = 8.5;
const OPENING_MINUTES = 20;
const CLOSING_MINUTES = 20;
const CLEANING_MINUTES = 45;
const ADMIN_MINUTES = 20;
const FIXED_OVERHEAD_MINUTES = OPENING_MINUTES + CLOSING_MINUTES + CLEANING_MINUTES + ADMIN_MINUTES;

type LabourBreakdownRow = {
  item_name: string;
  sku: string | null;
  quantity_sold: number;
  service_minutes: number;
  prep_allocation_minutes: number;
  packaging_minutes: number;
  mapped_recipe_id: number | null;
};

type HourlyLabourRow = {
  hour24: number | null;
  item_name: string;
  sku: string | null;
  quantity_sold: number;
  service_minutes: number;
  prep_allocation_minutes: number;
  packaging_minutes: number;
  mapped_recipe_id: number | null;
};

const HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2];

const hourLabel = (hour24: number): string => {
  if (hour24 === 0) return "12 AM";
  if (hour24 < 12) return `${hour24} AM`;
  if (hour24 === 12) return "12 PM";
  return `${hour24 - 12} PM`;
};

const toNonNegative = (value: unknown): number => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

const getUtilisationStatus = (value: number): LabourStatus => {
  if (value < 40) return "Underutilised";
  if (value < 60) return "Steady";
  if (value <= 80) return "Busy";
  return "Overloaded";
};

export async function buildLabourAnalysis(date: string) {
  if (!pool) {
    throw new Error("Database unavailable");
  }
  const warnings: string[] = [];

  const wagesResult = await pool.query(
    `SELECT payload
     FROM daily_sales_v2
     WHERE shift_date = $1::date
     ORDER BY id DESC
     LIMIT 1`,
    [date],
  );

  let staffCount = 0;
  if (wagesResult.rows.length > 0) {
    const payload = wagesResult.rows[0]?.payload ?? {};
    const wages = Array.isArray(payload?.wages) ? payload.wages : [];
    // Lockdown: wage rows count equals staff count by business rule.
    staffCount = wages.length;
  }

  if (staffCount === 0) {
    warnings.push("No wage rows found for this shift. Staff count treated as 0.");
  }

  const itemRowsResult = await pool.query<LabourBreakdownRow>(
    `SELECT
       rtl.item_name,
       rtl.sku,
       SUM(COALESCE(rtl.quantity, 0))::numeric AS quantity_sold,
       COALESCE(r.service_minutes, 0)::numeric AS service_minutes,
       COALESCE(r.prep_allocation_minutes, 0)::numeric AS prep_allocation_minutes,
       COALESCE(r.packaging_minutes, 0)::numeric AS packaging_minutes,
       COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id) AS mapped_recipe_id
     FROM receipt_truth_line rtl
     LEFT JOIN recipe_sku_map rsm_sku
       ON rsm_sku.channel = 'loyverse'
      AND rsm_sku.active = true
      AND rsm_sku.channel_sku = rtl.sku
     LEFT JOIN recipe_sku_map rsm_name
       ON rsm_name.channel = 'loyverse'
      AND rsm_name.active = true
      AND rsm_name.channel_sku = rtl.item_name
     LEFT JOIN recipes r
       ON r.id = COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id)
     WHERE rtl.receipt_date = $1::date
       AND rtl.receipt_type = 'SALE'
     GROUP BY rtl.item_name, rtl.sku, r.service_minutes, r.prep_allocation_minutes, r.packaging_minutes, COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id)
     ORDER BY SUM(COALESCE(rtl.quantity, 0)) DESC, rtl.item_name ASC`,
    [date],
  );

  let hasUnmapped = false;

  const itemBreakdown = itemRowsResult.rows.map((row) => {
    const quantitySold = toNonNegative(row.quantity_sold);
    const mapped = Boolean(row.mapped_recipe_id);
    if (!mapped) hasUnmapped = true;

    // Lockdown: recipe timing is the only variable labour source of truth.
    // Lockdown: unmapped items must resolve to zero timing, never crash.
    const serviceMinutes = mapped ? toNonNegative(row.service_minutes) : 0;
    const prepAllocationMinutes = mapped ? toNonNegative(row.prep_allocation_minutes) : 0;
    const packagingMinutes = mapped ? toNonNegative(row.packaging_minutes) : 0;
    const effectiveItemMinutes = serviceMinutes + prepAllocationMinutes + packagingMinutes;
    const itemWorkMinutes = quantitySold * effectiveItemMinutes;

    return {
      itemName: row.item_name,
      quantitySold,
      serviceMinutes,
      prepAllocationMinutes,
      packagingMinutes,
      effectiveItemMinutes,
      itemWorkMinutes,
      mapped,
    };
  });

  if (hasUnmapped) {
    warnings.push("Some sold items were not mapped to recipes and were counted with 0 labour minutes.");
  }

  const serviceWorkMinutes = itemBreakdown.reduce((sum, row) => sum + row.itemWorkMinutes, 0);
  // Lockdown: fixed overhead is intentionally shift-level, not stored in recipes.
  const fullShiftWorkMinutes = serviceWorkMinutes + FIXED_OVERHEAD_MINUTES;
  const totalAvailableLabourMinutes = staffCount * SHIFT_HOURS * 60;

  const serviceUtilisationPercent = totalAvailableLabourMinutes > 0
    ? (serviceWorkMinutes / totalAvailableLabourMinutes) * 100
    : 0;

  const fullShiftUtilisationPercent = totalAvailableLabourMinutes > 0
    ? (fullShiftWorkMinutes / totalAvailableLabourMinutes) * 100
    : 0;

  const recommendedDenominator = SHIFT_HOURS * 60 * 0.7;
  const recommendedStaff = recommendedDenominator > 0
    ? Math.ceil(fullShiftWorkMinutes / recommendedDenominator)
    : 0;

  const staffingVariance = staffCount - recommendedStaff;
  const staffingStatus: StaffingStatus = staffCount > recommendedStaff
    ? "Overstaffed"
    : staffCount < recommendedStaff
      ? "Understaffed"
      : "On Target";

  const hourlyRowsResult = await pool.query<HourlyLabourRow>(
    `SELECT
       EXTRACT(HOUR FROM lr.datetime_bkk)::int AS hour24,
       rtl.item_name,
       rtl.sku,
       SUM(COALESCE(rtl.quantity, 0))::numeric AS quantity_sold,
       COALESCE(r.service_minutes, 0)::numeric AS service_minutes,
       COALESCE(r.prep_allocation_minutes, 0)::numeric AS prep_allocation_minutes,
       COALESCE(r.packaging_minutes, 0)::numeric AS packaging_minutes,
       COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id) AS mapped_recipe_id
     FROM receipt_truth_line rtl
     LEFT JOIN lv_receipt lr
       ON lr.receipt_id = rtl.receipt_id
     LEFT JOIN recipe_sku_map rsm_sku
       ON rsm_sku.channel = 'loyverse'
      AND rsm_sku.active = true
      AND rsm_sku.channel_sku = rtl.sku
     LEFT JOIN recipe_sku_map rsm_name
       ON rsm_name.channel = 'loyverse'
      AND rsm_name.active = true
      AND rsm_name.channel_sku = rtl.item_name
     LEFT JOIN recipes r
       ON r.id = COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id)
     WHERE rtl.receipt_date = $1::date
       AND rtl.receipt_type = 'SALE'
     GROUP BY EXTRACT(HOUR FROM lr.datetime_bkk), rtl.item_name, rtl.sku, r.service_minutes, r.prep_allocation_minutes, r.packaging_minutes, COALESCE(rsm_sku.recipe_id, rsm_name.recipe_id)`,
    [date],
  );

  const hourlyWorkByHour = new Map<number, number>();
  for (const row of hourlyRowsResult.rows) {
    const hour = Number(row.hour24);
    if (!Number.isFinite(hour) || !HOURS.includes(hour)) continue;

    const mapped = Boolean(row.mapped_recipe_id);
    const serviceMinutes = mapped ? toNonNegative(row.service_minutes) : 0;
    const prepMinutes = mapped ? toNonNegative(row.prep_allocation_minutes) : 0;
    const packagingMinutes = mapped ? toNonNegative(row.packaging_minutes) : 0;
    const effectiveItemMinutes = serviceMinutes + prepMinutes + packagingMinutes;

    // Receipt timestamps are available at receipt level, so workload is assigned to the receipt hour bucket only.
    const workMinutes = toNonNegative(row.quantity_sold) * effectiveItemMinutes;
    hourlyWorkByHour.set(hour, (hourlyWorkByHour.get(hour) ?? 0) + workMinutes);
  }

  const hourlyDemand = HOURS.map((hour24) => {
    const serviceWork = hourlyWorkByHour.get(hour24) ?? 0;
    const availableLabourMinutes = staffCount * 60;
    const utilisationPercent = availableLabourMinutes > 0
      ? (serviceWork / availableLabourMinutes) * 100
      : 0;

    return {
      hourLabel: hourLabel(hour24),
      hour24,
      serviceWorkMinutes: serviceWork,
      availableLabourMinutes,
      utilisationPercent,
      status: getUtilisationStatus(utilisationPercent),
    };
  });

  return {
    assumptions: {
      staffCount,
      shiftHours: SHIFT_HOURS,
      openingMinutes: OPENING_MINUTES,
      closingMinutes: CLOSING_MINUTES,
      cleaningMinutes: CLEANING_MINUTES,
      adminMinutes: ADMIN_MINUTES,
      fixedOverheadMinutes: FIXED_OVERHEAD_MINUTES,
    },
    totals: {
      serviceWorkMinutes,
      fullShiftWorkMinutes,
      totalAvailableLabourMinutes,
    },
    utilisation: {
      serviceUtilisationPercent,
      fullShiftUtilisationPercent,
      utilisationStatus: getUtilisationStatus(fullShiftUtilisationPercent),
    },
    staffing: {
      actualStaff: staffCount,
      recommendedStaff,
      staffingVariance,
      staffingStatus,
    },
    itemBreakdown,
    hourlyDemand,
    warnings,
  };
}
