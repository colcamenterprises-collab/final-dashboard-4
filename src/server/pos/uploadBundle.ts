import { prisma } from "../../../lib/prisma";
import { parse } from "csv-parse/sync";
const num = (v:any)=> Number(String(v||"").replace(/[^\d.-]/g,"")) || 0;
const toDate = (v:any)=> { const d=new Date(v); return isNaN(+d)? new Date(): d; };

type Body = {
  title?: string;
  shiftStartISO?: string;
  shiftEndISO?: string;
  receiptsCsv?: string;
  shiftReportCsv?: string;
  itemSalesCsv?: string;
  modifierSalesCsv?: string;
  paymentTypeSalesCsv?: string;
};

export async function importPosBundle(body: Body) {
  const batch = await prisma.posBatch.create({
    data: {
      title: body.title ?? null,
      shiftStart: body.shiftStartISO ? new Date(body.shiftStartISO) : null,
      shiftEnd: body.shiftEndISO ? new Date(body.shiftEndISO) : null
    }
  });

  // Receipts (receipts-YYYY.csv)
  if (body.receiptsCsv) {
    const rows = parse(body.receiptsCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posReceipt.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        receiptId: r["Receipt #"],
        datetime: toDate(r["Date/time"]),
        total: num(r["Total"]),
        itemsJson: [],
        payment: r["Payment method"] || r["Payment Method"] || null
      }))
    });
  }

  // Shift Report (shifts-YYYY.csv)
  if (body.shiftReportCsv) {
    const r = parse(body.shiftReportCsv, { columns: true, skip_empty_lines: true }) as any[];
    const row = r[0] || {};
    await prisma.posShiftReport.create({
      data: {
        batchId: batch.id,
        grossSales: num(row["Gross sales"]),
        discounts: num(row["Discounts"]),
        netSales: num(row["Net sales"]),
        cashInDrawer: num(row["Actual cash amount"]),
        cashSales: num(row["Cash payments"]),
        qrSales: num(row["Card payments"] || row["QR payments"] || 0),
        otherSales: num(row["Other payments"] || 0),
        receiptCount: Number(row["Receipts"] || 0)
      }
    });
  }

  // Item Sales (item-sales-summary-YYYY.csv)
  if (body.itemSalesCsv) {
    const rows = parse(body.itemSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesItem.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: String(r["Item"] ?? r["Name"] ?? ""),
        qty: Number(r["Qty"] ?? r["Quantity"] ?? 0),
        net: num(r["Net sales"])
      }))
    });
  }

  // Modifier Sales (modifier-sales-YYYY.csv)
  if (body.modifierSalesCsv) {
    const rows = parse(body.modifierSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesModifier.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: String(r["Modifier"] ?? r["Name"] ?? ""),
        qty: Number(r["Qty"] ?? r["Quantity"] ?? 0),
        net: num(r["Net sales"])
      }))
    });
  }

  // Payment Type Sales (payment-type-sales-YYYY.csv)
  if (body.paymentTypeSalesCsv) {
    const rows = parse(body.paymentTypeSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posPaymentSummary.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        method: String(r["Payment method"] ?? r["Payment Method"] ?? ""),
        amount: num(r["Total"])
      }))
    });
  }

  return { batchId: batch.id };
}