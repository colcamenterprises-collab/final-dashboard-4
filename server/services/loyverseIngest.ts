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
  // Allow 30 min buffer for early openings
  const [year, month, day] = businessDate.split('-').map(Number);
  
  // Start: 30 min before 18:00 Bangkok = 10:30 UTC same day
  const startUtc = new Date(Date.UTC(year, month - 1, day, 10, 30, 0));
  
  // End: 30 min after 03:00 Bangkok = 20:30 UTC same day  
  const endUtc = new Date(Date.UTC(year, month - 1, day, 20, 30, 0));
  
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
  
  const url = new URL('https://api.loyverse.com/v1.0/shifts');
  url.searchParams.set('store_id', storeId);
  url.searchParams.set('limit', '100');

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.warn(`   ⚠️  Loyverse shifts ${r.status}: ${errorText}`);
    return expenses;
  }

  const data = await r.json() as LoyverseShiftsResponse;
  
  const startTime = new Date(startUtc).getTime();
  const endTime = new Date(endUtc).getTime();
  
  const filteredShifts = data.shifts.filter(shift => {
    const openedTime = new Date(shift.opened_at).getTime();
    return openedTime >= startTime && openedTime <= endTime;
  });
  
  if (filteredShifts.length === 0) {
    console.log(`   ℹ️  No shifts found for this date window`);
    return expenses;
  }
  
  console.log(`   📊 Filtered ${filteredShifts.length} shift(s) from ${data.shifts.length} total`);
  
  for (const shift of filteredShifts) {
    if (!shift.cash_movements || shift.cash_movements.length === 0) {
      console.log(`   ℹ️  No cash movements in shift ${shift.id}`);
      continue;
    }
    
    console.log(`   💸 Processing ${shift.cash_movements.length} cash movements from shift at ${shift.opened_at}`);
    
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

  const url = new URL('https://api.loyverse.com/v1.0/shifts');
  url.searchParams.set('store_id', storeId);
  url.searchParams.set('limit', '100');

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(`Loyverse shifts ${r.status}: ${errorText}`);
  }

  const data = await r.json() as LoyverseShiftsResponse;
  
  const startTime = new Date(startUtc).getTime();
  const endTime = new Date(endUtc).getTime();
  
  const filteredShifts = data.shifts.filter(shift => {
    const openedTime = new Date(shift.opened_at).getTime();
    return openedTime >= startTime && openedTime <= endTime;
  });
  
  if (filteredShifts.length === 0) {
    throw new Error(`No shift found for ${businessDate}`);
  }
  
  if (filteredShifts.length > 1) {
    console.warn(`   ⚠️  Found ${filteredShifts.length} shifts, using first one`);
  }
  
  const shift = filteredShifts[0];
  console.log(`   📊 Using shift opened at ${shift.opened_at}`);
  console.log(`   Net sales: ฿${shift.net_sales}, Receipts: ${shift.gross_sales - shift.net_sales > 0 ? 'has refunds' : 'no refunds'}`);
  
  const totals: Totals = { cash: 0, qr: 0, grab: 0, other: 0, grand: Math.round(shift.net_sales) };
  
  for (const payment of (shift.payments || [])) {
    const kind = mapping[payment.payment_type_id] || 'Other';
    const amt = Math.round(payment.money_amount);
    
    if (kind === 'Cash') totals.cash = amt;
    else if (kind === 'QR') totals.qr = amt;
    else if (kind === 'Grab') totals.grab = amt;
    else totals.other = amt;
  }

  console.log(`   Sales: Cash=${totals.cash}, QR=${totals.qr}, Grab=${totals.grab}, Other=${totals.other}, Grand=${totals.grand}`);

  // Fetch expense data
  console.log(`   📦 Fetching expenses...`);
  const expenses: ExpenseTotals = { shopping: 0, wages: 0, other: 0 };
  
  if (shift.cash_movements && shift.cash_movements.length > 0) {
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
      grossSales: Math.round(shift.gross_sales),
      discounts: Math.round(shift.discounts),
      netSales: totals.grand,
      cashInDrawer: Math.round(shift.expected_cash),
      cashSales: totals.cash,
      qrSales: totals.qr,
      otherSales: totals.other,
      receiptCount: 0,
      openedAt: new Date(shift.opened_at),
      closedAt: shift.closed_at ? new Date(shift.closed_at) : new Date(endUtc),
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
      startingCash: Math.round(shift.starting_cash),
      grossSales: Math.round(shift.gross_sales),
      discounts: Math.round(shift.discounts),
      netSales: totals.grand,
      cashInDrawer: Math.round(shift.expected_cash),
      cashSales: totals.cash,
      qrSales: totals.qr,
      otherSales: totals.other,
      receiptCount: 0,
      openedAt: new Date(shift.opened_at),
      closedAt: shift.closed_at ? new Date(shift.closed_at) : new Date(endUtc),
    },
  });

  console.log(`   ✅ Saved to database`);
  return { sales: totals, expenses };
}

export async function ingestShiftForDate(businessDate: string) {
  const storeId = 'bcacbb19-db02-4fe8-91fc-e5a9d8116f14';
  return await ingestPosForBusinessDate(storeId, businessDate);
}
