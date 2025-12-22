import { prisma } from "../../lib/prisma";

export async function rebuildAlerts() {
  const shifts = await prisma.shiftReconciliation.findMany();
  let criticalCount = 0;
  let warningCount = 0;

  for (const s of shifts) {
    await prisma.alertEvent.deleteMany({ where: { shiftId: s.shiftId } });

    if (s.status === "FAIL") {
      await prisma.alertEvent.create({
        data: {
          shiftId: s.shiftId,
          type: "RECONCILIATION_FAIL",
          severity: "CRITICAL",
          payload: {
            posSales: s.posSales,
            declaredSales: s.declaredSales,
            salesVariance: s.salesVariance,
            status: s.status
          }
        }
      });
      criticalCount++;
    }

    const coverage = await prisma.shiftRecipeCoverage.findFirst({
      where: { shiftId: s.shiftId }
    });

    if (coverage && coverage.coveragePercent < 100) {
      await prisma.alertEvent.create({
        data: {
          shiftId: s.shiftId,
          type: "RECIPE_COVERAGE_LOW",
          severity: "WARNING",
          payload: {
            totalSoldItems: coverage.totalSoldItems,
            mappedItems: coverage.mappedItems,
            unmappedItems: coverage.unmappedItems,
            coveragePercent: coverage.coveragePercent
          }
        }
      });
      warningCount++;
    }

    if (s.salesVariance !== 0) {
      await prisma.alertEvent.create({
        data: {
          shiftId: s.shiftId,
          type: "CASH_VARIANCE",
          severity: "CRITICAL",
          payload: {
            salesVariance: s.salesVariance,
            posSales: s.posSales,
            declaredSales: s.declaredSales
          }
        }
      });
      criticalCount++;
    }

    const meatVarianceG = Number(s.meatVariance);
    if (Math.abs(meatVarianceG) > 500) {
      await prisma.alertEvent.create({
        data: {
          shiftId: s.shiftId,
          type: "MEAT_VARIANCE_HIGH",
          severity: "WARNING",
          payload: {
            expectedMeat: Number(s.expectedMeat),
            declaredMeat: Number(s.declaredMeat),
            meatVariance: meatVarianceG
          }
        }
      });
      warningCount++;
    }

    if (Math.abs(s.bunsVariance) > 5) {
      await prisma.alertEvent.create({
        data: {
          shiftId: s.shiftId,
          type: "BUNS_VARIANCE_HIGH",
          severity: "WARNING",
          payload: {
            expectedBuns: s.expectedBuns,
            declaredBuns: s.declaredBuns,
            bunsVariance: s.bunsVariance
          }
        }
      });
      warningCount++;
    }
  }

  return { criticalCount, warningCount, shiftsProcessed: shifts.length };
}
