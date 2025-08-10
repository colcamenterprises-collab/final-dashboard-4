import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const rows = [
  { sourceName: 'Cash', channel: 'CASH' },
  { sourceName: 'CASH', channel: 'CASH' },
  { sourceName: 'Scan (QR Code)', channel: 'QR' },
  { sourceName: 'QR', channel: 'QR' },
  { sourceName: 'Grab', channel: 'GRAB' },
  { sourceName: 'GRAB', channel: 'GRAB' },
  { sourceName: 'Card', channel: 'CARD' },
  { sourceName: 'VISA', channel: 'CARD' },
  { sourceName: 'MASTERCARD', channel: 'CARD' },
];

(async () => {
  for (const r of rows) {
    await prisma.paymentMethodMap.upsert({
      where: { provider_sourceName: { provider: 'LOYVERSE', sourceName: r.sourceName } },
      create: { provider: 'LOYVERSE', sourceName: r.sourceName, channel: r.channel },
      update: { channel: r.channel },
    });
  }
  console.log('Seeded payment method map');
  await prisma.$disconnect();
})();