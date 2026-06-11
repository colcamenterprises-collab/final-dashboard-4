import { DateTime } from "luxon";
import { db } from "../lib/prisma";
import {
  getBangkokBusinessWindow,
  getRecentBangkokBusinessDates,
  normalizePaymentCategory,
  parseLoyverseMoney,
  roundMoney,
} from "./loyverseMirrorCommon.js";

type Blocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: false;
};

type Mismatch = {
  code: string;
  message: string;
  where: string;
  expected?: unknown;
  actual?: unknown;
  difference?: unknown;
};

type MirrorTotals = {
  receiptCount: number;
  grossSales: number;
  netSales: number;
  discounts: number;
  refunds: number;
  cash: number;
  qr: number;
  grab: number;
  other: number;
  lineItemCount: number;
  modifierCount: number;
};

const POS_TABLES = [
  "receipts",
  "receipt_items",
  "receipt_payments",
  "loyverse_receipts",
  "loyverse_shifts",
  "lv_receipt",
  "lv_line_item",
  "lv_modifier",
  "menu_items_v3",
  "import_log",
] as const;

const COUNT_TABLES = [
  "receipts",
  "receipt_items",
  "receipt_payments",
  "loyverse_receipts",
  "loyverse_shifts",
  "lv_receipt",
  "lv_line_item",
  "lv_modifier",
  "menu_items_v3",
] as const;

function blocker(code: string, message: string, where: string, canonical_source = where): Blocker {
  return { code, message, where, canonical_source, auto_build_attempted: false };
}

function zeroTotals(): MirrorTotals {
  return {
    receiptCount: 0,
    grossSales: 0,
    netSales: 0,
    discounts: 0,
    refunds: 0,
    cash: 0,
    qr: 0,
    grab: 0,
    other: 0,
    lineItemCount: 0,
    modifierCount: 0,
  };
}

function diffTotals(expected: MirrorTotals | null, actual: MirrorTotals | null) {
  if (!expected || !actual) return null;
  return {
    receiptCount: actual.receiptCount - expected.receiptCount,
    grossSales: roundMoney(actual.grossSales - expected.grossSales),
    netSales: roundMoney(actual.netSales - expected.netSales),
    discounts: roundMoney(actual.discounts - expected.discounts),
    refunds: roundMoney(actual.refunds - expected.refunds),
    cash: roundMoney(actual.cash - expected.cash),
    qr: roundMoney(actual.qr - expected.qr),
    grab: roundMoney(actual.grab - expected.grab),
    other: roundMoney(actual.other - expected.other),
    lineItemCount: actual.lineItemCount - expected.lineItemCount,
    modifierCount: actual.modifierCount - expected.modifierCount,
  };
}

function isZeroDifference(difference: ReturnType<typeof diffTotals>) {
  return Boolean(difference) && Object.values(difference!).every((value) => value === 0);
}

function normalizePaymentBucket(name: string | null): "cash" | "qr" | "grab" | "other" {
  const category = normalizePaymentCategory(name).category;
  if (category === "Cash") return "cash";
  if (category === "QR") return "qr";
  if (category === "Grab") return "grab";
  return "other";
}

function getShiftArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data?.shifts)) return data.shifts;
  if (Array.isArray(data)) return data;
  return [data];
}

function getMoneyField(source: any, keys: string[]) {
  for (const key of keys) {
    if (source?.[key] != null) return parseLoyverseMoney(source[key]);
  }
  return 0;
}

