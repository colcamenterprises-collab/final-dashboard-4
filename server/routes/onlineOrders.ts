import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function generateOrderRef() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

export function registerOnlineOrderRoutes(app: Express) {
  // POST /api/order - Submit order
  app.post("/api/order", async (req, res) => {
    try {
      const { name, phone, type, address, payment, subtotal, vatAmount, total, lines, rawPayload } = req.body;

      const order = await prisma.orderOnline.create({
        data: {
          id: generateId(),
          ref: generateOrderRef(),
          status: "pending",
          name,
          phone,
          type,
          address,
          payment,
          subtotal,
          vatAmount,
          total,
          rawPayload,
          lines: {
            create: lines.map((line: any) => ({
              id: generateId(),
              itemId: line.itemId,
              sku: line.sku,
              name: line.name,
              qty: line.qty,
              basePrice: line.basePrice,
              modifiers: line.modifiers,
              note: line.note,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      res.json({ order });
    } catch (error) {
      console.error("Error submitting order:", error);
      res.status(500).json({ error: "Failed to submit order" });
    }
  });

  // GET /api/orders - Get all orders (admin)
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await prisma.orderOnline.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          lines: true,
        },
      });

      res.json({ orders });
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // GET /api/order/:ref - Get order by reference
  app.get("/api/order/:ref", async (req, res) => {
    try {
      const order = await prisma.orderOnline.findUnique({
        where: { ref: req.params.ref },
        include: {
          lines: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ order });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // PUT /api/order/:id/status - Update order status
  app.put("/api/order/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      
      const order = await prisma.orderOnline.update({
        where: { id: req.params.id },
        data: { status },
      });

      res.json({ order });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });
}
