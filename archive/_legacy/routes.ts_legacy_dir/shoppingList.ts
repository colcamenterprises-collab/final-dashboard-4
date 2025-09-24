import { db } from './lib/prisma';

export async function generateShoppingListFromStock(stockId: string) {
  try {
    const stock = await db().dailyStock.findUnique({ where: { id: stockId } });
    if (!stock) return;

    const req = (stock.requisitionJson as any[]).filter(r => Number(r.qty) > 0);
    
    // Save or update a ShoppingList table entry here, e.g.:
    // await db().shoppingList.upsert({ ... })
    
    console.log('Shopping list generation triggered for stock:', stockId);
    console.log('Requisition items:', req.length);
    
    // TODO: Implement actual shopping list generation logic
    return { generated: true, items: req.length };
  } catch (error) {
    console.error('Shopping list generation failed:', error);
    return null;
  }
}