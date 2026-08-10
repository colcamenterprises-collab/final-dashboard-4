import { DateTime } from "luxon";
import type {
  CanonicalLineItem,
  CanonicalModifier,
  CanonicalPayment,
  CanonicalTransaction,
  ImportContext,
  ImportValidation,
  ReportingSourceAdapter,
  SourceFileDescriptor,
} from "./types";

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
  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    if (quoted) {
      if (ch === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim() !== ""));
}

function fileObjects(file: SourceFileDescriptor) {
  const text = Buffer.isBuffer(file.contents) ? file.contents.toString("utf8") : file.contents;
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [] as string[], rows: [] as Record<string, string>[] };
  const headers = rows[0].map(normalize);
  return {
    headers,
    rows: rows.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))),
  };
}

function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = row[normalize(name)];
    if (value != null && value !== "") return value;
  }
  return "";
}

function receiptId(row: Record<string, string>): string {
  return pick(row, "Receipt number", "Receipt", "Receipt no", "Order", "Order number").trim();
}

function receiptType(row: Record<string, string>): "sale" | "refund" {
  return normalize(pick(row, "Receipt type", "Type")).includes("refund") ? "refund" : "sale";
}

function isCancelled(row: Record<string, string>): boolean {
  return normalize(pick(row, "Status")) === "cancelled";
}

function identifyFiles(files: SourceFileDescriptor[]) {
  const inspected = files.map(file => ({ file, ...fileObjects(file), name: normalize(file.filename) }));
  const items = inspected.find(candidate => candidate.name.includes("by item") || (candidate.headers.includes("item name") && (candidate.headers.includes("sku") || candidate.headers.includes("category"))));
  const receipts = inspected.find(candidate => candidate !== items && candidate.headers.some(header => header.includes("receipt")) && candidate.headers.some(header => header === "total collected" || header === "net sales" || header.includes("payment")))
    || inspected.find(candidate => candidate !== items && candidate.name.includes("receipt"));
  return { receipts, items };
}

