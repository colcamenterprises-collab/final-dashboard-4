// PATCH O8 — DRIVER MANAGEMENT
import { db } from "../lib/prisma";

export async function addDriver(name: string, phone?: string) {
  return db().drivers_v1.create({
    data: { name, phone }
  });
}

export async function getDrivers() {
  return db().drivers_v1.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function setDriverStatus(driverId: string, active: boolean) {
  return db().drivers_v1.update({
    where: { id: driverId },
    data: { active }
  });
}
