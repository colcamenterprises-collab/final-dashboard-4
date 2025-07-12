import { db } from "../db";
import { loyverseReceipts, dailyShiftSummary, dailyStockSales, expenses } from "@shared/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { BURGER_DEFS } from "../constants/burgerDefinitions";

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

function getShiftRange(shiftDate: Date) {
  // shiftDate assumed to be the date at 5pm start BKK
  const start = new Date(shiftDate);
  start.setHours(10, 0, 0, 0); // 10:00 UTC == 17:00 BKK (5 PM)
  const end = new Date(start.getTime() + 10 * 60 * 60 * 1000); // +10h (5pm-3am)
  return { startUTC: start, endUTC: end };
}

export async function generateShiftSummary(shiftDate: Date) {
  console.log(`Generating shift summary for ${shiftDate.toISOString().split('T')[0]}`);
  
  const { startUTC, endUTC } = getShiftRange(shiftDate);
  const shiftDateStr = shiftDate.toISOString().split('T')[0];

  try {
    // 1. Fetch receipts for the shift
    const receipts = await db.select().from(loyverseReceipts)
      .where(and(
        gte(loyverseReceipts.receiptDate, startUTC),
        lte(loyverseReceipts.receiptDate, endUTC)
      ));

    console.log(`Found ${receipts.length} receipts for shift`);

    // 2. Burger matching and patty counting
    const burgerItems = receipts.flatMap(r => (r.items as any[]) ?? [])
      .filter(item => {
        const itemName = item.item_name?.toLowerCase() || '';
        const itemSku = item.sku || '';
        return BURGER_DEFS.some(def => 
          itemName.includes(def.handle.toLowerCase()) || itemSku === def.sku
        );
      });

    const burgersCount = burgerItems.length;

    const patties = burgerItems.reduce((sum, item) => {
      const itemName = item.item_name?.toLowerCase() || '';
      const itemSku = item.sku || '';
      const def = BURGER_DEFS.find(d => 
        itemName.includes(d.handle.toLowerCase()) || itemSku === d.sku
      );
      return sum + (def?.meatQty ?? 0);
    }, 0);

    console.log(`Burgers sold: ${burgersCount}, Patties used: ${patties}`);

    // 3. Get rolls starting count from stock form
    const stockForm = await db.select().from(dailyStockSales)
      .where(eq(dailyStockSales.shiftDate, shiftDate))
      .limit(1);
    
    const rollsStart = stockForm.length > 0 ? (stockForm[0].burgerBunsStock ?? 0) : 0;

    // 4. Get rolls purchased from expenses
    const rollExpenses = await db.select().from(expenses)
      .where(and(
        gte(expenses.date, startUTC),
        lte(expenses.date, endUTC),
        eq(expenses.category, 'Rolls Purchased')
      ));

    const rollsPurchased = rollExpenses.reduce((sum, expense) => 
      sum + Number(expense.quantity || 0), 0
    );

    // 5. Get rolls ending count from stock form
    const rollsEnd = stockForm.length > 0 ? (stockForm[0].burgerBunsStock ?? 0) : 0;

    // 6. Calculate expected and variance
    const expected = rollsStart + rollsPurchased - burgersCount;
    const variance = rollsEnd - expected;
    const flag = Math.abs(variance) > 5;

    console.log(`Rolls: Start=${rollsStart}, Purchased=${rollsPurchased}, Expected=${expected}, Actual=${rollsEnd}, Variance=${variance}`);

    // 7. Upsert summary record
    await db
      .insert(dailyShiftSummary)
      .values({
        shiftDate: shiftDateStr,
        burgersSold: burgersCount,
        pattiesUsed: patties,
        rollsStart,
        rollsPurchased,
        rollsExpected: expected,
        rollsActual: rollsEnd,
        rollsVariance: variance,
        varianceFlag: flag
      })
      .onConflictDoUpdate({
        target: dailyShiftSummary.shiftDate,
        set: {
          burgersSold: burgersCount,
          pattiesUsed: patties,
          rollsStart,
          rollsPurchased,
          rollsExpected: expected,
          rollsActual: rollsEnd,
          rollsVariance: variance,
          varianceFlag: flag
        }
      });

    console.log(`✅ Shift summary generated successfully for ${shiftDateStr}`);
    return { success: true, message: `Shift summary generated for ${shiftDateStr}` };

  } catch (error) {
    console.error('Error generating shift summary:', error);
    return { success: false, message: `Error generating shift summary: ${error}` };
  }
}

export async function getLatestShiftSummary() {
  try {
    const latest = await db.select().from(dailyShiftSummary)
      .orderBy(dailyShiftSummary.shiftDate)
      .limit(1);
    
    return latest[0] || null;
  } catch (error) {
    console.error('Error fetching latest shift summary:', error);
    return null;
  }
}

export async function getAllShiftSummaries() {
  try {
    const summaries = await db.select().from(dailyShiftSummary)
      .orderBy(dailyShiftSummary.shiftDate);
    
    return summaries;
  } catch (error) {
    console.error('Error fetching all shift summaries:', error);
    return [];
  }
}