function normalizeShiftReportPayload(data: any): MirrorTotals & { openingTime: string | null; closingTime: string | null; shiftCount: number } {
  const totals = zeroTotals() as MirrorTotals & { openingTime: string | null; closingTime: string | null; shiftCount: number };
  totals.openingTime = null;
  totals.closingTime = null;
  const shifts = getShiftArray(data);
  totals.shiftCount = shifts.length;

  for (const shift of shifts) {
    totals.grossSales += getMoneyField(shift, ["gross_sales", "total_sales"]);
    totals.netSales += getMoneyField(shift, ["net_sales", "total_sales", "gross_sales"]);
    totals.discounts += getMoneyField(shift, ["discounts", "total_discount", "discount_amount"]);
    totals.refunds += getMoneyField(shift, ["refunds", "refund_amount", "total_refunds"]);
    totals.receiptCount += Number(shift?.receipt_count ?? shift?.receipts_count ?? shift?.receipts ?? 0) || 0;
    totals.openingTime = totals.openingTime ?? shift?.opened_at ?? shift?.shift_start ?? shift?.open_time ?? null;
    totals.closingTime = shift?.closed_at ?? shift?.shift_end ?? shift?.close_time ?? totals.closingTime;

    for (const payment of Array.isArray(shift?.payments) ? shift.payments : []) {
      const name = payment?.payment_type_name ?? payment?.name ?? payment?.payment_type_id ?? payment?.type ?? null;
      const bucket = normalizePaymentBucket(name == null ? null : String(name));
      totals[bucket] += parseLoyverseMoney(payment?.money_amount ?? payment?.total_money ?? payment?.amount_money ?? payment?.amount);
    }
  }

  for (const key of ["grossSales", "netSales", "discounts", "refunds", "cash", "qr", "grab", "other"] as const) {
    totals[key] = roundMoney(totals[key]);
  }
  return totals;
}

async function existingTables() {
  const rows = await db().$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [...POS_TABLES],
  );
  return new Set(rows.map((row) => row.table_name));
}

