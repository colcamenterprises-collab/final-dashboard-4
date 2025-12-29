import { db } from '../db';
import { receiptBatchSummary, receiptBatchItems } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface BatchItem {
  category: string | null;
  sku: string | null;
  itemName: string;
  modifiers: string | null;
  quantity: number;
  grossSales: number;
  netSales: number;
}

interface BatchSummaryResult {
  businessDate: string;
  shiftStart: Date;
  shiftEnd: Date;
  receiptCount: number;
  refundCount: number;
  lineItemCount: number;
  grossSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  netSales: number;
  items: BatchItem[];
}

function getShiftWindow(businessDate: string): { start: Date; end: Date } {
  const [year, month, day] = businessDate.split('-').map(Number);
  // Bangkok is UTC+7
  // 17:00 Bangkok = 10:00 UTC same day
  // 03:00 Bangkok next day = 20:00 UTC same day
  const start = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  return { start, end };
}

export async function rebuildReceiptBatch(businessDate: string): Promise<BatchSummaryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const { start, end } = getShiftWindow(businessDate);
  console.log(`[ReceiptBatch] Rebuilding for ${businessDate}`);
  console.log(`[ReceiptBatch] Shift window: ${start.toISOString()} to ${end.toISOString()} (17:00-03:00 Bangkok)`);

  // Step 1: Get receipt-level totals from raw_json (THE SOURCE OF TRUTH)
  const receiptTotalsResult = await db.execute(sql`
    SELECT 
      receipt_id,
      datetime_bkk,
      (raw_json->>'total_money')::numeric as gross_total,
      COALESCE((raw_json->>'total_discount')::numeric, 0) as discount,
      raw_json->>'refund_for' as refund_for,
      raw_json->>'receipt_type' as receipt_type
    FROM lv_receipt
    WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
      AND datetime_bkk < ${end.toISOString()}::timestamptz
    ORDER BY datetime_bkk
  `);

  const allReceipts = receiptTotalsResult.rows as any[];

  if (allReceipts.length === 0) {
    throw new Error(`NO RECEIPTS FOUND for ${businessDate} (${start.toISOString()} to ${end.toISOString()}). Cannot build truth batch.`);
  }

  // Separate sales from refunds
  const salesReceipts = allReceipts.filter(r => !r.refund_for);
  const refundReceipts = allReceipts.filter(r => r.refund_for);

  const receiptCount = salesReceipts.length;
  const refundCount = refundReceipts.length;

  // Calculate totals from POS data
  const grossSales = salesReceipts.reduce((sum, r) => sum + Number(r.gross_total || 0), 0);
  const totalDiscounts = salesReceipts.reduce((sum, r) => sum + Number(r.discount || 0), 0);
  const totalRefunds = refundReceipts.reduce((sum, r) => sum + Math.abs(Number(r.gross_total || 0)), 0);
  const netSales = grossSales - totalDiscounts - totalRefunds;

  console.log(`[ReceiptBatch] Receipts: ${receiptCount} sales, ${refundCount} refunds`);
  console.log(`[ReceiptBatch] Gross: ${grossSales}, Discounts: ${totalDiscounts}, Refunds: ${totalRefunds}, Net: ${netSales}`);

  // Step 2: Get line item breakdown for the items table
  const salesReceiptIds = salesReceipts.map(r => r.receipt_id);
  
  let items: BatchItem[] = [];
  let lineItemCount = 0;

  if (salesReceiptIds.length > 0) {
    // Convert array to PostgreSQL array literal
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

    // Aggregate by item + modifiers
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
        });
      }
    }

    items = Array.from(itemAggregates.values()).sort((a, b) => b.quantity - a.quantity);
  }

  console.log(`[ReceiptBatch] ${lineItemCount} line items, ${items.length} unique item variants`);

  // Step 3: Store the batch
  await db.delete(receiptBatchSummary).where(eq(receiptBatchSummary.businessDate, businessDate));

  const [inserted] = await db.insert(receiptBatchSummary).values({
    businessDate,
    shiftStart: start,
    shiftEnd: end,
    receiptCount,
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
    receiptCount,
    refundCount,
    lineItemCount,
    grossSales,
    totalDiscounts,
    totalRefunds,
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

  const items = await db.select().from(receiptBatchItems)
    .where(eq(receiptBatchItems.batchId, batch.id));

  // Re-calculate refunds and discounts from raw data for display
  const { start, end } = getShiftWindow(businessDate);
  
  const statsResult = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE raw_json->>'refund_for' IS NOT NULL) as refund_count,
      COALESCE(SUM((raw_json->>'total_discount')::numeric) FILTER (WHERE raw_json->>'refund_for' IS NULL), 0) as total_discounts,
      COALESCE(SUM(ABS((raw_json->>'total_money')::numeric)) FILTER (WHERE raw_json->>'refund_for' IS NOT NULL), 0) as total_refunds
    FROM lv_receipt
    WHERE datetime_bkk >= ${start.toISOString()}::timestamptz
      AND datetime_bkk < ${end.toISOString()}::timestamptz
  `);

  const stats = statsResult.rows[0] as any;

  return {
    businessDate: batch.businessDate,
    shiftStart: batch.shiftStart,
    shiftEnd: batch.shiftEnd,
    receiptCount: batch.receiptCount,
    refundCount: Number(stats?.refund_count || 0),
    lineItemCount: batch.lineItemCount,
    grossSales: Number(batch.grossSales),
    totalDiscounts: Number(stats?.total_discounts || 0),
    totalRefunds: Number(stats?.total_refunds || 0),
    netSales: Number(batch.netSales),
    items: items.map(i => ({
      category: i.category,
      sku: i.sku,
      itemName: i.itemName || '',
      modifiers: i.modifiers,
      quantity: Number(i.quantity),
      grossSales: Number(i.grossSales),
      netSales: Number(i.netSales),
    })),
  };
}
