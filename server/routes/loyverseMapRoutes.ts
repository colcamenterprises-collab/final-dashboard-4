// PATCH O4 — LOYVERSE MAPPING CONSOLE BACKEND
import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

// Get all mappings
router.get("/all", async (req, res) => {
  const prisma = db();
  const map = await prisma.loyverse_map_v2.findMany();
  res.json(map);
});

// Save or update mapping
router.post("/save", async (req, res) => {
  const prisma = db();
  const { menuItemId, loyverseItemId, modifierName, loyverseModifierId } =
    req.body;

  const existing = await prisma.loyverse_map_v2.findFirst({
    where: { menuItemId, modifierName },
  });

  if (existing) {
    await prisma.loyverse_map_v2.update({
      where: { id: existing.id },
      data: { loyverseItemId, loyverseModifierId },
    });
    return res.json({ updated: true });
  }

  await prisma.loyverse_map_v2.create({
    data: { menuItemId, loyverseItemId, modifierName, loyverseModifierId },
  });

  res.json({ created: true });
});

export default router;