async function tableCounts(existing: Set<string>, blockers: Blocker[]) {
  const counts: Record<string, number | null> = {};
  for (const table of COUNT_TABLES) {
    if (!existing.has(table)) {
      counts[table] = null;
      if (["lv_receipt", "lv_line_item", "lv_modifier", "loyverse_shifts"].includes(table)) {
        blockers.push(blocker("MISSING_CANONICAL_POS_TABLE", `${table} is required for the Loyverse mirror but does not exist.`, table));
      }
      continue;
    }
    const rows = await db().$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM ${table}`);
    counts[table] = Number(rows[0]?.count ?? 0);
    if (["lv_receipt", "lv_line_item", "lv_modifier"].includes(table) && counts[table] === 0) {
      blockers.push(blocker("EMPTY_CANONICAL_POS_TABLE", `${table} is part of the canonical Loyverse mirror but is empty.`, table));
    }
  }
  return counts;
}

async function latestMetadata(existing: Set<string>) {
  const meta = { latestSyncAt: null as string | Date | null, latestReceiptDate: null as string | Date | null, latestShiftDate: null as string | Date | null };
  if (existing.has("import_log")) {
    const rows = await db().$queryRawUnsafe<any[]>(`SELECT MAX(COALESCE(finished_at, started_at)) AS latest_sync_at FROM import_log WHERE provider = 'loyverse'`);
    meta.latestSyncAt = rows[0]?.latest_sync_at ?? null;
  }
  if (existing.has("lv_receipt")) {
    const rows = await db().$queryRawUnsafe<any[]>(`SELECT MAX(datetime_bkk) AS latest_receipt_date, MAX(created_at) AS latest_created_at FROM lv_receipt`);
    meta.latestReceiptDate = rows[0]?.latest_receipt_date ?? null;
    meta.latestSyncAt = meta.latestSyncAt ?? rows[0]?.latest_created_at ?? null;
  }
  if (existing.has("loyverse_shifts")) {
    const rows = await db().$queryRawUnsafe<any[]>(`SELECT MAX(shift_date) AS latest_shift_date FROM loyverse_shifts`);
    meta.latestShiftDate = rows[0]?.latest_shift_date ?? null;
  }
  return meta;
}

async function receiptDerivedTotals(date: string, existing: Set<string>) {
  if (!existing.has("lv_receipt")) return null;
  const window = getBangkokBusinessWindow(date);
  const totals = zeroTotals();
  const receiptRows = await db().$queryRawUnsafe<any[]>(
    `SELECT receipt_id, total_amount, payment_json, raw_json
     FROM lv_receipt
     WHERE datetime_bkk >= $1::timestamptz AND datetime_bkk < $2::timestamptz`,
    window.startISO,
    window.endISO,
  );

  totals.receiptCount = receiptRows.length;
  for (const row of receiptRows) {
    const raw = row.raw_json ?? {};
    const isRefund = raw?.refund_for != null && raw.refund_for !== "null";
    const total = Number(row.total_amount ?? 0);
    const discounts = parseLoyverseMoney(raw?.total_discount ?? raw?.discount_amount ?? raw?.discounts);
    totals.discounts += discounts;
    totals.grossSales += total + discounts;
    totals.netSales += total;
    if (isRefund) totals.refunds += Math.abs(total);

    for (const payment of Array.isArray(row.payment_json) ? row.payment_json : []) {
      const name = payment?.originalName ?? payment?.payment_type_name ?? payment?.name ?? payment?.type ?? payment?.payment_type_id ?? null;
      const amount = Number(payment?.amount ?? NaN);
      const parsedAmount = Number.isFinite(amount) ? amount : parseLoyverseMoney(payment?.money_amount ?? payment?.total_money ?? payment?.amount_money);
      totals[normalizePaymentBucket(name == null ? null : String(name))] += parsedAmount;
    }
  }

  if (existing.has("lv_line_item")) {
    const rows = await db().$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM lv_line_item li JOIN lv_receipt r ON r.receipt_id = li.receipt_id WHERE r.datetime_bkk >= $1::timestamptz AND r.datetime_bkk < $2::timestamptz`,
      window.startISO,
      window.endISO,
    );
    totals.lineItemCount = Number(rows[0]?.count ?? 0);
  }
  if (existing.has("lv_modifier")) {
    const rows = await db().$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM lv_modifier m JOIN lv_line_item li ON li.receipt_id = m.receipt_id AND li.line_no = m.line_no JOIN lv_receipt r ON r.receipt_id = m.receipt_id WHERE r.datetime_bkk >= $1::timestamptz AND r.datetime_bkk < $2::timestamptz`,
      window.startISO,
      window.endISO,
    );
    totals.modifierCount = Number(rows[0]?.count ?? 0);
  }

  for (const key of ["grossSales", "netSales", "discounts", "refunds", "cash", "qr", "grab", "other"] as const) {
    totals[key] = roundMoney(totals[key]);
  }
  return totals;
}

async function legacyAppTotals(date: string, existing: Set<string>) {
  if (!existing.has("receipts")) return null;
  const window = getBangkokBusinessWindow(date);
  const totals = zeroTotals();
  const receiptRows = await db().$queryRawUnsafe<any[]>(
    `SELECT id, subtotal, discount, total FROM receipts WHERE "createdAtUTC" >= $1::timestamptz AND "createdAtUTC" < $2::timestamptz`,
    window.startISO,
    window.endISO,
  );
  totals.receiptCount = receiptRows.length;
  for (const receipt of receiptRows) {
    totals.grossSales += Number(receipt.subtotal ?? 0) / 100;
    totals.discounts += Number(receipt.discount ?? 0) / 100;
    totals.netSales += Number(receipt.total ?? 0) / 100;
  }
  if (existing.has("receipt_payments")) {
    const paymentRows = await db().$queryRawUnsafe<any[]>(
      `SELECT rp.method, rp.amount FROM receipt_payments rp JOIN receipts r ON r.id = rp."receiptId" WHERE r."createdAtUTC" >= $1::timestamptz AND r."createdAtUTC" < $2::timestamptz`,
      window.startISO,
      window.endISO,
    );
    for (const payment of paymentRows) totals[normalizePaymentBucket(payment.method)] += Number(payment.amount ?? 0) / 100;
  }
  if (existing.has("receipt_items")) {
    const itemRows = await db().$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS item_count, COALESCE(SUM(CASE WHEN jsonb_typeof(modifiers) = 'array' THEN jsonb_array_length(modifiers) ELSE 0 END), 0)::int AS modifier_count
       FROM receipt_items ri JOIN receipts r ON r.id = ri."receiptId" WHERE r."createdAtUTC" >= $1::timestamptz AND r."createdAtUTC" < $2::timestamptz`,
      window.startISO,
      window.endISO,
    );
    totals.lineItemCount = Number(itemRows[0]?.item_count ?? 0);
    totals.modifierCount = Number(itemRows[0]?.modifier_count ?? 0);
  }
  for (const key of ["grossSales", "netSales", "discounts", "refunds", "cash", "qr", "grab", "other"] as const) totals[key] = roundMoney(totals[key]);
  return totals;
}

