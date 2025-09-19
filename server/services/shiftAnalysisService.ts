import { db } from "../db";
import { dailySalesV2, expenses, dailyShiftAnalysis, dailyStockSales } from "../../shared/schema";
import { getShiftReport, getLoyverseReceipts } from "../utils/loyverse";
import { eq } from "drizzle-orm";
import { BURGER_DEFS } from "../constants/burgerDefinitions";

// Convert cents to THB for currency consistency
const THB = (cents?: number | null) => Number(cents ?? 0) / 100;

// Drink definitions for pattern matching
const DRINK_PATTERNS = [
  { name: 'Coca Cola', patterns: ['coca cola', 'coke', 'cola'], portion: 1 },
  { name: 'Pepsi', patterns: ['pepsi'], portion: 1 },
  { name: 'Sprite', patterns: ['sprite'], portion: 1 },
  { name: 'Fanta', patterns: ['fanta'], portion: 1 },
  { name: 'Water', patterns: ['water', 'bottle water'], portion: 1 },
  { name: 'Juice', patterns: ['juice', 'orange juice', 'apple juice'], portion: 1 },
  { name: 'Thai Tea', patterns: ['thai tea', 'cha yen'], portion: 1 },
  { name: 'Coffee', patterns: ['coffee', 'americano', 'latte'], portion: 1 },
];

// Standard meat portion per patty in grams
const MEAT_PER_PATTY_GRAMS = 95;

function matchDrinkType(itemName: string): string | null {
  const lowerName = itemName.toLowerCase();
  for (const drink of DRINK_PATTERNS) {
    if (drink.patterns.some(pattern => lowerName.includes(pattern))) {
      return drink.name;
    }
  }
  return null;
}

function matchBurgerType(itemName: string): { name: string; patties: number; buns: number } | null {
  const lowerName = itemName.toLowerCase();
  for (const def of BURGER_DEFS) {
    if (lowerName.includes(def.handle.toLowerCase())) {
      return {
        name: def.handle,
        patties: def.meatQty,
        buns: 1 // All burgers use 1 bun
      };
    }
  }
  return null;
}

