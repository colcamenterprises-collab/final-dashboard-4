import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

router.get("/online/catalog", async (_req, res) => {
  try {
    const prisma = db();
    const items = await prisma.menuItem_Online.findMany({
      where: { available: true },
      include: {
        category: true,
      },
      orderBy: [{ category: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
    });

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
      items: items.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        image_url: item.imageUrl,
        image: item.imageUrl,
        category: item.category.name,
        categoryId: item.categoryId,
        price: item.price,
        sort_order: item.position ?? 0,
        is_live: item.available === true,
        visible_online: item.available === true,
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch published items", error);
    res.status(500).json({ error: "Failed to fetch online catalog" });
  }
});

router.get("/online/catalog/:id/options", async (req, res) => {
  try {
    const prisma = db();
    const groups = await prisma.modifierGroup_Online.findMany({
      where: { itemId: req.params.id },
      include: { options: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
    });

    return res.json({
      item_id: req.params.id,
      option_groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        min: group.required ? 1 : 0,
        max: group.maxSel ?? (group.type === "single" ? 1 : 99),
        required: group.required === true,
        type: group.type,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          price_delta: option.priceDelta,
        })),
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch item options", error);
    return res.status(500).json({ error: "Failed to fetch item options" });
  }
});

export default router;
