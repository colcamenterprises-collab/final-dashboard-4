// server/services/kdsService.ts
// PATCH O9 — KITCHEN DISPLAY SYSTEM SERVICE
import { db } from "../lib/prisma";

export async function getActiveKDSOrders() {
  return await db().orders_v2.findMany({
    where: {
      kdsStatus: { not: "completed" }
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: { modifiers: true }
      }
    }
  });
}

export async function updateKDSStatus(orderId: string, status: string) {
  return await db().orders_v2.update({
    where: { id: orderId },
    data: { kdsStatus: status }
  });
}

export async function getKDSHistory() {
  return await db().orders_v2.findMany({
    where: { kdsStatus: "completed" },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function autoCompleteOldOrders() {
  return await db().orders_v2.updateMany({
    where: {
      kdsStatus: "delivered",
      createdAt: {
        lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
      }
    },
    data: { kdsStatus: "completed" }
  });
}
