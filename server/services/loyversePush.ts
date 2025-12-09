// PATCH O3 — LOYVERSE SALE PUSH SERVICE
import { db } from "../lib/prisma";
import axios from "axios";

const LOYVERSE_API = "https://api.loyverse.com/v1.0/receipts";
const LOYVERSE_TOKEN = process.env.LOYVERSE_API_KEY;

export async function buildLoyversePayload(order: any) {
  const prisma = db();
  // fetch mapping
  const mappings = await prisma.loyverse_map_v2.findMany();

  const items = order.items.map((item: any) => {
    const map = mappings.find((m) => m.menuItemId === item.itemId);

    const loyItemId = map?.loyverseItemId;
    if (!loyItemId) {
      console.error("NO MAPPING FOUND FOR:", item.itemName);
    }

    return {
      item_id: loyItemId,
      quantity: item.qty,
      price: item.basePrice,
      modifiers: item.modifiers.map((mod: any) => {
        const modMap = mappings.find((m) => m.modifierName === mod.name);
        return {
          modifier_id: modMap?.loyverseModifierId || null,
          name: mod.name,
          price: mod.price,
        };
      }),
    };
  });

  return {
    ticket_number: order.orderNumber,
    total_money: order.total,
    payments: [
      {
        type: "CARD", // QR treated as paid
        amount: order.total,
      },
    ],
    line_items: items,
    notes: `Online Order – ${order.orderType} | Partner: ${order.partnerCode || "None"}`,
    print_receipt: true,
  };
}

export async function sendToLoyverse(order: any) {
  const prisma = db();
  try {
    const payload = await buildLoyversePayload(order);

    const res = await axios.post(LOYVERSE_API, payload, {
      headers: {
        Authorization: `Bearer ${LOYVERSE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    await prisma.orders_v2.update({
      where: { id: order.id },
      data: { loyverseStatus: "sent" },
    });

    return res.data;
  } catch (err: any) {
    console.error("LOYVERSE PUSH ERROR:", err.response?.data || err);
    await prisma.orders_v2.update({
      where: { id: order.id },
      data: { loyverseStatus: "failed" },
    });
    throw err;
  }
}
