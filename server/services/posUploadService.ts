import fs from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../db";
import { loyverse_shifts, loyverse_receipts } from "../../shared/schema";

export async function processPosCsv(filePath: string) {
  const csvData = fs.readFileSync(filePath, "utf-8");
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  if (!records.length) return { status: "error", message: "Empty CSV" };

  // Detect type by headers
  const headers = Object.keys(records[0]).map(h => h.toLowerCase());
  let type: "shift" | "receipt" | "unknown" = "unknown";

  if (headers.includes("shift id") && headers.includes("gross sales")) type = "shift";
  if (headers.includes("payment type") && headers.includes("receipt number")) type = "receipt";

  let inserted = 0;

  if (type === "shift") {
    for (const row of records) {
      await db.insert(loyverse_shifts).values({
        shiftDate: new Date(row["Opened At"] || Date.now()).toISOString().split('T')[0],
        data: row, // store full row as JSON
      }).onConflictDoUpdate({
        target: loyverse_shifts.shiftDate,
        set: { data: row }
      });
      inserted++;
    }
  }

  if (type === "receipt") {
    for (const row of records) {
      await db.insert(loyverse_receipts).values({
        shiftDate: new Date(row["Receipt Date"] || Date.now()).toISOString().split('T')[0],
        data: row, // store full row as JSON
      }).onConflictDoUpdate({
        target: loyverse_receipts.shiftDate,
        set: { data: row }
      });
      inserted++;
    }
  }

  return { status: "ok", type, rows: inserted };
}

// 🔎 Extractor for reconciliation
export async function getShiftSummary(date: string) {
  const shift = await db.query.loyverse_shifts.findFirst({
    where: (s, { eq }) => eq(s.shiftDate, date),
  });

  if (!shift?.data) return null;

  const row = shift.data as any;

  return {
    grossSales: Number(row["Gross Sales"] || 0),
    netSales: Number(row["Net Sales"] || 0),
    cash: Number(row["Cash"] || 0),
    qr: Number(row["QR Code"] || 0),
    grab: Number(row["Grab"] || 0),
    other: Number(row["Other"] || 0),
    payIn: Number(row["Pay In"] || 0),
    payOut: Number(row["Pay Out"] || 0),
    expectedCash: Number(row["Expected Cash Amount"] || 0),
    actualCash: Number(row["Actual Cash Amount"] || 0),
  };
}