async function shiftReportForDate(date: string, existing: Set<string>) {
  if (!existing.has("loyverse_shifts")) return null;
  const rows = await db().$queryRawUnsafe<any[]>(`SELECT shift_date, data FROM loyverse_shifts WHERE shift_date = $1::date LIMIT 1`, date);
  if (!rows[0]) return null;
  return { date, raw: rows[0].data, totals: normalizeShiftReportPayload(rows[0].data) };
}

async function latestShiftReport(existing: Set<string>) {
  if (!existing.has("loyverse_shifts")) return null;
  const rows = await db().$queryRawUnsafe<any[]>(`SELECT shift_date, data FROM loyverse_shifts ORDER BY shift_date DESC LIMIT 1`);
  if (!rows[0]) return null;
  const date = DateTime.fromJSDate(new Date(rows[0].shift_date)).toISODate()!;
  return { date, raw: rows[0].data, totals: normalizeShiftReportPayload(rows[0].data) };
}

async function integrityFindings(existing: Set<string>) {
  const integrity: Record<string, any[]> = {
    duplicateReceipts: [],
    duplicateItems: [],
    duplicateModifiers: [],
    duplicatePayments: [],
    receiptsWithoutItems: [],
    receiptsWithoutPayments: [],
    paymentsWithoutReceipts: [],
    itemsWithoutReceipts: [],
    modifiersWithoutLineItems: [],
    legacyRowsMissingFromCanonical: [],
    canonicalRowsMissingFromLegacy: [],
  };

  if (existing.has("lv_receipt")) {
    integrity.duplicateReceipts = await db().$queryRawUnsafe<any[]>(
      `SELECT receipt_id, COUNT(*)::int AS count FROM lv_receipt GROUP BY receipt_id HAVING COUNT(*) > 1 LIMIT 25`,
    );
  }
  if (existing.has("lv_line_item")) {
    integrity.duplicateItems = await db().$queryRawUnsafe<any[]>(
      `SELECT receipt_id, line_no, COUNT(*)::int AS count FROM lv_line_item GROUP BY receipt_id, line_no HAVING COUNT(*) > 1 LIMIT 25`,
    );
  }
  if (existing.has("lv_modifier")) {
    integrity.duplicateModifiers = await db().$queryRawUnsafe<any[]>(
      `SELECT receipt_id, line_no, mod_no, COUNT(*)::int AS count FROM lv_modifier GROUP BY receipt_id, line_no, mod_no HAVING COUNT(*) > 1 LIMIT 25`,
    );
  }
  if (existing.has("lv_receipt") && existing.has("lv_line_item")) {
    integrity.receiptsWithoutItems = await db().$queryRawUnsafe<any[]>(
      `SELECT r.receipt_id, r.datetime_bkk FROM lv_receipt r LEFT JOIN lv_line_item li ON li.receipt_id = r.receipt_id WHERE li.receipt_id IS NULL ORDER BY r.datetime_bkk DESC LIMIT 25`,
    );
    integrity.itemsWithoutReceipts = await db().$queryRawUnsafe<any[]>(
      `SELECT li.receipt_id, li.line_no, li.name FROM lv_line_item li LEFT JOIN lv_receipt r ON r.receipt_id = li.receipt_id WHERE r.receipt_id IS NULL LIMIT 25`,
    );
  }
  if (existing.has("lv_modifier") && existing.has("lv_line_item")) {
    integrity.modifiersWithoutLineItems = await db().$queryRawUnsafe<any[]>(
      `SELECT m.receipt_id, m.line_no, m.mod_no, m.name FROM lv_modifier m LEFT JOIN lv_line_item li ON li.receipt_id = m.receipt_id AND li.line_no = m.line_no WHERE li.receipt_id IS NULL LIMIT 25`,
    );
  }
  if (existing.has("lv_receipt")) {
    integrity.receiptsWithoutPayments = await db().$queryRawUnsafe<any[]>(
      `SELECT receipt_id, datetime_bkk FROM lv_receipt WHERE jsonb_typeof(COALESCE(payment_json, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(payment_json, '[]'::jsonb)) = 0 ORDER BY datetime_bkk DESC LIMIT 25`,
    );
    integrity.duplicatePayments = await db().$queryRawUnsafe<any[]>(
      `SELECT receipt_id, payment_key, COUNT(*)::int AS count
       FROM (
         SELECT r.receipt_id, CONCAT(COALESCE(p->>'originalName', p->>'name', p->>'payment_type_name', p->>'payment_type_id', 'UNMAPPED'), '|', COALESCE(p->>'amount', p->>'money_amount', p->>'amount_money', '0')) AS payment_key
         FROM lv_receipt r, jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(r.payment_json, '[]'::jsonb)) = 'array' THEN COALESCE(r.payment_json, '[]'::jsonb) ELSE '[]'::jsonb END) p
       ) x GROUP BY receipt_id, payment_key HAVING COUNT(*) > 1 LIMIT 25`,
    );
  }
  if (existing.has("receipt_payments") && existing.has("receipts")) {
    integrity.paymentsWithoutReceipts = await db().$queryRawUnsafe<any[]>(
      `SELECT rp.id, rp."receiptId", rp.method, rp.amount FROM receipt_payments rp LEFT JOIN receipts r ON r.id = rp."receiptId" WHERE r.id IS NULL LIMIT 25`,
    );
  }
  if (existing.has("lv_receipt") && existing.has("receipts")) {
    integrity.canonicalRowsMissingFromLegacy = await db().$queryRawUnsafe<any[]>(
      `SELECT lr.receipt_id, lr.datetime_bkk FROM lv_receipt lr LEFT JOIN receipts r ON r."externalId" = lr.receipt_id OR r."receiptNumber" = lr.receipt_id WHERE r.id IS NULL ORDER BY lr.datetime_bkk DESC LIMIT 25`,
    );
    integrity.legacyRowsMissingFromCanonical = await db().$queryRawUnsafe<any[]>(
      `SELECT r.id, r."externalId", r."receiptNumber", r."createdAtUTC" FROM receipts r LEFT JOIN lv_receipt lr ON lr.receipt_id = r."externalId" OR lr.receipt_id = r."receiptNumber" WHERE lr.receipt_id IS NULL ORDER BY r."createdAtUTC" DESC LIMIT 25`,
    );
  }
  return integrity;
}

