import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getRollsPurchases(shiftDate: string) {
  return prisma.expenses.findMany({
    where: {
      source: 'STOCK_LODGMENT',
      item: { contains: 'roll', mode: 'insensitive' },
      date: shiftDate as any,
    },
  });
}

export async function getMeatPurchases(shiftDate: string) {
  return prisma.purchase_tally.findMany({
    where: { date: shiftDate as any },
    select: { meat_grams: true },
  });
}

export async function getDrinksPurchases(shiftDate: string) {
  return prisma.stock_received_log.findMany({
    where: { item_type: 'drinks', shift_date: shiftDate as any },
  });
}
