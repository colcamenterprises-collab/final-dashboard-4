import { db } from "../db";
import { ingredients } from "../../shared/schema";
import { eq } from "drizzle-orm";

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