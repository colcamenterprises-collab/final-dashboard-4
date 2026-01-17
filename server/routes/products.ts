/**
 * PATCH P1: PRODUCTS API ROUTES
 * 
 * CRUD endpoints for products with multi-channel pricing
 * Products link to canonical ingredients for cost calculation
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getProductCost, getProductCostDetails } from "../services/productCost.service";

const router = Router();

router.get("/api/products", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.image_url as "imageUrl",
        p.active,
        p.created_at as "createdAt",
        pm.category,
        pm.sort_order as "sortOrder",
        pm.visible_in_store as "visibleInStore",
        pm.visible_grab as "visibleGrab",
        pm.visible_online as "visibleOnline",
        pr.recipe_id as "recipeId",
        COALESCE(
          (SELECT SUM(pi2.portion_qty::numeric * COALESCE(i.unit_cost_per_base::numeric, 0))
           FROM product_ingredient pi2
           JOIN ingredients i ON pi2.ingredient_id = i.id
           WHERE pi2.product_id = p.id),
          (SELECT SUM(ri.portion_qty::numeric * COALESCE(i.unit_cost_per_base::numeric, 0))
           FROM product_recipe pr2
           JOIN recipe_ingredient ri ON pr2.recipe_id = ri.recipe_id
           JOIN ingredients i ON ri.ingredient_id = i.id
           WHERE pr2.product_id = p.id),
          0
        ) as cost
      FROM product p
      LEFT JOIN product_menu pm ON pm.product_id = p.id
      LEFT JOIN product_recipe pr ON pr.product_id = p.id
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
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const productResult = await db.execute(sql`
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.image_url as "imageUrl", 
        p.active, 
        p.created_at as "createdAt",
        pm.category,
        pm.sort_order as "sortOrder",
        pm.visible_in_store as "visibleInStore",
        pm.visible_grab as "visibleGrab",
        pm.visible_online as "visibleOnline",
        pr.recipe_id as "recipeId"
      FROM product p
      LEFT JOIN product_menu pm ON pm.product_id = p.id
      LEFT JOIN product_recipe pr ON pr.product_id = p.id
      WHERE p.id = ${id}
    `);

    const products = productResult.rows || productResult;
    if (!products.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = products[0];

    const ingredientsResult = await db.execute(sql`
      SELECT 
        pi.id,
        pi.ingredient_id as "ingredientId",
        i.name,
        i.base_unit as "baseUnit",
        pi.portion_qty as "portionQty",
        i.unit_cost_per_base as "unitCost"
      FROM product_ingredient pi
      INNER JOIN ingredients i ON pi.ingredient_id = i.id
      WHERE pi.product_id = ${id}
    `);

    const pricesResult = await db.execute(sql`
      SELECT id, channel, price
      FROM product_price
      WHERE product_id = ${id}
    `);

    const cost = await getProductCost(id);

    res.json({
      ok: true,
      product,
      ingredients: ingredientsResult.rows || ingredientsResult,
      prices: pricesResult.rows || pricesResult,
      cost,
    });
  } catch (error: any) {
    console.error("[products] Get error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    const { name, description, imageUrl, ingredients, prices, category, sortOrder, visibility, recipeId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    if ((!ingredients || ingredients.length === 0) && !recipeId) {
      return res.status(400).json({ error: "Product requires at least one ingredient or a linked recipe" });
    }

    const product = await db.transaction(async (tx) => {
      const productResult = await tx.execute(sql`
        INSERT INTO product (name, description, image_url)
        VALUES (${name}, ${description || null}, ${imageUrl || null})
        RETURNING id, name, description, image_url as "imageUrl", active, created_at as "createdAt"
      `);

      const productRows = productResult.rows || productResult;
      const created = productRows[0] as any;

      await tx.execute(sql`
        INSERT INTO product_menu (product_id, category, sort_order, visible_in_store, visible_grab, visible_online)
        VALUES (
          ${created.id},
          ${category || null},
          ${Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0},
          ${Boolean(visibility?.inStore)},
          ${Boolean(visibility?.grab)},
          ${Boolean(visibility?.online)}
        )
      `);

      if (recipeId) {
        await tx.execute(sql`
          INSERT INTO product_recipe (product_id, recipe_id)
          VALUES (${created.id}, ${recipeId})
        `);
      }

      for (const ing of ingredients) {
        await tx.execute(sql`
          INSERT INTO product_ingredient (product_id, ingredient_id, portion_qty)
          VALUES (${created.id}, ${ing.ingredientId}, ${ing.portionQty})
        `);
      }

      if (prices && prices.length > 0) {
        for (const p of prices) {
          await tx.execute(sql`
            INSERT INTO product_price (product_id, channel, price)
            VALUES (${created.id}, ${p.channel}, ${p.price})
          `);
        }
      }

      return created;
    });

    res.status(201).json({ ok: true, product });
  } catch (error: any) {
    console.error("[products] Create error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { name, description, imageUrl, ingredients, prices, active, category, sortOrder, visibility, recipeId } = req.body;

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE product
        SET name = ${name}, description = ${description || null}, image_url = ${imageUrl || null}, active = ${active !== false}
        WHERE id = ${id}
      `);

      await tx.execute(sql`
        INSERT INTO product_menu (product_id, category, sort_order, visible_in_store, visible_grab, visible_online)
        VALUES (
          ${id},
          ${category || null},
          ${Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0},
          ${Boolean(visibility?.inStore)},
          ${Boolean(visibility?.grab)},
          ${Boolean(visibility?.online)}
        )
        ON CONFLICT (product_id)
        DO UPDATE SET
          category = EXCLUDED.category,
          sort_order = EXCLUDED.sort_order,
          visible_in_store = EXCLUDED.visible_in_store,
          visible_grab = EXCLUDED.visible_grab,
          visible_online = EXCLUDED.visible_online
      `);

      await tx.execute(sql`DELETE FROM product_recipe WHERE product_id = ${id}`);
      if (recipeId) {
        await tx.execute(sql`
          INSERT INTO product_recipe (product_id, recipe_id)
          VALUES (${id}, ${recipeId})
        `);
      }

      await tx.execute(sql`DELETE FROM product_ingredient WHERE product_id = ${id}`);
      await tx.execute(sql`DELETE FROM product_price WHERE product_id = ${id}`);

      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          await tx.execute(sql`
            INSERT INTO product_ingredient (product_id, ingredient_id, portion_qty)
            VALUES (${id}, ${ing.ingredientId}, ${ing.portionQty})
          `);
        }
      }

      if (prices && prices.length > 0) {
        for (const p of prices) {
          await tx.execute(sql`
            INSERT INTO product_price (product_id, channel, price)
            VALUES (${id}, ${p.channel}, ${p.price})
          `);
        }
      }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[products] Update error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    await db.execute(sql`DELETE FROM product_recipe WHERE product_id = ${id}`);
    await db.execute(sql`DELETE FROM product_menu WHERE product_id = ${id}`);
    await db.execute(sql`DELETE FROM product_ingredient WHERE product_id = ${id}`);
    await db.execute(sql`DELETE FROM product_price WHERE product_id = ${id}`);
    await db.execute(sql`DELETE FROM product WHERE id = ${id}`);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[products] Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