export async function generateShiftAnalysis(date: string) {
  // Pull staff form
  const form = await db.query.dailySalesV2.findFirst({
    where: eq(dailySalesV2.shift_date, date),
  });

  // Pull daily stock form for actual counts
  // Convert date string to Date object for comparison
  const dateObj = new Date(date + 'T00:00:00.000Z');
  let stockForm = null;
  try {
    stockForm = await db.select().from(dailyStockSales)
      .where(eq(dailyStockSales.shiftDate, dateObj))
      .limit(1)
      .then(results => results[0] || null);
  } catch (e) {
    console.warn('Stock form unavailable - daily_stock_sales table does not exist:', e);
  }

  // Pull Loyverse shift report (POS ground truth)
  const shiftResult = await getShiftReport({ date: date });
  const shift = shiftResult?.shifts?.[0];

  // Pull receipts for stock usage
  const receiptsResult = await getLoyverseReceipts({ date: date });
  const receipts = receiptsResult?.receipts || [];

  console.log(`Analyzing ${receipts.length} receipts for date ${date}`);

  // Extract all sold items from receipts
  const soldItems = receipts.flatMap(receipt => 
    (receipt.line_items || []).map((item: any) => ({
      name: item.item_name || '',
      quantity: item.quantity || 1,
      category: item.category || 'OTHER'
    }))
  );

  console.log(`Found ${soldItems.length} total items sold`);

  // --- Build comparison ---
  const salesVsPOS = [
    { field: "Gross Sales", form: THB(form?.totalSales), pos: shift?.gross_sales },
    { field: "Net Sales", form: THB(form?.totalSales), pos: shift?.net_sales },
    { field: "Cash Payments", form: THB(form?.cashSales), pos: shift?.cash_sales },
    { field: "QR Sales", form: THB(form?.qrSales), pos: shift?.qr_sales },
    { field: "Grab Sales", form: THB(form?.grabSales), pos: shift?.grab_sales },
    { field: "Discounts", form: 0, pos: shift?.discounts },
    { field: "Refunds", form: 0, pos: shift?.refunds },
    { field: "Paid Out", form: 0, pos: shift?.paid_out },
  ].map(r => ({
    ...r,
    status: r.form === r.pos ? "✅" : `🚨 Δ ${Number(r.form||0) - Number(r.pos||0)}`
  }));

  // --- DETAILED DRINKS ANALYSIS ---
  const drinkSales = new Map<string, number>();
  soldItems.forEach(item => {
    const drinkType = matchDrinkType(item.name);
    if (drinkType) {
      drinkSales.set(drinkType, (drinkSales.get(drinkType) || 0) + item.quantity);
    }
  });

  // Get actual drink counts from form
  const formDrinkStock = (stockForm?.drinkStock as any[]) || [];
  const actualDrinkCounts = new Map<string, number>();
  formDrinkStock.forEach((drink: any) => {
    if (drink.name) {
      actualDrinkCounts.set(drink.name, Number(drink.quantity || drink.qty || 0));
    }
  });

  const drinksAnalysis = Array.from(drinkSales.entries()).map(([drinkName, qtySold]) => {
    const actualCount = actualDrinkCounts.get(drinkName) || 0;
    // Expected usage would be starting stock - drinks sold, but we don't have starting stock
    // So we'll use actual count + sold as the expected and compare with actual
    const expectedUsage = qtySold; // Simplified: expect to use exactly what was sold
    const variance = actualCount - expectedUsage;
    const tolerance = Math.max(2, Math.ceil(qtySold * 0.1)); // 10% tolerance or minimum 2

    return {
      itemName: drinkName,
      qtySold,
      expectedUsage,
      actualCount,
      variance,
      tolerance,
      status: Math.abs(variance) > tolerance ? "🚨" : "✅"
    };
  });

  // --- DETAILED ROLLS/BUNS ANALYSIS ---
  const burgerSales = new Map<string, { count: number; bunsNeeded: number }>();
  soldItems.forEach(item => {
    const burgerType = matchBurgerType(item.name);
    if (burgerType) {
      const current = burgerSales.get(burgerType.name) || { count: 0, bunsNeeded: 0 };
      burgerSales.set(burgerType.name, {
        count: current.count + item.quantity,
        bunsNeeded: current.bunsNeeded + (item.quantity * burgerType.buns)
      });
    }
  });

  const actualBunCount = stockForm?.burgerBunsStock || 0;
  const totalBunsNeeded = Array.from(burgerSales.values()).reduce((sum, burger) => sum + burger.bunsNeeded, 0);
  
  const rollsAnalysis = Array.from(burgerSales.entries()).map(([burgerName, data]) => {
    const expectedUsage = data.bunsNeeded;
    // For individual burger types, we estimate the proportion of total buns used
    const proportionOfTotal = totalBunsNeeded > 0 ? data.bunsNeeded / totalBunsNeeded : 0;
    const estimatedActualUsed = Math.round(actualBunCount * proportionOfTotal);
    const variance = estimatedActualUsed - expectedUsage;
    const tolerance = Math.max(1, Math.ceil(expectedUsage * 0.15)); // 15% tolerance

    return {
      itemName: `${burgerName} (${data.count} sold)`,
      qtySold: data.count,
      expectedUsage,
      actualCount: estimatedActualUsed,
      variance,
      tolerance,
      status: Math.abs(variance) > tolerance ? "🚨" : "✅"
    };
  });

  // Add total rolls summary
  rollsAnalysis.push({
    itemName: "Total Buns Used",
    qtySold: Array.from(burgerSales.values()).reduce((sum, burger) => sum + burger.count, 0),
    expectedUsage: totalBunsNeeded,
    actualCount: actualBunCount,
    variance: actualBunCount - totalBunsNeeded,
    tolerance: Math.max(3, Math.ceil(totalBunsNeeded * 0.1)),
    status: Math.abs(actualBunCount - totalBunsNeeded) > Math.max(3, Math.ceil(totalBunsNeeded * 0.1)) ? "🚨" : "✅"
  });

  // --- DETAILED MEAT ANALYSIS ---
  const meatUsage = new Map<string, { count: number; meatGrams: number }>();
  soldItems.forEach(item => {
    const burgerType = matchBurgerType(item.name);
    if (burgerType && burgerType.patties > 0) { // Only beef burgers
      const current = meatUsage.get(burgerType.name) || { count: 0, meatGrams: 0 };
      meatUsage.set(burgerType.name, {
        count: current.count + item.quantity,
        meatGrams: current.meatGrams + (item.quantity * burgerType.patties * MEAT_PER_PATTY_GRAMS)
      });
    }
  });

  const actualMeatWeight = Number(stockForm?.meatWeight || 0) * 1000; // Convert kg to grams
  const totalMeatNeeded = Array.from(meatUsage.values()).reduce((sum, burger) => sum + burger.meatGrams, 0);

  const meatAnalysis = Array.from(meatUsage.entries()).map(([burgerName, data]) => {
    const expectedUsage = data.meatGrams;
    // For individual burger types, estimate proportion of total meat used
    const proportionOfTotal = totalMeatNeeded > 0 ? data.meatGrams / totalMeatNeeded : 0;
    const estimatedActualUsed = Math.round(actualMeatWeight * proportionOfTotal);
    const variance = estimatedActualUsed - expectedUsage;
    const tolerance = Math.max(50, Math.ceil(expectedUsage * 0.15)); // 15% tolerance, minimum 50g

    return {
      itemName: `${burgerName} (${data.count} sold)`,
      qtySold: data.count,
      expectedUsage,
      actualCount: estimatedActualUsed,
      variance,
      tolerance,
      status: Math.abs(variance) > tolerance ? "🚨" : "✅"
    };
  });

  // Add total meat summary
  meatAnalysis.push({
    itemName: "Total Meat Used (grams)",
    qtySold: Array.from(meatUsage.values()).reduce((sum, burger) => sum + burger.count, 0),
    expectedUsage: totalMeatNeeded,
    actualCount: actualMeatWeight,
    variance: actualMeatWeight - totalMeatNeeded,
    tolerance: Math.max(200, Math.ceil(totalMeatNeeded * 0.1)),
    status: Math.abs(actualMeatWeight - totalMeatNeeded) > Math.max(200, Math.ceil(totalMeatNeeded * 0.1)) ? "🚨" : "✅"
  });

  // --- Legacy Stock usage checks for backward compatibility ---
  const stockUsage = [
    { item: "Rolls", expected: totalBunsNeeded, actual: actualBunCount, variance: actualBunCount - totalBunsNeeded, tolerance: 4 },
    { item: "Meat (g)", expected: totalMeatNeeded, actual: actualMeatWeight, variance: actualMeatWeight - totalMeatNeeded, tolerance: 500 },
    { item: "Drinks", expected: Array.from(drinkSales.values()).reduce((sum, qty) => sum + qty, 0), actual: Array.from(actualDrinkCounts.values()).reduce((sum, qty) => sum + qty, 0), variance: 0, tolerance: 2 },
  ].map(s => ({
    ...s,
    status: Math.abs(s.variance) > s.tolerance ? "🚨" : "✅"
  }));

  // --- Flags summary ---
  const flags = [
    ...salesVsPOS.filter(f => f.status.includes("🚨")).map(f => `${f.field} mismatch ${f.status}`),
    ...stockUsage.filter(s => s.status === "🚨").map(s => `${s.item} variance ${s.variance}`),
    ...drinksAnalysis.filter(d => d.status === "🚨").map(d => `${d.itemName} drink variance ${d.variance}`),
    ...rollsAnalysis.filter(r => r.status === "🚨").map(r => `${r.itemName} bun variance ${r.variance}`),
    ...meatAnalysis.filter(m => m.status === "🚨").map(m => `${m.itemName} meat variance ${m.variance}g`)
  ];

  const analysis = { 
    salesVsPOS, 
    stockUsage, 
    drinksAnalysis,
    rollsAnalysis,
    meatAnalysis,
    flags 
  };

  console.log(`Analysis complete: ${drinksAnalysis.length} drink items, ${rollsAnalysis.length} roll items, ${meatAnalysis.length} meat items`);

  // Save to DB
  await db.insert(dailyShiftAnalysis)
    .values({ shiftDate: date, analysis })
    .onConflictDoUpdate({ 
      target: dailyShiftAnalysis.shiftDate, 
      set: { analysis } 
    });

  return analysis;
}