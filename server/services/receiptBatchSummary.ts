import { db } from '../db';
import { receiptBatchSummary, receiptBatchItems } from '@shared/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

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
  lineItemCount: number;
  grossSales: number;
  netSales: number;
  items: BatchItem[];
}

function getShiftWindow(businessDate: string): { start: Date; end: Date } {
  const [year, month, day] = businessDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 11, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0));
  return { start, end };
}

export async function rebuildReceiptBatch(businessDate: string): Promise<BatchSummaryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const { start, end } = getShiftWindow(businessDate);
  console.log(`[ReceiptBatch] Rebuilding for ${businessDate}: ${start.toISOString()} to ${end.toISOString()}`);

  const receiptsResult = await db.execute(sql`
    SELECT 
      r.receipt_id,
      r.datetime_bkk,
      r.total_amount,
      li.line_no,
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
    FROM lv_receipt r
    JOIN lv_line_item li ON li.receipt_id = r.receipt_id
    WHERE r.datetime_bkk >= ${start.toISOString()}::timestamptz
      AND r.datetime_bkk < ${end.toISOString()}::timestamptz
    ORDER BY r.datetime_bkk, li.line_no
  `);

  const rows = receiptsResult.rows as any[];

  if (rows.length === 0) {
    throw new Error(`NO RECEIPTS FOUND for ${businessDate}. Cannot build truth batch.`);
  }

  const uniqueReceipts = new Set(rows.map(r => r.receipt_id));
  const receiptCount = uniqueReceipts.size;
  const lineItemCount = rows.length;

  let grossSales = 0;
  const itemAggregates = new Map<string, BatchItem>();

  for (const row of rows) {
    const lineTotal = Number(row.qty) * Number(row.unit_price || 0);
    grossSales += lineTotal;

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

  const netSales = grossSales;
  const items = Array.from(itemAggregates.values()).sort((a, b) => b.quantity - a.quantity);

  console.log(`[ReceiptBatch] Found ${receiptCount} receipts, ${lineItemCount} line items, ${items.length} unique items`);
  console.log(`[ReceiptBatch] Gross sales: ${grossSales.toFixed(2)}`);

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
    lineItemCount,
    grossSales,
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

  return {
    businessDate: batch.businessDate,
    shiftStart: batch.shiftStart,
    shiftEnd: batch.shiftEnd,
    receiptCount: batch.receiptCount,
    lineItemCount: batch.lineItemCount,
    grossSales: Number(batch.grossSales),
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
