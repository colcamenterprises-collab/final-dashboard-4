import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getRollsPurchases(shiftDate: string) {
  const [expenseRows, stockLogRows] = await Promise.all([
    prisma.expenses.findMany({
      where: {
        source: { in: ['STOCK_LODGMENT', 'stock_lodgement_home', 'stock_modal', 'manual_stock_purchase'] as any },
        date: shiftDate as any,
      },
      select: {
        id: true,
        quantity: true as any,
        meta: true as any,
        description: true,
      } as any,
    }).catch(() => [] as any[]),
    prisma.stock_received_log.findMany({
      where: {
        shift_date: shiftDate as any,
        item_type: 'rolls',
      },
      select: {
        id: true,
        qty: true,
      } as any,
    }),
  ]);

  const fromExpenses = (expenseRows as any[])
    .filter((row) => String(row?.description ?? '').toLowerCase().includes('roll'))
    .map((row) => ({
      id: row.id,
      meta: {
        quantity: Number((row as any)?.quantity ?? (row as any)?.meta?.quantity ?? 0),
      },
    }));

  const fromStockLog = stockLogRows.map((row: any) => ({
    id: row.id,
    meta: {
      quantity: Number(row?.qty ?? 0),
    },
  }));

  return [...fromExpenses, ...fromStockLog];
}

export async function getMeatPurchases(shiftDate: string) {
  const [purchaseTallyRows, stockLogRows] = await Promise.all([
    prisma.purchase_tally.findMany({
      where: { date: shiftDate as any },
      select: { meat_grams: true },
    }),
    prisma.stock_received_log.findMany({
      where: {
        shift_date: shiftDate as any,
        item_type: 'meat',
      },
      select: {
        weight_g: true,
      } as any,
    }),
  ]);

  const normalizedStockLogRows = stockLogRows.map((row: any) => ({
    meat_grams: Number(row?.weight_g ?? 0),
  }));

  return [...purchaseTallyRows, ...normalizedStockLogRows];
}

export async function getDrinksPurchases(shiftDate: string) {
  return prisma.stock_received_log.findMany({
    where: { item_type: 'drinks', shift_date: shiftDate as any },
  });
}
