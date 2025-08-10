import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MEAT_PER_PATTY_GRAM = 90;
const BUNS_PER_BURGER = 1;

function bkkWindowToUTC(dateStrYYYYMMDD) {
  const [y, m, d] = dateStrYYYYMMDD.split('-').map(Number);
  const startUTC = new Date(Date.UTC(y, m - 1, d, 11, 0, 0)); // 18:00 BKK
  const endUTC   = new Date(Date.UTC(y, m - 1, d, 20, 0, 0)); // 03:00 BKK
  return { startUTC, endUTC };
}
function toTHB(satang) {
  const n = typeof satang === 'bigint' ? Number(satang) : Number(satang || 0);
  return (n / 100).toFixed(2);
}
function isBurgerLike(name) {
  const s = (name || '').toLowerCase();
  return s.includes('burger') || s.includes('smash') || s.includes('double');
}
async function mapPaymentChannel(name) {
  try {
    const row = await prisma.paymentMethodMap.findUnique({
      where: { provider_sourceName: { provider: 'LOYVERSE', sourceName: name } }
    });
    if (row) return row.channel;
  } catch {}
  const n = (name || '').toLowerCase();
  if (n.includes('cash')) return 'CASH';
  if (n.includes('qr')) return 'QR';
  if (n.includes('grab')) return 'GRAB';
  if (n.includes('card') || n.includes('visa') || n.includes('master')) return 'CARD';
  return 'OTHER';
}

