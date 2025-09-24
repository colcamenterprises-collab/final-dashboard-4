import { Router } from "express";
import { db } from "../db";
import { expenseTypeLkp, supplierLkp, expenses } from "../../shared/schema";
import { eq, desc, and, or, like, ilike, gte, lte } from "drizzle-orm";

export const expensesV2Router = Router();

// Get meta data for dropdowns
expensesV2Router.get("/meta", async (_req, res) => {
  try {
    const [types, suppliers] = await Promise.all([
      db.select().from(expenseTypeLkp).where(eq(expenseTypeLkp.active, true)).orderBy(expenseTypeLkp.name),
      db.select().from(supplierLkp).where(eq(supplierLkp.active, true)).orderBy(supplierLkp.name),
    ]);
    res.json({ types, suppliers });
  } catch (error) {
    console.error("Error fetching expense meta:", error);
    res.status(500).json({ error: "Failed to fetch expense meta data" });
  }
});

// Quick add expense (handles upserts for types/suppliers)
expensesV2Router.post("/", async (req, res) => {
  try {
    const { 
      date, typeName, supplierName, label, amount, paid = false, 
      method, reference, receiptUrl, meta, categoryNote 
    } = req.body;

    // Find or create expense type
    let type = await db.select().from(expenseTypeLkp).where(eq(expenseTypeLkp.name, String(typeName).trim())).limit(1);
    if (type.length === 0) {
      const [newType] = await db.insert(expenseTypeLkp).values({
        name: String(typeName).trim(),
        active: true
      }).returning();
      type = [newType];
    } else {
      // Update to active if it was inactive
      await db.update(expenseTypeLkp)
        .set({ active: true })
        .where(eq(expenseTypeLkp.id, type[0].id));
    }

    // Find or create supplier if provided
    let supplierId: string | null = null;
    if (supplierName && String(supplierName).trim() !== "") {
      let supplier = await db.select().from(supplierLkp).where(eq(supplierLkp.name, String(supplierName).trim())).limit(1);
      if (supplier.length === 0) {
        const [newSupplier] = await db.insert(supplierLkp).values({
          name: String(supplierName).trim(),
          active: true
        }).returning();
        supplier = [newSupplier];
      } else {
        // Update to active if it was inactive
        await db.update(supplierLkp)
          .set({ active: true })
          .where(eq(supplierLkp.id, supplier[0].id));
      }
      supplierId = supplier[0].id;
    }

    // Create expense entry
    const [entry] = await db.insert(expenses).values({
      date: new Date(date),
      typeId: type[0].id,
      supplierId,
      label: label || null,
      amount: String(Number(amount || 0)),
      paid: !!paid,
      method: method || null,
      reference: reference || null,
      receiptUrl: receiptUrl || null,
      categoryNote: categoryNote || null,
      meta: meta || null,
    }).returning();

    res.json({ ok: true, entry });
  } catch (error) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: "Failed to create expense", details: (error as Error).message });
  }
});

// List expenses with filters and totals
expensesV2Router.get("/", async (req, res) => {
  try {
    const { from, to, q, type, supplier, paid } = req.query as any;
    const conditions: any[] = [];

    // Date range filter
    if (from) conditions.push(gte(expenseEntry.date, new Date(from)));
    if (to) conditions.push(lte(expenseEntry.date, new Date(to)));

    // Paid status filter
    if (paid === "true") conditions.push(eq(expenseEntry.paid, true));
    if (paid === "false") conditions.push(eq(expenseEntry.paid, false));

    // Type filter
    if (type) {
      const typeRecord = await db.select().from(expenseTypeLkp).where(eq(expenseTypeLkp.name, String(type))).limit(1);
      if (typeRecord.length > 0) {
        conditions.push(eq(expenseEntry.typeId, typeRecord[0].id));
      }
    }

    // Supplier filter
    if (supplier) {
      const supplierRecord = await db.select().from(supplierLkp).where(eq(supplierLkp.name, String(supplier))).limit(1);
      if (supplierRecord.length > 0) {
        conditions.push(eq(expenseEntry.supplierId, supplierRecord[0].id));
      }
    }

    // Search filter
    if (q) {
      conditions.push(
        or(
          ilike(expenseEntry.label, `%${String(q)}%`),
          ilike(expenseEntry.reference, `%${String(q)}%`)
        )
      );
    }

    // Build query
    let query = db.select({
      id: expenseEntry.id,
      date: expenseEntry.date,
      label: expenseEntry.label,
      amount: expenseEntry.amount,
      paid: expenseEntry.paid,
      method: expenseEntry.method,
      reference: expenseEntry.reference,
      receiptUrl: expenseEntry.receiptUrl,
      categoryNote: expenseEntry.categoryNote,
      meta: expenseEntry.meta,
      createdAt: expenseEntry.createdAt,
      updatedAt: expenseEntry.updatedAt,
      typeName: expenseTypeLkp.name,
      supplierName: supplierLkp.name,
    })
    .from(expenseEntry)
    .leftJoin(expenseTypeLkp, eq(expenseEntry.typeId, expenseTypeLkp.id))
    .leftJoin(supplierLkp, eq(expenseEntry.supplierId, supplierLkp.id))
    .orderBy(desc(expenseEntry.date));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const items = await query;

    // Calculate totals
    const totals = items.reduce((acc: any, item: any) => {
      const value = Number(item.amount);
      acc.all += value;
      if (item.paid) acc.paid += value; 
      else acc.unpaid += value;
      return acc;
    }, { paid: 0, unpaid: 0, all: 0 });

    res.json({ items, totals });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses", details: (error as Error).message });
  }
});

