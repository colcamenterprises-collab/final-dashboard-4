import { db } from "../db";
import { ingredients } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function getAllIngredients() {
  return db.select().from(ingredients).orderBy(ingredients.name);
}

export async function getIngredientById(id: string) {
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
    ...data,
    portionCost: portionCost ? String(portionCost) : null,
  }).returning();

  return result[0];
}

export async function updateIngredientPortion(id: string, portionUnit: string, portions: number) {
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

export async function updateIngredient(id: string, data: Partial<{
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
    ...data,
    ...(portionCost !== undefined && { portionCost }),
    lastReview: new Date(),
  };

  const result = await db
    .update(ingredients)
    .set(updateData)
    .where(eq(ingredients.id, id))
    .returning();

  return result[0];
}

export async function deleteIngredient(id: string) {
  const result = await db.delete(ingredients).where(eq(ingredients.id, id)).returning();
  return result[0];
}