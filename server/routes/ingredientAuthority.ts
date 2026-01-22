import { Router } from "express";
import { PrismaClient } from "@prisma/client";
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
export const ingredientSearchRouter = Router();
const prisma = new PrismaClient();

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

ingredientSearchRouter.get("/api/ingredients", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const like = `%${search}%`;

    const ingredients = await prisma.$queryRaw<
      Array<{
        id: number;
        name: string;
        category: string;
        supplier: string;
        purchase_quantity: number | string;
        purchase_unit: string;
        purchase_cost_thb: number | string;
        portion_quantity: number | string;
        portion_unit: string;
        conversion_factor: number | string | null;
        is_active: boolean;
        updated_at: Date;
        created_at: Date;
      }>
    >`
      SELECT
        id,
        name,
        category,
        supplier,
        purchase_quantity,
        purchase_unit,
        purchase_cost_thb,
        portion_quantity,
        portion_unit,
        conversion_factor,
        is_active,
        updated_at,
        created_at
      FROM ingredient_authority
      WHERE is_active = true
        AND name ILIKE ${like}
    `;

    const enriched = ingredients.map((ing) => {
      const purchaseQuantity = Number(ing.purchase_quantity);
      const purchaseCostThb = Number(ing.purchase_cost_thb);
      const portionQuantity = Number(ing.portion_quantity);
      const conversionFactor =
        ing.conversion_factor === null ? null : Number(ing.conversion_factor);
      const baseQty =
        purchaseQuantity * (conversionFactor === null ? 1 : conversionFactor);
      const costPerPortion = baseQty > 0 ? purchaseCostThb / baseQty : 0;

      return {
        ...ing,
        purchase_quantity: purchaseQuantity,
        purchase_cost_thb: purchaseCostThb,
        portion_quantity: portionQuantity,
        conversion_factor: conversionFactor,
        cost_per_portion: costPerPortion,
        is_valid:
          purchaseQuantity > 0 && purchaseCostThb >= 0 && portionQuantity > 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ingredient fetch failed" });
  }
});

export default router;
