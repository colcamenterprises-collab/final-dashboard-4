import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getLegacyMenuFromOnlineProducts, getOnlineProductsFlat, getOnlineProductsGrouped } from "../services/onlineProductFeed";

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_STATUSES = ["NEW", "PREPARING", "READY"] as const;

const generateOrderRef = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

const parseTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

router.get("/online/products", async (_req, res) => {
  try {
    const categories = await getOnlineProductsGrouped();
    res.json({ categories });
  } catch (error) {
    console.error("Error fetching online products:", error);
    res.status(500).json({ error: "Failed to fetch online products" });
  }
});

router.post("/online/orders", async (req, res) => {
  try {
    const { items, channel, timestamp } = req.body || {};

    if (channel !== "ONLINE") {
      return res.status(400).json({ error: "Channel must be ONLINE" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    if (!timestamp || typeof timestamp !== "string") {
      return res.status(400).json({ error: "timestamp is required" });
    }

    const parsedTimestamp = parseTimestamp(timestamp);
    if (!parsedTimestamp) {
      return res.status(400).json({ error: "timestamp must be a valid ISO string" });
    }

    const onlineProducts = await getOnlineProductsFlat();
    const productMap = new Map<number, (typeof onlineProducts)[number]>();
    for (const product of onlineProducts) {
      productMap.set(product.id, product);
    }

    const errors: Array<{ productId: number; error: string }> = [];
    const lineItems: Array<{
      itemId: string;
      name: string;
      qty: number;
      basePrice: number;
      lineTotal: number;
    }> = [];

    for (const item of items) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);
      const priceAtTime = Number(item?.priceAtTimeOfSale);

      if (!Number.isInteger(productId)) {
        errors.push({ productId, error: "Invalid productId" });
        continue;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors.push({ productId, error: "Invalid quantity" });
        continue;
      }

      const product = productMap.get(productId);
      if (!product) {
        errors.push({ productId, error: "Product not available online" });
        continue;
      }

      if (!Number.isFinite(product.priceOnline)) {
        errors.push({ productId, error: "Online price is invalid" });
        continue;
      }

      if (!Number.isFinite(priceAtTime) || priceAtTime !== product.priceOnline) {
        errors.push({ productId, error: "Price mismatch. Refresh menu before checkout." });
        continue;
      }

      const lineTotal = product.priceOnline * quantity;
      lineItems.push({
        itemId: String(product.id),
        name: product.name,
        qty: quantity,
        basePrice: product.priceOnline,
        lineTotal,
      });
    }

    if (errors.length > 0) {
      return res.status(409).json({ error: "Order blocked due to product changes", details: errors });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    if (!Number.isFinite(subtotal)) {
      return res.status(400).json({ error: "Subtotal is invalid" });
    }

    const order = await prisma.orderOnline.create({
      data: {
        ref: generateOrderRef(),
        status: "NEW",
        subtotal,
        vatAmount: 0,
        total: subtotal,
        rawPayload: {
          channel,
          timestamp,
          items,
        },
        lines: {
          create: lineItems,
        },
      },
      include: {
        lines: true,
      },
    });

    res.status(201).json({
      orderId: order.id,
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Error creating online order:", error);
    res.status(500).json({ error: "Failed to submit order" });
  }
});

router.get("/online/orders", async (_req, res) => {
  try {
    const orders = await prisma.orderOnline.findMany({
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });

    res.json({
      orders: orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        status: order.status ?? "NEW",
        channel: "ONLINE",
        items: order.lines.map((line) => ({
          productId: line.itemId,
          name: line.name,
          quantity: line.qty ?? 1,
          priceAtTimeOfSale: line.basePrice,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching online orders:", error);
    res.status(500).json({ error: "Failed to fetch online orders" });
  }
});

router.patch("/online/orders/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "").toUpperCase();
    if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await prisma.orderOnline.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({
      id: order.id,
      status: order.status,
    });
  } catch (error) {
    console.error("Error updating online order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

router.get("/ordering/menu", async (_req, res) => {
  try {
    const menu = await getLegacyMenuFromOnlineProducts();
    res.json({ deprecated: true, ...menu });
  } catch (error) {
    console.error("Error fetching ordering menu (deprecated):", error);
    res.status(500).json({ error: "Menu not found" });
  }
});

// Deprecated: legacy file-backed order endpoint. Use /api/online/orders instead.
router.post("/ordering/orders", (_req, res) => {
  res.status(410).json({ error: "Deprecated. Submit orders via /api/online/orders." });
});

// Deprecated: legacy file-backed order endpoint. Use /api/online/orders instead.
router.get("/ordering/orders", (_req, res) => {
  res.status(410).json({ error: "Deprecated. Fetch orders via /api/online/orders." });
});

export default router;
