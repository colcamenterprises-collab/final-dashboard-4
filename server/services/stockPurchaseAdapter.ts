import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PurchaseRow = { id: string; meta: { quantity: number } };

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists
  `;
  return Boolean(rows?.[0]?.exists);
}

async function tableColumns(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;
  return new Set(rows.map((row) => row.column_name));
}

function firstColumn(columns: Set<string>, candidates: string[]): string | null {
  return candidates.find((column) => columns.has(column)) ?? null;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function getExpenseRollRows(shiftDate: string): Promise<{ id: string; quantity: number | null }[]> {
  if (!(await tableExists('expenses'))) return [];

  const columns = await tableColumns('expenses');
  const dateColumn = firstColumn(columns, ['shiftDate', 'date', 'business_date', 'createdAt', 'created_at']);
  if (!dateColumn) return [];

  const textColumns = ['item', 'description', 'category', 'expenseType', 'supplier'].filter((column) => columns.has(column));
  const quantityExpressions = [
    columns.has('quantity') ? 'quantity::numeric' : null,
    columns.has('meta') ? "(meta->>'quantity')::numeric" : null,
    columns.has('meta') ? "(meta->>'qty')::numeric" : null,
    columns.has('meta') ? "(meta->>'rolls')::numeric" : null,
    columns.has('meta') ? "(meta->>'rolls_pcs')::numeric" : null,
  ].filter(Boolean);

  const haystack = textColumns.length
    ? `concat_ws(' ', ${textColumns.map(quoteIdent).join(', ')})`
    : "''";
  const quantitySql = quantityExpressions.length
    ? `COALESCE(${quantityExpressions.map((expr) => `NULLIF(${expr}, 0)`).join(', ')}, 0)::int`
    : '0::int';
  const sourceFilter = columns.has('source')
    ? `AND COALESCE(source, '') IN ('STOCK_LODGMENT', 'stock_lodgement_home', 'stock_modal', 'manual_stock_purchase')`
    : '';

  return prisma.$queryRawUnsafe<{ id: string; quantity: number | null }[]>(
    `SELECT id::text AS id, ${quantitySql} AS quantity
     FROM expenses
     WHERE ${quoteIdent(dateColumn)}::date = $1::date
       ${sourceFilter}
       AND lower(${haystack}) LIKE ANY (ARRAY['%roll%', '%bun%'])`,
    shiftDate,
  ).catch(() => []);
}

export async function getRollsPurchases(shiftDate: string): Promise<PurchaseRow[]> {
  const [expenseRows, stockLogRows, purchaseTallyRows] = await Promise.all([
    getExpenseRollRows(shiftDate),
    tableExists('stock_received_log').then((exists) => exists
      ? prisma.$queryRaw<{ id: string; quantity: number | null }[]>`
          SELECT id::text AS id, COALESCE(qty, 0)::int AS quantity
          FROM stock_received_log
          WHERE shift_date = ${shiftDate}::date
            AND item_type = 'rolls'
        `.catch(() => [] as { id: string; quantity: number | null }[])
      : []),
    tableExists('purchase_tally').then((exists) => exists
      ? prisma.$queryRaw<{ id: string; quantity: number | null }[]>`
          SELECT id::text AS id, COALESCE(rolls_pcs, 0)::int AS quantity
          FROM purchase_tally
          WHERE date = ${shiftDate}::date
            AND COALESCE(rolls_pcs, 0) <> 0
        `.catch(() => [] as { id: string; quantity: number | null }[])
      : []),
  ]);

  return [...expenseRows, ...stockLogRows, ...purchaseTallyRows]
    .map((row) => ({
      id: row.id,
      meta: { quantity: Number(row.quantity ?? 0) },
    }))
    .filter((row) => Number.isFinite(row.meta.quantity) && row.meta.quantity !== 0);
}

export async function getMeatPurchases(shiftDate: string) {
  const [purchaseTallyRows, stockLogRows] = await Promise.all([
    prisma.purchase_tally.findMany({
      where: { date: shiftDate as any },
      select: { meat_grams: true },
    }),
    tableExists('stock_received_log').then((exists) => exists
      ? prisma.$queryRaw<{ meat_grams: number | null }[]>`
          SELECT COALESCE(weight_g, 0)::int AS meat_grams
          FROM stock_received_log
          WHERE shift_date = ${shiftDate}::date
            AND item_type = 'meat'
        `
      : []),
  ]);

  return [...purchaseTallyRows, ...stockLogRows];
}

export async function getDrinksPurchases(shiftDate: string) {
  if (!(await tableExists('stock_received_log'))) return [];
  return prisma.$queryRaw<any[]>`
    SELECT *
    FROM stock_received_log
    WHERE item_type = 'drinks'
      AND shift_date = ${shiftDate}::date
  `;
}
