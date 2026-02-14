import { Router } from "express";
import { db } from "../../lib/prisma";
import { computeAndUpsertRollsLedger, getRollsLedgerRange } from "../../services/rollsLedger";
import { computeAndUpsertMeatLedger, getMeatLedgerRange } from "../../services/meatLedger";
import { computeAndUpsertDrinksLedger, getDrinksLedgerRange } from "../../services/drinksLedger";

const router = Router();

router.get("/live", async (req, res) => {
  const prisma = db();
  const items = await prisma.stock_item_live_v1.findMany({
    orderBy: { name: "asc" }
  });
  res.json({ success: true, items });
});

/**
 * K5: Manual Stock Purchase API
 * Logs rolls, meat, or drinks purchases to purchasing_shift_items
 * Optionally creates expense entry if paid=true
 */
router.post("/manual-purchase", async (req, res) => {
  try {
    const prisma = db();
    const { type, date, items, quantity, weightKg, cost, paid } = req.body;
    
    if (!type || !date) {
      return res.status(400).json({ error: "Type and date are required" });
    }

    // Find or create daily_stock_v2 for this date
    let dailyStock = await prisma.dailyStockV2.findFirst({
      where: { 
        createdAt: {
          gte: new Date(`${date}T00:00:00Z`),
          lt: new Date(`${date}T23:59:59Z`),
        },
        deletedAt: null,
      },
    });

    // If no dailyStock exists, we need to reference an existing one or create placeholder
    if (!dailyStock) {
      // Get the most recent dailyStock
      dailyStock = await prisma.dailyStockV2.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!dailyStock) {
      return res.status(400).json({ error: "No daily stock record found. Please complete a shift first." });
    }

    const dailyStockId = dailyStock.id;
    const results: any[] = [];

    if (type === "rolls") {
      // Find Burger Buns / Rolls in purchasing_items
      const rollsItem = await prisma.purchasingItem.findFirst({
        where: { 
          OR: [
            { item: { contains: "Burger Bun", mode: "insensitive" } },
            { item: { contains: "Rolls", mode: "insensitive" } },
          ],
          active: true,
        },
      });

      if (rollsItem) {
        // Upsert purchasing_shift_item
        const existing = await prisma.purchasingShiftItem.findFirst({
          where: { dailyStockId, purchasingItemId: rollsItem.id },
        });

        if (existing) {
          await prisma.purchasingShiftItem.update({
            where: { id: existing.id },
            data: { quantity: (parseFloat(existing.quantity as any) || 0) + (quantity || 0) },
          });
        } else {
          await prisma.purchasingShiftItem.create({
            data: {
              dailyStockId,
              purchasingItemId: rollsItem.id,
              quantity: quantity || 0,
            },
          });
        }
        results.push({ item: "Rolls", quantity });
      }
    } else if (type === "meat") {
      // For meat, we track in grams but input is in kg
      const meatGrams = Math.round((weightKg || 0) * 1000);
      
      // Update dailyStock meatWeightG field if available
      await prisma.dailyStockV2.update({
        where: { id: dailyStockId },
        data: { 
          meatWeightG: (dailyStock.meatWeightG || 0) + meatGrams,
        },
      });
      results.push({ item: "Meat", weightKg, grams: meatGrams });
    } else if (type === "drinks" && items && Array.isArray(items)) {
      // Get all drink purchasing items
      const drinkItems = await prisma.purchasingItem.findMany({
        where: { category: "Drinks", active: true },
      });

      const drinkNameToId = new Map(drinkItems.map(d => [d.item.toLowerCase(), d.id]));

      for (const drinkEntry of items) {
        const { name, quantity: qty } = drinkEntry;
        if (!name || !qty || qty <= 0) continue;

        const itemId = drinkNameToId.get(name.toLowerCase());
        if (!itemId) continue;

        // Upsert purchasing_shift_item
        const existing = await prisma.purchasingShiftItem.findFirst({
          where: { dailyStockId, purchasingItemId: itemId },
        });

        if (existing) {
          await prisma.purchasingShiftItem.update({
            where: { id: existing.id },
            data: { quantity: (parseFloat(existing.quantity as any) || 0) + qty },
          });
        } else {
          await prisma.purchasingShiftItem.create({
            data: {
              dailyStockId,
              purchasingItemId: itemId,
              quantity: qty,
            },
          });
        }
        results.push({ item: name, quantity: qty });
      }
    }

    // K5: If paid=true, create expense entry (derived from purchasing)
    if (paid && cost && cost > 0) {
      // Create expense record for the purchase
      await prisma.expenses.create({
        data: {
          date: new Date(date),
          description: `Stock Purchase: ${type}`,
          amount: cost,
          category: "Stock Purchase",
          source: "manual_stock_purchase",
        },
      });
      console.log(`[STOCK] Created expense entry for ${type}: ${cost} THB`);
    }

    res.json({ 
      success: true, 
      message: `Logged ${type} purchase successfully`,
      results,
      dailyStockId,
    });
  } catch (error: any) {
    console.error("[STOCK] Manual purchase error:", error);
    res.status(500).json({ error: error.message || "Failed to log stock purchase" });
  }
});

