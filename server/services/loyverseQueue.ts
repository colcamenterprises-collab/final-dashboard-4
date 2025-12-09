// PATCH O3 — LOYVERSE QUEUE (SAFE MODE)
import { db } from "../lib/prisma";
import { sendToLoyverse } from "./loyversePush";

export async function processLoyverseQueue() {
  const prisma = db();
  const pending = await prisma.orders_v2.findMany({
    where: { loyverseStatus: "pending" },
    include: { items: { include: { modifiers: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const order of pending) {
    try {
      await sendToLoyverse(order);
    } catch (err) {
      // failed orders are left as "failed" until retry cycle
      continue;
    }
  }
}
