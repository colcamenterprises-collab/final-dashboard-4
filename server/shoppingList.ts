// EXACT implementation from consolidated patch
import { pool } from './db';

export async function getShoppingList(req: any, res: any) {
  try {
    // Get latest sales and stock data
    const latestSalesResult = await pool.query(
      'SELECT * FROM daily_sales_v2 WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1'
    );
    const latestStockResult = await pool.query(
      'SELECT * FROM daily_stock_v2 ORDER BY "createdAt" DESC LIMIT 1'
    );
    
    const latestSales = latestSalesResult.rows[0];
    const latestStock = latestStockResult.rows[0];
    
    if (!latestSales || !latestStock) {
      return res.json({ groupedList: {} });
    }
    
    const salesPayload = latestSales.payload || {};
    const reqItems = (latestStock.requisition || []).filter((i: any) => i.qty > 0);
    
    const grouped: any = {
      Rolls: { qty: salesPayload.rollsEnd || 0, estCost: (salesPayload.rollsEnd || 0) * 8 },
      Meat: { qty: latestStock.meatCount || 0, estCost: 0 },
      Drinks: salesPayload.drinksEnd || []
    };
    
    reqItems.forEach((i: any) => {
      const category = i.category || 'Other';
      const estCost = i.qty * (i.unitPrice || 0);
      if (!grouped[category]) grouped[category] = [];
      if (!Array.isArray(grouped[category])) grouped[category] = [];
      grouped[category].push({ item: i.name || i.id, qty: i.qty, estCost });
    });
    
    res.json({ groupedList: grouped });
  } catch (error) {
    console.error('Shopping list error:', error);
    res.status(500).json({ error: 'Failed to generate shopping list' });
  }
}

export async function generateShoppingListFromStock(stockId: string) {
  try {
    console.log('Shopping list generation triggered for stock:', stockId);
    return { generated: true, items: 0 };
  } catch (error) {
    console.error('Shopping list generation failed:', error);
    return null;
  }
}