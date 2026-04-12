import { Router, Request, Response } from 'express';
import { syncPurchasingShiftItems, getPurchasingShiftMatrix, backfillPurchasingShiftItems } from '../services/purchasingShiftSync';
import { PrismaClient } from '@prisma/client';
import { getStockReconciliation } from './analysis/stockReconciliation';

const router = Router();
const prisma = new PrismaClient();

type FlagStatus = 'normal' | 'high' | 'zero' | 'insufficient';
type Cadence = 'FAST_MOVING' | 'MEDIUM_MOVING' | 'SLOW_MOVING' | 'INSUFFICIENT_HISTORY';

type ShiftLogItem = {
  itemId: number;
  itemName: string;
  category: string | null;
  quantities: Record<string, number>;
  totalQty: number;
  avgQty: number;
  purchaseCount: number;
  avgDaysBetweenOrders: number | null;
  cadenceClass: Cadence;
  baselineQty: number;
  confidence: 'high' | 'medium' | 'low';
};

function parseDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.includes('T') ? value.slice(0, 10) : value;
}

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayDiff(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function classifyCadence(avgDaysBetween: number | null, orderCount: number): Cadence {
  if (!avgDaysBetween || orderCount < 3) return 'INSUFFICIENT_HISTORY';
  if (avgDaysBetween <= 3) return 'FAST_MOVING';
  if (avgDaysBetween <= 10) return 'MEDIUM_MOVING';
  return 'SLOW_MOVING';
}

router.get('/purchasing-shift-matrix', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const matrix = await getPurchasingShiftMatrix(from as string | undefined, to as string | undefined);
    res.json(matrix);
  } catch (err: any) {
    console.error('[purchasing-shift-matrix] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchasing-shift-sync/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    const { purchasingJson } = req.body;

    if (!stockId) {
      return res.status(400).json({ error: 'Stock ID is required' });
    }

    const result = await syncPurchasingShiftItems(stockId, purchasingJson);
    res.json(result);
  } catch (err: any) {
    console.error('[purchasing-shift-sync] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchasing-shift-backfill', async (_req: Request, res: Response) => {
  try {
    const result = await backfillPurchasingShiftItems();
    res.json(result);
  } catch (err: any) {
    console.error('[purchasing-shift-backfill] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const preset = typeof req.query.preset === 'string' ? req.query.preset : '30d';
    const fromQuery = typeof req.query.from === 'string' ? req.query.from : null;
    const toQuery = typeof req.query.to === 'string' ? req.query.to : null;

    const endDate = toQuery && /^\d{4}-\d{2}-\d{2}$/.test(toQuery) ? asDate(toQuery) : new Date();
    const startDate = new Date(endDate);
    if (preset === '7d') startDate.setUTCDate(startDate.getUTCDate() - 6);
    else if (preset === '90d') startDate.setUTCDate(startDate.getUTCDate() - 89);
    else if (preset === 'custom' && fromQuery && /^\d{4}-\d{2}-\d{2}$/.test(fromQuery)) startDate.setTime(asDate(fromQuery).getTime());
    else startDate.setUTCDate(startDate.getUTCDate() - 29);

    const allShiftsRaw = await prisma.dailyStockV2.findMany({
      where: { deletedAt: null },
      select: { id: true, createdAt: true, salesId: true, purchasingJson: true },
      orderBy: { createdAt: 'asc' },
    });

    const salesIds = allShiftsRaw.map(s => s.salesId).filter(Boolean) as string[];
    const salesRows = salesIds.length > 0 ? await prisma.dailySalesV2.findMany({
      where: { id: { in: salesIds } },
      select: { id: true, shiftDate: true },
    }) : [];
    const salesDateMap = new Map<string, string>();
    for (const row of salesRows) salesDateMap.set(row.id, parseDateOnly(row.shiftDate));

    const allShifts = allShiftsRaw.map((s) => {
      const shiftDate = s.salesId ? salesDateMap.get(s.salesId) || parseDateOnly(s.createdAt) : parseDateOnly(s.createdAt);
      return { id: s.id, date: shiftDate, purchasingJson: s.purchasingJson };
    }).filter((s) => !!s.date);

    const allShiftDates = allShifts.map(s => s.date).sort();
    const minDate = allShiftDates[0] || null;
    const maxDate = allShiftDates[allShiftDates.length - 1] || null;

    const startDateIso = parseDateOnly(startDate);
    const endDateIso = parseDateOnly(endDate);

    const rangeShifts = allShifts.filter((s) => s.date >= startDateIso && s.date <= endDateIso);
    const rangeShiftIds = rangeShifts.map(s => s.id);

    const items = await prisma.purchasingItem.findMany({
      where: { active: true },
      select: { id: true, item: true, category: true, unitCost: true },
      orderBy: [{ category: 'asc' }, { item: 'asc' }],
    });

    const itemNameToId = new Map<string, number>();
    for (const item of items) itemNameToId.set(item.item.toLowerCase().trim(), item.id);

    const allShiftItems = await prisma.purchasingShiftItem.findMany({
      where: { dailyStockId: { in: allShifts.map(s => s.id) } },
      select: { dailyStockId: true, purchasingItemId: true, quantity: true },
    });

    const qtyMap = new Map<number, Map<string, number>>();
    for (const row of allShiftItems) {
      if (!qtyMap.has(row.purchasingItemId)) qtyMap.set(row.purchasingItemId, new Map());
      const qty = Number(row.quantity || 0);
      qtyMap.get(row.purchasingItemId)!.set(row.dailyStockId, Number.isFinite(qty) ? qty : 0);
    }

    const shiftsWithRows = new Set(allShiftItems.map(r => r.dailyStockId));
    for (const shift of allShifts) {
      if (shiftsWithRows.has(shift.id) || !shift.purchasingJson || typeof shift.purchasingJson !== 'object') continue;
      const payload = shift.purchasingJson as Record<string, unknown>;
      for (const [name, rawQty] of Object.entries(payload)) {
        const itemId = itemNameToId.get(name.toLowerCase().trim());
        if (!itemId) continue;
        if (!qtyMap.has(itemId)) qtyMap.set(itemId, new Map());
        const parsed = Number(rawQty || 0);
        qtyMap.get(itemId)!.set(shift.id, Number.isFinite(parsed) ? parsed : 0);
      }
    }

    const rangeShiftsSorted = [...rangeShifts].sort((a, b) => a.date.localeCompare(b.date));

    const flagMap: Record<number, Record<string, FlagStatus>> = {};
    const itemStats: Record<number, { cadence: Cadence; avgDaysBetween: number | null; baselineQty: number; confidence: 'high' | 'medium' | 'low' }> = {};

    const responseItems: ShiftLogItem[] = items.map((item) => {
      const allSeries = allShifts.map((shift) => ({
        shiftId: shift.id,
        date: shift.date,
        qty: qtyMap.get(item.id)?.get(shift.id) || 0,
      }));
      const positiveOrders = allSeries.filter(v => v.qty > 0);
      const totalPositiveQty = positiveOrders.reduce((sum, v) => sum + v.qty, 0);
      const baselineQty = positiveOrders.length > 0 ? totalPositiveQty / positiveOrders.length : 0;

      const intervals: number[] = [];
      for (let i = 1; i < positiveOrders.length; i++) {
        intervals.push(dayDiff(asDate(positiveOrders[i - 1].date), asDate(positiveOrders[i].date)));
      }
      const avgDaysBetween = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
      const cadence = classifyCadence(avgDaysBetween, positiveOrders.length);
      const confidence: 'high' | 'medium' | 'low' = positiveOrders.length >= 8 ? 'high' : positiveOrders.length >= 4 ? 'medium' : 'low';

      itemStats[item.id] = { cadence, avgDaysBetween, baselineQty, confidence };

      flagMap[item.id] = {};
      for (const shift of rangeShiftsSorted) {
        const shiftQty = qtyMap.get(item.id)?.get(shift.id) || 0;
        const thisDate = asDate(shift.date);
        const prevPositive = positiveOrders.filter((o) => asDate(o.date).getTime() < thisDate.getTime()).pop();
        const daysSincePrev = prevPositive ? dayDiff(asDate(prevPositive.date), thisDate) : null;

        const insufficient = cadence === 'INSUFFICIENT_HISTORY' || baselineQty <= 0;
        let flag: FlagStatus = 'normal';

        if (insufficient) {
          flag = 'insufficient';
        } else if (shiftQty > baselineQty * 1.5) {
          flag = 'high';
        } else if (shiftQty > 0 && avgDaysBetween && daysSincePrev !== null && daysSincePrev <= Math.max(1, avgDaysBetween * 0.5)) {
          flag = 'high';
        } else if (
          shiftQty === 0
          && (cadence === 'FAST_MOVING' || cadence === 'MEDIUM_MOVING')
          && avgDaysBetween
          && daysSincePrev !== null
          && daysSincePrev > avgDaysBetween * 1.3
        ) {
          flag = 'zero';
        } else if (shiftQty >= baselineQty * 0.7 && shiftQty <= baselineQty * 1.3) {
          flag = 'normal';
        }

        flagMap[item.id][shift.id] = flag;
      }

      const quantities: Record<string, number> = {};
      let totalQty = 0;
      let purchaseCount = 0;

      for (const shift of rangeShiftsSorted) {
        const qty = qtyMap.get(item.id)?.get(shift.id) || 0;
        quantities[shift.id] = qty;
        totalQty += qty;
        if (qty > 0) purchaseCount += 1;
      }

      const avgQty = rangeShiftsSorted.length > 0 ? totalQty / rangeShiftsSorted.length : 0;
      return {
        itemId: item.id,
        itemName: item.item,
        category: item.category,
        quantities,
        totalQty,
        avgQty,
        purchaseCount,
        avgDaysBetweenOrders: avgDaysBetween,
        cadenceClass: cadence,
        baselineQty,
        confidence,
      };
    });

    const totalSpend = responseItems.reduce((sum, row) => {
      const unitCost = Number(items.find(i => i.id === row.itemId)?.unitCost || 0);
      if (!Number.isFinite(unitCost) || unitCost <= 0) return sum;
      return sum + row.totalQty * unitCost;
    }, 0);

    const purchaseEvents = rangeShiftsSorted.filter((shift) =>
      responseItems.some((item) => (item.quantities[shift.id] || 0) > 0)
    ).length;

    const topByQty = [...responseItems]
      .filter(i => i.totalQty > 0)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5)
      .map(i => ({ itemName: i.itemName, value: i.totalQty, basis: 'quantity' as const }));

    const topByFrequency = [...responseItems]
      .filter(i => i.purchaseCount > 0)
      .sort((a, b) => b.purchaseCount - a.purchaseCount)
      .slice(0, 5)
      .map(i => ({ itemName: i.itemName, events: i.purchaseCount }));

    const overdueRegularItems = responseItems
      .filter((item) => {
        const stats = itemStats[item.itemId];
        if (!stats.avgDaysBetween || (stats.cadence !== 'FAST_MOVING' && stats.cadence !== 'MEDIUM_MOVING')) return false;
        const lastOrdered = allShifts.filter(s => (qtyMap.get(item.itemId)?.get(s.id) || 0) > 0).pop();
        if (!lastOrdered) return false;
        return dayDiff(asDate(lastOrdered.date), asDate(endDateIso)) > stats.avgDaysBetween * 1.3;
      })
      .slice(0, 8)
      .map(item => ({ itemName: item.itemName, cadence: item.cadenceClass, avgDaysBetween: item.avgDaysBetweenOrders }));

    const categoryMap = new Map<string, { category: string; quantity: number; purchaseCount: number; spend: number }>();
    for (const item of responseItems) {
      const category = item.category || 'Uncategorized';
      if (!categoryMap.has(category)) categoryMap.set(category, { category, quantity: 0, purchaseCount: 0, spend: 0 });
      const row = categoryMap.get(category)!;
      row.quantity += item.totalQty;
      row.purchaseCount += item.purchaseCount;
      const unitCost = Number(items.find(i => i.id === item.itemId)?.unitCost || 0);
      if (unitCost > 0) row.spend += item.totalQty * unitCost;
    }
    const totalCategoryQty = [...categoryMap.values()].reduce((sum, c) => sum + c.quantity, 0);
    const categoryBreakdown = [...categoryMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .map((c) => ({ ...c, share: totalCategoryQty > 0 ? c.quantity / totalCategoryQty : 0 }));

    const highItems = responseItems.filter(item => Object.values(flagMap[item.itemId] || {}).includes('high')).slice(0, 6);
    const zeroItems = responseItems.filter(item => Object.values(flagMap[item.itemId] || {}).includes('zero')).slice(0, 6);

    const insights: Array<{ type: string; message: string }> = [];
    if (highItems.length > 0) insights.push({ type: 'high-orders', message: `${highItems.length} items were materially above baseline quantity or reordered earlier than normal cadence.` });
    if (zeroItems.length > 0) insights.push({ type: 'missing-regulars', message: `${zeroItems.length} fast/medium-moving items appear overdue with zero orders in the selected range.` });
    if (categoryBreakdown.length > 0 && categoryBreakdown[0].share >= 0.45) insights.push({ type: 'concentration-risk', message: `${categoryBreakdown[0].category} contributes ${(categoryBreakdown[0].share * 100).toFixed(1)}% of ordered quantity, indicating concentration risk.` });
    if (overdueRegularItems.length > 0) insights.push({ type: 'not-recently-purchased', message: `${overdueRegularItems.length} normally used items have not been purchased recently versus expected cadence.` });
    if (insights.length === 0) insights.push({ type: 'stable', message: 'No major purchasing anomalies detected for the selected range.' });

    const reconciliationRaw = await getStockReconciliation();
    const reconciliationRows = reconciliationRaw.filter((row) => row.shift_date >= startDateIso && row.shift_date <= endDateIso);

    const purchaseRows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      date: string;
      staff: string | null;
      supplier: string | null;
      amount_thb: number | null;
      notes: string | null;
      rolls_pcs: number | null;
      meat_grams: number | null;
    }>>(
      `SELECT id, date::text AS date, staff, supplier, amount_thb, notes, rolls_pcs, meat_grams
       FROM purchase_tally
       WHERE date >= $1::date AND date <= $2::date
       ORDER BY date DESC, created_at DESC
       LIMIT 365`,
      startDateIso,
      endDateIso,
    );

    const drinkRows = await prisma.$queryRawUnsafe<Array<{
      tally_id: string;
      date: string;
      staff: string | null;
      supplier: string | null;
      amount_thb: number | null;
      item_name: string;
      qty: number;
      unit: string;
    }>>(
      `SELECT ptd.tally_id, pt.date::text AS date, pt.staff, pt.supplier, pt.amount_thb,
              ptd.item_name, ptd.qty, ptd.unit
       FROM purchase_tally_drink ptd
       JOIN purchase_tally pt ON pt.id = ptd.tally_id
       WHERE pt.date >= $1::date AND pt.date <= $2::date
       ORDER BY pt.date DESC, pt.created_at DESC
       LIMIT 1000`,
      startDateIso,
      endDateIso,
    );

    // Augment categoryBreakdown with purchase_tally rolls/meat and purchase_tally_drink data
    const augMap = new Map<string, { category: string; quantity: number; purchaseCount: number; spend: number }>(
      categoryBreakdown.map(c => [c.category, { category: c.category, quantity: c.quantity, purchaseCount: c.purchaseCount, spend: c.spend }])
    );

    // Meat: from purchase_tally rows where meat_grams > 0
    const meatTallyRows = purchaseRows.filter(r => Number(r.meat_grams || 0) > 0);
    if (meatTallyRows.length > 0) {
      const m = augMap.get('Meat') || { category: 'Meat', quantity: 0, purchaseCount: 0, spend: 0 };
      // qty in kg for readability
      m.quantity += meatTallyRows.reduce((s, r) => s + Number(r.meat_grams || 0) / 1000, 0);
      m.purchaseCount += meatTallyRows.length;
      m.spend += meatTallyRows.reduce((s, r) => s + Number(r.amount_thb || 0), 0);
      augMap.set('Meat', m);
    }

    // Rolls (Fresh Food): from purchase_tally rows where rolls_pcs > 0
    const rollsTallyRows = purchaseRows.filter(r => Number(r.rolls_pcs || 0) > 0);
    if (rollsTallyRows.length > 0) {
      const ff = augMap.get('Fresh Food') || { category: 'Fresh Food', quantity: 0, purchaseCount: 0, spend: 0 };
      ff.quantity += rollsTallyRows.reduce((s, r) => s + Number(r.rolls_pcs || 0), 0);
      ff.purchaseCount += rollsTallyRows.length;
      ff.spend += rollsTallyRows.reduce((s, r) => s + Number(r.amount_thb || 0), 0);
      augMap.set('Fresh Food', ff);
    }

    // Drinks: from purchase_tally_drink (group by distinct tally_id for purchase events)
    if (drinkRows.length > 0) {
      const dk = augMap.get('Drinks') || { category: 'Drinks', quantity: 0, purchaseCount: 0, spend: 0 };
      dk.quantity += drinkRows.reduce((s, r) => s + Number(r.qty || 0), 0);
      const distinctDrinkTallyIds = [...new Set(drinkRows.map(r => r.tally_id))];
      dk.purchaseCount += distinctDrinkTallyIds.length;
      dk.spend += distinctDrinkTallyIds.reduce((s, tid) => {
        const row = drinkRows.find(r => r.tally_id === tid);
        return s + Number(row?.amount_thb || 0);
      }, 0);
      augMap.set('Drinks', dk);
    }

    const totalCatQtyFinal = [...augMap.values()].reduce((sum, c) => sum + c.quantity, 0);
    const categoryBreakdownFinal = [...augMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .map(c => ({ ...c, share: totalCatQtyFinal > 0 ? c.quantity / totalCatQtyFinal : 0 }));

    res.json({
      items: responseItems,
      shifts: rangeShiftsSorted.map(s => ({ id: s.id, date: s.date })),
      dateRange: { start: startDateIso, end: endDateIso, preset },
      availableHistory: { minDate, maxDate, hasOlderThan30: !!(minDate && minDate < parseDateOnly(new Date(Date.now() - 29 * 86400000))) },
      flagsByItemByShift: flagMap,
      summary: {
        totalSpend,
        purchaseEvents,
        averageSpendPerEvent: purchaseEvents > 0 ? totalSpend / purchaseEvents : 0,
        topPurchasedItems: topByQty,
        mostFrequentItems: topByFrequency,
        itemsNotRecentlyPurchasedButNormallyUsed: overdueRegularItems,
      },
      categoryBreakdown: categoryBreakdownFinal,
      actionInsights: insights,
      stockReconciliation: reconciliationRows,
      stockReviewPurchases: purchaseRows,
      drinksPurchases: drinkRows,
    });
  } catch (error) {
    console.error('Error fetching shift log:', error);
    res.status(500).json({ error: 'Failed to fetch shift log' });
  }
});

export default router;
