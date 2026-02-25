// PATCH O1 — ONLINE ORDERING MENU DATA PIPELINE
import { Router } from "express";
import { db } from "../lib/prisma";
import { getOnlineProductsGrouped } from "../services/onlineProductFeed";

const router = Router();

// GET ALL CATEGORIES
router.get("/categories", async (req, res) => {
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

// GET ITEMS BY CATEGORY
router.get("/items/:categoryId", async (req, res) => {
  try {
    const prisma = db();
    const { categoryId } = req.params;

    const items = await prisma.menuItem_Online.findMany({
      where: { categoryId },
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

// GET FULL MENU (PRODUCT TABLE ONLY)
router.get("/full", async (req, res) => {
  try {
    const categories = await getOnlineProductsGrouped();
    res.json({ categories });
  } catch (err) {
    console.error("MENU FULL ERROR:", err);
    res.status(500).json({ error: "Failed to load full menu" });
  }
});

export default router;
