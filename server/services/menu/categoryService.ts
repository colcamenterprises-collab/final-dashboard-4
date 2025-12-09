import { db } from "../../lib/prisma";

export async function getAllCategories() {
  return await db().menu_categories_v3.findMany({
    orderBy: { sortOrder: "asc" }
  });
}

export async function createCategory(data: any) {
  return await db().menu_categories_v3.create({ data });
}

export async function updateCategory(id: string, data: any) {
  return await db().menu_categories_v3.update({
    where: { id },
    data
  });
}

export async function reorderCategories(orderList: string[]) {
  for (let i = 0; i < orderList.length; i++) {
    await db().menu_categories_v3.update({
      where: { id: orderList[i] },
      data: { sortOrder: i }
    });
  }
}
