import { db } from "../../lib/prisma";

export async function getAllItems() {
  const prisma = db();
  const items = await prisma.menu_items_v3.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      category: true,
      modifiers: true,
      recipes: true
    }
  });

  try {
    const links = await prisma.$queryRawUnsafe<Array<{ itemId: string; recipeId: number | null }>>(
      `SELECT "itemId", recipe_id AS "recipeId" FROM menu_item_recipes_v3 WHERE recipe_id IS NOT NULL`
    );
    const recipeByItem = new Map(links.map((link) => [link.itemId, link.recipeId]));
    return items.map((item) => ({ ...item, recipeId: recipeByItem.get(item.id) ?? null }));
  } catch (_error) {
    return items;
  }
}

export async function createItem(data: any) {
  return await db().menu_items_v3.create({ data });
}

export async function updateItem(id: string, data: any) {
  return await db().menu_items_v3.update({
    where: { id },
    data
  });
}

export async function toggleItem(id: string, isActive: boolean) {
  return await db().menu_items_v3.update({
    where: { id },
    data: { isActive }
  });
}
