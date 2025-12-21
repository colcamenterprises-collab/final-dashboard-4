import { prisma } from "../../lib/prisma";

export async function rebuildIngredientUsage() {
  const shifts = await prisma.soldItem.findMany({
    distinct: ["shiftId"],
    where: { recipeId: { not: null } }
  });

  let shiftsProcessed = 0;
  let usageRecordsCreated = 0;

  for (const { shiftId } of shifts) {
    await prisma.shiftIngredientUsage.deleteMany({ where: { shiftId } });

    const items = await prisma.soldItem.findMany({
      where: { shiftId, recipeId: { not: null } }
    });

    const usage: Record<string, {
      ingredientId: string;
      ingredientName: string;
      unit: string;
      qty: number;
    }> = {};

    for (const item of items) {
      const recipeItems = await prisma.recipeItemV2.findMany({
        where: { recipeId: item.recipeId! },
        include: { ingredient: true }
      });

      for (const line of recipeItems) {
        const key = `${line.ingredientId}-${line.ingredient.baseUnit || "unit"}`;
        usage[key] ??= {
          ingredientId: line.ingredientId,
          ingredientName: line.ingredient.name,
          unit: line.ingredient.baseUnit || "unit",
          qty: 0
        };
        usage[key].qty += Number(line.qty);
      }
    }

    for (const u of Object.values(usage)) {
      await prisma.shiftIngredientUsage.create({
        data: {
          shiftId,
          ingredientId: u.ingredientId,
          ingredientName: u.ingredientName,
          quantityUsed: u.qty,
          unit: u.unit,
          source: "SOLD_ITEM_RECIPE"
        }
      });
      usageRecordsCreated++;
    }

    shiftsProcessed++;
  }

  return { shiftsProcessed, usageRecordsCreated };
}