/**
 * 🔒 PATCH S1: Separate stock logging routes
 * - /rolls: qty + optional expense
 * - /meat: type + weight (NO expense)
 * - /drinks: qty only (NO expense, NO SKU)
 * 
 * Uses raw SQL to log to analysis tables
 */

router.post("/rolls", async (req, res) => {
  try {
    const prisma = db();
    const { qty, paid } = req.body;

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be positive" });
    }

    const today = new Date().toISOString().split('T')[0];

    await prisma.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, source, paid, created_at)
      VALUES (${new Date(today)}, 'rolls', 'Burger Buns', ${qty}, 'stock_modal', ${paid || false}, NOW())
    `;

    let expenseCreated = false;
    if (paid) {
      const rollsItem = await prisma.purchasingItem.findFirst({
        where: {
          OR: [
            { item: { contains: "Burger Bun", mode: "insensitive" } },
            { item: { contains: "Rolls", mode: "insensitive" } },
          ],
          active: true,
        },
      });
      
      const rollsCost = (rollsItem?.unitCost || 25) * qty;
      await prisma.expenses.create({
        data: {
          date: new Date(today),
          description: `Burger Buns/Rolls - ${qty} packs`,
          amount: rollsCost,
          category: "Stock Purchase",
          source: "stock_modal",
        },
      });
      expenseCreated = true;
    }

    res.json({ 
      success: true, 
      message: `Logged ${qty} rolls`,
      expenseCreated,
    });
  } catch (error: any) {
    console.error("[STOCK] Rolls log error:", error);
    res.status(500).json({ error: error.message || "Failed to log rolls" });
  }
});

router.post("/meat", async (req, res) => {
  try {
    const prisma = db();
    const { type, weightKg } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Meat type is required" });
    }
    if (!weightKg || weightKg <= 0) {
      return res.status(400).json({ error: "Weight must be positive" });
    }

    const today = new Date().toISOString().split('T')[0];
    const weightG = Math.round(weightKg * 1000);

    await prisma.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, weight_g, source, paid, created_at)
      VALUES (${new Date(today)}, 'meat', ${type}, 1, ${weightG}, 'stock_modal', false, NOW())
    `;

    res.json({ 
      success: true, 
      message: `Logged ${weightKg}kg ${type}`,
    });
  } catch (error: any) {
    console.error("[STOCK] Meat log error:", error);
    res.status(500).json({ error: error.message || "Failed to log meat" });
  }
});

router.post("/drinks", async (req, res) => {
  try {
    const prisma = db();
    const { counts } = req.body;

    if (!counts || typeof counts !== 'object') {
      return res.status(400).json({ error: "Drink counts object is required" });
    }

    const today = new Date().toISOString().split('T')[0];
    const results: { drink: string; qty: number }[] = [];

    for (const [drinkName, qty] of Object.entries(counts)) {
      if (typeof qty === 'number' && qty > 0) {
        await prisma.$executeRaw`
          INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, source, paid, created_at)
          VALUES (${new Date(today)}, 'drinks', ${drinkName}, ${qty}, 'stock_modal', false, NOW())
        `;
        results.push({ drink: drinkName, qty });
      }
    }

    const totalDrinks = results.reduce((sum, r) => sum + r.qty, 0);

    res.json({ 
      success: true, 
      message: `Logged ${totalDrinks} drinks`,
      items: results,
    });
  } catch (error: any) {
    console.error("[STOCK] Drinks log error:", error);
    res.status(500).json({ error: error.message || "Failed to log drinks" });
  }
});

