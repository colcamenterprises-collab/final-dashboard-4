// server/services/balanceService.ts
import { db } from "../db";
import { loyverse_shifts, dailyStockSales } from "../../shared/schema";
import { sql, desc } from "drizzle-orm";

export async function getPosBalances(limit = 5) {
  const rows = await db
    .select()
    .from(loyverse_shifts)
    .orderBy(desc(loyverse_shifts.shiftDate))
    .limit(limit);

  return rows.map(r => {
    const data = r.data as any;
    let expected = 0;
    let actual = 0;
    
    if (data?.['Expected cash amount']) {
      // CSV format
      expected = parseFloat(data['Expected cash amount'] || 0);
      actual = parseFloat(data['Actual cash amount'] || 0);
    } else if (data?.shifts?.[0]) {
      // API format
      const shiftInfo = data.shifts[0];
      expected = parseFloat(shiftInfo.expected_cash || 0);
      actual = parseFloat(shiftInfo.actual_cash || 0);
    }
    
    const diff = actual - expected;
    return {
      date: r.shiftDate,
      expected,
      actual,
      difference: diff,
      status: Math.abs(diff) <= 50 ? "Balanced" : "Anomaly"
    };
  });
}

export async function getFormBalances(limit = 5) {
  const rows = await db
    .select()
    .from(dailyStockSales)
    .orderBy(desc(dailyStockSales.createdAt))
    .limit(limit);

  return rows.map(r => {
    const expected =
      Number(r.startingCash || 0) +
      Number(r.cashSales || 0) -
      Number(r.cashRefunds || 0) +
      Number(r.paidIn || 0) -
      Number(r.paidOut || 0);
    const actual = Number(r.closingCash || 0);
    const diff = actual - expected;
    return {
      date: r.shiftDate?.toISOString().split('T')[0] || r.createdAt?.toISOString().split('T')[0] || 'Unknown',
      expected,
      actual,
      difference: diff,
      status: Math.abs(diff) <= 50 ? "Balanced" : "Anomaly"
    };
  });
}

export async function getCombinedBalances() {
  const pos = await getPosBalances(30);
  const forms = await getFormBalances(30);

  return pos.map(p => {
    const match = forms.find(f => f.date === p.date);
    return {
      date: p.date,
      pos: p,
      form: match || null,
      anomaly:
        !match ||
        Math.abs(p.difference) > 50 ||
        Math.abs((match?.difference || 0)) > 50
    };
  });
}