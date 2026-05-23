import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getPosStatus() {
  const [latestReceipt, latestShift, latestSync] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(`SELECT MAX("createdAtUTC") AS v FROM receipts`),
    prisma.$queryRawUnsafe<any[]>(`SELECT MAX(shift_date) AS v FROM loyverse_shifts`),
    prisma.$queryRawUnsafe<any[]>(`SELECT MAX("createdAt") AS v FROM receipts`),
  ]);
  const latestReceiptDate = latestReceipt?.[0]?.v ?? null;
  const latestShiftReportDate = latestShift?.[0]?.v ?? null;
  const latestSyncAt = latestSync?.[0]?.v ?? null;
  const hasToken = Boolean(process.env.LOYVERSE_API_TOKEN || process.env.LOYVERSE_TOKEN || process.env.BOBS_LOYVERSE_TOKEN);
  return {
    connected: hasToken && Boolean(latestReceiptDate),
    latestReceiptDate,
    latestShiftReportDate,
    latestSyncAt,
    activeIngestionRoute: '/api/loyverse/sync',
    receiptTable: 'receipts',
    shiftReportTable: 'loyverse_shifts',
  };
}
