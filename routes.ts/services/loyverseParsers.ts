// server/services/loyverseParsers.ts
import { parse as csvParse } from "csv-parse/sync";

type File = { originalname: string; buffer: Buffer; mimetype: string };

const cleanNum = (v:any) => {
  if (v === null || v === undefined) return 0;
  let s = String(v).replace(/[,฿%]/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const lc = (s:string)=> (s||"").toLowerCase();

function parseCSV(buf:Buffer): any[] {
  // attempt UTF-8 first, then UTF-16 tab if needed
  try {
    return csvParse(buf, { columns: true, skip_empty_lines: true });
  } catch {
    const txt = buf.toString("utf16le");
    return csvParse(txt, { columns: true, skip_empty_lines: true, delimiter: "\t" });
  }
}

export async function parseLoyverseFilesToSummary(files: File[], opts: { dateHint?: string } = {}) {
  const buckets:any = {}; // by guessed type
  for (const f of files) {
    const rows = parseCSV(f.buffer);
    const name = f.originalname.toLowerCase();
    if (name.includes("payment-type")) buckets.payment = rows;
    else if (name.includes("item-sales")) buckets.items = rows;
    else if (name.includes("modifier")) buckets.modifiers = rows;
    else if (name.includes("shift")) buckets.shifts = rows;
    else if (name.includes("receipts")) buckets.receipts = rows;
    else if (name.includes("sales-summary")) buckets.summary = rows;
    else {
      // try by headers
      const headers = Object.keys(rows[0] || {}).map(h=>h.toLowerCase());
      if (headers.includes("sales type") || headers.includes("payment type")) buckets.payment = rows;
      else if (headers.includes("item name") && headers.includes("items sold")) buckets.items = rows;
      else if (headers.includes("modifier") && headers.includes("qty")) buckets.modifiers = rows;
      else if (headers.includes("receipt number")) buckets.receipts = rows;
      else buckets.summary = rows;
    }
  }

  // 1) KPIs from summary
  const sumRows = buckets.summary || [];
  const grossSales = sumRows.reduce((a:number,r:any)=> a + cleanNum(r["Gross sales"]), 0);
  const refunds    = sumRows.reduce((a:number,r:any)=> a + cleanNum(r["Refunds"]||r["Refunded amount"]), 0);
  const netSales   = sumRows.reduce((a:number,r:any)=> a + cleanNum(r["Net sales"]), 0);

  // 2) Payment breakdown
  const payRows = buckets.payment || [];
  const paymentBreakdown:any = {};
  for (const r of payRows as any[]) {
    const label = String(r["Sales type"] || r["Payment type"] || r[Object.keys(r)[0]] || "").trim();
    const amt   = cleanNum(r["Gross sales"] || r["Amount"] || r[Object.keys(r)[1]]);
    paymentBreakdown[label] = (paymentBreakdown[label] || 0) + amt;
  }

  // Normalize keys we care about
  const normPay = {
    Cash: paymentBreakdown["Cash"] || 0,
    QR: paymentBreakdown["QR"] || paymentBreakdown["PromptPay"] || paymentBreakdown["QR PromptPay"] || 0,
    Grab: Object.keys(paymentBreakdown).filter(k=>lc(k).includes("grab")).reduce((a,k)=>a+paymentBreakdown[k],0),
    "Aroi Dee": Object.keys(paymentBreakdown).filter(k=>lc(k).includes("aroi")).reduce((a,k)=>a+paymentBreakdown[k],0),
    Direct: paymentBreakdown["Direct"] || 0,
    Other: paymentBreakdown["Other"] || 0,
    Card: paymentBreakdown["Card"] || 0
  };

  // 3) Receipts count + members (from receipts file if present)
  const recRows = buckets.receipts || [];
  const totalReceipts = recRows.length || cleanNum(sumRows[0]?.["Receipts"]);
  const memberCol = recRows.length ? Object.keys(recRows[0]).find(c=>lc(c).includes("member") || lc(c).includes("customer")) : null;
  const members = memberCol ? recRows.filter(r => String(r[memberCol]||"").trim() !== "").length : 0;

  // 4) Items (counts & top 5)
  const itemRows = buckets.items || [];
  const items = itemRows.map((r:any)=> ({
    itemName: r["Item name"] || r["Item"] || "",
    qty: cleanNum(r["Items sold"] || r["Qty"]),
    gross: cleanNum(r["Gross sales"] || r["Gross"])
  }));
  items.sort((a,b)=> (b.qty - a.qty) || (b.gross - a.gross));
  const top5 = items.slice(0,5);

  // 5) Burgers sold (heuristic contains 'burger')
  const burgersSold = items.filter(i => lc(i.itemName).includes("burger")).reduce((a,i)=>a+i.qty,0);

  // 6) Aroi/Grab from normalized pay
  const grabSales = normPay.Grab;
  const aroiDeeSales = normPay["Aroi Dee"];

  // 7) Date (local)
  let dateLocal = opts.dateHint || "";
  if (!dateLocal) {
    // try first date from receipts or summary
    const dateCol = recRows.length ? Object.keys(recRows[0]).find(c=>lc(c).includes("date")) : null;
    if (dateCol) {
      const first = String(recRows[0][dateCol]).split(" ")[0];
      dateLocal = first;
    }
  }

  return {
    dateLocal,
    kpis: {
      grossSales,
      netSales,
      refunds,
      totalReceipts,
      members,
      grabSales,
      aroiDeeSales,
      burgersSold
    },
    paymentBreakdown: normPay,
    topItems: top5,
    allItems: items
  };
}