// checkLinkage.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkOne(id) {
  const sales = await prisma.dailySales.findUnique({
    where: { id },
    select: { id: true, createdAt: true, completedBy: true }
  });

  // use findFirst because salesFormId is not unique in your schema
  const stock = await prisma.dailyStock.findFirst({
    where: { salesFormId: id },
    select: { id: true, salesFormId: true, createdAt: true }
  });

  console.log('Sales:', sales ?? 'NOT FOUND');
  console.log('Stock:', stock ?? 'NOT FOUND');
  console.log(
    sales && stock ? '\n✅ PASS: Sales ↔ Stock linkage exists.\n'
                   : '\n❌ FAIL: Missing Sales or Stock for that ID.\n'
  );
}

async function checkLast24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sales = await prisma.dailySales.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, createdAt: true, completedBy: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\nLast 24h Sales count: ${sales.length}`);
  for (const s of sales) {
    const stock = await prisma.dailyStock.findFirst({
      where: { salesFormId: s.id },
      select: { id: true }
    });
    console.log(
      `${s.createdAt.toISOString()}  ${s.id}  ${s.completedBy ?? ''}  -> ${stock ? '✅ linked' : '❌ NO STOCK'}`
    );
  }
}

const arg = process.argv[2];
if (arg === '--last24') {
  await checkLast24h();
} else {
  const id = arg || '9c303a5e-6b0f-4a12-b116-cfb6a0089ef7';
  await checkOne(id);
}

await prisma.$disconnect();
