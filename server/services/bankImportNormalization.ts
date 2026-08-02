export function extractMerchantSuggestion(description: string): string | null {
  const cleaned = description
    .replace(/\b(pos|visa|mastercard|promptpay|transfer|payment|purchase|debit|card)\b/gi, ' ')
    .replace(/[^a-z0-9ก-๙&.' -]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

export function generateBankImportDedupeKey(
  source: string,
  postedAt: Date,
  amountTHB: number,
  description: string,
  raw?: Record<string, unknown>,
): string {
  const dateStr = postedAt.toISOString().slice(0, 10);
  const absAmount = Math.abs(amountTHB);
  const descPrefix = description.slice(0, 32).toUpperCase();
  const statementTime = typeof raw?.time === 'string' ? raw.time.trim() : '';

  // SCB's fixed-width export can contain otherwise identical transactions on the
  // same date. Its statement time makes those rows distinct without changing the
  // historical key format used by the existing CSV importers.
  return statementTime
    ? `${source}|${dateStr}|${statementTime}|${absAmount}|${descPrefix}`
    : `${source}|${dateStr}|${absAmount}|${descPrefix}`;
}
