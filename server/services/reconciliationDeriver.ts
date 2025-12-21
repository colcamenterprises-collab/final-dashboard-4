import { prisma } from "../../lib/prisma";

export async function rebuildReconciliation() {
  const shifts = await prisma.soldItem.findMany({ distinct: ["shiftId"] });

  let recordsCreated = 0;

  for (const { shiftId } of shifts) {
    await prisma.shiftReconciliation.deleteMany({ where: { shiftId } });

    const posSales = await prisma.soldItem.aggregate({
      where: { shiftId },
      _sum: { netAmount: true }
    });

    const shiftDateStr = shiftId.replace("SHIFT_", "");
    const formattedDate = `${shiftDateStr.slice(0, 4)}-${shiftDateStr.slice(4, 6)}-${shiftDateStr.slice(6, 8)}`;

    const daily = await prisma.dailySalesV2.findFirst({
      where: { shiftDate: formattedDate },
      include: { stock: true }
    });

    if (!daily) {
      await prisma.shiftReconciliation.create({
        data: {
          shiftId,
          posSales: posSales._sum.netAmount ?? 0,
          declaredSales: 0,
          salesVariance: 0,
          expectedBuns: 0,
          declaredBuns: 0,
          bunsVariance: 0,
          expectedMeat: 0,
          declaredMeat: 0,
          meatVariance: 0,
          status: "FAIL"
        }
      });
      recordsCreated++;
      continue;
    }

    const posTotal = posSales._sum.netAmount ?? 0;
    const declaredTotal = daily.totalSales;
    const variance = Math.abs(declaredTotal - posTotal);

    const declaredBuns = daily.stock?.burgerBuns ?? 0;
    const declaredMeat = daily.stock?.meatWeightG ?? 0;

    const status = variance > 500 ? "FAIL" : variance > 100 ? "WARNING" : "OK";

    await prisma.shiftReconciliation.create({
      data: {
        shiftId,
        posSales: posTotal,
        declaredSales: declaredTotal,
        salesVariance: declaredTotal - posTotal,
        expectedBuns: 0,
        declaredBuns: declaredBuns,
        bunsVariance: 0,
        expectedMeat: 0,
        declaredMeat: declaredMeat,
        meatVariance: 0,
        status: status as any
      }
    });
    recordsCreated++;
  }

  return { shiftsProcessed: shifts.length, recordsCreated };
}
