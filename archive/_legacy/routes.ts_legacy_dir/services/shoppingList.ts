import { db } from '../lib/prisma';

type ReqItem = { name: string; category: string; unit: string; qty: number; costPerUnit: number };

export async function generateShoppingListFromStock(stockId: string) {
  const stock = await db().dailyStock.findUnique({ where: { id: stockId } });
  if (!stock) return null;

  const req: ReqItem[] = (stock.requisitionJson as any[]) || [];

  const drinksCounts = req
    .filter(r => (r.category || '').toLowerCase() === 'drinks' && Number(r.qty) > 0)
    .map(r => ({ name: r.name, qty: Number(r.qty) }));

  const items = req
    .filter(r => Number(r.qty) > 0)
    .map(r => ({
      name: r.name,
      unit: r.unit,
      qty: Number(r.qty),
      costPerUnit: Number(r.costPerUnit || 0),
      category: r.category
    }));

  const list = await db().shoppingList.create({
    data: {
      salesFormId: stock.salesFormId ?? null,
      stockFormId: stock.id,
      rollsCount: Number(stock.rollsCount || 0),
      meatWeightGrams: Number(stock.meatWeightGrams || 0),
      drinksCounts,
      items,
      totalItems: items.length
    }
  });

  return list;
}