import { Router } from "express";
import { db } from "../../lib/prisma";

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

export default router;
