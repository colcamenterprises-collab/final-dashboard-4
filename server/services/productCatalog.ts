import { db } from "../db";
import { product, recipe } from "@shared/schema";
import { eq } from "drizzle-orm";
import { calculateRecipeCost } from "./recipeAuthority";

export type ProductRecord = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  recipeId: number | null;
  baseCost: number | null;
  priceInStore: number | null;
  priceOnline: number | null;
  priceGrab: number | null;
  active: boolean;
  visibleInStore: boolean;
  visibleGrab: boolean;
  visibleOnline: boolean;
};

export type CreateProductResult =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "exists"; product: ProductRecord }
  | { status: "created"; product: ProductRecord };

export async function createProductFromRecipe(recipeId: number): Promise<CreateProductResult> {
  const [recipeRow] = await db.select().from(recipe).where(eq(recipe.id, recipeId));
  if (!recipeRow) return { status: "missing" };

  const existing = await db.select().from(product).where(eq(product.recipeId, recipeId));
  if (existing.length > 0) {
    return { status: "exists", product: existing[0] as ProductRecord };
  }

  const baseCost = await calculateRecipeCost(recipeId);
  if (baseCost === null) {
    return { status: "invalid", reason: "Recipe must have valid serves and quantities before promotion" };
  }

  const [created] = await db
    .insert(product)
    .values({
      name: recipeRow.name,
      description: null,
      imageUrl: null,
      recipeId,
      baseCost: Number(baseCost.toFixed(2)),
      priceInStore: null,
      priceOnline: null,
      priceGrab: null,
      category: null,
      active: false,
      visibleInStore: false,
      visibleGrab: false,
      visibleOnline: false,
    })
    .returning();

  return { status: "created", product: created as ProductRecord };
}

export async function refreshProductBaseCost(recipeId: number): Promise<void> {
  const baseCost = await calculateRecipeCost(recipeId);
  await db
    .update(product)
    .set({ baseCost: baseCost === null ? null : Number(baseCost.toFixed(2)) })
    .where(eq(product.recipeId, recipeId));
}
