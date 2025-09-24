// server/services/analytics/runProcessDaily.js
import { PrismaClient } from '@prisma/client';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { format } from 'date-fns';

const prisma = new PrismaClient();

const TZ = process.env.TZ || 'Asia/Bangkok';
// Tuning knobs
const SHIFT_START_HOUR_LOCAL = 18; // 18:00 -> 03:00
const MEAT_PER_PATTY_GRAMS = 90;
const BUNS_VARIANCE = 5;
const MEAT_VARIANCE = 500;
const DRINKS_VARIANCE = 5;

// Convert a UTC date into the shift anchor (18:00 local)
function shiftAnchorUTC(utcDate) {
  const local = utcToZonedTime(utcDate, TZ);
  const localShift = new Date(local);
  // if before 03:00 local, use previous day
  if (localShift.getHours() < 3) localShift.setDate(localShift.getDate() - 1);
  localShift.setHours(SHIFT_START_HOUR_LOCAL, 0, 0, 0);
  return zonedTimeToUtc(localShift, TZ);
}

async function processRestaurant(restaurantId) {
  // Pull last 48h of receipts and group by shiftDate
  const since = new Date(Date.now() - 48 * 3600_000);
  const receipts = await prisma.receipt.findMany({
    where: { restaurantId, createdAtUTC: { gte: since } },
    include: { items: true, payments: true }
  });

  const byShift = new Map(); // key: ISO shiftDateUTC -> array of receipts
  for (const r of receipts) {
    const key = shiftAnchorUTC(r.createdAtUTC).toISOString();
    if (!byShift.has(key)) byShift.set(key, []);
    byShift.get(key).push(r);
  }

  for (const [key, recs] of byShift) {
    const shiftDate = new Date(key);

    // Payments + totals
    let total = 0, cash = 0, card = 0, qr = 0, delivery = 0, other = 0;
    for (const r of recs) {
      total += r.total || 0;
      for (const p of r.payments) {
        const m = p.method;
        if (m === 'CASH') cash += p.amount;
        else if (m === 'CARD') card += p.amount;
        else if (m === 'QR') qr += p.amount;
        else if (m === 'DELIVERY_PARTNER') delivery += p.amount;
        else other += p.amount;
      }
    }

    // Upsert DailySales
    await prisma.dailySales.upsert({
      where: { restaurantId_shiftDate: { restaurantId, shiftDate } },
      create: {
        restaurantId, shiftDate,
        totalSales: total, cash, card, qr, delivery, other,
        receiptsCount: recs.length
      },
      update: {
        totalSales: total, cash, card, qr, delivery, other,
        receiptsCount: recs.length
      }
    });

    // Ingredient expectations
    let burgersSold = 0;
    let patties = 0;
    let drinksSold = 0;

    for (const r of recs) {
      for (const i of r.items) {
        const name = (i.name || '').toLowerCase();
        const sku = (i.sku || '').toUpperCase();
        const mods = JSON.stringify(i.modifiers || '').toLowerCase();

        const isBurger = sku.includes('BURGER') || name.includes('burger');
        const isDrink = sku.includes('DRINK') || /coke|sprite|fanta|soda|water|pepsi/i.test(name);

        if (isBurger) {
          burgersSold += i.qty;
          const pattiesPer = (sku.includes('DOUBLE') || name.includes('double') || mods.includes('double')) ? 2 : 1;
          patties += i.qty * pattiesPer;
        }
        if (isDrink) drinksSold += i.qty;
      }
    }

    const expectedBunsUsed = burgersSold;
    const expectedMeatGrams = patties * MEAT_PER_PATTY_GRAMS;
    const expectedDrinksUsed = drinksSold;

    // Variance vs daily_stock (if present)
    const stock = await prisma.dailyStock.findUnique({
      where: { restaurantId_shiftDate: { restaurantId, shiftDate } }
    });

    let variance = null;
    let flags = [];
    if (stock) {
      variance = {
        buns: (expectedBunsUsed - (stock.bunsCount ?? 0)),
        meatGrams: (expectedMeatGrams - (stock.meatWeightGrams ?? 0)),
        drinks: (expectedDrinksUsed - (stock.drinksCount ?? 0))
      };
      if (Math.abs(variance.buns) > BUNS_VARIANCE) flags.push(`Buns variance ${variance.buns}`);
      if (Math.abs(variance.meatGrams) > MEAT_VARIANCE) flags.push(`Meat variance ${variance.meatGrams}g`);
      if (Math.abs(variance.drinks) > DRINKS_VARIANCE) flags.push(`Drinks variance ${variance.drinks}`);
    }

    // Top 5s
    const totalsBySku = {};
    const revenueBySku = {};
    for (const r of recs) {
      for (const i of r.items) {
        const k = i.sku || i.name;
        totalsBySku[k] = (totalsBySku[k] || 0) + i.qty;
        revenueBySku[k] = (revenueBySku[k] || 0) + i.total;
      }
    }
    const top5ByQty = Object.entries(totalsBySku)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => ({ skuOrName: k, qty: v }));
    const top5ByRevenue = Object.entries(revenueBySku)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => ({ skuOrName: k, revenue: v }));

    await prisma.analyticsDaily.upsert({
      where: { restaurantId_shiftDate: { restaurantId, shiftDate } },
      create: {
        restaurantId, shiftDate,
        expectedBunsUsed, expectedMeatGrams, expectedDrinksUsed,
        variance, flags,
        top5ByQty, top5ByRevenue
      },
      update: {
        expectedBunsUsed, expectedMeatGrams, expectedDrinksUsed,
        variance, flags,
        top5ByQty, top5ByRevenue
      }
    });

    console.log(
      `[analytics] ${restaurantId} ${format(shiftDate, 'yyyy-MM-dd')} total ฿${(total/100).toFixed(2)} receipts ${recs.length}`
    );
  }
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  for (const r of restaurants) {
    await processRestaurant(r.id);
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });