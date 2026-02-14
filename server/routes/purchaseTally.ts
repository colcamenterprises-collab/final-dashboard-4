import { Router } from 'express';
import { db } from '../db';
import { purchaseTally, purchaseTallyDrink, insertPurchaseTallySchema, insertPurchaseTallyDrinkSchema } from '../../shared/schema';
import { eq, desc, and, gte, lte, like, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';

export const purchaseTallyRouter = Router();

// POST /api/purchase-tally - Create new purchase tally entry with itemized drinks
purchaseTallyRouter.post("/", async (req, res) => {
  try {
    const { drinks = [], ...tallyData } = req.body;
    
    // Create the main tally entry
    const [entry] = await db.insert(purchaseTally).values({
      date: tallyData.date,
      supplier: tallyData.supplier || null,
      amountTHB: tallyData.amountTHB || null,
      staff: tallyData.staff || null,
      notes: tallyData.notes || null,
      rollsPcs: tallyData.rollsPcs ? parseInt(tallyData.rollsPcs) : null,
      meatGrams: tallyData.meatGrams ? parseInt(tallyData.meatGrams) : null,
    }).returning();

    // Add drink line items if provided
    if (Array.isArray(drinks) && drinks.length > 0) {
      const validDrinks = drinks
        .filter(d => d?.itemName && Number(d?.qty) > 0)
        .map(d => ({
          tallyId: entry.id,
          itemName: String(d.itemName),
          qty: Number(d.qty),
          unit: d.unit || "pcs"
        }));

      if (validDrinks.length > 0) {
        await db.insert(purchaseTallyDrink).values(validDrinks);
      }
    }

    // Fetch the complete entry with drinks
    const completeEntry = await db.query.purchaseTally.findFirst({
      where: eq(purchaseTally.id, entry.id),
      with: { drinks: true }
    });
    
    res.json({ ok: true, entry: completeEntry });
  } catch (error) {
    console.error("Error creating purchase tally:", error);
    res.status(500).json({ error: "Failed to create purchase tally", details: (error as Error).message });
  }
});

// GET /api/purchase-tally - Get purchase tally entries with filters including drinks
purchaseTallyRouter.get("/", async (req, res) => {
  try {
    const { month, search, type, limit = "50" } = req.query;
    const conditions = [];
    
    // Month filter (YYYY-MM format)
    if (month && typeof month === 'string') {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const startDate = `${yearStr}-${monthStr}-01`;
      const endDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
      const endDate = `${yearStr}-${monthStr}-${String(endDay).padStart(2, '0')}`;

      conditions.push(
        and(
          gte(purchaseTally.date, startDate),
          lte(purchaseTally.date, endDate)
        )
      );
    }
    
    // Search filter (in supplier, staff, or notes)
    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      conditions.push(
        sql`(
          ${purchaseTally.supplier} ILIKE ${searchTerm} OR 
          ${purchaseTally.staff} ILIKE ${searchTerm} OR 
          ${purchaseTally.notes} ILIKE ${searchTerm}
        )`
      );
    }
    
    let query = db.query.purchaseTally.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: { drinks: true },
      orderBy: [desc(purchaseTally.date), desc(purchaseTally.createdAt)],
      limit: parseInt(limit as string)
    });
    
    const entries = await query;
    
    res.json({ entries });
  } catch (error) {
    console.error("Error fetching purchase tallies:", error);
    res.status(500).json({ error: "Failed to fetch purchase tallies" });
  }
});

// PATCH /api/purchase-tally/:id - Update purchase tally entry with drinks
purchaseTallyRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { drinks = [], ...tallyData } = req.body;
    
    // Update main tally entry
    await db.update(purchaseTally).set({
      date: tallyData.date || undefined,
      supplier: tallyData.supplier,
      amountTHB: tallyData.amountTHB || null,
      staff: tallyData.staff,
      notes: tallyData.notes,
      rollsPcs: tallyData.rollsPcs ? parseInt(tallyData.rollsPcs) : null,
      meatGrams: tallyData.meatGrams ? parseInt(tallyData.meatGrams) : null,
    }).where(eq(purchaseTally.id, id));

    // Replace drink line items
    await db.delete(purchaseTallyDrink).where(eq(purchaseTallyDrink.tallyId, id));
    
    if (Array.isArray(drinks) && drinks.length > 0) {
      const validDrinks = drinks
        .filter(d => d?.itemName && Number(d?.qty) > 0)
        .map(d => ({
          tallyId: id,
          itemName: String(d.itemName),
          qty: Number(d.qty),
          unit: d.unit || "pcs"
        }));

      if (validDrinks.length > 0) {
        await db.insert(purchaseTallyDrink).values(validDrinks);
      }
    }
    
    // Fetch updated entry with drinks
    const updatedEntry = await db.query.purchaseTally.findFirst({
      where: eq(purchaseTally.id, id),
      with: { drinks: true }
    });
    
    if (!updatedEntry) {
      return res.status(404).json({ error: "Purchase tally not found" });
    }
    
    res.json({ ok: true, entry: updatedEntry });
  } catch (error) {
    console.error("Error updating purchase tally:", error);
    res.status(500).json({ error: "Failed to update purchase tally" });
  }
});

