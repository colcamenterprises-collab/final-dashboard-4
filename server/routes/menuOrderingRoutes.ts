import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

router.get("/categories", async (_req, res) => {
  try {
    const prisma = db();
    const categories = await prisma.menuCategory.findMany({
      orderBy: { position: "asc" },
    });
    res.json(categories);
  } catch (err) {
    console.error("MENU CATEGORIES ERROR:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

router.get("/items/:categoryId", async (req, res) => {
  try {
    const prisma = db();
    const { categoryId } = req.params;

    const items = await prisma.menuItem_Online.findMany({
      where: { categoryId, available: true },
      include: {
        groups: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { position: "asc" },
    });

    res.json(items);
  } catch (err) {
    console.error("MENU ITEMS ERROR:", err);
    res.status(500).json({ error: "Failed to load items" });
  }
});

router.get("/full", async (_req, res) => {
  try {
    const prisma = db();
    const categories = await prisma.menuCategory.findMany({
      orderBy: { position: "asc" },
      include: {
        items: {
          where: { available: true },
          orderBy: { position: "asc" },
          include: {
            groups: {
              orderBy: { position: "asc" },
              include: {
                options: {
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
      },
    });

    res.json({ categories });
  } catch (err) {
    console.error("MENU FULL ERROR:", err);
    res.status(500).json({ error: "Failed to load full menu" });
  }
});

export default router;
