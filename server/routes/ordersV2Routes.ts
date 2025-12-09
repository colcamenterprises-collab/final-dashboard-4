// PATCH O2 — ORDER SUBMISSION & CHECKOUT
// PATCH O3 — ORDER NUMBERS + LOYVERSE INTEGRATION
// PATCH O4 — DELIVERY TIME ENGINE
// PATCH O7 — HYBRID REFERRAL DETECTION
import { Router } from "express";
import { db } from "../lib/prisma";
import { calculateDistanceKm } from "../utils/distance.js";
import { getNextOrderNumber } from "../services/orderNumber.js";
import { estimateTimes } from "../services/deliveryTime.js";
import { assignPartnerToOrder, manualPartnerSelection } from "../services/partnerTracker.js";

const router = Router();

// Restaurant location (Rawai)
const REST_LAT = 7.7787;
const REST_LNG = 98.3282;
const DELIVERY_MAX_KM = 6.0;

// CREATE ORDER
router.post("/create", async (req, res) => {
  try {
    const prisma = db();
    const {
      customerName,
      customerPhone,
      orderType,
      address,
      notes,
      partnerCode,
      paymentType,
      items,
      subtotal,
      total,
      lat,
      lng,
    } = req.body;

    // Validate radius if delivery
    let distanceKm = null;
    let deliveryAllowed = true;

    if (orderType === "delivery") {
      distanceKm = calculateDistanceKm(REST_LAT, REST_LNG, lat, lng);
      if (distanceKm > DELIVERY_MAX_KM) {
        deliveryAllowed = false;
        return res.status(400).json({
          error: "Delivery outside service range",
          distanceKm,
          max: DELIVERY_MAX_KM,
        });
      }
    }

    // Create main order
    const order = await prisma.orders_v2.create({
      data: {
        customerName,
        customerPhone,
        orderType,
        address,
        notes,
        partnerCode,
        paymentType,
        subtotal,
        total,
        distanceKm,
        deliveryAllowed,
      },
    });

    // Create items
    for (const item of items) {
      const orderItem = await prisma.order_items_v2.create({
        data: {
          orderId: order.id,
          itemId: item.itemId,
          itemName: item.itemName,
          qty: item.qty,
          basePrice: item.basePrice,
        },
      });

      // Create modifiers
      for (const mod of item.modifiers || []) {
        await prisma.order_modifiers_v2.create({
          data: {
            orderItemId: orderItem.id,
            name: mod.name,
            price: mod.price,
          },
        });
      }
    }

    // PATCH O3 — Generate sequential order number
    const orderNumber = await getNextOrderNumber();
    await prisma.orders_v2.update({
      where: { id: order.id },
      data: { orderNumber },
    });

    // PATCH O7 — Hybrid referral detection
    await assignPartnerToOrder(partnerCode, order.id);

    // PATCH O4 — Delivery time estimation
    const eta = estimateTimes(distanceKm || 0);

    res.json({ success: true, orderId: order.id, orderNumber, eta });
  } catch (error) {
    console.error("ORDER CREATE ERROR:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// GET ALL ORDERS (Admin)
router.get("/all", async (req, res) => {
  try {
    const prisma = db();
    const orders = await prisma.orders_v2.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { modifiers: true },
        },
      },
    });
    res.json(orders);
  } catch (error) {
    console.error("ORDERS FETCH ERROR:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// PATCH O5 — GET ORDER STATUS (for confirmation page polling)
router.get("/status", async (req, res) => {
  try {
    const prisma = db();
    const { orderId } = req.query;
    const o = await prisma.orders_v2.findUnique({ where: { id: String(orderId) } });
    res.json({ paidStatus: o?.paidStatus || "pending" });
  } catch (error) {
    console.error("ORDER STATUS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch order status" });
  }
});

// PATCH O7 — MANUAL PARTNER SELECTION
router.post("/manual-partner", async (req, res) => {
  try {
    const { orderId, partnerId } = req.body;
    await manualPartnerSelection(partnerId, orderId);
    res.json({ success: true });
  } catch (error) {
    console.error("MANUAL PARTNER ERROR:", error);
    res.status(500).json({ error: "Failed to assign partner" });
  }
});

export default router;
