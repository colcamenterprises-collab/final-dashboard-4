// PATCH O7 — PARTNER BAR ADMIN API (FOUNDATION)
import { Router } from "express";
import { db } from "../../lib/prisma";

const router = Router();

// CREATE PARTNER BAR
router.post("/create", async (req, res) => {
  try {
    const prisma = db();
    const { name, contactName, phone } = req.body;

    // Auto-generate code: removes spaces + random 3 digits
    const code = (name.replace(/\s+/g, "").toUpperCase() + Math.floor(Math.random() * 900 + 100)).slice(0, 12);

    const partner = await prisma.partner_bars_v1.create({
      data: { name, contactName, phone, code },
    });

    res.json(partner);
  } catch (err) {
    console.error("Partner create error:", err);
    res.status(500).json({ error: "Failed to create partner" });
  }
});

// LIST PARTNER BARS
router.get("/all", async (_req, res) => {
  try {
    const prisma = db();
    const bars = await prisma.partner_bars_v1.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(bars);
  } catch (err) {
    console.error("Partner list error:", err);
    res.status(500).json({ error: "Failed to list partners" });
  }
});

// GET SINGLE BAR
router.get("/:partnerId", async (req, res) => {
  try {
    const prisma = db();
    const bar = await prisma.partner_bars_v1.findUnique({
      where: { id: String(req.params.partnerId) },
    });
    res.json(bar);
  } catch (err) {
    console.error("Partner get error:", err);
    res.status(500).json({ error: "Failed to get partner" });
  }
});

export default router;
