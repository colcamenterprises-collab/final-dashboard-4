import { db } from "../lib/prisma";

interface VarianceItem {
  name: string;
  expected: number;
  used: number;
  variance: number;
  severity: "green" | "yellow" | "red";
}

export const StockVarianceService = {
  async computeShiftVariance(shiftDate: string): Promise<VarianceItem[]> {
    const prisma = db();

    const usage = await prisma.stock_ledger_v1.groupBy({
      by: ["itemName"],
      _sum: { change: true },
      where: {
        createdAt: {
          gte: new Date(`${shiftDate}T00:00:00`),
          lte: new Date(`${shiftDate}T23:59:59`)
        }
      }
    });

    const liveStock = await prisma.stock_item_live_v1.findMany();

    const variance: VarianceItem[] = [];

    for (const u of usage) {
      const item = liveStock.find((x) => x.name === u.itemName);

      if (!item) continue;

      const expected = item.qty;
      const actualUsage = Math.abs(u._sum.change || 0);

      const delta = actualUsage - expected;

      let severity: "green" | "yellow" | "red" = "green";

      if (Math.abs(delta) > 10) severity = "yellow";
      if (Math.abs(delta) > 30) severity = "red";

      variance.push({
        name: u.itemName,
        expected,
        used: actualUsage,
        variance: delta,
        severity
      });
    }

    return variance.sort((a, b) => b.variance - a.variance);
  }
};
