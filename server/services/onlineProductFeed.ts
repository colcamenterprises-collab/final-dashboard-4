import { sql } from "drizzle-orm";
import { db } from "../db";
import { isMenuEligible } from "./productMenuView";

export type OnlineProductRow = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  visibleOnline: boolean | null;
  priceOnline: number | null;
  active: boolean;
};

export type OnlineProduct = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  price: number | null;
  priceOnline: number | null;
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
  price: number | null;
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
      id,
      name,
      description,
      image_url,
      category,
      visible_online,
      price_online,
      active
    FROM product
    WHERE active = true
  `);

  const rows = (result.rows || result) as Array<Record<string, any>>;
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    category: row.category ?? null,
    visibleOnline: row.visible_online ?? null,
    priceOnline: row.price_online ?? null,
    active: Boolean(row.active),
  }));
}

export async function getOnlineProductsFlat(): Promise<OnlineProduct[]> {
  const rows = await fetchOnlineProductRows();

  return rows
    .filter((row) =>
      isMenuEligible(
        {
          active: row.active,
          visibleOnline: row.visibleOnline,
          price: row.priceOnline,
        },
        "ONLINE",
      ),
    )
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
      price: row.priceOnline !== null ? Number(row.priceOnline) : null,
      priceOnline: row.priceOnline !== null ? Number(row.priceOnline) : null,
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
      price: item.price ?? null,
      image: item.image || null,
    };
  });

  return {
    categories: Array.from(categories.values()),
    items: legacyItems,
  };
}
