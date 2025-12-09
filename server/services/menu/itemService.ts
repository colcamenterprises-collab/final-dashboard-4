import { db } from "../../lib/prisma";

export async function getAllItems() {
  return await db().menu_items_v3.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      category: true,
      modifiers: true,
      recipes: true
    }
  });
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
