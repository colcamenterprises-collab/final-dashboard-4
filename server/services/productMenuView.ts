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

type VisibilityKey = "visibleInStore" | "visibleGrab" | "visibleOnline";

const visibilityKeyByChannel: Record<ProductChannel, VisibilityKey> = {
  IN_STORE: "visibleInStore",
  GRAB: "visibleGrab",
  ONLINE: "visibleOnline",
};

export type MenuEligibilityInput = {
  active: boolean;
  price: number | null;
  visibleInStore?: boolean | null;
  visibleGrab?: boolean | null;
  visibleOnline?: boolean | null;
};

export function isMenuEligible(input: MenuEligibilityInput, channel: ProductChannel): boolean {
  const visibleKey = visibilityKeyByChannel[channel];
  const visible = Boolean(input[visibleKey]);
  const price = Number(input.price);
  if (!input.active) return false;
  if (!visible) return false;
  if (!Number.isFinite(price) || price <= 0) return false;
  return true;
}

const priceColumnByChannel: Record<ProductChannel, string> = {
  IN_STORE: "price_in_store",
  GRAB: "price_grab",
  ONLINE: "price_online",
};

export async function fetchProductMenuRows(channel: ProductChannel): Promise<ProductMenuRow[]> {
  const priceColumn = priceColumnByChannel[channel];
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url as "imageUrl",
      p.active,
      p.category,
      NULL as "sortOrder",
      p.visible_in_store as "visibleInStore",
      p.visible_grab as "visibleGrab",
      p.visible_online as "visibleOnline",
      ${sql.raw(`p.${priceColumn}`)} as "price"
    FROM product p
    WHERE p.active = TRUE
    ORDER BY p.created_at DESC
  `);

  return (result.rows || result) as ProductMenuRow[];
}

export function buildPublicMenu(
  rows: ProductMenuRow[],
  channel: ProductChannel
): { categories: ProductMenuCategory[]; items: ProductMenuItem[] } {
  const items = rows
    .filter((row) => isMenuEligible(row, channel))
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
        price: Number(row.price),
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
      p.category,
      NULL as "sortOrder",
      p.visible_in_store as "visibleInStore",
      p.visible_grab as "visibleGrab",
      p.visible_online as "visibleOnline",
      p.price_in_store as "priceInStore",
      p.price_grab as "priceGrab",
      p.price_online as "priceOnline"
    FROM product p
    ORDER BY p.created_at DESC
  `);

  const rows = (result.rows || result) as Array<
    ProductMenuRow & {
      priceInStore: number | null;
      priceGrab: number | null;
      priceOnline: number | null;
    }
  >;
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
    const target = byId.get(row.id);
    if (!target) continue;
    if (row.priceInStore !== null) target.prices.IN_STORE = Number(row.priceInStore);
    if (row.priceGrab !== null) target.prices.GRAB = Number(row.priceGrab);
    if (row.priceOnline !== null) target.prices.ONLINE = Number(row.priceOnline);
  }

  return Array.from(byId.values());
}
