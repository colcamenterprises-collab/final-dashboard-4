import { db } from "../../lib/prisma";

export async function setRecipe(itemId: string, recipeItems: Array<{ ingredientId: string; quantityUsed: number; unit: string }>) {
  await db().menu_item_recipes_v3.deleteMany({ where: { itemId } });

  for (const r of recipeItems) {
    await db().menu_item_recipes_v3.create({
      data: {
        itemId,
        ingredientId: r.ingredientId,
        quantityUsed: r.quantityUsed,
        unit: r.unit
      }
    });
  }
}

export async function getRecipe(itemId: string) {
  return await db().menu_item_recipes_v3.findMany({
    where: { itemId }
  });
}
