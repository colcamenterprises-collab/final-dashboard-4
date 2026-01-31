import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  ingredients,
  menuItemRecipe,
  menuItemV3,
  purchasingItems,
  recipe,
  recipeIngredient,
} from "../schema";
import { publishToMenu } from "./menuService";

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

      if (sku) {
        const existingPurchasing = await db
          .select({ id: purchasingItems.id })
          .from(purchasingItems)
          .where(eq(purchasingItems.supplierSku, sku))
          .limit(1);
        if (existingPurchasing.length === 0) {
          await db.insert(purchasingItems).values({
            item: ingredientName,
            supplier,
            supplierName: supplier,
            supplierSku: sku,
            active: true,
            isIngredient: true,
          });
        }
      }
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
      purchasingItemId: ingredientRow?.purchasingItemId ?? null,
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
      baseUnit: ingredients.baseUnit,
      unitCostPerBase: ingredients.unitCostPerBase,
      purchaseCost: ingredients.purchaseCost,
      baseYieldQty: ingredients.baseYieldQty,
      packageSize: ingredients.packageSize,
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
    const purchaseCost = toNumber(row.purchaseCost);
    const baseYieldQty = toNumber(row.baseYieldQty);
    const packageSize = toNumber(row.packageSize);

    if (!portionQty) {
      missing.push(`${row.ingredientName ?? "Unknown"}: missing portion quantity`);
      continue;
    }

    let resolvedUnitCost = unitCostPerBase;
    if (resolvedUnitCost === null && purchaseCost !== null && baseYieldQty) {
      resolvedUnitCost = purchaseCost / baseYieldQty;
    }
    if (resolvedUnitCost === null && purchaseCost !== null && packageSize) {
      resolvedUnitCost = purchaseCost / packageSize;
    }

    if (!resolvedUnitCost) {
      missing.push(`${row.ingredientName ?? "Unknown"}: missing cost data`);
      continue;
    }

    const lineCost = portionQty * resolvedUnitCost * (1 + wastePercentage / 100);
    totalCost += lineCost;
  }

  if (missing.length > 0) {
    throw new Error(`Insufficient data to calculate cost: ${missing.join("; ")}`);
  }

  const menuPriceRow = await db
    .select({ price: menuItemV3.price })
    .from(menuItemRecipe)
    .innerJoin(menuItemV3, eq(menuItemRecipe.menuItemId, menuItemV3.id))
    .where(eq(menuItemRecipe.recipeId, recipeId))
    .limit(1);

  const menuPrice = menuPriceRow.length > 0 ? toNumber(menuPriceRow[0].price) : null;
  const marginPercentage =
    menuPrice && menuPrice > 0 ? ((menuPrice - totalCost) / menuPrice) * 100 : null;

  await db
    .update(recipe)
    .set({
      totalCost: totalCost.toFixed(4),
      marginPercentage: marginPercentage !== null ? marginPercentage.toFixed(2) : undefined,
    })
    .where(eq(recipe.id, recipeId));

  return {
    recipeId,
    totalCost: Number(totalCost.toFixed(4)),
    marginPercentage: marginPercentage !== null ? Number(marginPercentage.toFixed(2)) : null,
  };
}
