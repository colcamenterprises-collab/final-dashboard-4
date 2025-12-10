import { db } from "../../lib/prisma";
import { subDays, startOfDay, endOfDay } from "date-fns";

interface UsageEntry {
  name: string;
  totalUsed: number;
  unit?: string;
}

export const IngredientUsageService = {
  async getDailyUsage(dateString: string): Promise<UsageEntry[]> {
    const prisma = db();
    const date = new Date(dateString);
    const start = startOfDay(date);
    const end = endOfDay(date);

    const entries = await prisma.stock_ledger_v1.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        change: { lt: 0 }
      }
    });

    const map: Record<string, UsageEntry> = {};

    for (const e of entries) {
      if (!map[e.itemName]) {
        map[e.itemName] = {
          name: e.itemName,
          totalUsed: 0,
          unit: "unit"
        };
      }
      map[e.itemName].totalUsed += Math.abs(e.change);
    }

    return Object.values(map).sort((a, b) => b.totalUsed - a.totalUsed);
  },

  async getTopIngredients(days = 7): Promise<UsageEntry[]> {
    const prisma = db();
    const start = subDays(new Date(), days);

    const entries = await prisma.stock_ledger_v1.findMany({
      where: {
        createdAt: { gte: start },
        change: { lt: 0 }
      }
    });

    const map: Record<string, UsageEntry> = {};

    for (const e of entries) {
      if (!map[e.itemName]) {
        map[e.itemName] = { name: e.itemName, totalUsed: 0 };
      }
      map[e.itemName].totalUsed += Math.abs(e.change);
    }

    return Object.values(map)
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .slice(0, 10);
  }
};
