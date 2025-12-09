// PATCH O8 — DELIVERY SERVICE CORE
import { db } from "../lib/prisma";

export async function createDelivery(orderId: string, payload: any) {
  const { address, lat, lng, deliveryType, fee } = payload;

  return db().deliveries_v1.create({
    data: {
      orderId,
      address: address || null,
      lat: lat || null,
      lng: lng || null,
      deliveryType: deliveryType || "delivery",
      fee: fee || 0
    }
  });
}

export async function assignDriver(deliveryId: string, driverId: string) {
  return db().deliveries_v1.update({
    where: { id: deliveryId },
    data: {
      driverId,
      status: "assigned",
      assignedAt: new Date()
    }
  });
}

export async function updateDeliveryStatus(deliveryId: string, status: string) {
  const timestamps: any = {};

  if (status === "picked_up") timestamps.pickedUpAt = new Date();
  if (status === "delivered") timestamps.deliveredAt = new Date();

  return db().deliveries_v1.update({
    where: { id: deliveryId },
    data: {
      status,
      ...timestamps
    }
  });
}

export async function getActiveDeliveries() {
  return db().deliveries_v1.findMany({
    where: {
      NOT: { status: "delivered" }
    },
    include: {
      driver: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDeliveryHistory() {
  return db().deliveries_v1.findMany({
    where: { status: "delivered" },
    include: { driver: true },
    orderBy: { deliveredAt: "desc" }
  });
}
