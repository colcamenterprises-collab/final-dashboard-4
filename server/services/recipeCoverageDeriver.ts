import { prisma } from "../../lib/prisma";

export async function rebuildRecipeCoverage() {
  const shifts = await prisma.soldItem.findMany({
    select: { shiftId: true },
    distinct: ["shiftId"]
  });

  for (const { shiftId } of shifts) {
    await prisma.shiftRecipeCoverage.deleteMany({ where: { shiftId } });

    const total = await prisma.soldItem.count({ where: { shiftId } });
    const mapped = await prisma.soldItem.count({
      where: { shiftId, recipeId: { not: null } }
    });

    await prisma.shiftRecipeCoverage.create({
      data: {
        shiftId,
        totalSoldItems: total,
        mappedItems: mapped,
        unmappedItems: total - mapped,
        coveragePercent: total === 0 ? 100 : Math.round((mapped / total) * 100)
      }
    });
  }

  return shifts.length;
}
