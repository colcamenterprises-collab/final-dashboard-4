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
  salePrice: number | null;
  totalCost: number | null;
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

export async function fetchProductMenuRows(): Promise<ProductMenuRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url as "imageUrl",
      p.active,
      p.category,
      p.sale_price as "salePrice",
      CASE
        WHEN COUNT(pi.id) = 0 THEN NULL
        WHEN SUM(
          CASE
            WHEN i.purchase_cost IS NULL
              OR i.yield_per_purchase IS NULL
              OR pi.quantity_used IS NULL
              OR pi.line_cost_derived IS NULL
            THEN 1
            ELSE 0
          END
        ) > 0 THEN NULL
        ELSE SUM(pi.line_cost_derived)
      END AS "totalCost"
    FROM product p
    LEFT JOIN product_ingredient pi ON pi.product_id = p.id
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);

  return (result.rows || result) as ProductMenuRow[];
}

export function buildPublicMenu(
  rows: ProductMenuRow[]
): { categories: ProductMenuCategory[]; items: ProductMenuItem[] } {
  const items = rows
    .filter((row) => row.active)
    .filter((row) => row.salePrice !== null && Number(row.salePrice) > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const categoryName = normalizeCategory(row.category);
      return {
        id: String(row.id),
        categoryId: slugify(categoryName),
        name: row.name,
        desc: row.description || "",
        price: Number(row.salePrice || 0),
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

export async function getPublicMenu() {
  const rows = await fetchProductMenuRows();
  return buildPublicMenu(rows);
}

export type ProductMenuAdminItem = ProductMenuRow;

export async function getAdminMenuRows(): Promise<ProductMenuAdminItem[]> {
  const rows = await fetchProductMenuRows();
  return rows.map((row) => ({
    ...row,
    salePrice: row.salePrice === null ? null : Number(row.salePrice),
    totalCost: row.totalCost === null ? null : Number(row.totalCost),
  }));
}
