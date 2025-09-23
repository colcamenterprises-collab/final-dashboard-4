import fs from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../db";
import { loyverse_shifts, loyverse_receipts } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function processPosCsv(filePath: string) {
  const csvData = fs.readFileSync(filePath, "utf-8");
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  });

  if (!records.length) return { status: "error", message: "Empty CSV" };

  const headers = Object.keys(records[0]).map(h => h.toLowerCase());

  if (headers.includes("shift id")) {
    return await processShiftReport(records);
  }
  if (headers.includes("payment type")) {
    return await processPaymentReport(records);
  }
  if (headers.includes("gross sales") && headers.includes("net sales")) {
    return await processSalesSummary(records);
  }

  return { status: "error", message: "Unrecognized CSV format" };
}

async function processShiftReport(records: any[]) {
  let inserted = 0;
  for (const row of records) {
    const shiftDate = new Date(row["Opened At"]).toISOString().split('T')[0];
    
    const existing = await db.query.loyverse_shifts.findFirst({
      where: eq(loyverse_shifts.shiftDate, shiftDate),
    });

    const shiftData = {
      gross_sales: parseFloat(row["Gross Sales"] || 0),
      net_sales: parseFloat(row["Net Sales"] || 0),
      cash: parseFloat(row["Cash Payments"] || 0),
      card: parseFloat(row["Card Payments"] || 0),
      qr: parseFloat(row["QR Payments"] || 0),
      pay_in: parseFloat(row["Pay Ins"] || 0),
      pay_out: parseFloat(row["Pay Outs"] || 0),
      expected_cash: parseFloat(row["Expected Cash Amount"] || 0),
      actual_cash: parseFloat(row["Actual Cash Amount"] || 0),
      raw_data: row
    };

    if (existing) {
      await db
        .update(loyverse_shifts)
        .set({ data: shiftData })
        .where(eq(loyverse_shifts.shiftDate, shiftDate));
    } else {
      await db.insert(loyverse_shifts).values({
        shiftDate,
        data: shiftData,
      });
    }
    inserted++;
  }
  return { status: "ok", type: "shift", rows: inserted };
}

async function processPaymentReport(records: any[]) {
  let inserted = 0;
  for (const row of records) {
    const receiptDate = new Date(row["Receipt Date"]).toISOString().split('T')[0];
    
    const receiptData = {
      receipt_number: row["Receipt Number"],
      shift_id: row["Shift ID"],
      payment_type: row["Payment Type"],
      amount: parseFloat(row["Amount"] || 0),
      raw_data: row
    };

    await db.insert(loyverse_receipts).values({
      shiftDate: receiptDate,
      data: receiptData,
    });
    inserted++;
  }
  return { status: "ok", type: "payment", rows: inserted };
}

async function processSalesSummary(records: any[]) {
  let inserted = 0;
  for (const row of records) {
    const shiftDate = new Date(row["Opened At"] || Date.now()).toISOString().split('T')[0];
    
    const existing = await db.query.loyverse_shifts.findFirst({
      where: eq(loyverse_shifts.shiftDate, shiftDate),
    });

    const summaryData = {
      gross_sales: parseFloat(row["Gross Sales"] || 0),
      net_sales: parseFloat(row["Net Sales"] || 0),
      expenses: parseFloat(row["Discounts"] || 0),
      raw_data: row
    };

    if (existing) {
      await db
        .update(loyverse_shifts)
        .set({ data: summaryData })
        .where(eq(loyverse_shifts.shiftDate, shiftDate));
    } else {
      await db.insert(loyverse_shifts).values({
        shiftDate,
        data: summaryData,
      });
    }
    inserted++;
  }
  return { status: "ok", type: "summary", rows: inserted };
}