import { prisma } from "../../lib/prisma";

function deriveShiftId(date: Date): string | null {
  const bkk = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const hour = bkk.getHours();
  if (hour >= 3 && hour < 17) return null;
  const dateStr = bkk.toISOString().slice(0, 10).replace(/-/g, "");
  return `SHIFT_${dateStr}`;
}

export async function deriveAllSoldItems() {
  const receiptItems = await prisma.receiptItem.findMany({
    include: { receipt: true }
  });

  const grouped: Record<string, typeof receiptItems> = {};

  for (const item of receiptItems) {
    const shiftId = deriveShiftId(item.receipt.createdAtUTC);
    if (!shiftId) continue;
    grouped[shiftId] ??= [];
    grouped[shiftId].push(item);
  }

  let totalCreated = 0;

  for (const shiftId of Object.keys(grouped)) {
    await prisma.soldItem.deleteMany({ where: { shiftId } });

    for (const item of grouped[shiftId]) {
      for (let i = 0; i < item.qty; i++) {
        const sold = await prisma.soldItem.create({
          data: {
            receiptId: item.receiptId,
            receiptItemId: item.id,
            soldAt: item.receipt.createdAtUTC,
            shiftId,
            channel: item.receipt.provider,
            externalSku: item.sku,
            internalItemId: null,
            recipeId: null,
            unitPrice: item.unitPrice,
            quantity: 1,
            grossAmount: item.unitPrice,
            discountAmount: 0,
            netAmount: item.unitPrice
          }
        });

        const modifiers = item.modifiers as Array<{ name: string; priceDelta?: number }> | null;
        if (modifiers && Array.isArray(modifiers)) {
          for (const mod of modifiers) {
            await prisma.soldItemModifier.create({
              data: {
                soldItemId: sold.id,
                name: mod.name,
                priceDelta: mod.priceDelta ?? 0
              }
            });
          }
        }
        totalCreated++;
      }
    }
  }

  return { shiftsProcessed: Object.keys(grouped).length, itemsCreated: totalCreated };
}
