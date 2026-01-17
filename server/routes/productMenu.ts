import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getAdminMenuRows } from "../services/productMenuView";

const router = Router();

const normalizeCategory = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "UNMAPPED";
};

const sortByOrderThenName = (a: any, b: any) => {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
};

router.get("/api/product-menu", async (_req, res) => {
  try {
    const rows = await getAdminMenuRows();

    const categoryMap = new Map<string, { name: string; items: any[] }>();

    for (const row of rows) {
      const categoryName = normalizeCategory(row.category);
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { name: categoryName, items: [] });
      }
      categoryMap.get(categoryName)?.items.push({
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        active: row.active,
        category: row.category,
        sortOrder: row.sortOrder ?? 0,
        visibility: {
          inStore: row.visibleInStore,
          grab: row.visibleGrab,
          online: row.visibleOnline,
        },
        prices: row.prices,
      });
    }

    const categories = Array.from(categoryMap.values())
      .map((entry) => ({
        name: entry.name,
        items: entry.items.sort(sortByOrderThenName),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ ok: true, categories });
  } catch (error: any) {
    console.error("Error fetching product menu:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.patch("/api/product-menu/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ ok: false, error: "Invalid product ID" });
    }

    const { category, sortOrder, visibility } = req.body;

    const currentResult = await db.execute(sql`
      SELECT category, sort_order, visible_in_store, visible_grab, visible_online
      FROM product_menu
      WHERE product_id = ${productId}
    `);

    const currentRows = (currentResult.rows || currentResult) as any[];
    const current = currentRows[0];

    const nextCategory = category !== undefined ? category : current?.category ?? null;
    const nextSortOrder = Number.isFinite(Number(sortOrder))
      ? Number(sortOrder)
      : current?.sort_order ?? 0;
    const nextVisibility = {
      inStore: visibility?.inStore ?? current?.visible_in_store ?? false,
      grab: visibility?.grab ?? current?.visible_grab ?? false,
      online: visibility?.online ?? current?.visible_online ?? false,
    };

    await db.execute(sql`
      INSERT INTO product_menu (product_id, category, sort_order, visible_in_store, visible_grab, visible_online)
      VALUES (${productId}, ${nextCategory}, ${nextSortOrder}, ${nextVisibility.inStore}, ${nextVisibility.grab}, ${nextVisibility.online})
      ON CONFLICT (product_id)
      DO UPDATE SET
        category = EXCLUDED.category,
        sort_order = EXCLUDED.sort_order,
        visible_in_store = EXCLUDED.visible_in_store,
        visible_grab = EXCLUDED.visible_grab,
        visible_online = EXCLUDED.visible_online
    `);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Error updating product menu:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
