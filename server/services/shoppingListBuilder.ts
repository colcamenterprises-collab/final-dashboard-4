// PATCH 1 — Shopping List Pipeline
// STRICT: DO NOT modify other files or structures without explicit instruction.

import { db } from "../lib/prisma";

/**
 * Build the shopping list strictly from:
 * - Daily Stock V2 requisition fields
 * - (Optional, safe) Daily Sales V2 added shopping items
 */
export async function buildShoppingList(salesId: string) {
  const prisma = db();

  // Load Daily Stock V2 (Form 2)
  const stock = await prisma.dailyStockV2.findUnique({
    where: { salesId },
  });

  if (!stock) {
    console.log("No DailyStockV2 found — skipping shopping list build.");
    return null;
  }

  // Extract requisition (items requested by staff)
  const requisition = stock.requisition_items || [];

  // Load Daily Sales V2 (safe optional inclusion ONLY of shoppingFields)
  const sales = await prisma.dailySalesV2.findUnique({
    where: { id: salesId },
  });

  const salesShopping =
    sales?.shopping_items?.filter((x: any) => x?.item?.trim()) || [];

  // Combine & normalize
  const combined = [...requisition, ...salesShopping].map((item: any) => ({
    item: item.item,
    quantity: Number(item.quantity || 1),
    notes: item.notes || "",
  }));

  // Save to DB (overwrite existing for this shift)
  const result = await prisma.shoppingListV2.upsert({
    where: { salesId },
    update: { items: combined },
    create: { salesId, items: combined },
  });

  console.log("Shopping List saved:", result);
  return result;
}
