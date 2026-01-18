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

// GET FULL MENU (ALL CATEGORIES + ITEMS + MODIFIERS)
// Now includes products from the new product table merged with legacy menu
router.get("/full", async (req, res) => {
  try {
    const prisma = db();
    
    // Fetch legacy menu categories
    const legacyCategories = await prisma.menuCategory.findMany({
      orderBy: { position: "asc" },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            groups: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    // Fetch products from new product table
    const productCategories = await getOnlineProductsGrouped();
    
    // Merge product categories into response format
    const productCategoriesFormatted = productCategories.map((cat, idx) => ({
      id: `product-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: cat.name,
      slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
      description: "",
      position: 100 + idx,
      items: cat.items.map(item => ({
        id: `product-${item.id}`,
        name: item.name,
        description: item.description || "",
        price: item.price,
        imageUrl: item.image,
        sku: null,
        available: true,
        groups: [],
      })),
    }));

    // Combine legacy and product categories
    const allCategories = [...legacyCategories, ...productCategoriesFormatted];
    
    res.json(allCategories);
  } catch (err) {
    console.error("MENU FULL ERROR:", err);
    res.status(500).json({ error: "Failed to load full menu" });
  }
});

export default router;
