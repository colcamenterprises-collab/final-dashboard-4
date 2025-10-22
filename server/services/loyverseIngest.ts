import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Totals = { cash: number; qr: number; grab: number; other: number; grand: number };

interface LoyverseReceipt {
  receipt_number: string;
  created_at: string;
  payments?: Array<{
    payment_type_id: string;
    amount: string;
  }>;
}

interface LoyverseResponse {
  receipts: LoyverseReceipt[];
  cursor?: string;
}

function toUtcWindowForBkkShift(businessDate: string): { startUtc: string; endUtc: string } {
  const d = new Date(businessDate + 'T00:00:00+07:00');
  
  const startBkk = new Date(d);
  startBkk.setHours(18, 0, 0, 0);
  
  const endBkk = new Date(d);
  endBkk.setDate(endBkk.getDate() + 1);
  endBkk.setHours(3, 0, 0, 0);
  
  return {
    startUtc: startBkk.toISOString(),
    endUtc: endBkk.toISOString(),
  };
}

export function toBkkDateMinus3h(timestamp: Date): Date {
  const bkkTime = new Date(timestamp.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  bkkTime.setHours(bkkTime.getHours() - 3);
  
  const year = bkkTime.getFullYear();
  const month = String(bkkTime.getMonth() + 1).padStart(2, '0');
  const day = String(bkkTime.getDate()).padStart(2, '0');
  
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

async function getPaymentTypeMapping(): Promise<Record<string, 'Cash' | 'QR' | 'Grab' | 'Other'>> {
  const token = process.env.LOYVERSE_TOKEN;
  if (!token) throw new Error('LOYVERSE_TOKEN not set');

  const url = 'https://api.loyverse.com/v1.0/payment_types';
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) throw new Error(`Loyverse payment types ${r.status}: ${await r.text()}`);

  const data = await r.json() as { payment_types: Array<{ id: string; name: string }> };
  
  const mapping: Record<string, 'Cash' | 'QR' | 'Grab' | 'Other'> = {};
  
  for (const pt of data.payment_types) {
    const name = pt.name.toLowerCase();
    if (name.includes('cash') || name.includes('เงินสด')) {
      mapping[pt.id] = 'Cash';
    } else if (name.includes('qr') || name.includes('promptpay') || name.includes('พร้อมเพย์')) {
      mapping[pt.id] = 'QR';
    } else if (name.includes('grab')) {
      mapping[pt.id] = 'Grab';
    } else {
      mapping[pt.id] = 'Other';
    }
  }
  
  console.log('💳 Payment type mapping:', mapping);
  return mapping;
}

export async function ingestPosForBusinessDate(storeId: string, businessDate: string) {
  console.log(`📥 Ingesting POS data for ${businessDate}...`);
  
  const { startUtc, endUtc } = toUtcWindowForBkkShift(businessDate);
  console.log(`   Window: ${startUtc} → ${endUtc}`);
  
  const mapping = await getPaymentTypeMapping();
  const token = process.env.LOYVERSE_TOKEN;
  if (!token) throw new Error('LOYVERSE_TOKEN not set');

  let cursor: string | undefined;
  const totals: Totals = { cash: 0, qr: 0, grab: 0, other: 0, grand: 0 };
  let receiptCount = 0;

  do {
    const url = new URL('https://api.loyverse.com/v1.0/receipts');
    url.searchParams.set('store_id', storeId);
    url.searchParams.set('created_at_min', startUtc);
    url.searchParams.set('created_at_max', endUtc);
    url.searchParams.set('limit', '250');
    if (cursor) url.searchParams.set('cursor', cursor);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Loyverse ${r.status}: ${errorText}`);
    }

    const data = await r.json() as LoyverseResponse;
    
    for (const rcpt of data.receipts) {
      receiptCount++;
      for (const p of (rcpt.payments || [])) {
        const kind = mapping[p.payment_type_id] || 'Other';
        const amt = Math.round(Number(p.amount) || 0);
        
        if (kind === 'Cash') totals.cash += amt;
        else if (kind === 'QR') totals.qr += amt;
        else if (kind === 'Grab') totals.grab += amt;
        else totals.other += amt;
        
        totals.grand += amt;
      }
    }
    
    cursor = data.cursor;
  } while (cursor);

  console.log(`   Processed ${receiptCount} receipts`);
  console.log(`   Totals: Cash=${totals.cash}, QR=${totals.qr}, Grab=${totals.grab}, Other=${totals.other}, Grand=${totals.grand}`);

  const businessDateObj = new Date(businessDate + 'T00:00:00Z');
  const batchId = `LOYVERSE_${businessDate}_${storeId}`;

  await prisma.posBatch.upsert({
    where: { id: batchId },
    update: {},
    create: {
      id: batchId,
      title: `Loyverse ${businessDate}`,
    },
  });

  await prisma.posShiftReport.upsert({
    where: { batchId },
    update: {
      storeId,
      cashTotal: totals.cash,
      qrTotal: totals.qr,
      grabTotal: totals.grab,
      otherTotal: totals.other,
      grandTotal: totals.grand,
      businessDate: businessDateObj,
      grossSales: totals.grand,
      discounts: 0,
      netSales: totals.grand,
      cashInDrawer: totals.cash,
      cashSales: totals.cash,
      qrSales: totals.qr,
      otherSales: totals.other,
      receiptCount: receiptCount,
      openedAt: new Date(startUtc),
      closedAt: new Date(endUtc),
    },
    create: {
      batchId,
      storeId,
      businessDate: businessDateObj,
      cashTotal: totals.cash,
      qrTotal: totals.qr,
      grabTotal: totals.grab,
      otherTotal: totals.other,
      grandTotal: totals.grand,
      shoppingTotal: 0,
      wagesTotal: 0,
      otherExpense: 0,
      startingCash: 0,
      grossSales: totals.grand,
      discounts: 0,
      netSales: totals.grand,
      cashInDrawer: totals.cash,
      cashSales: totals.cash,
      qrSales: totals.qr,
      otherSales: totals.other,
      receiptCount: receiptCount,
      openedAt: new Date(startUtc),
      closedAt: new Date(endUtc),
    },
  });

  console.log(`   ✅ Saved to database`);
  return totals;
}
