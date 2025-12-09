// PATCH O5 — SCB PAYMENT MATCHER
import { db } from "../lib/prisma";

export async function matchSCBPayment(ref: string, amount: number) {
  const prisma = db();
  
  // find order by reference code (5-digit order number)
  const order = await prisma.orders_v2.findFirst({
    where: { orderNumber: ref },
  });

  if (!order) {
    console.log("No order found for SCB ref:", ref);
    return null;
  }

  // tolerance ±2 THB (recommended by SCB)
  const diff = Math.abs(order.total - amount);
  if (diff > 2) {
    console.log("Amount mismatch for order", order.orderNumber);
    return null;
  }

  // mark order as PAID
  await prisma.orders_v2.update({
    where: { id: order.id },
    data: { paidStatus: "paid" },
  });

  console.log("Order marked PAID via SCB:", order.orderNumber);
  return order;
}
