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

  // Detect type
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
    };

    // Try to update first, then insert if not exists
    const existing = await db.select().from(loyverse_shifts).where(eq(loyverse_shifts.shiftDate, new Date(row["Opened At"])));
    
    if (existing.length > 0) {
      await db.update(loyverse_shifts)
        .set(shiftData)
        .where(eq(loyverse_shifts.shiftDate, new Date(row["Opened At"])));
    } else {
      await db.insert(loyverse_shifts).values({
        shiftDate: new Date(row["Opened At"]),
        ...shiftData,
      }).onConflictDoNothing();
    }
    inserted++;
  }
  return { status: "ok", type: "shift", rows: inserted };
}

async function processPaymentReport(records: any[]) {
  let inserted = 0;
  for (const row of records) {
    await db.insert(loyverse_receipts).values({
      receipt_number: row["Receipt Number"],
      payment_type: row["Payment Type"],
      amount: parseFloat(row["Amount"] || 0),
      receipt_date: new Date(row["Receipt Date"]),
      shift_id: row["Shift ID"],
    }).onConflictDoNothing();
    inserted++;
  }
  return { status: "ok", type: "payment", rows: inserted };
}

async function processSalesSummary(records: any[]) {
  let inserted = 0;
  for (const row of records) {
    const summaryData = {
      gross_sales: parseFloat(row["Gross Sales"] || 0),
      net_sales: parseFloat(row["Net Sales"] || 0),
      expenses: parseFloat(row["Discounts"] || 0),
    };

    const shiftDate = new Date(row["Opened At"] || Date.now());
    const existing = await db.select().from(loyverse_shifts).where(eq(loyverse_shifts.shiftDate, shiftDate));
    
    if (existing.length > 0) {
      await db.update(loyverse_shifts)
        .set(summaryData)
        .where(eq(loyverse_shifts.shiftDate, shiftDate));
    } else {
      await db.insert(loyverse_shifts).values({
        shiftDate,
        ...summaryData,
      }).onConflictDoNothing();
    }
    inserted++;
  }
  return { status: "ok", type: "summary", rows: inserted };
}