/**
 * 🔒 CANONICAL PURCHASING FLOW (ANALYTICS API)
 * purchasing_items → Form 2 → purchasing_shift_items → Analytics
 *
 * Manager-level metrics for purchasing intelligence
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || '30';
    const customStart = req.query.start as string;
    const customEnd = req.query.end as string;

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    
    if (period === 'mtd') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    } else if (period === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart);
      endDate.setTime(new Date(customEnd).getTime());
    } else {
      startDate.setDate(startDate.getDate() - parseInt(period));
    }

    const daysInRange = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Get all shift items in date range with item details
    const shiftItems = await prisma.purchasingShiftItem.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        quantity: { gt: 0 },
      },
      include: {
        purchasingItem: true,
      },
    });

    // Aggregate by item
    const itemAgg = new Map<number, {
      itemId: number;
      itemName: string;
      category: string | null;
      supplier: string | null;
      totalQty: number;
      totalSpend: number;
    }>();

    for (const si of shiftItems) {
      const item = si.purchasingItem;
      const unitCost = item.unitCost ? Number(item.unitCost) : 0;
      const spend = si.quantity * unitCost;

      if (!itemAgg.has(item.id)) {
        itemAgg.set(item.id, {
          itemId: item.id,
          itemName: item.item,
          category: item.category,
          supplier: item.supplierName,
          totalQty: 0,
          totalSpend: 0,
        });
      }

      const agg = itemAgg.get(item.id)!;
      agg.totalQty += si.quantity;
      agg.totalSpend += spend;
    }

    const itemList = Array.from(itemAgg.values()).map(i => ({
      ...i,
      avgDailyQty: i.totalQty / daysInRange,
    }));

    // Top 10 by spend
    const topBySpend = [...itemList]
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    // Top 10 by quantity
    const topByQuantity = [...itemList]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 10);

    // Supplier breakdown
    const supplierAgg = new Map<string, {
      name: string;
      totalSpend: number;
      totalQty: number;
      itemCount: number;
    }>();

    for (const item of itemList) {
      const supplier = item.supplier || 'No Supplier';
      if (!supplierAgg.has(supplier)) {
        supplierAgg.set(supplier, {
          name: supplier,
          totalSpend: 0,
          totalQty: 0,
          itemCount: 0,
        });
      }
      const agg = supplierAgg.get(supplier)!;
      agg.totalSpend += item.totalSpend;
      agg.totalQty += item.totalQty;
      agg.itemCount += 1;
    }

    const totalSpend = itemList.reduce((sum, i) => sum + i.totalSpend, 0);

    const supplierBreakdown = Array.from(supplierAgg.values())
      .map(s => ({
        ...s,
        percentage: totalSpend > 0 ? (s.totalSpend / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    // Category breakdown
    const categoryAgg = new Map<string, {
      name: string;
      totalSpend: number;
      totalQty: number;
      itemCount: number;
    }>();

    for (const item of itemList) {
      const category = item.category || 'Uncategorized';
      if (!categoryAgg.has(category)) {
        categoryAgg.set(category, {
          name: category,
          totalSpend: 0,
          totalQty: 0,
          itemCount: 0,
        });
      }
      const agg = categoryAgg.get(category)!;
      agg.totalSpend += item.totalSpend;
      agg.totalQty += item.totalQty;
      agg.itemCount += 1;
    }

    const categoryBreakdown = Array.from(categoryAgg.values())
      .map(c => ({
        ...c,
        percentage: totalSpend > 0 ? (c.totalSpend / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    res.json({
      topBySpend,
      topByQuantity,
      supplierBreakdown,
      categoryBreakdown,
      totalSpend,
      totalItems: itemList.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      daysInRange,
    });
  } catch (error) {
    console.error('Error fetching purchasing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
