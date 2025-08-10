// checkLinkage.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const formId = '9c303a5e-6b0f-4a12-b116-cfb6a0089ef7';

  const sales = await prisma.dailySales.findUnique({
    where: { id: formId },
    select: { id: true, createdAt: true, completedBy: true }
  });

  const stock = await prisma.dailyStock.findUnique({
    where: { salesFormId: formId },
    select: { id: true, salesFormId: true, createdAt: true }
  });

  console.log('Sales form:', sales || 'NOT FOUND');
  console.log('Stock form:', stock || 'NOT FOUND');

  if (sales && stock) {
    console.log('\n✅ PASS: Sales and Stock linkage exists.');
  } else {
    console.log('\n❌ FAIL: Missing Sales or Stock form for this ID.');
  }

  process.exit(0);
})();
