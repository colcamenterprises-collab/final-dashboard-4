import { DateTime } from "luxon";

export type NormalizedPaymentCategory = "Cash" | "QR" | "Grab" | "Other";

export type NormalizedPayment = {
  originalName: string | null;
  normalizedCategory: NormalizedPaymentCategory;
  amount: number;
  mappingStatus: "mapped" | "unmapped";
  paymentTypeId: string | null;
  raw: unknown;
};

export function getBangkokBusinessWindow(date: string) {
  const start = DateTime.fromISO(date, { zone: "Asia/Bangkok" }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const end = start.plus({ days: 1 }).set({ hour: 3, minute: 0, second: 0, millisecond: 0 });
  return {
    businessDate: date,
    timezone: "Asia/Bangkok",
    startBangkok: start.toISO(),
    endBangkok: end.toISO(),
    startISO: start.toUTC().toISO()!,
    endISO: end.toUTC().toISO()!,
  };
}

export function getRecentBangkokBusinessDates(days = 7) {
  const todayBkk = DateTime.now().setZone("Asia/Bangkok").startOf("day");
  return Array.from({ length: days }, (_, index) => todayBkk.minus({ days: days - 1 - index }).toISODate()!);
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseLoyverseMoney(raw: any): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw / 100;
  if (typeof raw === "string") return Number(raw) || 0;
  if (typeof raw === "object") {
    if (raw.amount != null) return Number(raw.amount) / 100;
    if (raw.value != null) return Number(raw.value) / 100;
    if (raw.money_amount != null) return parseLoyverseMoney(raw.money_amount);
    if (raw.total_money != null) return parseLoyverseMoney(raw.total_money);
  }
  return 0;
}

export function getPaymentOriginalName(payment: any): string | null {
  const value =
    payment?.payment_type_name ??
    payment?.name ??
    payment?.type ??
    payment?.payment_type ??
    payment?.payment_name ??
    payment?.paymentType ??
    payment?.payment_type_id ??
    null;
  return value == null ? null : String(value).trim() || null;
}

export function normalizePaymentCategory(name: string | null): { category: NormalizedPaymentCategory; mapped: boolean } {
  const normalized = String(name ?? "").toLowerCase();
  if (normalized.includes("cash")) return { category: "Cash", mapped: true };
  if (normalized.includes("qr") || normalized.includes("scan") || normalized.includes("promptpay") || normalized.includes("prompt pay") || normalized.includes("transfer")) {
    return { category: "QR", mapped: true };
  }
  if (normalized.includes("grab")) return { category: "Grab", mapped: true };
  if (normalized.includes("other")) return { category: "Other", mapped: true };
  return { category: "Other", mapped: false };
}

export function normalizeLoyversePayment(payment: any): NormalizedPayment {
  const originalName = getPaymentOriginalName(payment);
  const { category, mapped } = normalizePaymentCategory(originalName);
  return {
    originalName,
    normalizedCategory: category,
    amount: roundMoney(parseLoyverseMoney(payment?.money_amount ?? payment?.total_money ?? payment?.amount_money ?? payment?.amount ?? payment?.value)),
    mappingStatus: mapped ? "mapped" : "unmapped",
    paymentTypeId: payment?.payment_type_id == null ? null : String(payment.payment_type_id),
    raw: payment,
  };
}

export function normalizeLoyversePayments(payments: any[] | undefined | null): NormalizedPayment[] {
  return (Array.isArray(payments) ? payments : []).map(normalizeLoyversePayment);
}
