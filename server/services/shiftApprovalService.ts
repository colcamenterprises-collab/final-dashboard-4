import { DateTime } from 'luxon';
import { db } from '../lib/prisma';
import { ensureShiftDerivedTables, NormalizedShiftReport } from './loyverseService';

export interface ShiftComparisonData extends Partial<NormalizedShiftReport> {}

const DEFAULT_DATA: NormalizedShiftReport = {
  total: 0,
  cash: 0,
  qr: 0,
  grab: 0,
  other: 0,
  exp_cash: 0,
  exp: 0,
};

function parseNumeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getShiftSnapshot(date: string): Promise<any | null> {
  await ensureShiftDerivedTables();
  const prisma = db();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM shift_snapshot_v2 WHERE date = $1::date LIMIT 1`,
    date,
  );
  return rows[0] ?? null;
}

export async function listShiftSnapshots(): Promise<any[]> {
  await ensureShiftDerivedTables();
  const prisma = db();
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT date, approved, pos_data, form_data, cash_banked, qr_banked, completed_by, updated_at
     FROM shift_snapshot_v2
     ORDER BY date DESC
     LIMIT 90`,
  );
}

export async function getDailySalesFormNormalized(date: string): Promise<ShiftComparisonData> {
  const prisma = db();

  const salesRows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT id, "totalSales", "cashSales", "qrSales", "grabSales", "othersTotal", "totalExpenses", payload
      FROM daily_sales_v2
      WHERE "shift_date" = $1::date OR "shiftDate" = $1
      ORDER BY COALESCE("submittedAtISO", "createdAt") DESC
      LIMIT 1
    `,
    date,
  );

  if (!salesRows[0]) {
    return { ...DEFAULT_DATA };
  }

  const row = salesRows[0];
  const payload = (row.payload ?? {}) as Record<string, any>;

  const total = parseNumeric(row.totalSales ?? payload.totalSales);
  const cash = parseNumeric(row.cashSales ?? payload.cashSales);
  const qr = parseNumeric(row.qrSales ?? payload.qrSales);
  const grab = parseNumeric(row.grabSales ?? payload.grabSales);
  const otherFromPayload = payload.otherSales ?? payload.aroiSales;
  const other = parseNumeric(otherFromPayload ?? total - cash - qr - grab);

  const totalExpenses = parseNumeric(row.totalExpenses ?? payload.totalExpenses);
  const explicitExpCash = payload.exp_cash ?? payload.expCash ?? payload.cashExpense;

  return {
    total,
    cash,
    qr,
    grab,
    other,
    exp: totalExpenses,
    exp_cash: explicitExpCash == null ? 0 : parseNumeric(explicitExpCash),
  };
}

export async function upsertFormSnapshot(date: string, formData: ShiftComparisonData): Promise<void> {
  await ensureShiftDerivedTables();
  const prisma = db();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shift_snapshot_v2 (date, form_data, updated_at)
      VALUES ($1::date, $2::jsonb, NOW())
      ON CONFLICT (date)
      DO UPDATE SET form_data = EXCLUDED.form_data, updated_at = NOW();
    `,
    date,
    JSON.stringify(formData),
  );
}

