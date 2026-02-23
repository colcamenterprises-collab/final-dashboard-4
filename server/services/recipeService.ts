import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  ingredients,
  recipe,
  recipeIngredient,
} from "../schema";
import { publishToMenu } from "./menuService";

/**
 * ARCHITECTURE CONTRACT:
 * Recipes and Cost Calculator are standalone.
 * Do NOT import or query purchasing tables here.
 * Purchasing is a separate domain.
 */

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createOrUpdateRecipe(data: any) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const status = typeof data?.status === "string" ? data.status.toLowerCase() : null;
  const isFinal = status === "approved" ? true : data?.isFinal ?? false;

  if (!data?.name && !data?.id) {
    throw new Error("Recipe name is required");
  }

  let recipeId = data?.id ? Number(data.id) : null;

  if (recipeId) {
    const updatePayload: Record<string, unknown> = {};
    if (data?.name) updatePayload.name = data.name;
    if (data?.description !== undefined) updatePayload.description = data.description;
    if (data?.instructions !== undefined) updatePayload.instructions = data.instructions;
    if (data?.sellingPrice !== undefined || data?.selling_price !== undefined) {
      updatePayload.sellingPrice = data?.sellingPrice ?? data?.selling_price ?? null;
    }
    if (data?.yieldUnits !== undefined || data?.yield_units !== undefined) {
      updatePayload.yieldUnits = data?.yieldUnits ?? data?.yield_units ?? null;
    }
    if (typeof data?.active === "boolean") updatePayload.active = data.active;
    if (status || data?.isFinal !== undefined) updatePayload.isFinal = isFinal;

    if (Object.keys(updatePayload).length > 0) {
      await db.update(recipe).set(updatePayload).where(eq(recipe.id, recipeId));
    }
  } else {
    const recipePayload = {
      name: data?.name,
      description: data?.description ?? null,
      instructions: data?.instructions ?? null,
      sellingPrice: data?.sellingPrice ?? data?.selling_price ?? null,
      yieldUnits: data?.yieldUnits ?? data?.yield_units ?? null,
      active: data?.active ?? true,
      isFinal,
    };

    const inserted = await db
      .insert(recipe)
      .values(recipePayload)
      .returning({ id: recipe.id });
    recipeId = inserted[0]?.id ?? null;
  }

  if (!recipeId) {
    throw new Error("Failed to create or update recipe");
  }

  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId));

  const ingredientRows = Array.isArray(data?.ingredients) ? data.ingredients : [];

  for (const ingredientRow of ingredientRows) {
    const sku =
      ingredientRow?.sku ||
      ingredientRow?.supplierSku ||
      ingredientRow?.itemSku ||
      ingredientRow?.item_sku;
    const ingredientName =
      ingredientRow?.name || ingredientRow?.ingredientName || ingredientRow?.itemName;
    const portionQty =
      toNumber(ingredientRow?.portionQty) ??
      toNumber(ingredientRow?.quantity) ??
      toNumber(ingredientRow?.qty);
    const unit = ingredientRow?.unit || ingredientRow?.portionUnit || null;
    const wastePercentage =
      toNumber(ingredientRow?.wastePercentage) ??
      toNumber(ingredientRow?.waste_percentage) ??
      5;

    if (!portionQty) {
      throw new Error(`Missing portion quantity for ingredient "${ingredientName ?? sku ?? "unknown"}"`);
    }

    let ingredientId = ingredientRow?.ingredientId
      ? Number(ingredientRow.ingredientId)
      : null;

    if (!ingredientId && sku) {
      const existingIngredient = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.supplierSku, sku))
        .limit(1);
      ingredientId = existingIngredient[0]?.id ?? null;
    }

    if (!ingredientId) {
      if (!ingredientName) {
        throw new Error("Ingredient name required to create pending ingredient.");
      }

      const supplier = ingredientRow?.supplier || "Makro";
      const createdIngredient = await db
        .insert(ingredients)
        .values({
          name: ingredientName,
          supplier,
          supplierSku: sku,
          source: "pending",
          verified: false,
        })
        .returning({ id: ingredients.id });
      ingredientId = createdIngredient[0]?.id ?? null;
    }

    if (!ingredientId) {
      throw new Error(`Unable to resolve ingredient "${ingredientName ?? sku ?? "unknown"}".`);
    }

    await db.insert(recipeIngredient).values({
      recipeId,
      ingredientId,
      portionQty: portionQty.toString(),
      quantity: ingredientRow?.quantity ?? null,
      unit,
      portionUnit: ingredientRow?.portionUnit ?? unit,
      wastePercentage: wastePercentage.toFixed(2),
    });
  }

  await calculateRecipeCost(recipeId);

  if (status === "approved") {
    await publishToMenu(recipeId);
  }

  return { id: recipeId };
}

export async function calculateRecipeCost(recipeId: number) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const ingredientRows = await db
    .select({
      ingredientId: recipeIngredient.ingredientId,
      portionQty: recipeIngredient.portionQty,
      wastePercentage: recipeIngredient.wastePercentage,
      ingredientName: ingredients.name,
      unitCostPerBase: ingredients.unitCostPerBase,
    })
    .from(recipeIngredient)
    .leftJoin(ingredients, eq(recipeIngredient.ingredientId, ingredients.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  const missing: string[] = [];
  let totalCost = 0;

  for (const row of ingredientRows) {
    const portionQty = toNumber(row.portionQty);
    const wastePercentage = toNumber(row.wastePercentage) ?? 5;
    const unitCostPerBase = toNumber(row.unitCostPerBase);

    if (!portionQty) {
      missing.push(`${row.ingredientName ?? "Unknown"}: missing portion quantity`);
      continue;
    }

    if (!unitCostPerBase || unitCostPerBase <= 0) {
      missing.push(`${row.ingredientName ?? "Unknown"}: missing unit cost`);
      continue;
    }

    const lineCost = unitCostPerBase * portionQty * (1 + wastePercentage / 100);
    totalCost += Number(lineCost.toFixed(2));
  }

  if (missing.length > 0) {
    throw new Error(`Insufficient data to calculate cost: ${missing.join("; ")}`);
  }

  const recipeRow = await db
    .select({ sellingPrice: recipe.sellingPrice })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);

  const sellingPrice = recipeRow.length > 0 ? toNumber(recipeRow[0].sellingPrice) : null;
  const roundedTotalCost = Number(totalCost.toFixed(2));
  const marginPercentage =
    sellingPrice && sellingPrice > 0
      ? ((sellingPrice - roundedTotalCost) / sellingPrice * 100).toFixed(1)
      : "0";

  await db
    .update(recipe)
    .set({
      totalCost: roundedTotalCost.toFixed(2),
      marginPercentage,
    })
    .where(eq(recipe.id, recipeId));

  return {
    recipeId,
    totalCost: roundedTotalCost,
    marginPercentage: Number(marginPercentage),
  };
}
