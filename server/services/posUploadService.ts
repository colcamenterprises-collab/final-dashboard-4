import fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { db } from "../db";
import { loyverseShiftReports, loyverseReceipts } from "../../shared/schema";

export async function processPosCsv(filePath: string) {
  const csvData = fs.readFileSync(filePath, "utf-8");
  const records = csvParse(csvData, {
    columns: true,
    skip_empty_lines: true,
  });

  if (!records.length) return;

  const headers = Object.keys(records[0]).map(h => h.toLowerCase());

  // Detect file type
  if (headers.includes("shift id")) {
    return processShiftReport(records);
  }
  if (headers.includes("payment type")) {
    return processPaymentReport(records);
  }
  if (headers.includes("net sales") && headers.includes("gross sales")) {
    return processSalesSummary(records);
  }

  return { status: "unknown", message: "CSV type not recognized" };
}

async function processShiftReport(records: any[]) {
  for (const row of records) {
    await db.insert(loyverseShiftReports).values({
      reportId: row["Shift ID"] || `shift_${Date.now()}`,
      totalSales: parseFloat(row["Gross Sales"] || 0).toString(),
      reportData: row,
    }).onConflictDoNothing();
  }
  return { status: "ok", type: "shift" };
}

async function processPaymentReport(records: any[]) {
  for (const row of records) {
    await db.insert(loyverseReceipts).values({
      receiptId: row["Receipt Number"] || row["Receipt ID"] || `receipt_${Date.now()}`,
      receiptNumber: row["Receipt Number"] || row["Receipt ID"] || "unknown",
      receiptDate: new Date(row["Receipt Date"] || row["Date"]),
      totalAmount: parseFloat(row["Amount"] || row["Total"] || 0),
      paymentMethod: row["Payment Type"] || row["Payment Method"] || "unknown",
      items: [{ name: "Payment record", amount: parseFloat(row["Amount"] || 0) }],
      shiftDate: new Date(row["Receipt Date"] || row["Date"]),
    }).onConflictDoNothing();
  }
  return { status: "ok", type: "payment" };
}

async function processSalesSummary(records: any[]) {
  for (const row of records) {
    await db.insert(loyverseShiftReports).values({
      reportId: row["Shift ID"] || `summary_${Date.now()}`,
      totalSales: parseFloat(row["Gross Sales"] || 0),
      reportData: row,
    }).onConflictDoNothing();
  }
  return { status: "ok", type: "summary" };
}