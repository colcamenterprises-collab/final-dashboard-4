import { Router } from "express";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db, databaseAvailable } from "../db";
import { ingredientAuthority } from "@shared/schema";
import {
  allowedUnits,
  validateAndDeriveIngredientAuthority,
  type Unit,
} from "../lib/ingredientAuthority";

const router = Router();

const unitEnum = z.enum(allowedUnits);

const ingredientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  category: z.string().trim().min(1, "Category is required."),
  supplier: z.string().trim().min(1, "Supplier is required."),
  purchaseQuantity: z.number(),
  purchaseUnit: unitEnum,
  purchaseCostThb: z.number(),
  portionQuantity: z.number(),
  portionUnit: unitEnum,
  conversionFactor: z.number().nullable(),
  isActive: z.boolean(),
});

type IngredientAuthorityRow = typeof ingredientAuthority.$inferSelect;

const mapRow = (row: IngredientAuthorityRow) => {
  const purchaseQuantity = Number(row.purchaseQuantity);
  const purchaseCostThb = Number(row.purchaseCostThb);
  const portionQuantity = Number(row.portionQuantity);
  const conversionFactor = row.conversionFactor !== null ? Number(row.conversionFactor) : null;
  const purchaseUnit = row.purchaseUnit as Unit;
  const portionUnit = row.portionUnit as Unit;

  const validation = validateAndDeriveIngredientAuthority({
    purchaseQuantity,
    purchaseUnit,
    purchaseCostThb,
    portionQuantity,
    portionUnit,
    conversionFactor,
  });

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    supplier: row.supplier,
    purchaseQuantity,
    purchaseUnit,
    purchaseCostThb,
    portionQuantity,
    portionUnit,
    conversionFactor,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    derived: validation.valid ? validation.derived : null,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
    },
  };
};

router.get("/", async (_req, res) => {
  if (!databaseAvailable || !db) {
    return res.json({ items: [], count: 0, warning: "DATABASE_UNAVAILABLE" });
  }
  try {
    const rows = await db
      .select()
      .from(ingredientAuthority)
      .orderBy(asc(ingredientAuthority.name));

    res.json({
      items: rows.map(mapRow),
      count: rows.length,
    });
  } catch (error: any) {
    console.error("[ingredient-authority] list error:", error);
    res.status(500).json({ error: "Failed to load ingredients." });
  }
});

router.get("/:id", async (req, res) => {
  if (!databaseAvailable || !db) {
    return res.status(503).json({ error: "Database unavailable." });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid ingredient ID." });
  }
  try {
    const rows = await db
      .select()
      .from(ingredientAuthority)
      .where(eq(ingredientAuthority.id, id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ingredient not found." });
    }

    res.json({ item: mapRow(rows[0]) });
  } catch (error: any) {
    console.error("[ingredient-authority] detail error:", error);
    res.status(500).json({ error: "Failed to load ingredient." });
  }
});

router.post("/", async (req, res) => {
  if (!databaseAvailable || !db) {
    return res.status(503).json({ error: "Database unavailable." });
  }
  const parsed = ingredientInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed.",
      details: parsed.error.flatten(),
    });
  }

  const validation = validateAndDeriveIngredientAuthority({
    purchaseQuantity: parsed.data.purchaseQuantity,
    purchaseUnit: parsed.data.purchaseUnit,
    purchaseCostThb: parsed.data.purchaseCostThb,
    portionQuantity: parsed.data.portionQuantity,
    portionUnit: parsed.data.portionUnit,
    conversionFactor: parsed.data.conversionFactor,
  });

  try {
    const [created] = await db
      .insert(ingredientAuthority)
      .values({
        name: parsed.data.name,
        category: parsed.data.category,
        supplier: parsed.data.supplier,
        purchaseQuantity: parsed.data.purchaseQuantity,
        purchaseUnit: parsed.data.purchaseUnit,
        purchaseCostThb: parsed.data.purchaseCostThb,
        portionQuantity: parsed.data.portionQuantity,
        portionUnit: parsed.data.portionUnit,
        conversionFactor: parsed.data.conversionFactor,
        isActive: parsed.data.isActive,
      })
      .returning();

    res.status(201).json({ item: mapRow(created) });
  } catch (error: any) {
    console.error("[ingredient-authority] create error:", error);
    res.status(500).json({ error: "Failed to create ingredient." });
  }
});

router.put("/:id", async (req, res) => {
  if (!databaseAvailable || !db) {
    return res.status(503).json({ error: "Database unavailable." });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid ingredient ID." });
  }

  const parsed = ingredientInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed.",
      details: parsed.error.flatten(),
    });
  }

  const validation = validateAndDeriveIngredientAuthority({
    purchaseQuantity: parsed.data.purchaseQuantity,
    purchaseUnit: parsed.data.purchaseUnit,
    purchaseCostThb: parsed.data.purchaseCostThb,
    portionQuantity: parsed.data.portionQuantity,
    portionUnit: parsed.data.portionUnit,
    conversionFactor: parsed.data.conversionFactor,
  });

  try {
    const existing = await db
      .select()
      .from(ingredientAuthority)
      .where(eq(ingredientAuthority.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Ingredient not found." });
    }

    const [updated] = await db
      .update(ingredientAuthority)
      .set({
        name: parsed.data.name,
        category: parsed.data.category,
        supplier: parsed.data.supplier,
        purchaseQuantity: parsed.data.purchaseQuantity,
        purchaseUnit: parsed.data.purchaseUnit,
        purchaseCostThb: parsed.data.purchaseCostThb,
        portionQuantity: parsed.data.portionQuantity,
        portionUnit: parsed.data.portionUnit,
        conversionFactor: parsed.data.conversionFactor,
        isActive: parsed.data.isActive,
        updatedAt: sql`NOW()`,
      })
      .where(eq(ingredientAuthority.id, id))
      .returning();

    res.json({ item: mapRow(updated) });
  } catch (error: any) {
    console.error("[ingredient-authority] update error:", error);
    res.status(500).json({ error: "Failed to update ingredient." });
  }
});

export default router;
