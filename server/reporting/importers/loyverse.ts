import type {
  CanonicalLineItem,
  CanonicalPayment,
  CanonicalTransaction,
  ImportContext,
  ImportValidation,
  ReportingSourceAdapter,
  SourceFileDescriptor,
} from "./types";

const RECEIPT_HINTS = ["receipt", "receipts"];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseNumber(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = row[normalize(name)];
    if (value != null && value !== "") return value;
  }
  return "";
}

function asObjects(file: SourceFileDescriptor): Record<string, string>[] {
  const text = Buffer.isBuffer(file.contents) ? file.contents.toString("utf8") : file.contents;
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalize);
  return rows.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function receiptFile(files: SourceFileDescriptor[]): SourceFileDescriptor | undefined {
  return files.find(file => RECEIPT_HINTS.some(hint => normalize(file.filename).includes(hint))) ?? files[0];
}

function occurredAt(row: Record<string, string>): string {
  const raw = pick(row, "Date", "Receipt date", "Created at", "Date and time", "Datetime");
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function toPayment(row: Record<string, string>, total: number): CanonicalPayment[] {
  const method = pick(row, "Payment type", "Payment method", "Payment");
  if (!method) return [];
  return [{ paymentMethod: method, amount: total, paidAt: occurredAt(row) || undefined, sourcePayload: row }];
}

function toItem(row: Record<string, string>, index: number): CanonicalLineItem[] {
  const name = pick(row, "Item", "Item name");
  if (!name) return [];
  const quantity = parseNumber(pick(row, "Quantity", "Items sold")) || 1;
  const gross = parseNumber(pick(row, "Gross sales", "Gross", "Item gross"));
  const discount = Math.abs(parseNumber(pick(row, "Discounts", "Discount")));
  const refund = Math.abs(parseNumber(pick(row, "Refunds", "Refund")));
  const net = parseNumber(pick(row, "Net sales", "Net")) || gross - discount - refund;
  return [{
    sourceLineId: pick(row, "Line item id", "Line id") || `${pick(row, "Receipt number", "Receipt", "Order") || "row"}:${index}`,
    sourceItemId: pick(row, "Item id") || undefined,
    itemName: name,
    sku: pick(row, "SKU") || undefined,
    category: pick(row, "Category") || undefined,
    quantity,
    unitPrice: quantity ? gross / quantity : undefined,
    grossSales: gross,
    discountTotal: discount,
    refundTotal: refund,
    netSales: net,
    taxTotal: parseNumber(pick(row, "Taxes", "Tax")),
    sourcePayload: row,
  }];
}

export const loyverseAdapter: ReportingSourceAdapter = {
  id: "loyverse",
  displayName: "Loyverse POS",
  detect(files) {
    const file = receiptFile(files);
    if (!file) return 0;
    const nameScore = RECEIPT_HINTS.some(hint => normalize(file.filename).includes(hint)) ? 40 : 0;
    const first = asObjects(file)[0];
    if (!first) return nameScore;
    const keys = Object.keys(first);
    const receiptScore = keys.some(k => k.includes("receipt")) ? 30 : 0;
    const salesScore = keys.some(k => k.includes("total") || k.includes("net sales")) ? 20 : 0;
    return Math.min(100, nameScore + receiptScore + salesScore);
  },
  async validate(files, context): Promise<ImportValidation> {
    const file = receiptFile(files);
    if (!file) return { ok: false, warnings: [], errors: ["No Loyverse receipt CSV supplied"] };
    const rows = asObjects(file);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!rows.length) errors.push("Receipt CSV contains no data rows");
    const ids = rows.map(row => pick(row, "Receipt number", "Receipt", "Order", "Order number")).filter(Boolean);
    if (!ids.length) errors.push("No receipt/order identifier column was detected");
    const dates = rows.map(occurredAt).filter(Boolean);
    if (!dates.length) errors.push("No receipt timestamp column was detected");
    if (context.cutoverAt) {
      const cutover = new Date(context.cutoverAt).getTime();
      const atOrAfter = dates.filter(value => {
        const time = new Date(value).getTime();
        return Number.isFinite(time) && time >= cutover;
      }).length;
      if (atOrAfter) errors.push(`${atOrAfter} Loyverse rows are at/after the configured cutover and must not be imported as canonical historical sales`);
    }
    const totals = rows.map(row => parseNumber(pick(row, "Total", "Net sales", "Net")));
    return {
      ok: errors.length === 0,
      warnings,
      errors,
      sourceRowCount: rows.length,
      transactionCount: new Set(ids).size || rows.length,
      netSales: totals.reduce((sum, value) => sum + value, 0),
    };
  },
  async *parse(files, context): AsyncIterable<CanonicalTransaction> {
    const file = receiptFile(files);
    if (!file) return;
    const rows = asObjects(file);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const sourceTransactionId = pick(row, "Receipt number", "Receipt", "Order", "Order number") || `loyverse-row-${index + 2}`;
      const total = parseNumber(pick(row, "Total", "Net sales", "Net"));
      const subtotal = parseNumber(pick(row, "Gross sales", "Subtotal", "Gross")) || total;
      const discountTotal = Math.abs(parseNumber(pick(row, "Discounts", "Discount")));
      const refundTotal = Math.abs(parseNumber(pick(row, "Refunds", "Refund")));
      const taxTotal = parseNumber(pick(row, "Taxes", "Tax"));
      yield {
        venueKey: context.venueKey,
        sourceSystem: "loyverse",
        sourceTransactionId,
        sourceReceiptNumber: sourceTransactionId,
        occurredAt: occurredAt(row),
        businessTimezone: context.timezone,
        channel: pick(row, "Dining option", "Channel", "Order type") || undefined,
        orderMode: pick(row, "Dining option", "Order type") || undefined,
        paymentStatus: pick(row, "Status", "Payment status") || undefined,
        subtotal,
        discountTotal,
        refundTotal,
        taxTotal,
        netSales: total,
        total,
        currency: context.currency || pick(row, "Currency") || "THB",
        staffName: pick(row, "Employee", "Staff", "Cashier") || undefined,
        items: toItem(row, index),
        payments: toPayment(row, total),
        sourcePayload: row,
      };
    }
  },
};

export default loyverseAdapter;
