import { PrismaClient, SkuKind } from "@prisma/client";

const prisma = new PrismaClient();

export type ResolveResult =
  | { found: true; kind: SkuKind; internalId: string; meta?: any }
  | { found: false };

export async function resolveSku(channel: string, sku: string, kind: SkuKind): Promise<ResolveResult> {
  const m = await prisma.externalSkuMap.findUnique({
    where: { channel_channelSku_kind: { channel, channelSku: sku, kind } },
  });
  if (!m || !m.active) return { found: false };
  return { found: true, kind: m.kind, internalId: m.internalId, meta: m.meta ?? undefined };
}

export async function logMissingSku(opts: {
  channel: string;
  kind: SkuKind;
  sku: string;
  samplePayload?: any;
  lastOrderRef?: string;
}) {
  const { channel, kind, sku, samplePayload, lastOrderRef } = opts;
  try {
    await prisma.missingSkuEvent.upsert({
      where: { channel_kind_sku: { channel, kind, sku } },
      update: {
        count: { increment: 1 },
        samplePayload: samplePayload ?? undefined,
        lastOrderRef: lastOrderRef ?? undefined,
      },
      create: {
        channel,
        kind,
        sku,
        samplePayload: samplePayload ?? undefined,
        lastOrderRef: lastOrderRef ?? undefined,
      },
    });
  } catch (e) {
    console.error("[logMissingSku] upsert failed", e);
  }
}
