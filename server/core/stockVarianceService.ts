import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getStockStatus(shiftDate: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT payload FROM daily_sales_v2 WHERE DATE(created_at) = $1 ORDER BY created_at DESC LIMIT 1`, shiftDate);
  const p = rows?.[0]?.payload ?? {};
  const metrics = p.stockControl ?? {};
  return {
    shiftDate,
    rolls: metrics.rolls ?? null,
    meat: metrics.meat ?? null,
    drinks: metrics.drinks ?? null,
    fries: metrics.fries ?? null,
    thresholds: { rolls: 4, meat: 500, drinks: 2, fries: 3 },
    friesThresholdNote: 'Temporary threshold ±3 units until canonical fries baseline table is finalized.',
  };
}
