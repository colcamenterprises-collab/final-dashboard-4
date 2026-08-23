import crypto from 'crypto';
import { DateTime } from 'luxon';
import { parse as parseCsv } from 'csv-parse/sync';

export type ExternalEvidenceRecord = {
  transactionAt: Date;
  externalTransactionId: string | null;
  externalOrderId: string | null;
  transactionType: 'sale' | 'refund' | 'adjustment' | 'fee' | 'settlement' | 'cancellation' | 'other';
  grossSales: number | null;
  netSales: number | null;
  merchantFundedDiscount: number | null;
  providerFundedDiscount: number | null;
  refundAmount: number | null;
  commission: number | null;
  platformFee: number | null;
  paymentFee: number | null;
  tax: number | null;
  tips: number | null;
  otherDeduction: number | null;
  expectedSettlement: number | null;
  originalRecord: Record<string, unknown>;
  sourceRecordHash: string;
};

export type ParsedExternalEvidence = {
  headers: string[];
  accepted: ExternalEvidenceRecord[];
  rejected: Array<{ row: number; reason: string; raw: Record<string, unknown> }>;
  skippedSummaryRows: number;
};

const normalize = (value: unknown) => String(value ?? '')
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9ก-๙]+/g, ' ')
  .trim();

const compact = (value: unknown) => normalize(value).replace(/\s+/g, '');

function firstValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const wanted = compact(candidate);
    const match = entries.find(([key]) => {
      const keyCompact = compact(key);
      return keyCompact === wanted || keyCompact.includes(wanted) || wanted.includes(keyCompact);
    });
    if (match && String(match[1] ?? '').trim() !== '') return match[1];
  }
  return undefined;
}

function money(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-' || raw.toLowerCase() === 'n/a') return null;
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[฿,$,%\s]/g, '').replace(/[()]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function parseDateTime(row: Record<string, unknown>, timezone: string): Date {
  const dateValue = firstValue(row, ['date', 'completed date', 'transaction date', 'order date']);
  const timeValue = firstValue(row, ['completed time', 'time', 'transaction time', 'completed at']);
  const combinedValue = firstValue(row, ['completed datetime', 'completed date time', 'transaction datetime', 'created at', 'completed_at']);

  const candidates = [
    combinedValue == null ? '' : String(combinedValue).trim(),
    `${String(dateValue ?? '').trim()} ${String(timeValue ?? '').trim()}`.trim(),
    String(dateValue ?? '').trim(),
  ].filter(Boolean);

  const formats = [
    'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm', 'yyyy-MM-dd h:mm a',
    'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm', 'dd/MM/yy HH:mm',
    'dd-MM-yyyy HH:mm:ss', 'dd-MM-yyyy HH:mm', 'dd-MMM-yyyy HH:mm',
    'M/d/yyyy h:mm a', 'M/d/yy h:mm a',
  ];

  for (const candidate of candidates) {
    const iso = DateTime.fromISO(candidate, { zone: timezone });
    if (iso.isValid) return iso.toUTC().toJSDate();
    for (const format of formats) {
      const parsed = DateTime.fromFormat(candidate, format, { zone: timezone, locale: 'en' });
      if (parsed.isValid) return parsed.toUTC().toJSDate();
    }
  }

  throw new Error(`Could not parse transaction date/time from ${JSON.stringify({ dateValue, timeValue, combinedValue })}`);
}

function normalizeOrderId(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^(daily|grand|all dates|total)/i.test(raw)) return null;
  const gf = raw.match(/GF\s*[- ]?\s*(\d+)/i);
  if (gf) return `GF-${gf[1]}`;
  return raw.slice(0, 160);
}

function isSummaryRow(row: Record<string, unknown>) {
  const order = String(firstValue(row, ['order number', 'order id', 'booking code', 'external order id']) ?? '').trim();
  const date = String(firstValue(row, ['date', 'completed date', 'transaction date']) ?? '').trim();
  return /daily total|grand total|all dates|summary|total orders/i.test(`${order} ${date}`);
}

