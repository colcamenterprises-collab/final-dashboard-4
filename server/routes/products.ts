/**
 * PATCH P1: PRODUCTS API ROUTES
 *
 * Product-first CRUD endpoints with line-by-line costing
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/api/products", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.*,
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
        END AS cost
      FROM product p
      LEFT JOIN product_ingredient pi ON pi.product_id = p.id
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    res.json({ ok: true, products: result.rows || result });
  } catch (error: any) {
    console.error("[products] List error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const productResult = await db.execute(sql`
      SELECT *
      FROM product
      WHERE id = ${id}
    `);

    const products = productResult.rows || productResult;
    if (!products.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = products[0];

    const linesResult = await db.execute(sql`
      SELECT
        pi.id,
        pi.ingredient_id,
        pi.quantity_used,
        pi.prep_note,
        CASE
          WHEN i.purchase_cost IS NULL OR i.yield_per_purchase IS NULL
          THEN NULL
          ELSE pi.unit_cost_derived
        END AS unit_cost_derived,
        CASE
          WHEN i.purchase_cost IS NULL OR i.yield_per_purchase IS NULL
          THEN NULL
          ELSE pi.line_cost_derived
        END AS line_cost_derived
      FROM product_ingredient pi
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      WHERE pi.product_id = ${id}
      ORDER BY pi.id
    `);

    res.json({
      ok: true,
      product,
      lines: linesResult.rows || linesResult,
    });
  } catch (error: any) {
    console.error("[products] Get error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    const { name, description, prep_notes, image_url, category, sale_price } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const product = await db.transaction(async (tx) => {
      const productResult = await tx.execute(sql`
        INSERT INTO product (
          name,
          description,
          prep_notes,
          image_url,
          category,
          sale_price,
          active,
          updated_at
        )
        VALUES (
          ${name},
          ${description || null},
          ${prep_notes || null},
          ${image_url || null},
          ${category || null},
          ${sale_price ?? null},
          FALSE,
          NOW()
        )
        RETURNING *
      `);

      const productRows = productResult.rows || productResult;
      return productRows[0] as any;
    });

    res.status(201).json({ ok: true, id: product.id, product });
  } catch (error: any) {
    console.error("[products] Create error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { name, description, prep_notes, image_url, category, sale_price } = req.body;

    await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE product
        SET
          name = ${name},
          description = ${description || null},
          prep_notes = ${prep_notes || null},
          image_url = ${image_url || null},
          category = ${category || null},
          sale_price = ${sale_price ?? null},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id
      `);
      const rows = result.rows || result;
      if (!rows.length) {
        throw new Error("Product not found");
      }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[products] Update error:", error);
    if (error.message === "Product not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    await db.execute(sql`DELETE FROM product_ingredient WHERE product_id = ${id}`);
    await db.execute(sql`DELETE FROM product WHERE id = ${id}`);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[products] Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
