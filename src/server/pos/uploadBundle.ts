import { prisma } from "../../../lib/prisma";
import { parse } from "csv-parse/sync";
// Utility: get field by tolerant matching
function pick(row: any, keys: string[], def: any = null) {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
    const found = Object.keys(row).find(h => h.toLowerCase().includes(k.toLowerCase()));
    if (found) return row[found];
  }
  return def;
}

function num(val: any) {
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/[^\d\.\-]/g, ""); // strip currency symbols, commas, ฿
  const f = parseFloat(cleaned);
  return isNaN(f) ? 0 : f;
}

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

  // Receipts
  if (body.receiptsCsv) {
    const rows = parse(body.receiptsCsv, { columns: true, skip_empty_lines: true }) as any[];

    const norm = (r:any, key:string[]) => {
      for (const k of key) {
        if (r[k] !== undefined) return r[k];
        // case-insensitive fallback
        const hit = Object.keys(r).find(h => h.toLowerCase() === k.toLowerCase());
        if (hit) return r[hit];
      }
      return undefined;
    };

    const parseDateTime = (r:any) => {
      const dt = norm(r, ["Date/time","Date/Time","Date time"]);
      if (dt) return new Date(dt);
      const d = norm(r, ["Date"]);
      const t = norm(r, ["Time"]);
      if (d && t) return new Date(`${d} ${t}`);
      return new Date();
    };

    await prisma.posReceipt.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        receiptId: String(norm(r, ["Receipt #","Receipt number","Receipt"]) || ""),
        datetime: parseDateTime(r),
        total: num(norm(r, ["Total","Total amount","Amount"])),
        itemsJson: [],
        payment: String(norm(r, ["Payment method","Payment Method","Payment type","Payment Type"]) || null)
      }))
    });
  }

  // Shift Report (shifts-YYYY.csv)
  if (body.shiftReportCsv) {
    const rows = parse(body.shiftReportCsv, { columns: true, skip_empty_lines: true }) as any[];
    const r = rows[0] || {};
    await prisma.posShiftReport.create({
      data: {
        batchId: batch.id,
        grossSales: num(pick(r, ["Gross sales","Gross Sales"])),
        discounts: num(pick(r, ["Discounts"])),
        netSales: num(pick(r, ["Net sales","Net Sales","Net Sales (฿)"])),
        cashInDrawer: num(pick(r, ["Cash in drawer","Cash in Drawer","Cash Drawer"])),
        cashSales: num(pick(r, ["Cash sales","Cash Sales"])),
        qrSales: num(pick(r, ["Card","QR","QR sales","QR Sales","Credit Card","POS Card"])),
        otherSales: num(pick(r, ["Other sales","Others"])),
        receiptCount: num(pick(r, ["Receipts","Receipt Count"]))
      }
    });
  }

  // Item Sales (item-sales-summary-YYYY.csv)
  if (body.itemSalesCsv) {
    const rows = parse(body.itemSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesItem.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: pick(r, ["Item","Name"]) || "Unknown",
        qty: num(pick(r, ["Qty","Quantity","Sold qty"])),
        net: num(pick(r, ["Net sales","Net Sales","Net Sales (฿)","Net amount"]))
      }))
    });
  }

  // Modifier Sales (modifier-sales-YYYY.csv)
  if (body.modifierSalesCsv) {
    const rows = parse(body.modifierSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posSalesModifier.createMany({
      data: rows.map(r => ({
        batchId: batch.id,
        name: pick(r, ["Modifier","Name"]) || "Unknown",
        qty: num(pick(r, ["Qty","Quantity","Sold qty"])),
        net: num(pick(r, ["Net sales","Net Sales","Net Sales (฿)","Net amount"]))
      }))
    });
  }

  // Payment Type Sales
  if (body.paymentTypeSalesCsv) {
    const rows = parse(body.paymentTypeSalesCsv, { columns: true, skip_empty_lines: true }) as any[];
    await prisma.posPaymentSummary.createMany({
      data: rows.map(r => {
        const method = r["Payment method"] ?? r["Payment Method"] ?? r["Payment type"] ?? r["Payment Type"] ?? "";
        const total  = r["Total"] ?? r["Amount"] ?? r["Sum"] ?? 0;
        return {
          batchId: batch.id,
          method: String(method),
          amount: num(total)
        };
      })
    });
  }

  return { batchId: batch.id };
}