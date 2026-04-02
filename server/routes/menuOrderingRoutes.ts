import { Router } from "express";
import { getOnlineProductsFlat } from "../services/onlineProductFeed";

const router = Router();

const normalizeCategory = (value: string | null | undefined) => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "UNMAPPED";
};

const slugifyCategory = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function getCatalogSnapshot() {
  const items = await getOnlineProductsFlat();

  const categoriesBySlug = new Map<string, { id: string; name: string; position: number }>();
  const groupedItems = new Map<string, Array<any>>();

  let position = 1;
  for (const item of items) {
    const categoryName = normalizeCategory(item.category);
    const categoryId = slugifyCategory(categoryName) || "unmapped";

    if (!categoriesBySlug.has(categoryId)) {
      categoriesBySlug.set(categoryId, {
        id: categoryId,
        name: categoryName,
        position: position++,
      });
    }

    const nextItems = groupedItems.get(categoryId) ?? [];
    nextItems.push({
      id: String(item.id),
      categoryId,
      name: item.name,
      description: item.description ?? "",
      price: item.price ?? 0,
      imageUrl: item.image ?? null,
      position: nextItems.length + 1,
      available: true,
      groups: [],
    });
    groupedItems.set(categoryId, nextItems);
  }

  const categories = Array.from(categoriesBySlug.values()).sort((a, b) => a.position - b.position);
  return { categories, groupedItems };
}

router.get("/categories", async (_req, res) => {
  try {
    const { categories } = await getCatalogSnapshot();
    res.json(categories);
  } catch (err) {
    console.error("MENU CATEGORIES ERROR:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

router.get("/items/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { groupedItems } = await getCatalogSnapshot();
    res.json(groupedItems.get(categoryId) ?? []);
  } catch (err) {
    console.error("MENU ITEMS ERROR:", err);
    res.status(500).json({ error: "Failed to load items" });
  }
});

router.get("/full", async (_req, res) => {
  try {
    const { categories, groupedItems } = await getCatalogSnapshot();
    const payload = categories.map((category) => ({
      ...category,
      items: groupedItems.get(category.id) ?? [],
    }));

    res.json({ categories: payload });
  } catch (err) {
    console.error("MENU FULL ERROR:", err);
    res.status(500).json({ error: "Failed to load full menu" });
  }
});

export default router;
