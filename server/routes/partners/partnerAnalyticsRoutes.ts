// PATCH O7 — ANALYTICS ROUTE
import { Router } from "express";
import { db } from "../../lib/prisma";

const router = Router();

router.get("/analytics", async (_req, res) => {
  try {
    const prisma = db();
    const partners = await prisma.partner_bars_v1.findMany({
      include: {
        orders: true,
      },
    });

    const stats = partners.map((p) => {
      const revenue = p.orders.reduce((t, o) => t + (o.total || 0), 0);
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        orders: p.orders.length,
        revenue,
      };
    });

    res.json(stats);
  } catch (err) {
    console.error("Partner analytics error:", err);
    res.status(500).json({ error: "Failed to fetch partner analytics" });
  }
});

export default router;