router.post('/lodge/rolls', async (req, res) => {
  try {
    const prisma = db();
    const { shiftDate, staffName, rollsPurchased } = req.body;

    if (!shiftDate) return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    if (!staffName || String(staffName).trim().length === 0) return res.status(400).json({ ok: false, error: 'staffName is required' });
    if (!Number.isFinite(Number(rollsPurchased)) || Number(rollsPurchased) <= 0) return res.status(400).json({ ok: false, error: 'rollsPurchased must be a positive number' });

    await prisma.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, staff_name, source, paid, created_at)
      VALUES (${shiftDate}::date, 'rolls', 'Burger Buns', ${Number(rollsPurchased)}, ${String(staffName).trim()}, 'stock_lodgement_home', false, NOW())
    `;

    await computeAndUpsertRollsLedger(shiftDate);
    const ledgerRows = await getRollsLedgerRange(shiftDate, shiftDate);
    return res.json({ ok: true, shiftDate, ledger: ledgerRows[0] ?? null });
  } catch (error: any) {
    console.error('[STOCK] Rolls lodgement error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to lodge rolls' });
  }
});

router.post('/lodge/meat', async (req, res) => {
  try {
    const prisma = db();
    const { shiftDate, staffName, kilosPurchased } = req.body;

    if (!shiftDate) return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    if (!staffName || String(staffName).trim().length === 0) return res.status(400).json({ ok: false, error: 'staffName is required' });
    if (!Number.isFinite(Number(kilosPurchased)) || Number(kilosPurchased) <= 0) return res.status(400).json({ ok: false, error: 'kilosPurchased must be a positive number' });

    const weightG = Math.round(Number(kilosPurchased) * 1000);
    await prisma.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, weight_g, staff_name, source, paid, created_at)
      VALUES (${shiftDate}::date, 'meat', 'Meat Lodgement', 1, ${weightG}, ${String(staffName).trim()}, 'stock_lodgement_home', false, NOW())
    `;

    await computeAndUpsertMeatLedger(shiftDate);
    const ledgerRows = await getMeatLedgerRange(shiftDate, shiftDate);
    return res.json({ ok: true, shiftDate, ledger: ledgerRows[0] ?? null });
  } catch (error: any) {
    console.error('[STOCK] Meat lodgement error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to lodge meat' });
  }
});

router.post('/lodge/drinks', async (req, res) => {
  try {
    const prisma = db();
    const { shiftDate, staffName, items } = req.body;

    if (!shiftDate) return res.status(400).json({ ok: false, error: 'shiftDate is required' });
    if (!staffName || String(staffName).trim().length === 0) return res.status(400).json({ ok: false, error: 'staffName is required' });
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items must be an array' });

    const validItems = items
      .map((item: any) => ({ sku: String(item?.sku || '').trim(), quantity: Number(item?.quantity) }))
      .filter((item: { sku: string; quantity: number }) => item.sku.length > 0 && Number.isFinite(item.quantity) && item.quantity > 0);

    if (validItems.length === 0) return res.status(400).json({ ok: false, error: 'At least one drink item with quantity > 0 is required' });

    for (const item of validItems) {
      await prisma.$executeRaw`
        INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, staff_name, sku, source, paid, created_at)
        VALUES (${shiftDate}::date, 'drinks', ${item.sku}, ${item.quantity}, ${String(staffName).trim()}, ${item.sku}, 'stock_lodgement_home', false, NOW())
      `;
    }

    await computeAndUpsertDrinksLedger(shiftDate);
    const ledgerRows = await getDrinksLedgerRange(shiftDate, shiftDate);
    return res.json({ ok: true, shiftDate, insertedItems: validItems.length, ledger: ledgerRows[0] ?? null });
  } catch (error: any) {
    console.error('[STOCK] Drinks lodgement error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to lodge drinks' });
  }
});

export default router;
