import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/online/catalog", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, image_url, category, price_online
       FROM product
       WHERE visible_online = true
         AND active = true
         AND price_online IS NOT NULL
         AND price_online > 0
       ORDER BY category ASC NULLS LAST, name ASC`,
    );

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json({
      items: result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        description: row.description ? String(row.description) : null,
        imageUrl: row.image_url ? String(row.image_url) : null,
        image_url: row.image_url ? String(row.image_url) : null,
        image: row.image_url ? String(row.image_url) : null,
        category: row.category ? String(row.category) : "Uncategorized",
        price: Number(row.price_online),
        is_live: true,
        visible_online: true,
      })),
    });
  } catch (error) {
    console.error("[catalog] failed to fetch published items", error);
    res.status(500).json({ error: "Failed to fetch online catalog" });
  }
});

router.get("/online/catalog/:id/options", async (req, res) => {
  return res.json({ item_id: req.params.id, option_groups: [] });
});

export default router;
