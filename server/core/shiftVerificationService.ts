import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getShiftVerification(shiftDate: string) {
  const [pos, sales, stock, purchasing, receipts] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(total),0) AS total FROM loyverse_shifts WHERE shift_date = $1`, shiftDate),
    prisma.$queryRawUnsafe<any[]>(`SELECT id, payload FROM daily_sales_v2 WHERE DATE(created_at) = $1 ORDER BY created_at DESC LIMIT 1`, shiftDate),
    prisma.$queryRawUnsafe<any[]>(`SELECT id FROM daily_stock_sales WHERE DATE(date) = $1 ORDER BY created_at DESC LIMIT 1`, shiftDate),
    prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM purchasing_shift_items WHERE shiftDate = $1`, shiftDate),
    prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM receipts WHERE DATE("createdAtUTC") = $1`, shiftDate),
  ]);
  return {
    shiftDate,
    posSales: Number(pos?.[0]?.total ?? 0),
    staffDeclaredSales: sales?.[0]?.payload?.totals?.netSales ?? null,
    paymentBreakdownComparison: sales?.[0]?.payload?.paymentMethods ?? null,
    receiptCount: receipts?.[0]?.c ?? 0,
    dailySalesFormStatus: sales?.length ? 'submitted' : 'missing',
    dailyStockFormStatus: stock?.length ? 'submitted' : 'missing',
    purchasingStatus: (purchasing?.[0]?.c ?? 0) > 0 ? 'logged' : 'missing',
  };
}
