import axios from "axios";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { menuItemRecipe, menuItemV3, recipe } from "../schema";

export async function publishToMenu(recipeId: number) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const recipeRow = await db
    .select({ id: recipe.id, name: recipe.name, isFinal: recipe.isFinal })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);

  if (recipeRow.length === 0) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  if (!recipeRow[0].isFinal) {
    throw new Error(`Recipe ${recipeId} is not approved`);
  }

  const existingLink = await db
    .select({ menuItemId: menuItemRecipe.menuItemId })
    .from(menuItemRecipe)
    .where(eq(menuItemRecipe.recipeId, recipeId))
    .limit(1);

  let menuItemId: string;

  if (existingLink.length > 0) {
    menuItemId = existingLink[0].menuItemId;
    await db
      .update(menuItemV3)
      .set({
        name: recipeRow[0].name,
        isActive: true,
        isOnlineEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(menuItemV3.id, menuItemId));
  } else {
    const defaultCategory = process.env.DEFAULT_MENU_CATEGORY;
    const defaultPrice = Number(process.env.DEFAULT_MENU_PRICE);

    if (!defaultCategory || !Number.isFinite(defaultPrice)) {
      throw new Error("DEFAULT_MENU_CATEGORY and DEFAULT_MENU_PRICE are required to publish new menu items.");
    }

    const inserted = await db
      .insert(menuItemV3)
      .values({
        name: recipeRow[0].name,
        category: defaultCategory,
        price: defaultPrice.toFixed(2),
        isActive: true,
        isOnlineEnabled: true,
      })
      .returning({ id: menuItemV3.id });
    menuItemId = inserted[0].id;

    await db.insert(menuItemRecipe).values({
      menuItemId,
      recipeId,
    });
  }

  const apiUrl = process.env.ONLINE_ORDERING_API || "https://example.com/online-ordering";
  try {
    await axios.post(apiUrl, { recipeId, menuItemId, name: recipeRow[0].name });
  } catch (error) {
    console.error("[publishToMenu] Online ordering API failed:", error);
  }

  const grabApiUrl = process.env.GRAB_ORDERING_API;
  if (grabApiUrl) {
    try {
      await axios.post(grabApiUrl, { recipeId, menuItemId, name: recipeRow[0].name });
    } catch (error) {
      console.error("[publishToMenu] Grab API failed:", error);
    }
  }

  return { recipeId, menuItemId };
}
