import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  ingredients,
  menuItemRecipe,
  menuItemV3,
  recipe,
  recipeIngredient,
} from "../schema";
import { publishToMenu } from "./menuService";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createOrUpdateRecipe(data: any): Promise<any> {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const { id, name, status, ingredients: payloadIngredients } = data ?? {};
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : null;
  const isFinal = normalizedStatus === "approved";

  let recipeId: number;

  if (id) {
    const updatePayload: Record<string, unknown> = {};
    if (name) updatePayload.name = name;
    if (normalizedStatus) updatePayload.isFinal = isFinal;

    if (Object.keys(updatePayload).length > 0) {
      await db.update(recipe).set(updatePayload).where(eq(recipe.id, id));
    }
    recipeId = id;
  } else {
    if (!name) {
      throw new Error("Recipe name is required");
    }

    const newRecipe = await db
      .insert(recipe)
      .values({ name, isFinal: false, active: true })
      .returning({ id: recipe.id });
    recipeId = newRecipe[0].id;
  }

  const ingredientRows = Array.isArray(payloadIngredients) ? payloadIngredients : [];

  if (ingredientRows.length > 0) {
    await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId));

    for (const ing of ingredientRows) {
      const sku = ing?.sku || ing?.supplierSku || ing?.itemSku || ing?.item_sku;
      const ingredientName = ing?.name || ing?.ingredientName || ing?.itemName;
      const portionQty = toNumber(ing?.portionQty) ?? toNumber(ing?.quantity) ?? toNumber(ing?.qty);

      if (!portionQty) {
        throw new Error(`Missing portion quantity for ingredient "${ingredientName ?? sku ?? "unknown"}"`);
      }

      let ingredientId = ing?.ingredientId ? Number(ing.ingredientId) : null;
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

        const supplier = ing?.supplier || "Makro";
        const pending = await db
          .insert(ingredients)
          .values({
            name: ingredientName,
            supplier,
            supplierSku: sku,
            source: "pending",
            verified: false,
          })
          .returning({ id: ingredients.id });
        ingredientId = pending[0]?.id ?? null;
      }

      if (!ingredientId) {
        throw new Error(`Unable to resolve ingredient "${ingredientName ?? sku ?? "unknown"}".`);
      }

      await db.insert(recipeIngredient).values({
        recipeId,
        ingredientId,
        portionQty: portionQty.toString(),
        quantity: ing?.quantity ?? portionQty.toString(),
        unit: ing?.unit || ing?.portionUnit || null,
        wastePercentage: (toNumber(ing?.wastePercentage) ?? 5).toFixed(2),
      });
    }

    await calculateRecipeCost(recipeId);
  }

  if (normalizedStatus === "approved") {
    await publishToMenu(recipeId);
  }

  return { id: recipeId, message: "Recipe saved" };
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
