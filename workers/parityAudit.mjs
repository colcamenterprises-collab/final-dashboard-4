import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const prisma = new PrismaClient();

// usage: node workers/parityAudit.mjs 2025-08-09 /path/to/sales-summary.csv /path/to/payment-type-sales.csv
const [dateArg, salesSummaryCsv, paymentsCsv] = process.argv.slice(2);
if (!dateArg || !salesSummaryCsv || !paymentsCsv) {
  console.error('Usage: node workers/parityAudit.mjs YYYY-MM-DD sales-summary.csv payment-type-sales.csv');
  process.exit(1);
}

const csv = p => fs.readFileSync(p, 'utf8').trim().split('\n').map(r => r.split(','));
const toNum = s => Number((s || '').replace(/[^\d.-]/g, ''));

try {
  const salesRows = csv(salesSummaryCsv);
  const payRows = csv(paymentsCsv);

  // payment total from CSV
  let csvTotal = 0;
  for (let i = 1; i < payRows.length; i++) {
    const netAmountIndex = payRows[0].indexOf('Net amount');
    if (netAmountIndex !== -1) {
      csvTotal += toNum(payRows[i][netAmountIndex]);
    }
  }

  const startUTC = new Date(Date.UTC(...dateArg.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)), 11, 0, 0));
  const endUTC = new Date(Date.UTC(...dateArg.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)), 20, 0, 0));

  const [dbAgg] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count, COALESCE(SUM("totalSatang"),0)::bigint AS total
    FROM "Receipt"
    WHERE provider='LOYVERSE' AND "createdAtUTC" BETWEEN ${startUTC} AND ${endUTC};
  `;

  const dbReceipts = dbAgg?.count ?? 0;
  const dbTotalTHB = Number(dbAgg?.total ?? 0) / 100;

  const diffTotal = +(dbTotalTHB - csvTotal).toFixed(2);

  console.log({
    date: dateArg,
    dbReceipts,
    csvReceipts: salesRows[1]?.[salesRows[0].indexOf('Receipts')] || null,
    dbTotalTHB,
    csvTotalTHB: csvTotal,
    diffTotal
  });

  if (diffTotal !== 0) {
    await prisma.shiftSnapshot.updateMany({
      where: { windowStartUTC: startUTC, windowEndUTC: endUTC },
      data: { reconcileState: 'MISMATCH', reconcileNotes: 'DB vs CSV totals differ' }
    });
  }
  
} catch (error) {
  console.error('Parity audit failed:', error);
} finally {
  await prisma.$disconnect();
}