async function hasCanonicalExpenses(date: string): Promise<boolean> {
  const prisma = db();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT (
        EXISTS (SELECT 1 FROM expenses WHERE date = $1::date)
        OR EXISTS (SELECT 1 FROM expenses_v2 WHERE date::date = $1::date)
        OR EXISTS (
          SELECT 1
          FROM "OtherExpenseV2" o
          JOIN daily_sales_v2 d ON d.id = o."salesId"
          WHERE d."shift_date" = $1::date OR d."shiftDate" = $1
        )
        OR EXISTS (
          SELECT 1
          FROM "WageEntryV2" w
          JOIN daily_sales_v2 d ON d.id = w."salesId"
          WHERE d."shift_date" = $1::date OR d."shiftDate" = $1
        )
      ) AS has_expenses;
    `,
    date,
  );
  return Boolean(rows[0]?.has_expenses);
}

export async function approveShiftAndPostFinancials(params: {
  date: string;
  cashBanked: number;
  qrBanked: number;
  notes?: string;
  completedBy: string;
}): Promise<void> {
  await ensureShiftDerivedTables();
  const prisma = db();

  const snapshot = await getShiftSnapshot(params.date);
  const posData = (snapshot?.pos_data ?? null) as ShiftComparisonData | null;
  const formData = (snapshot?.form_data ?? null) as ShiftComparisonData | null;
  const sourceData: ShiftComparisonData = posData && parseNumeric(posData.total) > 0 ? posData : (formData ?? DEFAULT_DATA);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shift_snapshot_v2 (date, approved, cash_banked, qr_banked, notes, completed_by, updated_at)
      VALUES ($1::date, true, $2::numeric, $3::numeric, $4::text, $5::text, NOW())
      ON CONFLICT (date)
      DO UPDATE SET approved = true,
                    cash_banked = EXCLUDED.cash_banked,
                    qr_banked = EXCLUDED.qr_banked,
                    notes = EXCLUDED.notes,
                    completed_by = EXCLUDED.completed_by,
                    updated_at = NOW();
    `,
    params.date,
    params.cashBanked,
    params.qrBanked,
    params.notes ?? '',
    params.completedBy,
  );

  await prisma.$executeRawUnsafe(
    `DELETE FROM financial_entries_shift WHERE date = $1::date AND source = 'shift';`,
    params.date,
  );

  const salesEntries: Array<{ category: string; amount: number }> = [
    { category: 'cash', amount: parseNumeric(sourceData.cash) },
    { category: 'qr', amount: parseNumeric(sourceData.qr) },
    { category: 'grab', amount: parseNumeric(sourceData.grab) },
    { category: 'other', amount: parseNumeric(sourceData.other) },
  ].filter((entry) => entry.amount > 0);

  for (const entry of salesEntries) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO financial_entries_shift (date, type, category, amount, source)
        VALUES ($1::date, 'sales', $2::text, $3::numeric, 'shift')
        ON CONFLICT (date, type, category, source)
        DO UPDATE SET amount = EXCLUDED.amount;
      `,
      params.date,
      entry.category,
      entry.amount,
    );
  }

  const canonicalExpensesExist = await hasCanonicalExpenses(params.date);
  if (!canonicalExpensesExist) {
    const expenseEntries: Array<{ category: string; amount: number }> = [
      { category: 'exp_cash', amount: parseNumeric(sourceData.exp_cash) },
      { category: 'exp', amount: parseNumeric(sourceData.exp) },
    ].filter((entry) => entry.amount > 0);

    for (const entry of expenseEntries) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO financial_entries_shift (date, type, category, amount, source)
          VALUES ($1::date, 'expense', $2::text, $3::numeric, 'shift')
          ON CONFLICT (date, type, category, source)
          DO UPDATE SET amount = EXCLUDED.amount;
        `,
        params.date,
        entry.category,
        entry.amount,
      );
    }
  }
}

export async function getPnlForPeriod(period: string): Promise<any> {
  await ensureShiftDerivedTables();
  const prisma = db();

  const month = DateTime.fromFormat(period, 'yyyy-MM', { zone: 'Asia/Bangkok' });
  if (!month.isValid) {
    throw new Error('Invalid period. Use YYYY-MM format.');
  }

  const from = month.startOf('month').toISODate();
  const to = month.endOf('month').toISODate();

  const shiftRows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT type, category, COALESCE(SUM(amount), 0) AS amount
      FROM financial_entries_shift
      WHERE date BETWEEN $1::date AND $2::date
      GROUP BY type, category
    `,
    from,
    to,
  );

  const shiftSales = shiftRows
    .filter((r) => r.type === 'sales')
    .reduce((sum, r) => sum + parseNumeric(r.amount), 0);
  const shiftExpenses = shiftRows
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + parseNumeric(r.amount), 0);

  const canonicalExpensesRows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT SUM(total) AS amount FROM (
        SELECT COALESCE(SUM(amount_cents), 0) / 100.0 AS total
        FROM expenses
        WHERE date BETWEEN $1::date AND $2::date

        UNION ALL

        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses_v2
        WHERE date::date BETWEEN $1::date AND $2::date

        UNION ALL

        SELECT COALESCE(SUM(o."amount"), 0) AS total
        FROM "OtherExpenseV2" o
        JOIN daily_sales_v2 d ON d.id = o."salesId"
        WHERE d."shift_date" BETWEEN $1::date AND $2::date

        UNION ALL

        SELECT COALESCE(SUM(w."amount"), 0) AS total
        FROM "WageEntryV2" w
        JOIN daily_sales_v2 d ON d.id = w."salesId"
        WHERE d."shift_date" BETWEEN $1::date AND $2::date
      ) s;
    `,
    from,
    to,
  );

  const canonicalExpenses = parseNumeric(canonicalExpensesRows[0]?.amount);
  const sales = shiftSales;
  const expenses = shiftExpenses + canonicalExpenses;

  return {
    period,
    sales,
    expenses,
    profit: sales - expenses,
    breakdown: {
      shift: shiftRows.map((r) => ({ type: r.type, category: r.category, amount: parseNumeric(r.amount) })),
      canonicalExpenses,
    },
  };
}