async function runForDate(dateStr, opts = {}) {
  const { startUTC, endUTC } = bkkWindowToUTC(dateStr);

  const snapshot = await prisma.shiftSnapshot.create({
    data: {
      windowStartUTC: startUTC,
      windowEndUTC: endUTC,
      salesFormId: opts.salesFormId ?? null,
      loyverseShiftNumber: opts.loyverseShiftNumber ?? null,
      reconcileState: 'MISSING_DATA'
    }
  });

  const receipts = await prisma.$queryRaw`
    SELECT id, "receiptNumber", "createdAtUTC", "total"
    FROM receipts
    WHERE provider='LOYVERSE'
      AND "createdAtUTC" BETWEEN ${startUTC} AND ${endUTC}
    ORDER BY "createdAtUTC" ASC
  `;
  const totalSalesSatang = receipts.reduce((a, r) => a + Number(r.total), 0);
  await prisma.shiftSnapshot.update({
    where: { id: snapshot.id },
    data: {
      totalReceipts: receipts.length,
      totalSalesSatang: BigInt(totalSalesSatang)
    }
  });

  const payments = await prisma.$queryRaw`
    SELECT rp.method::text as method,
           COUNT(*)::int as count,
           COALESCE(SUM(rp.amount),0)::bigint as total_satang
    FROM receipt_payments rp
    JOIN receipts r ON r.id = rp."receiptId"
    WHERE r.provider='LOYVERSE'
      AND r."createdAtUTC" BETWEEN ${startUTC} AND ${endUTC}
    GROUP BY rp.method
    ORDER BY rp.method
  `;
  for (const p of payments) {
    const channel = await mapPaymentChannel(p.method);
    await prisma.paymentBreakdown.upsert({
      where: { snapshotId_channel: { snapshotId: snapshot.id, channel } },
      create: { snapshotId: snapshot.id, channel, count: p.count, totalSatang: BigInt(p.total_satang) },
      update: { count: p.count, totalSatang: BigInt(p.total_satang) }
    });
  }

  const items = await prisma.$queryRaw`
    SELECT ri.name, ri.sku, ri.category,
           SUM(ri.qty)::int as qty,
           COALESCE(SUM(ri.total),0)::bigint as revenue_satang
    FROM receipt_items ri
    JOIN receipts r ON r.id = ri."receiptId"
    WHERE r.provider='LOYVERSE'
      AND r."createdAtUTC" BETWEEN ${startUTC} AND ${endUTC}
    GROUP BY ri.name, ri.sku, ri.category
    ORDER BY qty DESC NULLS LAST
  `;
  for (const it of items) {
    await prisma.snapshotItem.create({
      data: {
        snapshotId: snapshot.id,
        itemName: it.name,
        sku: it.sku,
        category: it.category ?? undefined,
        qty: it.qty,
        revenueSatang: BigInt(it.revenue_satang)
      }
    });
  }

  const mods = await prisma.$queryRaw`
    WITH src AS (
      SELECT ri.modifiers
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri."receiptId"
      WHERE r.provider='LOYVERSE'
        AND r."createdAtUTC" BETWEEN ${startUTC} AND ${endUTC}
    ), flat AS (
      SELECT jsonb_array_elements(COALESCE(src.modifiers, '[]'::jsonb)) AS mod FROM src
    )
    SELECT
      mod->>'name' AS modifier_name,
      COUNT(*)::int AS lines,
      COALESCE(SUM( (mod->>'price')::bigint ),0)::bigint AS revenue_satang
    FROM flat
    GROUP BY modifier_name
    ORDER BY lines DESC NULLS LAST
  `;
  for (const m of mods) {
    await prisma.snapshotModifier.create({
      data: {
        snapshotId: snapshot.id,
        modifierName: m.modifier_name ?? '(none)',
        lines: m.lines,
        revenueSatang: BigInt(m.revenue_satang)
      }
    });
  }

  // Jussi quick comparison (heuristic for now)
  const itemsForCalc = await prisma.snapshotItem.findMany({ where: { snapshotId: snapshot.id } });
  let burgersSold = 0;
  let drinksSold = 0;
  for (const it of itemsForCalc) {
    const nm = (it.itemName || '').toLowerCase();
    if (isBurgerLike(nm)) {
      const isDouble = /double|คู่/.test(nm);
      const pattiesPer = isDouble ? 2 : 1;
      burgersSold += it.qty * pattiesPer;
    }
    if (nm.includes('cola') || nm.includes('fanta') || nm.includes('schweppes') || nm.includes('water') || nm.includes('soda')) {
      drinksSold += it.qty;
    }
    if (nm.includes('set') || nm.includes('meal')) {
      drinksSold += it.qty; // default 1 drink per set
    }
  }
  const expectedBuns = burgersSold * BUNS_PER_BURGER;
  const expectedMeatGram = burgersSold * MEAT_PER_PATTY_GRAM;

  let staffBuns = null, staffMeatGram = null, staffDrinks = null;
  let salesFormId = opts.salesFormId || null;
  if (!salesFormId) {
    const ds = await prisma.dailySales.findFirst({
      where: { createdAt: { gte: startUTC, lte: endUTC } },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    if (ds) salesFormId = ds.id;
  }

  // Get staff data from DailyStock if available
  if (salesFormId) {
    const stockData = await prisma.dailyStock.findFirst({
      where: { salesFormId: salesFormId },
      select: { burgerBuns: true, meatGrams: true }
    });
    if (stockData) {
      staffBuns = stockData.burgerBuns ?? null;
      staffMeatGram = stockData.meatGrams ?? null;
    }
  }

  // === PHASE 2+ ENHANCED VARIANCE CALCULATION ===
  
  // Helper functions to categorize ingredients
  const isBun  = (cat) => (cat||'').toLowerCase().includes('bun') || (cat||'').toLowerCase().includes('roll');
  const isMeat = (cat) => (cat||'').toLowerCase().includes('meat') || (cat||'').toLowerCase().includes('beef');
  const isDrink= (cat) => (cat||'').toLowerCase().includes('drink') || (cat||'').toLowerCase().includes('beverage');

  // 1) Opening stock (previous shift's closing stock)
  const prevSales = await prisma.dailySales.findFirst({
    where: { createdAt: { lt: startUTC } },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });
  
  let openingBuns = null, openingMeat = null, openingDrnk = null;
  if (prevSales) {
    const prevStock = await prisma.dailyStock.findFirst({
      where: { salesFormId: prevSales.id },
      select: { 
        burgerBuns: true, 
        meatGrams: true, 
        drinkStock: true 
      }
    });
    
    if (prevStock) {
      openingBuns = prevStock.burgerBuns ?? null;
      openingMeat = prevStock.meatGrams ?? null;
      // Calculate drinks count from drinkStock JSON
      openingDrnk = prevStock.drinkStock ? 
        Object.values(prevStock.drinkStock).reduce((sum, count) => sum + (Number(count) || 0), 0) : null;
    }
  }

  // 2) Purchases in window (placeholder for expense system)
  // TODO: Implement when Expense/ExpenseLine tables are available
  let purchasedBuns = 0, purchasedMeat = 0, purchasedDrnk = 0;

  // 3) Usage from POS (already computed): expectedBuns, expectedMeatGram, drinksSold

  // 4) Expected closing = opening + purchases - usage
  const expectedCloseBuns = (openingBuns ?? 0) + purchasedBuns - (expectedBuns ?? 0);
  const expectedCloseMeat = (openingMeat ?? 0) + purchasedMeat - (expectedMeatGram ?? 0);
  const expectedCloseDrnk = (openingDrnk ?? 0) + purchasedDrnk - (drinksSold ?? 0);

  // 5) Variance = staff closing - expected closing
  const varBuns = staffBuns != null ? staffBuns - expectedCloseBuns : null;
  const varMeat = staffMeatGram != null ? staffMeatGram - expectedCloseMeat : null;
  const varDrinks = staffDrinks != null ? staffDrinks - expectedCloseDrnk : null;

  let state = 'OK';
  const notes = [];
  if (varBuns != null && Math.abs(varBuns) > 5) state = 'MISMATCH';
  if (varMeat != null && Math.abs(varMeat) > 500) state = 'MISMATCH';
  if (staffBuns == null || staffMeatGram == null) {
    state = 'MISSING_DATA';
    notes.push('Missing staff stock counts.');
  }
  
  // Add purchase information to notes
  if (purchasedBuns > 0 || purchasedMeat > 0 || purchasedDrnk > 0) {
    notes.push(`Purchases: ${purchasedBuns} buns, ${purchasedMeat}g meat, ${purchasedDrnk} drinks.`);
  }

  await prisma.jussiComparison.create({
    data: {
      snapshotId: snapshot.id,
      salesFormId,
      
      // Opening stock
      openingBuns,
      openingMeatGram: openingMeat,
      openingDrinks: openingDrnk,
      
      // Purchases
      purchasedBuns,
      purchasedMeatGram: purchasedMeat,
      purchasedDrinks: purchasedDrnk,
      
      // Usage (POS expected)
      expectedBuns,
      expectedMeatGram,
      expectedDrinks: drinksSold,
      
      // Expected closing
      expectedCloseBuns,
      expectedCloseMeatGram: expectedCloseMeat,
      expectedCloseDrinks: expectedCloseDrnk,
      
      // Staff actual
      staffBuns,
      staffMeatGram,
      staffDrinks,
      
      // Final variance
      varBuns,
      varMeatGram: varMeat,
      varDrinks,
      
      state,
      notes: notes.length ? notes.join(' ') : null
    }
  });

  await prisma.shiftSnapshot.update({
    where: { id: snapshot.id },
    data: { reconcileState: state, reconcileNotes: notes.length ? notes.join(' ') : null }
  });

  const cash = await prisma.paymentBreakdown.findUnique({ where: { snapshotId_channel: { snapshotId: snapshot.id, channel: 'CASH' } } });
  const qr   = await prisma.paymentBreakdown.findUnique({ where: { snapshotId_channel: { snapshotId: snapshot.id, channel: 'QR' } } });
  const grab = await prisma.paymentBreakdown.findUnique({ where: { snapshotId_channel: { snapshotId: snapshot.id, channel: 'GRAB' } } });

  console.log(`\nSnapshot ${snapshot.id}`);
  console.log(`Receipts: ${receipts.length}`);
  console.log(`Sales THB: ${toTHB(totalSalesSatang)}`);
  console.log(`Payments THB -> CASH: ${toTHB(cash?.totalSatang ?? 0)} | QR: ${toTHB(qr?.totalSatang ?? 0)} | GRAB: ${toTHB(grab?.totalSatang ?? 0)}`);
  console.log(`\nPHASE 2+ ENHANCED STOCK TRACKING:`);
  console.log(`Opening -> Buns: ${openingBuns}, Meat(g): ${openingMeat}, Drinks: ${openingDrnk}`);
  console.log(`Purchases -> Buns: ${purchasedBuns}, Meat(g): ${purchasedMeat}, Drinks: ${purchasedDrnk}`);
  console.log(`Usage -> Buns: ${expectedBuns}, Meat(g): ${expectedMeatGram}, Drinks: ${drinksSold}`);
  console.log(`Expected Close -> Buns: ${expectedCloseBuns}, Meat(g): ${expectedCloseMeat}, Drinks: ${expectedCloseDrnk}`);
  console.log(`Staff Close -> Buns: ${staffBuns}, Meat(g): ${staffMeatGram}, Drinks: ${staffDrinks}`);
  console.log(`Variance -> Buns: ${varBuns}, Meat(g): ${varMeat}, Drinks: ${varDrinks}`);
  console.log(`State: ${state}`);
}

const dateArg = process.argv[2];
if (!dateArg) {
  console.error('Usage: node workers/snapshotWorker.mjs YYYY-MM-DD [salesFormId]');
  process.exit(1);
}
const salesFormIdArg = process.argv[3];

runForDate(dateArg, { salesFormId: salesFormIdArg })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });