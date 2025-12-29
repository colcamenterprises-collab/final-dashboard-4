import { db } from '../db';
import { receiptBatchSummary, receiptBatchItems } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { getShiftWindowUTC } from '../utils/shiftWindow';

interface BatchItem {
  category: string | null;
  sku: string | null;
  itemName: string;
  modifiers: string | null;
  quantity: number;
  grossSales: number;
  netSales: number;
  isRefund: boolean;
}

interface BatchSummaryResult {
  businessDate: string;
  shiftStart: Date;
  shiftEnd: Date;
  allReceipts: number;
  salesCount: number;
  refundCount: number;
  lineItemCount: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  items: BatchItem[];
}

export async function rebuildReceiptBatch(businessDate: string): Promise<BatchSummaryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const { start, end } = getShiftWindowUTC(businessDate);
  console.log(`[ReceiptBatch] Rebuilding for ${businessDate}`);
  console.log(`[ReceiptBatch] Shift window: ${start.toISOString()} to ${end.toISOString()} (17:00-03:00 Bangkok)`);

  const summaryResult = await db.execute(sql`
    WITH receipts AS (
      SELECT
        receipt_id,
        datetime_bkk,
        raw_json,
        (raw_json->>'refund_for') IS NOT NULL AS is_refund,
        (raw_json->>'total_money')::numeric AS total_money,
        COALESCE((raw_json->>'total_discount')::numeric, 0) AS total_discount
      FROM lv_receipt
      WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
        AND datetime_bkk < ${end.toISOString()}::timestamptz
    )
    SELECT
      COUNT(*)::int                                      AS all_receipts,
      COUNT(*) FILTER (WHERE NOT is_refund)::int         AS sales_count,
      COUNT(*) FILTER (WHERE is_refund)::int             AS refund_count,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0) AS gross_sales,
      COALESCE(SUM(total_discount), 0)                   AS discounts,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0)
        - COALESCE(SUM(total_discount), 0)               AS net_sales
    FROM receipts
  `);

  const summary = summaryResult.rows[0] as any;
  const allReceipts = Number(summary?.all_receipts || 0);
  const salesCount = Number(summary?.sales_count || 0);
  const refundCount = Number(summary?.refund_count || 0);
  const grossSales = Number(summary?.gross_sales || 0);
  const discounts = Number(summary?.discounts || 0);
  const netSales = Number(summary?.net_sales || 0);

  if (allReceipts === 0) {
    throw new Error(`[RECEIPTS_TRUTH] No receipts found for shift window ${businessDate} (${start.toISOString()} to ${end.toISOString()})`);
  }

  console.log(`[ReceiptBatch] All: ${allReceipts}, Sales: ${salesCount}, Refunds: ${refundCount}`);
  console.log(`[ReceiptBatch] Gross: ${grossSales}, Discounts: ${discounts}, Net: ${netSales}`);

  const salesReceiptsResult = await db.execute(sql`
    SELECT receipt_id
    FROM lv_receipt
    WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
      AND datetime_bkk < ${end.toISOString()}::timestamptz
      AND (raw_json->>'refund_for') IS NULL
  `);
  const salesReceiptIds = (salesReceiptsResult.rows as any[]).map(r => r.receipt_id);

  let items: BatchItem[] = [];
  let lineItemCount = 0;

  if (salesReceiptIds.length > 0) {
    const idsLiteral = '{' + salesReceiptIds.map((id: string) => `"${id}"`).join(',') + '}';
    
    const lineItemsResult = await db.execute(sql`
      SELECT 
        li.category_hint,
        li.sku,
        li.name as item_name,
        li.qty,
        li.unit_price,
        (
          SELECT string_agg(m.name, ', ' ORDER BY m.mod_no)
          FROM lv_modifier m
          WHERE m.receipt_id = li.receipt_id AND m.line_no = li.line_no
        ) as modifiers
      FROM lv_line_item li
      WHERE li.receipt_id = ANY(${idsLiteral}::text[])
      ORDER BY li.name
    `);

    const lineItems = lineItemsResult.rows as any[];
    lineItemCount = lineItems.length;

    const itemAggregates = new Map<string, BatchItem>();

    for (const row of lineItems) {
      const lineTotal = Number(row.qty) * Number(row.unit_price || 0);
      const key = `${row.category_hint || 'Uncategorized'}|${row.sku || ''}|${row.item_name}|${row.modifiers || ''}`;
      
      if (itemAggregates.has(key)) {
        const existing = itemAggregates.get(key)!;
        existing.quantity += Number(row.qty);
        existing.grossSales += lineTotal;
        existing.netSales += lineTotal;
      } else {
        itemAggregates.set(key, {
          category: row.category_hint || 'Uncategorized',
          sku: row.sku,
          itemName: row.item_name,
          modifiers: row.modifiers,
          quantity: Number(row.qty),
          grossSales: lineTotal,
          netSales: lineTotal,
          isRefund: false,
        });
      }
    }

    items = Array.from(itemAggregates.values()).sort((a, b) => b.quantity - a.quantity);
  }

  console.log(`[ReceiptBatch] ${lineItemCount} line items, ${items.length} unique item variants`);

  await db.delete(receiptBatchSummary).where(eq(receiptBatchSummary.businessDate, businessDate));

  const [inserted] = await db.insert(receiptBatchSummary).values({
    businessDate,
    shiftStart: start,
    shiftEnd: end,
    receiptCount: salesCount,
    lineItemCount,
    grossSales: grossSales.toFixed(2),
    netSales: netSales.toFixed(2),
  }).returning();

  if (items.length > 0) {
    await db.insert(receiptBatchItems).values(
      items.map(item => ({
        batchId: inserted.id,
        category: item.category,
        sku: item.sku,
        itemName: item.itemName,
        modifiers: item.modifiers,
        quantity: item.quantity.toFixed(2),
        grossSales: item.grossSales.toFixed(2),
        netSales: item.netSales.toFixed(2),
      }))
    );
  }

  return {
    businessDate,
    shiftStart: start,
    shiftEnd: end,
    allReceipts,
    salesCount,
    refundCount,
    lineItemCount,
    grossSales,
    discounts,
    netSales,
    items,
  };
}

