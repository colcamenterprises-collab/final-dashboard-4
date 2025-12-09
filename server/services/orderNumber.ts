// PATCH O3 — SEQUENTIAL ORDER NUMBER GENERATOR
import { db } from "../lib/prisma";

export async function getNextOrderNumber() {
  const prisma = db();
  const key = "online_order_number";
  let counter = await prisma.order_counters.findUnique({ where: { key } });

  if (!counter) {
    counter = await prisma.order_counters.create({
      data: { key, value: 1 },
    });
  } else {
    counter = await prisma.order_counters.update({
      where: { key },
      data: { value: counter.value + 1 },
    });
  }

  return counter.value.toString().padStart(5, "0");
}