function parseOccurredAt(row: Record<string, string>, timezone: string): string {
  const raw = pick(row, "Date", "Receipt date", "Created at", "Date and time", "Datetime", "Time");
  if (!raw) return "";
  const iso = DateTime.fromISO(raw, { zone: timezone });
  if (iso.isValid) return iso.toUTC().toISO() || "";
  for (const format of ["yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "M/d/yyyy H:mm:ss", "M/d/yyyy H:mm"]) {
    const parsed = DateTime.fromFormat(raw, format, { zone: timezone });
    if (parsed.isValid) return parsed.toUTC().toISO() || "";
  }
  const js = new Date(raw);
  return Number.isFinite(js.getTime()) ? js.toISOString() : "";
}

function payment(row: Record<string, string>, amount: number, occurredAt: string): CanonicalPayment[] {
  const method = pick(row, "Payment type", "Payment method", "Payment");
  if (!method) return [];
  return [{ sourcePaymentId: `${receiptId(row)}:${normalize(method)}`, paymentMethod: method, amount, paidAt: occurredAt, sourcePayload: row }];
}

function modifiersFromRow(row: Record<string, string>, sourceLineId: string): CanonicalModifier[] {
  const raw = pick(row, "Modifiers applied", "Modifiers", "Modifier", "Options", "Option");
  if (!raw.trim()) return [];
  return raw.split(/\s*[,;|]\s*/).filter(Boolean).map((name, index) => ({
    sourceModifierId: `${sourceLineId}:modifier:${index + 1}`,
    name: name.trim(),
    quantity: 1,
    priceDelta: 0,
    revenue: 0,
    sourcePayload: { raw },
  }));
}

function itemFromRow(row: Record<string, string>, sourceLineId: string): CanonicalLineItem {
  const quantity = parseNumber(pick(row, "Quantity", "Items sold")) || 1;
  const rawGross = parseNumber(pick(row, "Gross sales", "Gross", "Item gross"));
  const rawDiscount = parseNumber(pick(row, "Discounts", "Discount"));
  const rawNetValue = pick(row, "Net sales", "Net");
  const rawNet = rawNetValue ? parseNumber(rawNetValue) : rawGross - rawDiscount;
  const refund = receiptType(row) === "refund";
  const costRaw = pick(row, "Cost of goods", "COGS", "Cost");
  const profitRaw = pick(row, "Gross profit", "Profit");
  return {
    sourceLineId,
    sourceItemId: pick(row, "Item id") || undefined,
    itemName: pick(row, "Item", "Item name") || "Unknown item",
    sku: pick(row, "SKU") || undefined,
    category: pick(row, "Category") || undefined,
    quantity,
    unitPrice: quantity ? rawGross / quantity : undefined,
    grossSales: refund ? 0 : rawGross,
    discountTotal: rawDiscount,
    refundTotal: refund ? Math.abs(rawGross) : 0,
    netSales: rawNet,
    taxTotal: parseNumber(pick(row, "Taxes", "Tax")),
    costOfGoods: costRaw === "" ? null : parseNumber(costRaw),
    grossProfit: profitRaw === "" ? null : parseNumber(profitRaw),
    modifiers: modifiersFromRow(row, sourceLineId),
    sourcePayload: row,
  };
}

function receiptFinancials(row: Record<string, string>) {
  const rawGross = parseNumber(pick(row, "Gross sales", "Gross", "Subtotal"));
  const rawDiscount = parseNumber(pick(row, "Discounts", "Discount"));
  const netRaw = pick(row, "Net sales", "Net", "Total collected", "Total");
  const rawNet = netRaw ? parseNumber(netRaw) : rawGross - rawDiscount;
  const refund = receiptType(row) === "refund";
  return {
    grossSales: refund ? 0 : rawGross,
    discounts: rawDiscount,
    refunds: refund ? Math.abs(rawGross) : 0,
    netSales: rawNet,
    collected: parseNumber(pick(row, "Total collected")) || rawNet,
  };
}

export const loyverseAdapter: ReportingSourceAdapter = {
  id: "loyverse",
  displayName: "Loyverse POS",
  detect(files) {
    const { receipts, items } = identifyFiles(files);
    if (!receipts) return 0;
    return items ? 100 : 75;
  },
  async validate(files, context): Promise<ImportValidation> {
    const { receipts, items } = identifyFiles(files);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!receipts) return { ok: false, warnings, errors: ["A Loyverse Receipts CSV could not be identified"] };
    if (!items) warnings.push("Receipts by Item was not supplied; historical item-level reporting will be incomplete");

    const cancelledCount = receipts.rows.filter(isCancelled).length;
    if (cancelledCount) warnings.push(`${cancelledCount} cancelled Loyverse receipts will be excluded from canonical sales`);
    const activeReceipts = receipts.rows.filter(row => !isCancelled(row));
    const ids = activeReceipts.map(receiptId).filter(Boolean);
    if (!ids.length) errors.push("No receipt number column was detected in the Receipts export");
    if (new Set(ids).size !== ids.length) errors.push("Receipts export contains duplicate active receipt numbers");
    const timestamps = activeReceipts.map(row => parseOccurredAt(row, context.timezone));
    if (timestamps.some(value => !value)) errors.push("One or more active receipt timestamps could not be parsed");
    if (context.cutoverAt) {
      const cutover = new Date(context.cutoverAt).getTime();
      const invalid = timestamps.filter(value => value && new Date(value).getTime() >= cutover).length;
      if (invalid) errors.push(`${invalid} Loyverse receipts are at/after the configured cutover`);
    }
    if (items) {
      const idSet = new Set(ids);
      const orphanItems = items.rows.filter(row => !isCancelled(row) && !idSet.has(receiptId(row))).length;
      if (orphanItems) errors.push(`${orphanItems} active Receipts by Item rows do not link to an active receipt in the canonical Receipts export`);
    }

    const financials = activeReceipts.map(receiptFinancials);
    return {
      ok: errors.length === 0,
      warnings,
      errors,
      sourceRowCount: activeReceipts.length,
      transactionCount: ids.length,
      grossSales: financials.reduce((sum, row) => sum + row.grossSales, 0),
      discounts: financials.reduce((sum, row) => sum + row.discounts, 0),
      refunds: financials.reduce((sum, row) => sum + row.refunds, 0),
      netSales: financials.reduce((sum, row) => sum + row.netSales, 0),
    };
  },
  async *parse(files, context): AsyncIterable<CanonicalTransaction> {
    const { receipts, items } = identifyFiles(files);
    if (!receipts) return;
    const itemGroups = new Map<string, Record<string, string>[]>();
    for (const row of items?.rows || []) {
      if (isCancelled(row)) continue;
      const id = receiptId(row);
      if (!itemGroups.has(id)) itemGroups.set(id, []);
      itemGroups.get(id)!.push(row);
    }

    for (const receiptRow of receipts.rows) {
      if (isCancelled(receiptRow)) continue;
      const id = receiptId(receiptRow);
      const occurredAt = parseOccurredAt(receiptRow, context.timezone);
      const financials = receiptFinancials(receiptRow);
      const itemRows = itemGroups.get(id) || [];
      const canonicalItems = itemRows.map((row, index) => itemFromRow(row, `${id}:line:${index + 1}`));
      const refund = receiptType(receiptRow) === "refund";
      yield {
        venueKey: context.venueKey,
        sourceSystem: "loyverse",
        sourceTransactionId: id,
        sourceReceiptNumber: id,
        occurredAt,
        businessTimezone: context.timezone,
        channel: pick(receiptRow, "Dining option", "Channel", "Order type") || undefined,
        orderMode: pick(receiptRow, "Dining option", "Order type") || undefined,
        paymentStatus: refund ? "refunded" : "paid",
        subtotal: financials.grossSales,
        discountTotal: financials.discounts,
        refundTotal: financials.refunds,
        taxTotal: parseNumber(pick(receiptRow, "Taxes", "Tax")),
        netSales: financials.netSales,
        total: financials.collected,
        currency: context.currency || pick(receiptRow, "Currency") || "THB",
        staffName: pick(receiptRow, "Cashier name", "Employee", "Staff", "Cashier") || undefined,
        items: canonicalItems,
        payments: payment(receiptRow, financials.collected, occurredAt),
        sourcePayload: receiptRow,
      };
    }
  },
};

export default loyverseAdapter;
