import fs from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../db";
import { loyverse_shifts, loyverse_receipts } from "../../shared/schema";

function detectCsvType(headers: string[]): "shift" | "receipt" | "summary" | "unknown" {
  const h = headers.map(h => h.toLowerCase());

  if (h.some(x => x.includes("shift")) && h.some(x => x.includes("gross"))) return "shift";
  if (h.some(x => x.includes("payment")) && h.some(x => x.includes("receipt"))) return "receipt";
  if (h.some(x => x.includes("gross")) && h.some(x => x.includes("net"))) return "summary";

  return "unknown";
}

export async function processPosCsv(filePath: string) {
  console.log("🚀 processPosCsv called with:", filePath);
  const csvData = fs.readFileSync(filePath, "utf-8");
  console.log("📄 CSV data length:", csvData.length);
  const records = parse(csvData, { columns: true, skip_empty_lines: true });
  console.log("📊 Records parsed:", records.length);

  if (!records.length) return { status: "error", message: "Empty CSV" };

  const headers = Object.keys(records[0]);
  const type = detectCsvType(headers);
  
  // Debug logging to see what headers we're getting
  console.log("🔍 CSV Headers:", headers);
  console.log("🔍 Detected Type:", type);

  let inserted = 0;

  if (type === "shift") {
    for (const row of records) {
      await db.insert(loyverse_shifts).values({
        shiftDate: new Date(row["Opened At"] || Date.now()).toISOString().split('T')[0],
        data: row,
      }).onConflictDoUpdate({
        target: loyverse_shifts.shiftDate,
        set: { data: row }
      });
      inserted++;
    }
  }

  if (type === "receipt" || type === "summary") {
    for (const row of records) {
      await db.insert(loyverse_receipts).values({
        shiftDate: new Date(row["Receipt Date"] || row["Date"] || Date.now()).toISOString().split('T')[0],
        data: row,
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