function recordHash(row: Record<string, unknown>): string {
  const canonical = Object.fromEntries(
    Object.entries(row)
      .map(([key, value]) => [normalize(key), String(value ?? '').trim()])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function parseExternalEvidenceCsv(
  input: Buffer | string,
  options: { timezone?: string; providerKey?: string } = {},
): ParsedExternalEvidence {
  const timezone = options.timezone || 'Asia/Bangkok';
  const rows = parseCsv(input, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[];

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const accepted: ExternalEvidenceRecord[] = [];
  const rejected: ParsedExternalEvidence['rejected'] = [];
  let skippedSummaryRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (isSummaryRow(row)) {
      skippedSummaryRows += 1;
      return;
    }

    try {
      const externalOrderId = normalizeOrderId(firstValue(row, [
        'order number', 'order no', 'order id', 'short order id', 'booking code', 'external order id',
      ]));
      const externalTransactionIdRaw = firstValue(row, [
        'transaction id', 'transaction number', 'reference id', 'reference', 'booking id',
      ]);
      const externalTransactionId = String(externalTransactionIdRaw ?? '').trim() || null;

      const grossSales = money(firstValue(row, [
        'gross amount thb', 'gross amount', 'gross sales', 'order value', 'gross merchant sales', 'basket value',
      ]));
      const netSales = money(firstValue(row, [
        'net amount thb', 'net amount', 'net sales', 'merchant net', 'net payout', 'payout amount',
      ]));
      const explicitDeductions = money(firstValue(row, [
        'grab deductions thb', 'provider deductions', 'total deductions', 'deductions', 'total fee',
      ]));
      const commission = money(firstValue(row, ['commission', 'commission fee', 'grab commission']));
      const platformFee = money(firstValue(row, ['platform fee', 'service fee', 'marketing fee']));
      const paymentFee = money(firstValue(row, ['payment fee', 'transaction fee']));
      const merchantFundedDiscount = money(firstValue(row, [
        'merchant funded discount', 'merchant promotion', 'merchant promo', 'merchant discount',
      ]));
      const providerFundedDiscount = money(firstValue(row, [
        'provider funded discount', 'grab funded discount', 'grab promotion', 'grab promo',
      ]));
      const refundAmount = money(firstValue(row, ['refund amount', 'refund']));
      const tax = money(firstValue(row, ['tax', 'vat']));
      const tips = money(firstValue(row, ['tip', 'tips']));

      if (!externalOrderId && !externalTransactionId) {
        throw new Error('Missing transaction/order identifier');
      }
      if (grossSales == null && netSales == null) {
        throw new Error('Missing both gross and net financial amounts');
      }

      const transactionAt = parseDateTime(row, timezone);
      const typeText = normalize(firstValue(row, ['transaction type', 'type', 'status']));
      let transactionType: ExternalEvidenceRecord['transactionType'] = 'sale';
      if (typeText.includes('refund') || (refundAmount ?? 0) > 0 || (grossSales ?? 0) < 0) transactionType = 'refund';
      else if (typeText.includes('cancel')) transactionType = 'cancellation';
      else if (typeText.includes('settlement') || typeText.includes('payout')) transactionType = 'settlement';
      else if (typeText.includes('fee')) transactionType = 'fee';
      else if (typeText.includes('adjust')) transactionType = 'adjustment';

      let otherDeduction = explicitDeductions;
      if (otherDeduction == null && grossSales != null && netSales != null) {
        otherDeduction = Math.round((grossSales - netSales) * 100) / 100;
      }

      accepted.push({
        transactionAt,
        externalTransactionId,
        externalOrderId,
        transactionType,
        grossSales,
        netSales,
        merchantFundedDiscount,
        providerFundedDiscount,
        refundAmount,
        commission,
        platformFee,
        paymentFee,
        tax,
        tips,
        otherDeduction,
        expectedSettlement: netSales,
        originalRecord: row,
        sourceRecordHash: recordHash(row),
      });
    } catch (error: any) {
      rejected.push({ row: rowNumber, reason: error?.message || String(error), raw: row });
    }
  });

  return { headers, accepted, rejected, skippedSummaryRows };
}
