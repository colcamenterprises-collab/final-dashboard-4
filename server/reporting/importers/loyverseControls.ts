import { parse } from "csv-parse/sync";
import type { SourceFileDescriptor } from "./types";

export type LoyverseControlValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    salesSummary?: { rows: number; matched: number };
    paymentTypes?: { rows: number; matched: number };
  };
};

type Row = Record<string, string>;

const norm = (value: string) => value.trim().toLowerCase();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};
const text = (file: SourceFileDescriptor) => Buffer.isBuffer(file.contents) ? file.contents.toString("utf8") : file.contents;
const rows = (file: SourceFileDescriptor): Row[] => parse(text(file).replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: false });

function headers(file: SourceFileDescriptor): string[] {
  const parsed = parse(text(file).replace(/^\uFEFF/, ""), { to_line: 1, bom: true }) as string[][];
  return (parsed[0] || []).map(norm);
}

function findByHeaders(files: SourceFileDescriptor[], required: string[]) {
  return files.find(file => {
    const set = new Set(headers(file));
    return required.every(header => set.has(norm(header)));
  });
}

function isCancelled(row: Row) { return norm(row["Status"] || "") === "cancelled"; }
function isRefund(row: Row) { return norm(row["Receipt type"] || "") === "refund"; }
function dayOf(row: Row) { return String(row["Date"] || "").slice(0, 10); }

export function validateLoyverseControlReports(files: SourceFileDescriptor[]): LoyverseControlValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: LoyverseControlValidation["checks"] = {};
  const receiptsFile = findByHeaders(files, ["Date", "Receipt number", "Receipt type", "Gross sales", "Net sales", "Payment type", "Status"]);
  if (!receiptsFile) return { ok: false, errors: ["Receipts control source could not be identified"], warnings, checks };
  const receipts = rows(receiptsFile).filter(row => !isCancelled(row));

  const salesSummaryFile = findByHeaders(files, ["Date", "Gross sales", "Refunds", "Discounts", "Net sales", "Gross profit"]);
  if (salesSummaryFile) {
    const daily = new Map<string, { gross: number; refunds: number; discounts: number; net: number }>();
    for (const receipt of receipts) {
      const key = dayOf(receipt);
      const current = daily.get(key) || { gross: 0, refunds: 0, discounts: 0, net: 0 };
      const gross = num(receipt["Gross sales"]);
      if (isRefund(receipt)) current.refunds += Math.abs(gross); else current.gross += gross;
      current.discounts += num(receipt["Discounts"]);
      current.net += num(receipt["Net sales"]);
      daily.set(key, current);
    }
    let matched = 0;
    const summaryRows = rows(salesSummaryFile);
    const summaryDays = new Set<string>();
    for (const control of summaryRows) {
      const key = String(control["Date"] || "");
      summaryDays.add(key);
      const actual = daily.get(key) || { gross: 0, refunds: 0, discounts: 0, net: 0 };
      const expected = {
        gross: num(control["Gross sales"]),
        refunds: num(control["Refunds"]),
        discounts: num(control["Discounts"]),
        net: num(control["Net sales"]),
      };
      const normalized = {
        gross: Math.trunc(actual.gross),
        refunds: Math.trunc(actual.refunds),
        discounts: Math.trunc(actual.discounts),
        net: Math.trunc(actual.net),
      };
      if (expected.gross === normalized.gross && expected.refunds === normalized.refunds && expected.discounts === normalized.discounts && expected.net === normalized.net) matched += 1;
      else errors.push(`Sales Summary ${key} does not reconcile after Loyverse whole-baht truncation`);
    }
    for (const key of daily.keys()) if (!summaryDays.has(key)) errors.push(`Sales Summary is missing receipt date ${key}`);
    checks.salesSummary = { rows: summaryRows.length, matched };
  } else warnings.push("Sales Summary control file not supplied");

  const paymentFile = findByHeaders(files, ["Payment type", "Payment transactions", "Payments amount", "Refund transactions", "Refunds amount", "Net amount"]);
  if (paymentFile) {
    const grouped = new Map<string, { saleCount: number; paymentAmount: number; refundCount: number; refundAmount: number; netAmount: number }>();
    for (const receipt of receipts) {
      const key = String(receipt["Payment type"] || "Unknown");
      const current = grouped.get(key) || { saleCount: 0, paymentAmount: 0, refundCount: 0, refundAmount: 0, netAmount: 0 };
      const amount = num(receipt["Total collected"] || receipt["Net sales"]);
      if (isRefund(receipt)) { current.refundCount += 1; current.refundAmount += Math.abs(amount); }
      else { current.saleCount += 1; current.paymentAmount += amount; }
      current.netAmount += amount;
      grouped.set(key, current);
    }
    let matched = 0;
    const controlRows = rows(paymentFile);
    const controlTypes = new Set<string>();
    for (const control of controlRows) {
      const key = String(control["Payment type"] || "Unknown");
      controlTypes.add(key);
      const actual = grouped.get(key) || { saleCount: 0, paymentAmount: 0, refundCount: 0, refundAmount: 0, netAmount: 0 };
      const ok =
        actual.saleCount === num(control["Payment transactions"]) &&
        actual.refundCount === num(control["Refund transactions"]) &&
        Math.trunc(actual.paymentAmount) === num(control["Payments amount"]) &&
        Math.trunc(actual.refundAmount) === num(control["Refunds amount"]) &&
        Math.trunc(actual.netAmount) === num(control["Net amount"]);
      if (ok) matched += 1; else errors.push(`Payment Type ${key} does not reconcile after Loyverse whole-baht truncation`);
    }
    for (const key of grouped.keys()) if (!controlTypes.has(key)) errors.push(`Payment Type control is missing ${key}`);
    checks.paymentTypes = { rows: controlRows.length, matched };
  } else warnings.push("Payment Type Sales control file not supplied");

  return { ok: errors.length === 0, errors, warnings, checks };
}
