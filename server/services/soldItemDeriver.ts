import { prisma } from "../../lib/prisma";

async function resolveRecipeIdFromSku(
  sku: string | null,
  channel: string
): Promise<string | null> {
  if (!sku) return null;

  // PATCH: Use recipe_sku_map table for direct SKU → recipe mapping
  const skuMap = await prisma.recipeSkuMap.findFirst({
    where: {
      channel,
      channelSku: sku,
      active: true
    }
  });

  if (skuMap) {
    return skuMap.recipeId.toString();
  }

  // Fallback: Legacy external_sku_map → recipe_v2 mapping
  const legacyMap = await prisma.externalSkuMap.findFirst({
    where: {
      channel,
      channelSku: sku
    }
  });

  if (!legacyMap) return null;

  const recipe = await prisma.recipeV2.findFirst({
    where: {
      name: legacyMap.internalId
    }
  });

  return recipe?.id ?? null;
}

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
            recipeId: await resolveRecipeIdFromSku(item.sku, item.receipt.provider),
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
