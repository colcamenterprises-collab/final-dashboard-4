import { Router } from "express";
import { pool } from "../db";
import { ensureOnlineCatalogTable, listAllCatalogItems, listPublishedCatalogItems } from "../services/onlineCatalogService";
import { ensureOnlineCatalogOptionTables, listCatalogItemOptionGroups } from "../services/onlineCatalogOptionsService";

const router = Router();

const cleanMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

router.get("/online/catalog", async (_req, res) => {
  try {
    const items = await listPublishedCatalogItems();
    res.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: item.imageUrl,
        image: item.imageUrl,
        category: item.category || "Unmapped",
        price: item.price,
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch published items", error);
    res.status(500).json({ error: "Failed to fetch online catalog" });
  }
});


router.get("/online/catalog/:id/options", async (req, res) => {
  try {
    await ensureOnlineCatalogOptionTables();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const optionGroups = await listCatalogItemOptionGroups(id);
    return res.json({
      item_id: id,
      option_groups: optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        min: group.min,
        max: group.max,
        required: group.required,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          price_delta: option.priceDelta,
        })),
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch item options", error);
    return res.status(500).json({ error: "Failed to fetch item option groups" });
  }
});

router.get("/catalog", async (_req, res) => {
  try {
    const items = await listAllCatalogItems();
    res.json({ items });
  } catch (error) {
    console.error("[catalog] failed to fetch admin catalog", error);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

router.post("/catalog/manual", async (req, res) => {
  try {
    await ensureOnlineCatalogTable();
    const name = String(req.body?.name || "").trim();
    const description = req.body?.description == null ? null : String(req.body.description);
    const imageUrl = req.body?.imageUrl == null ? null : String(req.body.imageUrl);
    const category = req.body?.category == null ? null : String(req.body.category);
    const price = cleanMoney(req.body?.price);
    const isPublished = Boolean(req.body?.isPublished ?? false);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;

    if (!name) return res.status(400).json({ error: "name is required" });

    const inserted = await pool.query(
      `INSERT INTO online_catalog_items
        (source_type, source_id, name, description, image_url, category, price, is_published, sort_order)
       VALUES
        ('manual', NULL, $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, imageUrl, category, price, isPublished, sortOrder],
    );

    res.status(201).json({ item: inserted.rows[0] });
  } catch (error) {
    console.error("[catalog] failed to create manual item", error);
    res.status(500).json({ error: "Failed to create manual catalog item" });
  }
});

router.put("/catalog/:id", async (req, res) => {
  try {
    await ensureOnlineCatalogTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const allowed: Record<string, unknown> = {
      name: req.body?.name,
      description: req.body?.description,
      image_url: req.body?.imageUrl,
      category: req.body?.category,
      price: req.body?.price,
      is_published: req.body?.isPublished,
      sort_order: req.body?.sortOrder,
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, rawValue] of Object.entries(allowed)) {
      if (rawValue === undefined) continue;
      let value: unknown = rawValue;
      if (key === "price") value = cleanMoney(rawValue);
      if (key === "is_published") value = Boolean(rawValue);
      if (key === "sort_order") value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
      setClauses.push(`${key} = $${index++}`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const result = await pool.query(
      `UPDATE online_catalog_items
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
    await ensureOnlineCatalogTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const result = await pool.query(`DELETE FROM online_catalog_items WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Catalog item not found" });

    res.json({ ok: true });
  } catch (error) {
    console.error("[catalog] failed to delete item", error);
    res.status(500).json({ error: "Failed to delete catalog item" });
  }
});

router.post("/catalog/from-recipe/:recipeId", async (req, res) => {
  try {
    await ensureOnlineCatalogTable();
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

    const upserted = await pool.query(
      `INSERT INTO online_catalog_items
        (source_type, source_id, name, description, image_url, category, price)
       VALUES ('recipe', $1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_type, source_id)
       WHERE source_type = 'recipe' AND source_id IS NOT NULL
       DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             image_url = EXCLUDED.image_url,
             category = EXCLUDED.category,
             price = EXCLUDED.price,
             updated_at = now()
       RETURNING *`,
      [recipeId, row.name, row.description, row.image_url, row.category, cleanMoney(row.suggested_price)],
    );

    res.json({ item: upserted.rows[0] });
  } catch (error) {
    console.error("[catalog] failed to upsert from recipe", error);
    res.status(500).json({ error: "Failed to add recipe to catalog" });
  }
});

export default router;
