import { Router } from "express";
import { pool } from "../db";

const router = Router();

const cleanMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

router.get("/online/catalog", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, image_url, category, price_online
       FROM product
       WHERE active = true
         AND visible_online = true
         AND price_online IS NOT NULL
         AND price_online > 0
       ORDER BY category ASC NULLS LAST, name ASC`,
    );

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
      items: result.rows.map((row) => ({
        id: Number(row.id),
        sku: null,
        name: String(row.name ?? ""),
        description: row.description == null ? null : String(row.description),
        imageUrl: row.image_url == null ? null : String(row.image_url),
        image_url: row.image_url == null ? null : String(row.image_url),
        image: row.image_url == null ? null : String(row.image_url),
        category: String(row.category ?? "UNMAPPED"),
        price: Number(row.price_online),
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch published items", error);
    res.status(500).json({ error: "Failed to fetch online catalog" });
  }
});


router.get("/online/catalog/:id/options", async (req, res) => {
  return res.json({ item_id: Number(req.params.id), option_groups: [] });
});

router.get("/catalog", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, image_url, category, price_online, visible_online, active
       FROM product
       WHERE active = true
       ORDER BY category ASC NULLS LAST, name ASC`,
    );
    const items = result.rows.map((row) => ({
      id: Number(row.id),
      source_type: "product",
      source_id: Number(row.id),
      name: String(row.name ?? ""),
      description: row.description == null ? null : String(row.description),
      image_url: row.image_url == null ? null : String(row.image_url),
      category: row.category == null ? null : String(row.category),
      price: row.price_online == null ? null : Number(row.price_online),
      is_published: row.visible_online === true,
      active: row.active === true,
    }));
    res.json({ items });
  } catch (error) {
    console.error("[catalog] failed to fetch admin catalog", error);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

router.post("/catalog/manual", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const description = req.body?.description == null ? null : String(req.body.description);
    const imageUrl = req.body?.imageUrl == null ? null : String(req.body.imageUrl);
    const category = req.body?.category == null ? null : String(req.body.category);
    const price = cleanMoney(req.body?.price);
    const isPublished = Boolean(req.body?.isPublished ?? false);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;

    if (!name) return res.status(400).json({ error: "name is required" });

    const inserted = await pool.query(
      `INSERT INTO product (name, description, image_url, category, price_online, visible_online, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, description, image_url, category, price_online, visible_online`,
      [name, description, imageUrl, category, price, isPublished],
    );

    res.status(201).json({ item: inserted.rows[0], sortOrder });
  } catch (error) {
    console.error("[catalog] failed to create manual item", error);
    res.status(500).json({ error: "Failed to create manual catalog item" });
  }
});

router.put("/catalog/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const allowed: Record<string, unknown> = {
      name: req.body?.name,
      description: req.body?.description,
      image_url: req.body?.imageUrl,
      category: req.body?.category,
      price_online: req.body?.price,
      visible_online: req.body?.isPublished,
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, rawValue] of Object.entries(allowed)) {
      if (rawValue === undefined) continue;
      let value: unknown = rawValue;
      if (key === "price_online") value = cleanMoney(rawValue);
      if (key === "visible_online") value = Boolean(rawValue);
      setClauses.push(`${key} = $${index++}`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const result = await pool.query(
      `UPDATE product
       SET ${setClauses.join(", ")}, updated_at = now()
       WHERE id = $${index}
       RETURNING *`,
      [...values, id],
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Catalog item not found" });

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("[catalog] failed to update item", error);
    res.status(500).json({ error: "Failed to update catalog item" });
  }
});

router.delete("/catalog/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const result = await pool.query(
      `UPDATE product
       SET active = false,
           visible_online = false,
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Catalog item not found" });

    res.json({ ok: true });
  } catch (error) {
    console.error("[catalog] failed to delete item", error);
    res.status(500).json({ error: "Failed to delete catalog item" });
  }
});

router.post("/catalog/from-recipe/:recipeId", async (req, res) => {
  try {
    const recipeId = Number(req.params.recipeId);
    if (!Number.isFinite(recipeId)) return res.status(400).json({ error: "Invalid recipeId" });

    const recipe = await pool.query(
      `SELECT id, name, description, image_url, category, suggested_price
       FROM recipes
       WHERE id = $1
       LIMIT 1`,
      [recipeId],
    );

    if (!recipe.rows[0]) return res.status(404).json({ error: "Recipe not found" });

    const row = recipe.rows[0];
    const existing = await pool.query(
      `SELECT id
       FROM product
       WHERE recipe_id = $1
       LIMIT 1`,
      [recipeId],
    );

    if (existing.rows[0]) {
      const updated = await pool.query(
        `UPDATE product
         SET name = $2,
             description = $3,
             image_url = $4,
             category = $5,
             price_online = $6,
             visible_online = true,
             active = true,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, row.name, row.description, row.image_url, row.category, cleanMoney(row.suggested_price)],
      );
      return res.json({ item: updated.rows[0] });
    }

    const inserted = await pool.query(
      `INSERT INTO product (name, description, image_url, recipe_id, category, price_online, visible_online, active)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       RETURNING *`,
      [row.name, row.description, row.image_url, recipeId, row.category, cleanMoney(row.suggested_price)],
    );

    res.json({ item: inserted.rows[0] });
  } catch (error) {
    console.error("[catalog] failed to upsert from recipe", error);
    res.status(500).json({ error: "Failed to add recipe to catalog" });
  }
});

export default router;
