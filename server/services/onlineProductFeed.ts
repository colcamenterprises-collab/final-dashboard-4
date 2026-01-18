import { sql } from "drizzle-orm";
import { db } from "../db";

export type OnlineProductRow = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  visibleOnline: boolean | null;
  priceOnline: number | null;
};

export type OnlineProduct = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  priceOnline: number;
  category: string;
};

export type OnlineProductCategory = {
  name: string;
  items: OnlineProduct[];
};

export type LegacyMenuCategory = {
  id: string;
  name: string;
  position: number;
};

export type LegacyMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  desc: string;
  price: number;
  image?: string | null;
};

const normalizeCategory = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "UNMAPPED";
};

const slugifyCategory = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function fetchOnlineProductRows(): Promise<OnlineProductRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url as "imageUrl",
      p.category,
      p.visible_online as "visibleOnline",
      p.price_online as "priceOnline"
    FROM product p
    WHERE p.active = true
      AND p.visible_online = true
      AND p.price_online IS NOT NULL
      AND p.price_online > 0
  `);

  return (result.rows || result) as OnlineProductRow[];
}

export async function getOnlineProductsFlat(): Promise<OnlineProduct[]> {
  const rows = await fetchOnlineProductRows();

  return rows
    .sort((a, b) => {
      const categoryA = normalizeCategory(a.category);
      const categoryB = normalizeCategory(b.category);
      if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
      return a.name.localeCompare(b.name);
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      image: row.imageUrl || null,
      price: Number(row.priceOnline || 0),
      priceOnline: Number(row.priceOnline || 0),
      category: normalizeCategory(row.category),
    }));
}

export async function getOnlineProductsGrouped(): Promise<OnlineProductCategory[]> {
  const items = await getOnlineProductsFlat();
  const categoryMap = new Map<string, OnlineProduct[]>();

  for (const item of items) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, []);
    }
    categoryMap.get(item.category)?.push(item);
  }

  return Array.from(categoryMap.entries())
    .map(([name, items]) => ({
      name,
      items,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLegacyMenuFromOnlineProducts(): Promise<{
  categories: LegacyMenuCategory[];
  items: LegacyMenuItem[];
}> {
  const items = await getOnlineProductsFlat();

  const categories = new Map<string, LegacyMenuCategory>();
  const legacyItems: LegacyMenuItem[] = items.map((item) => {
    const categoryId = slugifyCategory(item.category);
    if (!categories.has(categoryId)) {
      categories.set(categoryId, {
        id: categoryId,
        name: item.category,
        position: 0,
      });
    }

    return {
      id: String(item.id),
      categoryId,
      name: item.name,
      desc: item.description || "",
      price: Number(item.price || 0),
      image: item.image || null,
    };
  });

  return {
    categories: Array.from(categories.values()),
    items: legacyItems,
  };
}
