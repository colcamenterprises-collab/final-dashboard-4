import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Totals = { cash: number; qr: number; grab: number; other: number; grand: number };
type ExpenseTotals = { shopping: number; wages: number; other: number };

interface LoyverseReceipt {
  receipt_number: string;
  created_at: string;
  payments?: Array<{
    payment_type_id: string;
    money_amount: string;
  }>;
}

interface LoyverseResponse {
  receipts: LoyverseReceipt[];
  cursor?: string;
}

interface LoyverseShift {
  id: string;
  store_id: string;
  opened_at: string;
  closed_at: string;
  starting_cash: number;
  cash_payments: number;
  cash_refunds: number;
  paid_in: number;
  paid_out: number;
  expected_cash: number;
  actual_cash: number;
  gross_sales: number;
  refunds: number;
  discounts: number;
  net_sales: number;
  cash_movements?: Array<{
    type: 'PAY_IN' | 'PAY_OUT';
    money_amount: number;
    comment?: string;
    employee_id: string;
    created_at: string;
  }>;
}

interface LoyverseShiftsResponse {
  shifts: LoyverseShift[];
  cursor?: string;
}

function toUtcWindowForBkkShift(businessDate: string): { startUtc: string; endUtc: string } {
  // Bangkok is UTC+7
  // Business date shift: D 18:00 Bangkok → D+1 03:00 Bangkok
  const [year, month, day] = businessDate.split('-').map(Number);
  
  // Start: businessDate 18:00 Bangkok = 11:00 UTC same day
  const startUtc = new Date(Date.UTC(year, month - 1, day, 11, 0, 0));
  
  // End: businessDate+1 03:00 Bangkok = 20:00 UTC same day  
  const endUtc = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  
  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
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

function categorizeExpense(comment: string): 'shopping' | 'wages' | 'other' {
  const lower = comment.toLowerCase();
  
  // Shopping indicators (suppliers, stores)
  const shoppingKeywords = ['makro', 'แม็ก', 'supercheap', '7-11', 'seven', 'lotus', 'tesco', 'big c', 'tops', 'foodland', 'villa', 'gourmet', 'market', 'shop'];
  if (shoppingKeywords.some(k => lower.includes(k))) {
    return 'shopping';
  }
  
  // Wage indicators
  const wageKeywords = ['wage', 'salary', 'เงินเดือน', 'ค่าจ้าง', 'staff', 'employee', 'พนักงาน'];
  if (wageKeywords.some(k => lower.includes(k))) {
    return 'wages';
  }
  
  // Default to other
  return 'other';
}

async function fetchShiftExpenses(storeId: string, startUtc: string, endUtc: string): Promise<ExpenseTotals> {
  const token = process.env.LOYVERSE_TOKEN;
  if (!token) throw new Error('LOYVERSE_TOKEN not set');

  const expenses: ExpenseTotals = { shopping: 0, wages: 0, other: 0 };
  
  // Fetch shifts that opened within the business date window
  const url = new URL('https://api.loyverse.com/v1.0/shifts');
  url.searchParams.set('store_id', storeId);
  url.searchParams.set('opening_time_min', startUtc);
  url.searchParams.set('opening_time_max', endUtc);
  url.searchParams.set('limit', '10'); // Should only be 1-2 shifts per day

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.warn(`   ⚠️  Loyverse shifts ${r.status}: ${errorText}`);
    return expenses; // Return empty expenses if shift data unavailable
  }

  const data = await r.json() as LoyverseShiftsResponse;
  
  if (data.shifts.length === 0) {
    console.log(`   ℹ️  No shifts found for this date`);
    return expenses;
  }
  
  console.log(`   📊 Processing ${data.shifts.length} shift(s)`);
  
  for (const shift of data.shifts) {
    if (!shift.cash_movements || shift.cash_movements.length === 0) {
      console.log(`   ℹ️  No cash movements in shift ${shift.id}`);
      continue;
    }
    
    console.log(`   💸 Processing ${shift.cash_movements.length} cash movements`);
    
    for (const movement of shift.cash_movements) {
      if (movement.type === 'PAY_OUT') {
        const amount = Math.round(movement.money_amount || 0);
        const category = categorizeExpense(movement.comment || '');
        
        if (category === 'shopping') expenses.shopping += amount;
        else if (category === 'wages') expenses.wages += amount;
        else expenses.other += amount;
        
        console.log(`      • ${movement.comment || 'Unnamed'}: ฿${amount} → ${category}`);
      }
    }
  }

  return expenses;
}

export async function ingestPosForBusinessDate(storeId: string, businessDate: string) {
  console.log(`📥 Ingesting POS data for ${businessDate}...`);
  
  const { startUtc, endUtc } = toUtcWindowForBkkShift(businessDate);
  console.log(`   Window: ${startUtc} → ${endUtc}`);
  
  const mapping = await getPaymentTypeMapping();
  const token = process.env.LOYVERSE_TOKEN;
  if (!token) throw new Error('LOYVERSE_TOKEN not set');

  // Fetch sales data
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
        const amt = Math.round(Number(p.money_amount) || 0);
        
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
  console.log(`   Sales: Cash=${totals.cash}, QR=${totals.qr}, Grab=${totals.grab}, Other=${totals.other}, Grand=${totals.grand}`);

  // Fetch expense data
  console.log(`   📦 Fetching expenses...`);
  const expenses = await fetchShiftExpenses(storeId, startUtc, endUtc);
  console.log(`   Expenses: Shopping=${expenses.shopping}, Wages=${expenses.wages}, Other=${expenses.other}`);

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
      shoppingTotal: expenses.shopping,
      wagesTotal: expenses.wages,
      otherExpense: expenses.other,
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
      shoppingTotal: expenses.shopping,
      wagesTotal: expenses.wages,
      otherExpense: expenses.other,
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
  return { sales: totals, expenses };
}

export async function ingestShiftForDate(businessDate: string) {
  const storeId = 'bcacbb19-db02-4fe8-91fc-e5a9d8116f14';
  return await ingestPosForBusinessDate(storeId, businessDate);
}
