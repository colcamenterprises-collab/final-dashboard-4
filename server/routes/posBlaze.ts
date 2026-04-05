import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "../lib/prisma";

const router = express.Router();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type PosEventPayload = {
  type: "order_created" | "grab_eta_updated";
  orderId: string;
  timestamp: string;
  payload: unknown;
};

const sseClients = new Set<express.Response>();

function publishEvent(event: PosEventPayload) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

function emitSocketIfAvailable(req: express.Request, event: string, payload: unknown) {
  const io = req.app.get("io");
  if (io && typeof io.emit === "function") {
    io.emit(event, payload);
  }
}

const orderSchema = z.object({
  tableLabel: z.string().trim().max(60).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  wantsUpsell: z.boolean().optional(),
  items: z.array(
    z.object({
      itemId: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1),
      qty: z.number().int().min(1).max(99),
      price: z.number().min(0),
      modifiers: z.array(
        z.object({
          name: z.string().trim().min(1),
          price: z.number().min(0),
        })
      ).optional(),
    })
  ).min(1),
});

async function generateUpsell(items: Array<{ name: string }>) {
  if (!openai) return null;
  const names = items.map((i) => i.name).join(", ");
  const prompt = `Suggest one short upsell line for this POS cart: ${names}`;
  const request = openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
  const response = await Promise.race([request as Promise<any>, timeout]);
  if (!response || typeof response !== "object") return null;
  return typeof response.output_text === "string" ? response.output_text.trim() : null;
}

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

router.post("/order", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "INVALID_PAYLOAD", details: parsed.error.flatten() });
  }

  const input = parsed.data;
  const total = Number(
    input.items
      .reduce((sum, item) => {
        const mods = (item.modifiers || []).reduce((mSum, mod) => mSum + mod.price, 0);
        return sum + (item.price + mods) * item.qty;
      }, 0)
      .toFixed(2)
  );

  try {
    const prisma = db();
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.orders_v2.create({
        data: {
          customerName: "Walk-in",
          customerPhone: "N/A",
          orderType: "instore",
          paymentType: input.paymentMethod || "cash",
          subtotal: total,
          total,
          notes: input.tableLabel ? `tableLabel:${input.tableLabel}` : undefined,
          loyverseStatus: input.source || "pos",
          kdsStatus: "new",
        },
      });

      for (const item of input.items) {
        const orderItem = await tx.order_items_v2.create({
          data: {
            orderId: order.id,
            itemId: item.itemId || item.name,
            itemName: item.name,
            qty: item.qty,
            basePrice: item.price,
          },
        });

        for (const mod of item.modifiers || []) {
          await tx.order_modifiers_v2.create({
            data: {
              orderItemId: orderItem.id,
              name: mod.name,
              price: mod.price,
            },
          });
        }
      }

      await tx.kDSQueue.create({
        data: {
          orderId: order.id,
          status: "new",
        },
      });

      return tx.orders_v2.findUnique({
        where: { id: order.id },
        include: { items: { include: { modifiers: true } } },
      });
    });

    const eventPayload = { order: created };
    emitSocketIfAvailable(req, "pos:order-created", eventPayload);
    publishEvent({ type: "order_created", orderId: created!.id, timestamp: new Date().toISOString(), payload: eventPayload });

    let upsell: string | null = null;
    if (input.wantsUpsell) {
      try {
        upsell = await generateUpsell(input.items.map((i) => ({ name: i.name })));
      } catch (e) {
        console.warn("[pos] optional upsell failed", (e as Error).message);
      }
    }

    return res.status(201).json({ ok: true, order: created, upsell });
  } catch (error) {
    console.error("[pos/order]", error);
    return res.status(500).json({ ok: false, error: "ORDER_CREATE_FAILED" });
  }
});

router.get("/order/:id", async (req, res) => {
  try {
    const prisma = db();
    const order = await prisma.orders_v2.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { modifiers: true } } },
    });
    if (!order) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, order });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "ORDER_FETCH_FAILED" });
  }
});

router.get("/receipt/:id", async (req, res) => {
  try {
    const prisma = db();
    const order = await prisma.orders_v2.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { modifiers: true } } },
    });
    if (!order) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const tableLabel = order.notes?.startsWith("tableLabel:") ? order.notes.replace("tableLabel:", "") : null;
    const lines = order.items.map((item) => {
      const mods = item.modifiers.map((m) => ` + ${m.name} (${m.price.toFixed(2)})`).join("<br/>");
      const lineTotal = (item.basePrice + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.qty;
      return `<tr><td>${item.itemName}${mods ? `<br/><small>${mods}</small>` : ""}</td><td>${item.qty}</td><td>${lineTotal.toFixed(2)}</td></tr>`;
    }).join("");

    const receiptHtml = `<!doctype html><html><body><h2>BlazePOS Receipt</h2><p>Order ID: ${order.id}<br/>Receipt #: ${order.orderNumber || order.id.slice(0, 8)}<br/>Table: ${tableLabel || "-"}<br/>Created: ${order.createdAt.toISOString()}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${lines}</tbody></table><h3>Total: ${order.total.toFixed(2)}</h3></body></html>`;

    return res.json({
      ok: true,
      receipt: {
        orderId: order.id,
        receiptNumber: order.orderNumber || order.id.slice(0, 8),
        tableLabel,
        total: order.total,
        createdAt: order.createdAt,
        html: receiptHtml,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "RECEIPT_FAILED" });
  }
});

const grabEtaSchema = z.object({
  orderId: z.string().min(1),
  etaMinutes: z.number().int().min(1).max(240),
  signature: z.string().optional(),
});

router.post("/grab/eta", async (req, res) => {
  const parsed = grabEtaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "INVALID_PAYLOAD" });
  }

  const expectedToken = process.env.POS_GRAB_WEBHOOK_TOKEN;
  const authToken = req.header("x-pos-webhook-token") || parsed.data.signature;
  if (expectedToken && authToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const prisma = db();
    const etaAt = new Date(Date.now() + parsed.data.etaMinutes * 60_000);
    const event = await prisma.kDSQueue.create({
      data: {
        orderId: parsed.data.orderId,
        status: `grab_eta:${parsed.data.etaMinutes}`,
      },
    });

    const payload = { orderId: parsed.data.orderId, etaMinutes: parsed.data.etaMinutes, etaAt };
    emitSocketIfAvailable(req, "pos:grab-eta", payload);
    publishEvent({ type: "grab_eta_updated", orderId: parsed.data.orderId, timestamp: new Date().toISOString(), payload });

    return res.json({ ok: true, eventId: event.id, etaAt });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "GRAB_ETA_FAILED" });
  }
});

export default router;