export async function getReceiptBatchSummary(businessDate: string): Promise<BatchSummaryResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const [batch] = await db.select().from(receiptBatchSummary)
    .where(eq(receiptBatchSummary.businessDate, businessDate));

  if (!batch) {
    return null;
  }

  const { start, end } = getShiftWindowUTC(businessDate);

  const summaryResult = await db.execute(sql`
    WITH receipts AS (
      SELECT
        receipt_id,
        (raw_json->>'refund_for') IS NOT NULL AS is_refund,
        (raw_json->>'total_money')::numeric AS total_money,
        COALESCE((raw_json->>'total_discount')::numeric, 0) AS total_discount
      FROM lv_receipt
      WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
        AND datetime_bkk < ${end.toISOString()}::timestamptz
    )
    SELECT
      COUNT(*)::int                                      AS all_receipts,
      COUNT(*) FILTER (WHERE NOT is_refund)::int         AS sales_count,
      COUNT(*) FILTER (WHERE is_refund)::int             AS refund_count,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0) AS gross_sales,
      COALESCE(SUM(total_discount), 0)                   AS discounts,
      COALESCE(SUM(total_money) FILTER (WHERE NOT is_refund), 0)
        - COALESCE(SUM(total_discount), 0)               AS net_sales
    FROM receipts
  `);

  const summary = summaryResult.rows[0] as any;

  const items = await db.select().from(receiptBatchItems)
    .where(eq(receiptBatchItems.batchId, batch.id));

  return {
    businessDate: batch.businessDate,
    shiftStart: batch.shiftStart,
    shiftEnd: batch.shiftEnd,
    allReceipts: Number(summary?.all_receipts || 0),
    salesCount: Number(summary?.sales_count || 0),
    refundCount: Number(summary?.refund_count || 0),
    lineItemCount: batch.lineItemCount,
    grossSales: Number(summary?.gross_sales || 0),
    discounts: Number(summary?.discounts || 0),
    netSales: Number(summary?.net_sales || 0),
    items: items.map(i => ({
      category: i.category,
      sku: i.sku,
      itemName: i.itemName || '',
      modifiers: i.modifiers,
      quantity: Number(i.quantity),
      grossSales: Number(i.grossSales),
      netSales: Number(i.netSales),
      isRefund: false,
    })),
  };
}
