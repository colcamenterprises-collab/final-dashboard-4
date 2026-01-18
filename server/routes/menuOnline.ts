import { Router } from "express";
import { getLegacyMenuFromOnlineProducts } from "../services/onlineProductFeed";
const router = Router();

/**
 * GET /api/menu
 * Public menu endpoint for customer ordering page
 * Returns categories with their available items, ordered by position ASC.
 */
router.get("/menu", async (_req, res) => {
  try {
    const menu = await getLegacyMenuFromOnlineProducts();
    res.json({ deprecated: true, ...menu });
  } catch (error) {
    console.error("Error fetching menu:", error);
    res.status(500).json({ error: "Failed to fetch menu" });
  }
});

/**
 * GET /api/menu-online
 * Returns categories with their available items, ordered by position ASC.
 */
router.get("/menu-online", async (_req, res) => {
  try {
    const menu = await getLegacyMenuFromOnlineProducts();
    const categories = menu.categories.map((category) => ({
      ...category,
      items: menu.items.filter((item) => item.categoryId === category.id),
    }));
    res.set("X-Deprecated", "true");
    res.json(categories);
  } catch (error) {
    console.error("Error fetching menu-online:", error);
    res.status(500).json({ error: "Failed to fetch menu" });
  }
});

/**
 * PATCH /api/menu-online/item/:id
 * Allows updating common fields like imageUrl, price, available, etc.
 * Body: { name?, sku?, description?, price?, imageUrl?, position?, available?, categoryId? }
 */
router.patch("/menu-online/item/:id", async (_req, res) => {
  res.status(409).json({
    ok: false,
    error: "Menu items are read-only. Update products for pricing and visibility. (Deprecated endpoint)",
  });
});

export default router;