// Mark expense as paid
expensesV2Router.post("/:id/mark-paid", async (req, res) => {
  try {
    const { method, reference } = req.body || {};
    const [entry] = await db.update(expenseEntry)
      .set({ 
        paid: true, 
        method: method || "unknown", 
        reference: reference || null,
        updatedAt: new Date()
      })
      .where(eq(expenseEntry.id, String(req.params.id)))
      .returning();

    res.json({ ok: true, entry });
  } catch (error) {
    console.error("Error marking expense as paid:", error);
    res.status(500).json({ error: "Failed to mark expense as paid" });
  }
});

// Update expense
expensesV2Router.put("/:id", async (req, res) => {
  try {
    const { 
      date, typeName, supplierName, label, amount, paid, 
      method, reference, receiptUrl, categoryNote, meta 
    } = req.body;

    const updates: any = { updatedAt: new Date() };
    
    if (date !== undefined) updates.date = new Date(date);
    if (label !== undefined) updates.label = label;
    if (amount !== undefined) updates.amount = String(Number(amount));
    if (paid !== undefined) updates.paid = !!paid;
    if (method !== undefined) updates.method = method;
    if (reference !== undefined) updates.reference = reference;
    if (receiptUrl !== undefined) updates.receiptUrl = receiptUrl;
    if (categoryNote !== undefined) updates.categoryNote = categoryNote;
    if (meta !== undefined) updates.meta = meta;

    // Handle type update
    if (typeName) {
      let type = await db.select().from(expenseTypeLkp).where(eq(expenseTypeLkp.name, String(typeName).trim())).limit(1);
      if (type.length === 0) {
        const [newType] = await db.insert(expenseTypeLkp).values({
          name: String(typeName).trim(),
          active: true
        }).returning();
        type = [newType];
      }
      updates.typeId = type[0].id;
    }

    // Handle supplier update
    if (supplierName !== undefined) {
      if (supplierName === null || supplierName === "") {
        updates.supplierId = null;
      } else {
        let supplier = await db.select().from(supplierLkp).where(eq(supplierLkp.name, String(supplierName).trim())).limit(1);
        if (supplier.length === 0) {
          const [newSupplier] = await db.insert(supplierLkp).values({
            name: String(supplierName).trim(),
            active: true
          }).returning();
          supplier = [newSupplier];
        }
        updates.supplierId = supplier[0].id;
      }
    }

    const [entry] = await db.update(expenseEntry)
      .set(updates)
      .where(eq(expenseEntry.id, String(req.params.id)))
      .returning();

    res.json({ ok: true, entry });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// Delete expense
expensesV2Router.delete("/:id", async (req, res) => {
  try {
    await db.delete(expenseEntry)
      .where(eq(expenseEntry.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// Get month-to-date expenses summary
expensesV2Router.get("/month-to-date", async (_req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Use direct SQL to avoid Drizzle schema issues
    const result = await db.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(cost_cents), 0) as total_cents
      FROM expenses 
      WHERE 
        EXTRACT(YEAR FROM shift_date) = ${year}
        AND EXTRACT(MONTH FROM shift_date) = ${month}
        AND source = 'DIRECT'
    `);
    
    const row = result.rows[0] as any;
    const count = parseInt(row.count || 0);
    const totalCents = parseInt(row.total_cents || 0);
    const total = totalCents / 100; // Convert cents to dollars

    res.json({ total, count });
  } catch (error) {
    console.error("Error fetching month-to-date expenses:", error);
    res.status(500).json({ error: "Failed to fetch month-to-date expenses" });
  }
});