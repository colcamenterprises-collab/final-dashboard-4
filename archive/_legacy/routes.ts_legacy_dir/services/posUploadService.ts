import { db } from "../db";
import { posBatch, posReceipt, posShiftReport, posSalesItem, posSalesModifier, posPaymentSummary } from "../../shared/schema";
import { parse } from 'csv-parse/sync';

export type UploadBody = {
  title?: string;
  shiftStartISO?: string;
  shiftEndISO?: string;
  receiptsCsv?: string;
  shiftReportCsv?: string;
  salesByItemCsv?: string;
  salesByModifierCsv?: string;
  salesByPaymentCsv?: string;
};

// Helper functions
function num(n: any): number { 
  const x = Number(String(n).replace(/[,฿]/g, "")); 
  return isNaN(x) ? 0 : x; 
}

function toISO(d: string): Date | null { 
  const t = new Date(d); 
  return isNaN(+t) ? null : t; 
}

function tryParse(v: any): any {
  try { 
    return JSON.parse(v); 
  } catch { 
    return []; 
  }
}

export async function processPosUpload(body: UploadBody): Promise<string> {
  console.log('[POS Upload] Starting batch processing...');
  
  // Create batch record
  const [batch] = await db.insert(posBatch).values({
    title: body.title || null,
    shiftStart: body.shiftStartISO ? new Date(body.shiftStartISO) : null,
    shiftEnd: body.shiftEndISO ? new Date(body.shiftEndISO) : null,
  }).returning();

  console.log(`[POS Upload] Created batch ${batch.id}`);

  // Process Receipts CSV
  if (body.receiptsCsv) {
    try {
      const rows = parse(body.receiptsCsv, { columns: true, skip_empty_lines: true }) as any[];
      console.log(`[POS Upload] Processing ${rows.length} receipts...`);
      
      const receipts = rows.map((row) => ({
        batchId: batch.id,
        receiptId: row["Receipt #"] || row["Receipt ID"] || row["Receipt"] || "unknown",
        datetime: toISO(row["Date/time"] || row["Date"] || row["Time"]) || new Date(),
        total: num(row["Total"] || row["Total, THB"] || row["Amount"]).toString(),
        itemsJson: tryParse(row["Items JSON"] || row["Items"] || "[]"),
        payment: row["Payment Type"] || row["Payment method"] || row["Payment"],
      }));
      
      await db.insert(posReceipt).values(receipts);
      console.log(`[POS Upload] Inserted ${receipts.length} receipts`);
    } catch (error) {
      console.error('[POS Upload] Error processing receipts:', error);
    }
  }

  // Process Shift Report CSV
  if (body.shiftReportCsv) {
    try {
      const rows = parse(body.shiftReportCsv, { columns: true, skip_empty_lines: true }) as any[];
      const row = rows[0] || {};
      console.log('[POS Upload] Processing shift report...');
      
      await db.insert(posShiftReport).values({
        batchId: batch.id,
        grossSales: num(row["Gross Sales"] ?? row["Gross sales"]).toString(),
        discounts: num(row["Discounts"]).toString(),
        netSales: num(row["Net Sales"] ?? row["Net sales"]).toString(),
        cashInDrawer: num(row["Cash in Drawer"] ?? row["Cash in drawer"]).toString(),
        cashSales: num(row["Cash Sales"] ?? row["Cash sales"]).toString(),
        qrSales: num(row["QR Sales"] ?? row["QR sales"] ?? row["Card Sales"] ?? 0).toString(),
        otherSales: num(row["Other Payments"] ?? row["Other payments"] ?? 0).toString(),
        receiptCount: Number(row["Receipts"] ?? row["Receipt count"] ?? 0),
      });
      
      console.log('[POS Upload] Inserted shift report');
    } catch (error) {
      console.error('[POS Upload] Error processing shift report:', error);
    }
  }

  // Process Sales by Item CSV
  if (body.salesByItemCsv) {
    try {
      const rows = parse(body.salesByItemCsv, { columns: true, skip_empty_lines: true }) as any[];
      console.log(`[POS Upload] Processing ${rows.length} sales items...`);
      
      const items = rows.map((row) => ({
        batchId: batch.id,
        name: String(row["Item"] ?? row["Name"] ?? ""),
        qty: Number(row["Qty"] ?? row["Quantity"] ?? 0),
        net: num(row["Net Sales"] ?? row["Net sales"] ?? row["Net"]).toString(),
      }));
      
      await db.insert(posSalesItem).values(items);
      console.log(`[POS Upload] Inserted ${items.length} sales items`);
    } catch (error) {
      console.error('[POS Upload] Error processing sales items:', error);
    }
  }

  // Process Sales by Modifier CSV
  if (body.salesByModifierCsv) {
    try {
      const rows = parse(body.salesByModifierCsv, { columns: true, skip_empty_lines: true }) as any[];
      console.log(`[POS Upload] Processing ${rows.length} modifiers...`);
      
      const modifiers = rows.map((row) => ({
        batchId: batch.id,
        name: String(row["Modifier"] ?? row["Name"] ?? ""),
        qty: Number(row["Qty"] ?? row["Quantity"] ?? 0),
        net: num(row["Net Sales"] ?? row["Net sales"] ?? row["Net"]).toString(),
      }));
      
      await db.insert(posSalesModifier).values(modifiers);
      console.log(`[POS Upload] Inserted ${modifiers.length} modifiers`);
    } catch (error) {
      console.error('[POS Upload] Error processing modifiers:', error);
    }
  }

  // Process Sales by Payment Method CSV
  if (body.salesByPaymentCsv) {
    try {
      const rows = parse(body.salesByPaymentCsv, { columns: true, skip_empty_lines: true }) as any[];
      console.log(`[POS Upload] Processing ${rows.length} payment methods...`);
      
      const payments = rows.map((row) => ({
        batchId: batch.id,
        method: String(row["Payment Method"] ?? row["Method"] ?? ""),
        amount: num(row["Amount"] ?? row["Total"] ?? row["Net"]).toString(),
      }));
      
      await db.insert(posPaymentSummary).values(payments);
      console.log(`[POS Upload] Inserted ${payments.length} payment methods`);
    } catch (error) {
      console.error('[POS Upload] Error processing payments:', error);
    }
  }

  console.log(`[POS Upload] Batch ${batch.id} processing complete`);
  return batch.id;
}