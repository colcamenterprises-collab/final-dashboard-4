import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getShiftWindowUTC } from '../utils/shiftWindow';
import { dailyShiftReceiptSummary, insertDailyReceiptSummarySchema } from '@shared/schema';

export interface ReceiptSummary {
  allReceipts: number;
  salesReceipts: number;
  refundReceipts: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
}

export async function buildReceiptSummary(businessDate: string): Promise<ReceiptSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPTS_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const { start, end } = getShiftWindowUTC(businessDate);
  console.log(`[ReceiptSummary] Building for ${businessDate}, window: ${start.toISOString()} to ${end.toISOString()}`);

  const result = await db.execute(sql`
    WITH receipts AS (
      SELECT
        raw_json,
        (raw_json->>'refund_for') IS NOT NULL AS is_refund,
        (raw_json->>'total_money')::numeric AS total_money,
        COALESCE((raw_json->>'total_discount')::numeric, 0) AS total_discount
      FROM lv_receipt
      WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
        AND datetime_bkk < ${end.toISOString()}::timestamptz
    )
    SELECT
      COUNT(*)::int AS all_receipts,
      COUNT(*) FILTER (WHERE NOT is_refund)::int AS sales_receipts,
      COUNT(*) FILTER (WHERE is_refund)::int AS refund_receipts,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0) AS gross_sales,
      COALESCE(SUM(total_discount) FILTER (WHERE NOT is_refund), 0) AS discounts,
      COALESCE(SUM(total_money) FILTER (WHERE is_refund), 0) AS refund_value,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0)
        - COALESCE(SUM(total_discount) FILTER (WHERE NOT is_refund), 0)
        - COALESCE(SUM(total_money) FILTER (WHERE is_refund), 0) AS net_sales
    FROM receipts
  `);

  const row = result.rows[0] as any;
  
  const allReceipts = Number(row?.all_receipts || 0);
  const salesReceipts = Number(row?.sales_receipts || 0);
  const refundReceipts = Number(row?.refund_receipts || 0);
  const grossSales = Number(row?.gross_sales || 0);
  const discounts = Number(row?.discounts || 0);
  const refunds = Number(row?.refund_value || 0);
  const netSales = Number(row?.net_sales || 0);

  if (allReceipts === 0) {
    throw new Error(`[RECEIPTS_FAIL] No receipts found for shift ${businessDate}`);
  }

  if (allReceipts !== salesReceipts + refundReceipts) {
    throw new Error(`[RECEIPTS_FAIL] Receipt count mismatch: ${allReceipts} != ${salesReceipts} + ${refundReceipts}`);
  }

  console.log(`[ReceiptSummary] All: ${allReceipts}, Sales: ${salesReceipts}, Refunds: ${refundReceipts}`);
  console.log(`[ReceiptSummary] Gross: ${grossSales}, Discounts: ${discounts}, RefundValue: ${refunds}, Net: ${netSales}`);

  return {
    allReceipts,
    salesReceipts,
    refundReceipts,
    grossSales,
    discounts,
    refunds,
    netSales,
  };
}

/** Legacy: Build + save summary for a given Bangkok date (yyyy-mm-dd). Used by scheduler. */
export async function buildShiftSummary(dateStr: string) {
  const summary = await buildReceiptSummary(dateStr);
  
  const data = insertDailyReceiptSummarySchema.parse({
    shiftDate: dateStr,
    burgersSold: 0,
    drinksSold: 0,
    itemsBreakdown: {},
    modifiersSummary: {},
  });

  await db
    .insert(dailyShiftReceiptSummary)
    .values(data)
    .onConflictDoUpdate({ target: dailyShiftReceiptSummary.shiftDate, set: data });
  
  return data;
}
