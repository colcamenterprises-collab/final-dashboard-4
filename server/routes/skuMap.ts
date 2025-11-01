import { Router } from "express";
import { z } from "zod";
import { PrismaClient, SkuKind } from "@prisma/client";
import { requireAdmin } from "../middleware/requireAdmin";
import { resolveSku } from "../services/skuMap";

const prisma = new PrismaClient();
export const skuMapRouter = Router();

const Mapping = z.object({
  channel: z.enum(["grab", "pos"]),
  channelSku: z.string().min(1),
  kind: z.nativeEnum(SkuKind),
  internalId: z.string().min(1),
  active: z.boolean().optional().default(true),
  meta: z.any().optional(),
});

const ListQuery = z.object({
  channel: z.enum(["grab", "pos"]).optional(),
  kind: z.nativeEnum(SkuKind).optional(),
  q: z.string().optional(),
});

skuMapRouter.get("/sku-map", requireAdmin, async (req, res) => {
  const { channel, kind, q } = ListQuery.parse(req.query);
  const where: any = {};
  if (channel) where.channel = channel;
  if (kind) where.kind = kind;
  if (q) {
    where.OR = [
      { channelSku: { contains: q, mode: "insensitive" } },
      { internalId: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.externalSkuMap.findMany({ where, orderBy: { updatedAt: "desc" } });
  res.json(rows);
});

skuMapRouter.post("/sku-map/upsert", requireAdmin, async (req, res) => {
  const body = z.array(Mapping).parse(req.body);
  const ops = body.map((m) =>
    prisma.externalSkuMap.upsert({
      where: { channel_channelSku_kind: { channel: m.channel, channelSku: m.channelSku, kind: m.kind } },
      update: { internalId: m.internalId, active: m.active, meta: m.meta },
      create: { ...m },
    })
  );
  const results = await prisma.$transaction(ops);
  res.json({ ok: true, count: results.length });
});

const ResolveQuery = z.object({
  channel: z.enum(["grab", "pos"]),
  sku: z.string().min(1),
  kind: z.nativeEnum(SkuKind),
});

skuMapRouter.get("/sku-map/resolve", async (req, res) => {
  const { channel, sku, kind } = ResolveQuery.parse(req.query);
  const r = await resolveSku(channel, sku, kind);
  res.json(r);
});

// --- CSV Export ---
skuMapRouter.get("/sku-map/export.csv", requireAdmin, async (_req, res) => {
  const rows = await prisma.externalSkuMap.findMany({ orderBy: { channel: "asc" } });
  const header = "channel,kind,channelSku,internalId,active\n";
  const lines = rows.map((r) =>
    [r.channel, r.kind, r.channelSku, r.internalId, r.active ? "true" : "false"]
      .map((v) => String(v).replace(/"/g, '""'))
      .map((v) => (v.includes(",") ? `"${v}"` : v))
      .join(",")
  );
  res.setHeader("Content-Type", "text/csv");
  res.send(header + lines.join("\n"));
});

// --- CSV Import (simple CSV: no embedded commas/quotes) ---
skuMapRouter.post("/sku-map/import.csv", requireAdmin, async (req, res) => {
  if (typeof req.body !== "string") return res.status(400).json({ error: "Expect text/csv body" });
  const lines = req.body.split(/\r?\n/).filter(Boolean);
  const [maybeHeader, ...data] = lines;
  const hasHeader = /^channel,/.test(maybeHeader.toLowerCase());
  const rows = (hasHeader ? data : lines).map((ln) => ln.split(","));
  const parsed = rows.map((arr) => ({
    channel: (arr[0] || "").trim() as "grab" | "pos",
    kind: (arr[1] || "").trim().toUpperCase() as keyof typeof SkuKind,
    channelSku: (arr[2] || "").trim(),
    internalId: (arr[3] || "").trim(),
    active: String(arr[4] || "true").trim().toLowerCase() !== "false",
  }));
  // validate
  const valid = parsed
    .filter((r) => (r.channel === "grab" || r.channel === "pos") && r.channelSku && r.internalId && SkuKind[r.kind]);

  const tx = valid.map((m) =>
    prisma.externalSkuMap.upsert({
      where: { channel_channelSku_kind: { channel: m.channel, channelSku: m.channelSku, kind: SkuKind[m.kind] } },
      update: { internalId: m.internalId, active: m.active },
      create: { channel: m.channel, channelSku: m.channelSku, kind: SkuKind[m.kind], internalId: m.internalId, active: m.active },
    })
  );
  const results = await prisma.$transaction(tx);
  res.json({ ok: true, imported: results.length, skipped: parsed.length - valid.length });
});

// --- Missing SKU events (admin listing) ---
skuMapRouter.get("/sku-map/missing", requireAdmin, async (_req, res) => {
  const rows = await prisma.missingSkuEvent.findMany({ orderBy: { lastSeenAt: "desc" }, take: 200 });
  res.json(rows);
});

export default skuMapRouter;
