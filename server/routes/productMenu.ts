import { Router } from "express";
import { getAdminMenuRows } from "../services/productMenuView";

const router = Router();

const normalizeCategory = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "UNMAPPED";
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
        salePrice: row.salePrice,
        totalCost: row.totalCost,
      });
    }

    const categories = Array.from(categoryMap.values())
      .map((entry) => ({
        name: entry.name,
        items: entry.items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ ok: true, categories });
  } catch (error: any) {
    console.error("Error fetching product menu:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const writeBlocked = (_req: any, res: any) => {
  res.status(409).json({
    ok: false,
    error: "Product menu is read-only. Update products and ingredient lines instead.",
  });
};

router.patch("/api/product-menu/:productId", writeBlocked);

export default router;
