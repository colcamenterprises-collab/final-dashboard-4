// PATCH O12 — REAL-TIME STOCK & INGREDIENT DEDUCTION ENGINE
import { db } from "../lib/prisma";

interface OrderItem {
  menuItemId: string;
  qty: number;
}

interface Order {
  id: string;
  source: string;
  items?: OrderItem[];
}

export const StockEngine = {
  async deductFromOrder(order: Order) {
    if (!order?.items) return;

    const prisma = db();

    for (const item of order.items) {
      const recipes = await prisma.recipe_portions_v1.findMany({
        where: { menuItemId: item.menuItemId }
      });

      for (const r of recipes) {
        const totalUse = r.qty * item.qty;

        await prisma.stock_ledger_v1.create({
          data: {
            itemId: r.ingredientId,
            itemName: r.ingredientName,
            change: -totalUse,
            reason: "order",
            source: order.source,
            orderId: order.id
          }
        });

        const live = await prisma.stock_item_live_v1.findFirst({
          where: { name: r.ingredientName }
        });

        if (!live) {
          await prisma.stock_item_live_v1.create({
            data: {
              name: r.ingredientName,
              unit: r.unit,
              qty: Math.max(0, -totalUse)
            }
          });
        } else {
          await prisma.stock_item_live_v1.update({
            where: { id: live.id },
            data: {
              qty: live.qty - totalUse,
              updatedAt: new Date()
            }
          });
        }
      }
    }
  }
};