async function paymentMapping(existing: Set<string>) {
  const result = { mappedPayments: [] as any[], unmappedPayments: [] as any[], rules: { Cash: ["cash"], QR: ["qr", "scan", "promptpay", "prompt pay", "transfer"], Grab: ["grab"], Other: ["other"], Unmapped: "Any payment name not matching an explicit rule is normalized to Other with mappingStatus=unmapped." } };
  if (!existing.has("lv_receipt")) return result;
  const rows = await db().$queryRawUnsafe<any[]>(
    `SELECT COALESCE(p->>'originalName', p->>'name', p->>'payment_type_name', p->>'payment_type_id', 'UNMAPPED') AS original_name,
            COALESCE(p->>'normalizedCategory', p->>'normalized_category') AS normalized_category,
            COALESCE(p->>'mappingStatus', p->>'mapping_status') AS mapping_status,
            COUNT(*)::int AS count,
            ROUND(SUM(COALESCE(NULLIF(p->>'amount', '')::numeric, 0))::numeric, 2) AS amount
     FROM lv_receipt r,
          jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(r.payment_json, '[]'::jsonb)) = 'array' THEN COALESCE(r.payment_json, '[]'::jsonb) ELSE '[]'::jsonb END) p
     GROUP BY 1, 2, 3 ORDER BY count DESC LIMIT 100`,
  );
  for (const row of rows) {
    const inferred = normalizePaymentCategory(row.original_name === "UNMAPPED" ? null : row.original_name);
    const entry = {
      originalName: row.original_name,
      normalizedCategory: row.normalized_category || inferred.category,
      mappingStatus: row.mapping_status || (inferred.mapped ? "mapped" : "unmapped"),
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    };
    if (entry.mappingStatus === "unmapped") result.unmappedPayments.push(entry);
    else result.mappedPayments.push(entry);
  }
  return result;
}

