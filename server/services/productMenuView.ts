import { db } from "../db";
import { sql } from "drizzle-orm";

export type ProductChannel = "IN_STORE" | "GRAB" | "ONLINE";

export type ProductMenuRow = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  category: string | null;
  sortOrder: number | null;
  visibleInStore: boolean | null;
  visibleGrab: boolean | null;
  visibleOnline: boolean | null;
  price: number | null;
};

export type ProductMenuCategory = {
  id: string;
  name: string;
  position: number;
};

export type ProductMenuItem = {
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const visibilityKeyByChannel: Record<ProductChannel, keyof ProductMenuRow> = {
  IN_STORE: "visibleInStore",
  GRAB: "visibleGrab",
  ONLINE: "visibleOnline",
};

export async function fetchProductMenuRows(channel: ProductChannel): Promise<ProductMenuRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url as "imageUrl",
      p.active,
      pm.category,
      pm.sort_order as "sortOrder",
      pm.visible_in_store as "visibleInStore",
      pm.visible_grab as "visibleGrab",
      pm.visible_online as "visibleOnline",
      pp.price as "price"
    FROM product p
    LEFT JOIN product_menu pm ON pm.product_id = p.id
    LEFT JOIN product_price pp ON pp.product_id = p.id AND pp.channel = ${channel}
    ORDER BY p.created_at DESC
  `);

  return (result.rows || result) as ProductMenuRow[];
}

export function buildPublicMenu(
  rows: ProductMenuRow[],
  channel: ProductChannel
): { categories: ProductMenuCategory[]; items: ProductMenuItem[] } {
  const visibleKey = visibilityKeyByChannel[channel];
  const items = rows
    .filter((row) => row.active)
    .filter((row) => Boolean(row[visibleKey]))
    .filter((row) => row.price !== null && Number(row.price) > 0)
    .sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    })
    .map((row) => {
      const categoryName = normalizeCategory(row.category);
      return {
        id: String(row.id),
        categoryId: slugify(categoryName),
        name: row.name,
        desc: row.description || "",
        price: Number(row.price || 0),
        image: row.imageUrl || null,
        _categoryName: categoryName,
      };
    });

  const categoryMap = new Map<string, ProductMenuCategory>();
  for (const item of items) {
    if (!categoryMap.has(item.categoryId)) {
      categoryMap.set(item.categoryId, {
        id: item.categoryId,
        name: item._categoryName,
        position: 0,
      });
    }
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const sanitizedItems = items.map(({ _categoryName, ...rest }) => rest);
  return { categories, items: sanitizedItems };
}

export async function getPublicMenu(channel: ProductChannel) {
  const rows = await fetchProductMenuRows(channel);
  return buildPublicMenu(rows, channel);
}

export type ProductMenuAdminItem = ProductMenuRow & {
  prices: Record<string, number>;
};

export async function getAdminMenuRows(): Promise<ProductMenuAdminItem[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url as "imageUrl",
      p.active,
      pm.category,
      pm.sort_order as "sortOrder",
      pm.visible_in_store as "visibleInStore",
      pm.visible_grab as "visibleGrab",
      pm.visible_online as "visibleOnline",
      pp.channel,
      pp.price
    FROM product p
    LEFT JOIN product_menu pm ON pm.product_id = p.id
    LEFT JOIN product_price pp ON pp.product_id = p.id
    ORDER BY p.created_at DESC
  `);

  const rows = (result.rows || result) as Array<ProductMenuRow & { channel: string | null }>;
  const byId = new Map<number, ProductMenuAdminItem>();

  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, {
        ...row,
        price: null,
        prices: {},
      });
    }
    if (row.channel && row.price !== null) {
      const target = byId.get(row.id);
      if (target) {
        target.prices[row.channel] = Number(row.price);
      }
    }
  }

  return Array.from(byId.values());
}
