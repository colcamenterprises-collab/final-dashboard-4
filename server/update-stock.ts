import { db } from './db.ts';
import { dailyStockSales, loyverseReceipts, recipes, recipeIngredients, inventory } from '../shared/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import winston from 'winston';

const logger = winston.createLogger({ 
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/stock-monitor.log' })
  ]
});

async function monitorStock() {
  const today = DateTime.now().setZone('Asia/Bangkok').toJSDate();
  
  // Step 1: Get most recent shift form for ending stock
  const lastForm = await db.select().from(dailyStockSales).orderBy(desc(dailyStockSales.createdAt)).limit(1);
  if (!lastForm.length) {
    logger.warn('No shift form found - using defaults');
    return { success: false, message: 'No shift form found' };
  }
  const last = lastForm[0];
  const lastRolls = parseFloat(last.burgerBunsStock) || 0;
  const lastMeat = parseFloat(last.meatWeight) || 0;
  const lastDrinks = parseFloat(last.drinkStockCount) || 0;

  // Step 2: Update with today's purchases (hardcoded for now - extend to expenses table query)
  const purchaseRolls = 40; // From user
  const purchaseMeat = 0; // Assume 0 - query stock_purchase_meat if purchases today
  const purchaseDrinks = 0; // Assume 0

  // Step 3: Calc today's usage from receipts
  const receipts = await db.select().from(loyverseReceipts).where(eq(loyverseReceipts.shiftDate, today));
  let usedRolls = 0;
  let usedMeat = 0;
  let usedDrinks = 0;
  for (const receipt of receipts) {
    for (const item of receipt.items || []) {
      if (item.item_name.includes('Burger')) {
        const recipe = await db.select().from(recipes).where(eq(recipes.name, item.item_name)).limit(1);
        if (recipe.length) {
          const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe[0].id));
          for (const ing of ings) {
            if (ing.ingredientId === 'buns') usedRolls += (ing.quantity * item.quantity);
            if (ing.ingredientId === 'meat') usedMeat += (ing.quantity * item.quantity);
          }
        }
      }
      if (item.item_name.includes('Drink')) usedDrinks += item.quantity;
    }
  }

  // Step 4: Current stock = last end + purchase - today's usage
  const currentRolls = lastRolls + purchaseRolls - usedRolls;
  const currentMeat = lastMeat + purchaseMeat - usedMeat;
  const currentDrinks = lastDrinks + purchaseDrinks - usedDrinks;

  // Step 5: Update inventory table (create entries if they don't exist)
  try {
    const inventoryItems = [
      { name: 'Burger Rolls', quantity: currentRolls.toString(), category: 'Ingredient', unit: 'pieces' },
      { name: 'Meat', quantity: currentMeat.toString(), category: 'Ingredient', unit: 'kg' },
      { name: 'Drinks', quantity: currentDrinks.toString(), category: 'Beverage', unit: 'bottles' }
    ];

    for (const item of inventoryItems) {
      const existing = await db.select().from(inventory).where(eq(inventory.name, item.name)).limit(1);
      if (existing.length) {
        await db.update(inventory).set({ quantity: item.quantity }).where(eq(inventory.name, item.name));
      } else {
        await db.insert(inventory).values({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          minStock: '10',
          supplier: 'Default Supplier',
          pricePerUnit: '0.00'
        });
      }
    }
  } catch (error) {
    logger.error('Error updating inventory:', error);
  }

  // Step 6: Flags & suggestions
  const flags = [];
  const orders = [];
  if (usedRolls > lastRolls * 1.1) flags.push(`Security: Rolls used ${usedRolls} > last stock ${lastRolls}`);
  if (currentRolls < 50) orders.push(`Order rolls: 40 more (current ${currentRolls})`);
  if (usedMeat > lastMeat * 1.1) flags.push(`Security: Meat used ${usedMeat} > last stock ${lastMeat}`);
  if (currentMeat < 10) orders.push(`Order meat: 20kg more (current ${currentMeat})`);
  if (usedDrinks > lastDrinks * 1.1) flags.push(`Security: Drinks used ${usedDrinks} > last stock ${lastDrinks}`);
  if (currentDrinks < 50) orders.push(`Order drinks: 100 more (current ${currentDrinks})`);

  // Output tables
  console.table({ CurrentStock: { Rolls: currentRolls, Meat: currentMeat, Drinks: currentDrinks } });
  console.table({ Flags: flags });
  console.table({ OrderSuggestions: orders });
  logger.info(`Monitored stock: Rolls ${currentRolls}, Meat ${currentMeat}, Drinks ${currentDrinks}`);

  return { current: { rolls: currentRolls, meat: currentMeat, drinks: currentDrinks }, flags, orders };
}

monitorStock();