import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/menu-online
 * Returns categories with their available items, ordered by position ASC.
 */
router.get("/menu-online", async (_req, res) => {
  const cats = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug, position FROM menu_categories_online ORDER BY position ASC`
  );
  const out = [];
  for (const c of cats) {
    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, slug, sku, description, price,
              image_url AS "imageUrl", position, available
         FROM menu_items_online
        WHERE category_id = $1 AND available = TRUE
        ORDER BY position ASC`,
      c.id
    );
    out.push({ ...c, items });
  }
  res.json(out);
});

/**
 * PATCH /api/menu-online/item/:id
 * Allows updating common fields like image_url, price, available, etc.
 * Body: { name?, sku?, description?, price?, image_url?, position?, available?, category_id? }
 */
router.patch("/menu-online/item/:id", async (req, res) => {
  const { id } = req.params;
  const allowed = ["name","sku","description","price","image_url","position","available","category_id"];
  const data: any = {};
  for (const k of allowed) if (k in req.body) data[k] = req.body[k];

  const keys = Object.keys(data);
  if (keys.length === 0) return res.json({ ok: true, changed: 0 });

  const setSql = keys.map((k, i) => `${k}=$${i + 2}`).join(", ");
  await prisma.$executeRawUnsafe(
    `UPDATE menu_items_online SET ${setSql} WHERE id=$1`,
    id,
    ...keys.map((k) => data[k])
  );

  const row = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug, sku, description, price,
            image_url AS "imageUrl", position, available, category_id
       FROM menu_items_online WHERE id=$1 LIMIT 1`,
    id
  );
  res.json(row?.[0] ?? { ok: true });
});

export default router;
