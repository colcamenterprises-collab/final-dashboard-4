import { db } from "../db";
import { ingredients } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

export async function getAllIngredients() {
  return db.select().from(ingredients).orderBy(ingredients.name);
}

export async function listIngredientsWithStatus() {
  const all = await db.select().from(ingredients).orderBy(ingredients.name);
  return all.map(ing => ({
    ...ing,
    status: ing.locked ? 'locked' : (ing.verified ? 'verified' : 'unverified')
  }));
}

export async function toggleIngredientVerified(id: number) {
  const current = await getIngredientById(id);
  if (!current) throw new Error("Ingredient not found");
  if (current.locked) throw new Error("Cannot modify locked ingredient");
  
  const result = await db
    .update(ingredients)
    .set({ verified: !current.verified })
    .where(eq(ingredients.id, id))
    .returning();
  return result[0];
}

export async function toggleIngredientLocked(id: number) {
  const current = await getIngredientById(id);
  if (!current) throw new Error("Ingredient not found");
  
  const result = await db
    .update(ingredients)
    .set({ locked: !current.locked })
    .where(eq(ingredients.id, id))
    .returning();
  return result[0];
}

export async function getIngredientById(id: number) {
  const result = await db.select().from(ingredients).where(eq(ingredients.id, id));
  return result[0] || null;
}

export async function createIngredient(data: {
  name: string;
  category?: string;
  supplier?: string;
  brand?: string;
  purchaseQty: number;
  purchaseUnit: string;
  purchaseCost: number;
  portionUnit?: string;
  portionsPerPurchase?: number;
}) {
  const portionCost = data.portionsPerPurchase && data.portionsPerPurchase > 0 
    ? data.purchaseCost / data.portionsPerPurchase 
    : null;

  const result = await db.insert(ingredients).values({
    name: data.name,
    category: data.category,
    supplier: data.supplier,
    brand: data.brand,
    purchaseQty: String(data.purchaseQty),
    purchaseUnit: data.purchaseUnit,
    purchaseCost: String(data.purchaseCost),
    portionUnit: data.portionUnit,
    portionsPerPurchase: data.portionsPerPurchase,
    portionCost: portionCost ? String(portionCost) : null,
  }).returning();

  return result[0];
}

export async function updateIngredientPortion(id: number, portionUnit: string, portions: number) {
  // First get the current ingredient to access purchase cost
  const current = await getIngredientById(id);
  if (!current) {
    throw new Error("Ingredient not found");
  }

  const portionCost = portions > 0 ? Number(current.purchaseCost) / portions : null;

  const result = await db
    .update(ingredients)
    .set({
      portionUnit,
      portionsPerPurchase: portions,
      portionCost: portionCost ? String(portionCost) : null,
      lastReview: new Date(),
    })
    .where(eq(ingredients.id, id))
    .returning();

  return result[0];
}

export async function updateIngredient(id: number, data: Partial<{
  name: string;
  category: string;
  supplier: string;
  brand: string;
  purchaseQty: number;
  purchaseUnit: string;
  purchaseCost: number;
  portionUnit: string;
  portionsPerPurchase: number;
}>) {
  const current = await getIngredientById(id);
  if (current?.locked) {
    throw new Error("Cannot update locked ingredient");
  }
  // Recalculate portion cost if purchase cost or portions changed
  let portionCost = undefined;
  if (data.purchaseCost !== undefined || data.portionsPerPurchase !== undefined) {
    const current = await getIngredientById(id);
    if (current) {
      const newCost = data.purchaseCost ?? Number(current.purchaseCost);
      const newPortions = data.portionsPerPurchase ?? current.portionsPerPurchase;
      portionCost = newPortions && newPortions > 0 ? String(newCost / newPortions) : null;
    }
  }

  const updateData = {
    name: data.name,
    category: data.category,
    supplier: data.supplier,
    brand: data.brand,
    purchaseQty: data.purchaseQty ? String(data.purchaseQty) : undefined,
    purchaseUnit: data.purchaseUnit,
    purchaseCost: data.purchaseCost ? String(data.purchaseCost) : undefined,
    portionUnit: data.portionUnit,
    portionsPerPurchase: data.portionsPerPurchase,
    ...(portionCost !== undefined && { portionCost }),
    lastReview: new Date(),
  };

  // Remove undefined values
  const cleanedData = Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  );

  const result = await db
    .update(ingredients)
    .set(cleanedData)
    .where(eq(ingredients.id, id))
    .returning();

  return result[0];
}

export async function deleteIngredient(id: number) {
  const result = await db.delete(ingredients).where(eq(ingredients.id, id)).returning();
  return result[0];
}

export async function getItemsWithPurchasing(options?: { search?: string; limit?: number }) {
  const limit = Math.min(options?.limit ?? 200, 500);
  const search = options?.search?.trim().toLowerCase();

  const baseQuery = sql`
    SELECT
      i.id,
      i.name,
      i.category,
      i.base_unit AS "baseUnit",
      i.unit_cost_per_base AS "unitCostPerBase",
      COALESCE(p.brand, i.brand) AS brand,
      p."supplierSku" AS sku,
      COALESCE(p."unitCost", i.unit_price) AS "unitPrice",
      p."unitCost" AS "packCost",
      CASE
        WHEN p.portion_size IS NOT NULL AND p.portion_unit IS NOT NULL
          THEN p.portion_size::text || ' ' || p.portion_unit
        ELSE NULL
      END AS "portionMeasurement"
    FROM ingredients i
    LEFT JOIN purchasing_items p ON i.source_purchasing_item_id = p.id
  `;

  const result = search
    ? await db.execute(sql`
        ${baseQuery}
        WHERE LOWER(i.name) LIKE ${'%' + search + '%'}
        ORDER BY i.name ASC
        LIMIT ${limit};
      `)
    : await db.execute(sql`
        ${baseQuery}
        ORDER BY i.name ASC
        LIMIT ${limit};
      `);

  const rows = result.rows || result;
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    baseUnit: row.baseUnit ?? null,
    unitCostPerBase: row.unitCostPerBase !== null ? Number(row.unitCostPerBase) : null,
    brand: row.brand ?? null,
    sku: row.sku ?? null,
    unitPrice: row.unitPrice !== null ? Number(row.unitPrice) : null,
    packCost: row.packCost !== null ? Number(row.packCost) : null,
    portionMeasurement: row.portionMeasurement ?? null,
  }));
}