// DELETE /api/purchase-tally/:id - Delete purchase tally entry (cascades to drinks)
purchaseTallyRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete main entry (drinks will cascade due to foreign key constraint)
    await db.delete(purchaseTally).where(eq(purchaseTally.id, id));
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting purchase tally:", error);
    res.status(500).json({ error: "Failed to delete purchase tally" });
  }
});

// GET /api/purchase-tally/summary - Get monthly summary for dashboard
purchaseTallyRouter.get("/summary", async (req, res) => {
  try {
    const { month } = req.query;
    const currentDate = new Date();
    
    // Default to current month if not provided
    const targetMonth = month 
      ? new Date(month as string + '-01')
      : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    // Get main summary
    const summary = await db
      .select({
        totalAmount: sql`COALESCE(SUM(${purchaseTally.amountTHB}), 0)`.as('totalAmount'),
        totalRolls: sql`COALESCE(SUM(${purchaseTally.rollsPcs}), 0)`.as('totalRolls'),
        totalMeat: sql`COALESCE(SUM(${purchaseTally.meatGrams}), 0)`.as('totalMeat'),
        entryCount: sql`COUNT(*)`.as('entryCount'),
      })
      .from(purchaseTally)
      .where(
        and(
          gte(purchaseTally.date, startDate.toISOString().split('T')[0]),
          lte(purchaseTally.date, endDate.toISOString().split('T')[0])
        )
      );

    // Get drinks total from line items
    const drinksTotal = await db
      .select({
        totalDrinks: sql`COALESCE(SUM(${purchaseTallyDrink.qty}), 0)`.as('totalDrinks')
      })
      .from(purchaseTallyDrink)
      .innerJoin(purchaseTally, eq(purchaseTallyDrink.tallyId, purchaseTally.id))
      .where(
        and(
          gte(purchaseTally.date, startDate.toISOString().split('T')[0]),
          lte(purchaseTally.date, endDate.toISOString().split('T')[0])
        )
      );
    
    const result = summary[0] || {
      totalAmount: 0,
      totalRolls: 0, 
      totalMeat: 0,
      entryCount: 0
    };

    res.json({ 
      month: targetMonth.toISOString().substring(0, 7),
      summary: {
        ...result,
        totalDrinks: drinksTotal[0]?.totalDrinks || 0,
      }
    });
  } catch (error) {
    console.error("Error fetching purchase tally summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// GET /api/purchase-tally/drinks/summary - Get per-brand drink totals
purchaseTallyRouter.get("/drinks/summary", async (req, res) => {
  try {
    const { month } = req.query;
    const currentDate = new Date();
    
    // Default to current month if not provided  
    const targetMonth = month 
      ? new Date(month as string + '-01')
      : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    const items = await db
      .select({
        itemName: purchaseTallyDrink.itemName,
        qty: sql`SUM(${purchaseTallyDrink.qty})`.as('qty')
      })
      .from(purchaseTallyDrink)
      .innerJoin(purchaseTally, eq(purchaseTallyDrink.tallyId, purchaseTally.id))
      .where(
        and(
          gte(purchaseTally.date, startDate.toISOString().split('T')[0]),
          lte(purchaseTally.date, endDate.toISOString().split('T')[0])
        )
      )
      .groupBy(purchaseTallyDrink.itemName)
      .orderBy(sql`SUM(${purchaseTallyDrink.qty}) DESC`);

    res.json({ 
      ok: true, 
      items: items.map(item => ({
        itemName: item.itemName,
        qty: Number(item.qty) || 0
      }))
    });
  } catch (error) {
    console.error("Error fetching drinks summary:", error);
    res.status(500).json({ error: "Failed to fetch drinks summary" });
  }
});