export async function buildLoyverseMirrorDiagnostic() {
  const blockers: Blocker[] = [];
  const mismatches: Mismatch[] = [];
  const existing = await existingTables();
  const receiptCounts = await tableCounts(existing, blockers);
  const meta = await latestMetadata(existing);
  const integrity = await integrityFindings(existing);
  const paymentMap = await paymentMapping(existing);

  const canonicalTables = {
    rawReceiptSource: "lv_receipt.raw_json",
    receipts: "lv_receipt",
    lineItems: "lv_line_item",
    modifiers: "lv_modifier",
    payments: "lv_receipt.payment_json (normalized payment entries; no separate canonical payment table exists in current schema)",
    shiftReports: "loyverse_shifts",
    syncTimestamps: "import_log plus lv_receipt.created_at",
    appComparisonTables: ["receipts", "receipt_items", "receipt_payments"],
    staleOrDuplicateTables: ["loyverse_receipts is legacy date-bucket JSON and is counted only; it is not used as canonical truth"],
  };

  if (!meta.latestSyncAt) blockers.push(blocker("MISSING_LATEST_SYNC", "No Loyverse sync timestamp found.", "import_log", "import_log"));
  if (!meta.latestReceiptDate) blockers.push(blocker("MISSING_LATEST_RECEIPT", "No canonical Loyverse receipt timestamp found.", "lv_receipt", "lv_receipt"));
  if (!meta.latestShiftDate) blockers.push(blocker("MISSING_SHIFT_REPORT", "No Loyverse shift report date found.", "loyverse_shifts", "loyverse_shifts"));
  if (meta.latestSyncAt) {
    const ageHours = DateTime.now().diff(DateTime.fromJSDate(new Date(meta.latestSyncAt)), "hours").hours;
    if (ageHours > 24) blockers.push(blocker("STALE_SYNC", `Latest sync is ${roundMoney(ageHours)} hours old.`, "import_log", "import_log"));
  }
  if (paymentMap.unmappedPayments.length > 0) {
    mismatches.push({ code: "UNMAPPED_PAYMENT_NAMES", message: "One or more Loyverse payment names did not match an explicit payment mapping rule.", where: "lv_receipt.payment_json", actual: paymentMap.unmappedPayments });
  }

  const sevenDayComparison = [];
  for (const date of getRecentBangkokBusinessDates(7)) {
    const appTotals = await receiptDerivedTotals(date, existing);
    const legacyTotals = await legacyAppTotals(date, existing);
    const shiftReport = await shiftReportForDate(date, existing);
    const shiftTotals = shiftReport?.totals ?? null;
    const difference = diffTotals(shiftTotals, appTotals);
    const status = !appTotals || !shiftTotals ? "missing" : isZeroDifference(difference) ? "match" : "mismatch";
    if (status === "missing") {
      blockers.push(blocker("MISSING_DAILY_POS_SOURCE", `Missing canonical receipt totals or Loyverse shift report for ${date}.`, `sevenDayComparison.${date}`, "lv_receipt/loyverse_shifts"));
    } else if (status === "mismatch") {
      mismatches.push({ code: "MISMATCHED_DAILY_TOTALS", message: `Receipt-derived totals do not match Loyverse shift totals for ${date}.`, where: `sevenDayComparison.${date}`, expected: shiftTotals, actual: appTotals, difference });
    }
    sevenDayComparison.push({ date, appTotals, loyverseShiftTotals: shiftTotals, legacyAppTotals: legacyTotals, difference, status });
  }

  const latestShift = await latestShiftReport(existing);
  const latestShiftDate = latestShift?.date ?? null;
  const latestReceiptTotals = latestShiftDate ? await receiptDerivedTotals(latestShiftDate, existing) : null;
  const latestLegacyTotals = latestShiftDate ? await legacyAppTotals(latestShiftDate, existing) : null;
  const latestDifference = diffTotals(latestShift?.totals ?? null, latestReceiptTotals);
  const latestShiftComparison = {
    date: latestShiftDate,
    loyverseShiftReportTotals: latestShift?.totals ?? null,
    receiptDerivedTotals: latestReceiptTotals,
    paymentDerivedTotals: latestReceiptTotals ? { cash: latestReceiptTotals.cash, qr: latestReceiptTotals.qr, grab: latestReceiptTotals.grab, other: latestReceiptTotals.other } : null,
    appShiftTotals: latestLegacyTotals,
    difference: latestDifference,
    status: !latestShift || !latestReceiptTotals ? "missing" : isZeroDifference(latestDifference) ? "match" : "mismatch",
  };
  if (latestShiftComparison.status === "missing") {
    blockers.push(blocker("LATEST_SHIFT_INCOMPLETE", "Latest completed shift cannot be verified because shift report or receipt-derived totals are missing.", "latestShiftComparison", "loyverse_shifts/lv_receipt"));
  } else if (latestShiftComparison.status === "mismatch") {
    mismatches.push({ code: "LATEST_SHIFT_MISMATCH", message: "Latest completed shift report does not match receipt-derived totals.", where: "latestShiftComparison", expected: latestShift?.totals, actual: latestReceiptTotals, difference: latestDifference });
  }

  for (const [key, rows] of Object.entries(integrity)) {
    if (Array.isArray(rows) && rows.length > 0 && !["canonicalRowsMissingFromLegacy", "legacyRowsMissingFromCanonical"].includes(key)) {
      mismatches.push({ code: key.toUpperCase(), message: `${rows.length} ${key} finding(s) detected.`, where: `integrity.${key}`, actual: rows });
    }
  }

  const status = blockers.length > 0 || mismatches.length > 0 ? "fail" : "ok";
  return {
    status,
    latestSyncAt: meta.latestSyncAt,
    latestReceiptDate: meta.latestReceiptDate,
    latestShiftDate: meta.latestShiftDate,
    canonicalTables,
    receiptCounts,
    integrity,
    paymentMapping: paymentMap,
    latestShiftComparison,
    sevenDayComparison,
    blockers,
    mismatches,
    sourceMap: {
      syncRoute: "POST /api/loyverse/sync?from=YYYY-MM-DD&to=YYYY-MM-DD",
      syncService: "server/services/loyverseImportV2.ts#importReceiptsV2",
      receiptEndpoint: "GET https://api.loyverse.com/v1.0/receipts",
      shiftEndpoint: "GET https://api.loyverse.com/v1.0/shifts via legacy shift mirror routes/services",
      timezone: "Asia/Bangkok",
      shiftWindow: "17:00-03:00 Asia/Bangkok via getBangkokBusinessWindow",
    },
  };
}
