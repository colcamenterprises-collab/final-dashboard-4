import { Router } from 'express';
import { db } from '../db';
import { purchaseTally, insertPurchaseTallySchema } from '../../shared/schema';
import { eq, desc, and, gte, lte, like, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';

export const purchaseTallyRouter = Router();

// POST /api/purchase-tally - Create new purchase tally entry
purchaseTallyRouter.post("/", async (req, res) => {
  try {
    const validatedData = insertPurchaseTallySchema.parse(req.body);
    
    const [entry] = await db.insert(purchaseTally).values(validatedData).returning();
    
    res.json({ ok: true, entry });
  } catch (error) {
    console.error("Error creating purchase tally:", error);
    res.status(500).json({ error: "Failed to create purchase tally", details: (error as Error).message });
  }
});

// GET /api/purchase-tally - Get purchase tally entries with filters
purchaseTallyRouter.get("/", async (req, res) => {
  try {
    const { month, search, type, limit = "50" } = req.query;
    
    let query = db.select().from(purchaseTally);
    const conditions = [];
    
    // Month filter (YYYY-MM format)
    if (month && typeof month === 'string') {
      const year = parseInt(month.split('-')[0]);
      const monthNum = parseInt(month.split('-')[1]);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      conditions.push(
        and(
          gte(purchaseTally.date, startDate.toISOString().split('T')[0]),
          lte(purchaseTally.date, endDate.toISOString().split('T')[0])
        )
      );
    }
    
    // Search filter (in supplier, staff, or notes)
    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      conditions.push(
        // Using SQL OR for multiple column search
        sql`(
          ${purchaseTally.supplier} ILIKE ${searchTerm} OR 
          ${purchaseTally.staff} ILIKE ${searchTerm} OR 
          ${purchaseTally.notes} ILIKE ${searchTerm}
        )`
      );
    }
    
    // Type filter (rolls, meat, drinks based on quantities)
    if (type && typeof type === 'string') {
      switch (type) {
        case 'rolls':
          conditions.push(sql`${purchaseTally.rollsPcs} > 0`);
          break;
        case 'meat':
          conditions.push(sql`${purchaseTally.meatGrams} > 0`);
          break;
        case 'drinks':
          conditions.push(sql`${purchaseTally.drinksPcs} > 0`);
          break;
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const entries = await query
      .orderBy(desc(purchaseTally.date), desc(purchaseTally.createdAt))
      .limit(parseInt(limit as string));
    
    res.json({ entries });
  } catch (error) {
    console.error("Error fetching purchase tallies:", error);
    res.status(500).json({ error: "Failed to fetch purchase tallies" });
  }
});

// PATCH /api/purchase-tally/:id - Update purchase tally entry
purchaseTallyRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove id from update data if present
    delete updateData.id;
    delete updateData.createdAt;
    
    const [updatedEntry] = await db
      .update(purchaseTally)
      .set(updateData)
      .where(eq(purchaseTally.id, id))
      .returning();
    
    if (!updatedEntry) {
      return res.status(404).json({ error: "Purchase tally not found" });
    }
    
    res.json({ ok: true, entry: updatedEntry });
  } catch (error) {
    console.error("Error updating purchase tally:", error);
    res.status(500).json({ error: "Failed to update purchase tally" });
  }
});

// DELETE /api/purchase-tally/:id - Delete purchase tally entry  
purchaseTallyRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    const summary = await db
      .select({
        totalAmount: sql`COALESCE(SUM(${purchaseTally.amountTHB}), 0)`.as('totalAmount'),
        totalRolls: sql`COALESCE(SUM(${purchaseTally.rollsPcs}), 0)`.as('totalRolls'),
        totalMeat: sql`COALESCE(SUM(${purchaseTally.meatGrams}), 0)`.as('totalMeat'),
        totalDrinks: sql`COALESCE(SUM(${purchaseTally.drinksPcs}), 0)`.as('totalDrinks'),
        entryCount: sql`COUNT(*)`.as('entryCount'),
      })
      .from(purchaseTally)
      .where(
        and(
          gte(purchaseTally.date, startDate.toISOString().split('T')[0]),
          lte(purchaseTally.date, endDate.toISOString().split('T')[0])
        )
      );
    
    res.json({ 
      month: targetMonth.toISOString().substring(0, 7),
      summary: summary[0] || {
        totalAmount: 0,
        totalRolls: 0, 
        totalMeat: 0,
        totalDrinks: 0,
        entryCount: 0
      }
    });
  } catch (error) {
    console.error("Error fetching purchase tally summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});