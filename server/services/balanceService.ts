// server/services/balanceService.ts
import { db } from "../db";
import { loyverse_shifts, dailyStockSales } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export async function getDailyBalances(limit = 7) {
  // POS balances from loyverse_shifts
  const shifts = await db
    .select()
    .from(loyverse_shifts)
    .orderBy(desc(loyverse_shifts.shiftDate))
    .limit(limit);

  const posBalances = shifts.map((s) => {
    // Handle both CSV format and API format
    let expected = 0;
    let actual = 0;
    
    const data = s.data as any;
    if (data?.['Expected cash amount']) {
      // CSV format
      expected = Number(data['Expected cash amount'] || 0);
      actual = Number(data['Actual cash amount'] || 0);
    } else if (data?.shifts?.[0]) {
      // API format
      const shiftInfo = data.shifts[0];
      expected = Number(shiftInfo.expected_cash || 0);
      actual = Number(shiftInfo.actual_cash || 0);
    }

    const difference = actual - expected;
    const status = Math.abs(difference) <= 50 ? "Balanced" : "Mismatch";

    return {
      source: "POS",
      date: s.shiftDate,
      expected,
      actual,
      difference,
      status,
    };
  });

  // Form balances from dailyStockSales
  const forms = await db
    .select()
    .from(dailyStockSales)
    .orderBy(desc(dailyStockSales.createdAt))
    .limit(limit);

  const formBalances = forms.map((f) => {
    const startingCash = Number(f.startingCash || 0);
    const cashSales = Number(f.cashSales || 0);
    const endingCash = Number(f.endingCash || 0);

    // For forms, we compare starting + cash sales vs ending cash
    const expected = startingCash + cashSales;
    const actual = endingCash;
    const difference = actual - expected;
    const status = Math.abs(difference) <= 50 ? "Balanced" : "Mismatch";

    return {
      source: "Form",
      date: f.shiftDate?.toISOString().split('T')[0] || 'Unknown',
      expected,
      actual,
      difference,
      status,
    };
  });

  return { posBalances, formBalances };
}