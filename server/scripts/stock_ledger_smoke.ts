import { PrismaClient } from '@prisma/client';
import { computeAndUpsertRollsLedger } from '../services/rollsLedger.js';
import { computeAndUpsertMeatLedger } from '../services/meatLedger.js';
import { computeAndUpsertDrinksLedger } from '../services/drinksLedger.js';

const db = new PrismaClient();

async function seedIfPossible(shiftDate: string) {
  try {
    await db.$executeRaw`
      INSERT INTO expenses (date, category, item, amount, source, meta, "createdAt")
      VALUES (${shiftDate}::date, 'Stock', ${`roll smoke ${Date.now()}`}, 1, 'STOCK_LODGMENT', '{"quantity":10}'::jsonb, NOW())
    `;
  } catch (e) {
    console.warn('[SMOKE] could not seed expenses', e);
  }

  try {
    await db.$executeRaw`
      INSERT INTO purchase_tally (date, meat_grams)
      VALUES (${shiftDate}::date, 1000)
    `;
  } catch (e) {
    console.warn('[SMOKE] could not seed purchase_tally', e);
  }

  try {
    await db.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, qty)
      VALUES (${shiftDate}::date, 'drinks', 5)
    `;
  } catch (e) {
    console.warn('[SMOKE] could not seed stock_received_log', e);
  }

  try {
    await db.$executeRaw`
      INSERT INTO daily_sales_v2 ("shiftDate", payload, "createdAt", "updatedAt")
      VALUES (${shiftDate}, '{"rollsEnd":2,"meatEnd":300,"drinksEnd":1,"drinkStock":{"coke":1,"soda":0}}'::jsonb, NOW(), NOW())
    `;
  } catch (e) {
    console.warn('[SMOKE] could not seed daily_sales_v2', e);
  }
}

async function run() {
  const shiftDate = process.env.SMOKE_SHIFT_DATE || new Date().toISOString().slice(0, 10);
  try {
    await seedIfPossible(shiftDate);

    const rolls = await computeAndUpsertRollsLedger(shiftDate);
    const meat = await computeAndUpsertMeatLedger(shiftDate);
    const drinks = await computeAndUpsertDrinksLedger(shiftDate);

    console.log('[SMOKE] deterministic outputs', {
      shiftDate,
      rolls: { estimated: rolls.estimated, actual: rolls.actual_end, variance: rolls.variance },
      meat: { estimated: meat.estimated_g, actual: meat.actual_end_g, variance: meat.variance_g },
      drinks: { estimated: drinks.estimatedDrinksEnd, actual: drinks.actualDrinksEnd, variance: drinks.variance },
    });
  } catch (error) {
    console.error('[SMOKE] stock ledger smoke failed gracefully', error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

run();
