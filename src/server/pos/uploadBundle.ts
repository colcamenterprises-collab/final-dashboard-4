import { prisma } from "../../../lib/prisma";
import { parse } from "csv-parse/sync";

// tolerant getters
function pick(row: any, candidates: string[], def: any = null) {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
    const hit = Object.keys(row).find(h => h.trim().toLowerCase() === c.trim().toLowerCase());
    if (hit) return row[hit];
  }
  // loose contains()
  for (const key of Object.keys(row)) {
    const low = key.trim().toLowerCase();
    if (candidates.some(c => low.includes(c.trim().toLowerCase()))) return row[key];
  }
  return def;
}
function num(val: any) {
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/[^\d.\-]/g, "");
  const f = parseFloat(cleaned);
  return isNaN(f) ? 0 : f;
}
const toDate = (v:any)=>{ const d=new Date(v); return isNaN(+d)? new Date(): d; };

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

  // Receipts (various header variants)
  if (body.receiptsCsv) {
    const rows = parse(body.receiptsCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posReceipt.createMany({
      data: rows.map(r => {
        // date/time variants
        const dt = pick(r, ["Date/time","Date Time","Date/Time","Date Time (local)","Date"]) ??
                   `${pick(r,["Date"],"")} ${pick(r,["Time"],"")}`;
        return {
          batchId: batch.id,
          receiptId: String(pick(r, ["Receipt #","Receipt number","Receipt","Receipt No.","Number"], "")),
          datetime: toDate(dt),
          total: num(pick(r, ["Total","Total amount","Amount","Grand total"], 0)),
          itemsJson: [],
          payment: String(pick(r, ["Payment method","Payment Method","Payment type","Payment Type"], "")) || null,
        };
      })
    });
  }

  // Shift Report (your file has "Cash payments", "Actual cash amount", etc.)
  if (body.shiftReportCsv) {
    const rws = parse(body.shiftReportCsv, { columns: true, skip_empty_lines: true }) as any[];
    const r = rws[0] || {};
    await prisma.posShiftReport.create({
      data: {
        batchId: batch.id,
        grossSales:   num(pick(r, ["Gross sales","Gross Sales"], 0)),
        discounts:    num(pick(r, ["Discounts"], 0)),
        netSales:     num(pick(r, ["Net sales","Net Sales","Net Sales (฿)","Net amount"], 0)),
        cashInDrawer: num(pick(r, ["Actual cash amount","Cash in drawer","Cash in Drawer"], 0)),
        cashSales:    num(pick(r, ["Cash payments","Cash Sales","Cash"], 0)),
        qrSales:      num(pick(r, ["QR payments","Card payments","Bank card","QR/Card"], 0)),
        otherSales:   num(pick(r, ["Other payments","Others"], 0)),
        // don't trust shift report for receipt count; compute later from receipts
        receiptCount: 0
      }
    });
  }

  // Item Sales
  if (body.itemSalesCsv) {
    const rows = parse(body.itemSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesItem.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: String(pick(r, ["Item","Name"], "Unknown")),
        qty:  Math.round(num(pick(r, ["Qty","Quantity","Sold qty"], 0))),
        net:  num(pick(r, ["Net sales","Net Sales","Net Sales (฿)","Net amount"], 0)),
      }))
    });
  }

  // Modifier Sales
  if (body.modifierSalesCsv) {
    const rows = parse(body.modifierSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesModifier.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: String(pick(r, ["Modifier","Name"], "Unknown")),
        qty:  Math.round(num(pick(r, ["Qty","Quantity","Sold qty"], 0))),
        net:  num(pick(r, ["Net sales","Net Sales","Net Sales (฿)","Net amount"], 0)),
      }))
    });
  }

  // Payment Type Sales
  if (body.paymentTypeSalesCsv) {
    const rows = parse(body.paymentTypeSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posPaymentSummary.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        method: String(pick(r, ["Payment method","Payment Method","Payment type","Payment Type"], "")),
        amount: num(pick(r, ["Total","Amount","Sum"], 0)),
      }))
    });
  }

  // backfill receiptCount from actual receipts we just inserted
  const rc = await prisma.posReceipt.count({ where: { batchId: batch.id } });
  if (rc > 0) {
    const s = await prisma.posShiftReport.findUnique({ where: { batchId: batch.id } });
    if (s) await prisma.posShiftReport.update({ where: { batchId: batch.id }, data: { receiptCount: rc } });
  }

  return { batchId: batch.id };
}