// PATCH O7 — PARTNER REFERRAL TRACKER
import { db } from "../lib/prisma";

export async function assignPartnerToOrder(partnerCode: string | null, orderId: string) {
  if (!partnerCode) return;

  const prisma = db();
  const partner = await prisma.partner_bars_v1.findUnique({
    where: { code: partnerCode.toUpperCase() }
  });

  if (!partner) return;

  await prisma.orders_v2.update({
    where: { id: orderId },
    data: { partnerId: partner.id }
  });

  // log activity
  await prisma.partner_activity_v1.create({
    data: {
      partnerId: partner.id,
      orderId,
      amount: 0,
      channel: "qr"
    }
  });
}

export async function manualPartnerSelection(partnerId: string, orderId: string) {
  const prisma = db();
  const partner = await prisma.partner_bars_v1.findUnique({
    where: { id: partnerId }
  });
  if (!partner) return;

  await prisma.orders_v2.update({
    where: { id: orderId },
    data: { partnerId: partnerId }
  });

  await prisma.partner_activity_v1.create({
    data: {
      partnerId,
      orderId,
      amount: 0,
      channel: "manual"
    }
  });
}
