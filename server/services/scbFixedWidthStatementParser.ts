export interface ParsedScbFixedWidthTransaction {
  postedAt: Date;
  description: string;
  amountTHB: number;
  ref?: string;
  raw: Record<string, unknown>;
}

const TRANSACTION_LINE = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})\s+(X\d+)\s+(\S+)/i;
const MONEY_VALUE = /(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}/g;

function statementLines(records: string[][]): string[] {
  return records
    .map((row) => row.length === 1 ? String(row[0] || '') : row.map((cell) => String(cell || '')).join(','))
    .map((line) => line.replace(/^\uFEFF/, '').trimEnd());
}

function moneyValues(line: string): number[] {
  return Array.from(line.matchAll(MONEY_VALUE), (match) => Number(match[0].replace(/,/g, '')))
    .filter(Number.isFinite);
}

function parseStatementDate(value: string): Date {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) throw new Error(`Unsupported SCB transaction date "${value}".`);

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (year > 2400) year -= 543;

  const parsed = new Date(Date.UTC(year, month, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Unsupported SCB transaction date "${value}".`);
  }
  return parsed;
}

function isStatementMetadata(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  return (
    /THE SIAM COMMERCIAL BANK/i.test(trimmed) ||
    /STATEMENT OF SAVING ACCOUNT/i.test(trimmed) ||
    /BALANCE BROUGHT FORWARD/i.test(trimmed) ||
    /^Date$/i.test(trimmed) ||
    /^วันที่$/i.test(trimmed) ||
    /^Date\s+Time\s+Code\s+Channel/i.test(trimmed) ||
    /^วันที่\s+เวลา\s+รายการ\s+ช่องทาง/i.test(trimmed) ||
    /^Page\s+\d+/i.test(trimmed) ||
    /^หน้า\s*\d+/i.test(trimmed) ||
    /^\d{5,}$/.test(trimmed) ||
    /^วันที่\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(trimmed)
  );
}

function descriptionPart(line: string): string {
  const marker = line.match(/DESC\s*:\s*(.*)$/i);
  if (marker) return marker[1].trim();
  return line.trim();
}

function extractReference(description: string): string | undefined {
  const match = description.match(/\b(?:REF|REFERENCE|เลขที่อ้างอิง)\s*[:#]?\s*([^\s,;]+)/i);
  return match?.[1]?.trim() || undefined;
}

export function looksLikeScbFixedWidthStatement(records: string[][]): boolean {
  const lines = statementLines(records);
  const firstPage = lines.slice(0, 80).join('\n');
  const transactionLines = lines.filter((line) => TRANSACTION_LINE.test(line.trim())).length;

  return (
    transactionLines > 0 &&
    (/THE SIAM COMMERCIAL BANK/i.test(firstPage) || /BALANCE BROUGHT FORWARD/i.test(firstPage)) &&
    /Debit\/Credit|ลูกหนี้\/เจ้าหนี้/i.test(firstPage)
  );
}

export function parseScbFixedWidthStatement(records: string[][]): ParsedScbFixedWidthTransaction[] {
  const lines = statementLines(records);
  const transactions: ParsedScbFixedWidthTransaction[] = [];
  let previousBalance: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/BALANCE BROUGHT FORWARD/i.test(trimmed)) {
      const balances = moneyValues(trimmed);
      if (balances.length > 0) previousBalance = balances[balances.length - 1];
      continue;
    }

    const match = trimmed.match(TRANSACTION_LINE);
    if (!match) continue;

    const values = moneyValues(trimmed);
    if (values.length < 2) continue;

    const transactionAmount = values[values.length - 2];
    const balance = values[values.length - 1];
    const code = match[3].toUpperCase();
    const channel = match[4].toUpperCase();
    const continuationLines: string[] = [];

    for (let continuationIndex = index + 1; continuationIndex < lines.length; continuationIndex += 1) {
      const continuation = lines[continuationIndex];
      if (TRANSACTION_LINE.test(continuation.trim()) || /BALANCE BROUGHT FORWARD/i.test(continuation)) break;
      if (!isStatementMetadata(continuation)) continuationLines.push(continuation.trim());
      index = continuationIndex;
    }

    const descriptionParts = [descriptionPart(trimmed), ...continuationLines.map(descriptionPart)]
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const description = descriptionParts.join(' ').trim() || `${code} ${channel}`;

    let amountTHB: number;
    if (code === 'X1') {
      amountTHB = -transactionAmount;
    } else if (code === 'X2') {
      amountTHB = transactionAmount;
    } else if (previousBalance !== null) {
      amountTHB = balance >= previousBalance ? -transactionAmount : transactionAmount;
    } else {
      throw new Error(`Unsupported SCB transaction direction code "${code}".`);
    }

    transactions.push({
      postedAt: parseStatementDate(match[1]),
      description,
      amountTHB,
      ref: extractReference(description),
      raw: {
        layout: 'scb_fixed_width',
        statementLine: trimmed,
        continuationLines,
        time: match[2],
        code,
        channel,
        balanceTHB: balance,
      },
    });

    previousBalance = balance;
  }

  if (transactions.length === 0) {
    throw new Error('No SCB transactions were found in the fixed-width statement export.');
  }

  return transactions;
}
