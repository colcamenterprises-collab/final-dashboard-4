import { db } from './db.ts';
import { loyverseShiftReports, dailyStockSales, loyverseReceipts, recipes, recipeIngredients } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import winston from 'winston';

const logger = winston.createLogger({ 
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/db-validate.log' })
  ]
});

async function validateLiveShift(shiftDate) {
  const bkkDate = DateTime.fromISO(shiftDate, { zone: 'Asia/Bangkok' });
  const utcDate = bkkDate.toUTC().toJSDate();

  // Fetch live data
  const shiftReport = await db.select().from(loyverseShiftReports).where(eq(loyverseShiftReports.shiftDate, utcDate)).limit(1);
  const staffForm = await db.select().from(dailyStockSales).where(eq(dailyStockSales.shiftDate, utcDate)).limit(1);
  const receipts = await db.select().from(loyverseReceipts).where(eq(loyverseReceipts.shiftDate, utcDate));

  if (!shiftReport.length || !staffForm.length) {
    logger.warn(`Missing live data for ${shiftDate}`);
    return { success: false, message: 'Missing report or form - sync Loyverse/pull receipts' };
  }

  const report = shiftReport[0];
  const form = staffForm[0];
  const posSales = parseFloat(report.totalSales);
  const staffSales = parseFloat(form.totalSales);
  const salesDiff = Math.abs(posSales - staffSales);
  const salesVariance = (salesDiff / posSales) * 100;

  const posCash = parseFloat(report.cashSales);
  const staffCash = parseFloat(form.cashSales);
  const cashDiff = Math.abs(posCash - staffCash);

  const posExpenses = parseFloat(report.discounts) + parseFloat(report.taxes); // Approx in/out (adjust if more fields)
  const staffExpenses = parseFloat(form.totalExpenses);
  const expenseDiff = Math.abs(posExpenses - staffExpenses);

  const warnings = [];
  if (salesVariance > 5 || salesDiff > 50) warnings.push(`Sales imbalance: POS ฿${posSales} vs Staff ฿${staffSales} (${salesVariance.toFixed(1)}%)`);
  if (cashDiff > 50) warnings.push(`Cash imbalance: POS ฿${posCash} vs Staff ฿${staffCash} (diff ฿${cashDiff})`);
  if (expenseDiff > 50) warnings.push(`Expenses imbalance: POS ฿${posExpenses} vs Staff ฿${staffExpenses} (diff ฿${expenseDiff})`);

  // Receipts: Items/modifiers → usage
  const usage = {};
  for (const receipt of receipts) {
    for (const line of receipt.items || []) {
      const recipe = await db.select().from(recipes).where(eq(recipes.name, line.item_name)).limit(1);
      if (recipe.length) {
        const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe[0].id));
        for (const ing of ings) {
          const key = ing.ingredientId; // Or name
          usage[key] = { used: (usage[key]?.used || 0) + (ing.quantity * line.quantity), unit: ing.unit };
        }
      }
      // Modifiers: Assume modifiers in receipt.rawData or add field—e.g., extra patties → +patties usage
      for (const mod of line.modifiers || []) {
        if (mod.name === 'Extra Patty') usage['patties'] = { used: (usage['patties']?.used || 0) + line.quantity, unit: 'unit' };
        // Expand for other modifiers
      }
      // Packaging: Add fixed per item (e.g., burger → +1 bag/box)
      if (line.item_name.includes('Burger')) usage['packaging'] = { used: (usage['packaging']?.used || 0) + line.quantity, unit: 'unit' };
    }
  }

  // Security/Ordering: Flag variance, suggest orders
  const securityFlags = [];
  const orderSuggestions = [];
  for (const [ing, data] of Object.entries(usage)) {
    const staffStock = form[`${ing.toLowerCase()}Stock`] || 0; // Adjust keys to match form (e.g., burgerBunsStock)
    const variance = data.used - staffStock;
    if (variance > staffStock * 0.1) securityFlags.push(`Security flag: ${ing} used ${data.used} > stock ${staffStock} (variance ${variance}) - potential theft/waste`);
    if (staffStock - data.used < staffStock * 0.2) orderSuggestions.push(`Order ${ing}: ${data.used + staffStock * 0.5} ${data.unit} (low stock)`);
  }

  // Output tables
  console.table({ warnings });
  console.table({ securityFlags });
  console.table({ orderSuggestions });
  console.table(usage);
  logger.info(`Validated ${shiftDate}: ${warnings.length} warnings, ${securityFlags.length} flags, ${orderSuggestions.length} orders`);

  return { success: true, warnings, securityFlags, orderSuggestions, usage };
}

// CLI
const args = process.argv.reduce((acc, arg) => { 
  if (arg.includes('=')) { 
    const [k, v] = arg.split('='); 
    acc[k.replace('--', '')] = v; 
  } 
  return acc; 
}, {});

if (args.shiftDate) {
  validateLiveShift(args.shiftDate);
} else {
  logger.error('Run: node validate-live-db.js --shiftDate=2025-07-16');
}