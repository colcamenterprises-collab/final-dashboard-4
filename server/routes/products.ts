/**
 * PATCH P1: PRODUCTS API ROUTES
 * 
 * CRUD endpoints for products with multi-channel pricing
 * Products link to canonical ingredients for cost calculation
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getProductCost } from "../services/productCost.service";
import { calculateRecipeCost } from "../services/recipeAuthority";

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
        p.category,
        p.visible_in_store as "visibleInStore",
        p.visible_grab as "visibleGrab",
        p.visible_online as "visibleOnline",
        p.recipe_id as "recipeId",
        p.base_cost as cost
      FROM product p
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
        p.category,
        p.visible_in_store as "visibleInStore",
        p.visible_grab as "visibleGrab",
        p.visible_online as "visibleOnline",
        p.recipe_id as "recipeId",
        p.price_in_store as "priceInStore",
        p.price_grab as "priceGrab",
        p.price_online as "priceOnline",
        p.base_cost as "baseCost"
      FROM product p
      WHERE p.id = ${id}
    `);

    const products = productResult.rows || productResult;
    if (!products.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = products[0];

    const ingredientsResult = await db.execute(sql`
      SELECT 
        ri.id,
        ri.ingredient_id as "ingredientId",
        i.name,
        i.base_unit as "baseUnit",
        ri.portion_qty as "portionQty",
        i.unit_cost_per_base as "unitCost"
      FROM recipe_ingredient ri
      INNER JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ${product.recipeId}
    `);

    const prices = [
      { channel: "IN_STORE", price: product.priceInStore },
      { channel: "GRAB", price: product.priceGrab },
      { channel: "ONLINE", price: product.priceOnline },
    ].filter((price) => price.price !== null && price.price !== undefined);

    const cost = product.baseCost ?? await getProductCost(id);

    res.json({
      ok: true,
      product,
      ingredients: ingredientsResult.rows || ingredientsResult,
      prices,
      cost,
    });
  } catch (error: any) {
    console.error("[products] Get error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    const { name, description, imageUrl, prices, category, visibility, recipeId, active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    if (!recipeId) {
      return res.status(400).json({ error: "Product requires a linked recipe" });
    }

    const product = await db.transaction(async (tx) => {
      const baseCost = await calculateRecipeCost(Number(recipeId));
      if (baseCost === null) {
        throw new Error("Recipe must have valid serves and quantities before creating a product");
      }
      const priceInStore = prices?.find((p: any) => p.channel === "IN_STORE")?.price ?? null;
      const priceOnline = prices?.find((p: any) => p.channel === "ONLINE")?.price ?? null;
      const hasPrice = (priceInStore && priceInStore > 0) || (priceOnline && priceOnline > 0);
      const hasImage = Boolean(imageUrl && String(imageUrl).trim());
      const activeFlag = active === true;
      const canActivate = hasPrice && hasImage && baseCost !== null && Boolean(recipeId);
      if (activeFlag && !canActivate) {
        throw new Error("Product cannot be activated until it has an image, price, linked recipe, and base cost");
      }
      const productResult = await tx.execute(sql`
        INSERT INTO product (
          name,
          description,
          image_url,
          recipe_id,
          base_cost,
          price_in_store,
          price_grab,
          price_online,
          category,
          active,
          visible_in_store,
          visible_grab,
          visible_online
        )
        VALUES (
          ${name},
          ${description || null},
          ${imageUrl || null},
          ${Number(recipeId)},
          ${Number(baseCost.toFixed(2))},
          ${priceInStore},
          ${prices?.find((p: any) => p.channel === "GRAB")?.price ?? null},
          ${priceOnline},
          ${category || null},
          ${activeFlag},
          ${Boolean(visibility?.inStore)},
          ${Boolean(visibility?.grab)},
          ${Boolean(visibility?.online)}
        )
        RETURNING id, name, description, image_url as "imageUrl", active, created_at as "createdAt"
      `);

      const productRows = productResult.rows || productResult;
      const created = productRows[0] as any;

      return created;
    });

    res.status(201).json({ ok: true, product });
  } catch (error: any) {
    console.error("[products] Create error:", error);
    if (error.message?.includes("Recipe must have valid serves") || error.message?.includes("Product cannot be activated")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { name, description, imageUrl, prices, active, category, visibility, recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: "Product requires a linked recipe" });
    }

    await db.transaction(async (tx) => {
      const baseCost = recipeId ? await calculateRecipeCost(Number(recipeId)) : null;
      if (recipeId && baseCost === null) {
        throw new Error("Recipe must have valid serves and quantities before updating product");
      }
      const priceInStore = prices?.find((p: any) => p.channel === "IN_STORE")?.price ?? null;
      const priceOnline = prices?.find((p: any) => p.channel === "ONLINE")?.price ?? null;
      const hasPrice = (priceInStore && priceInStore > 0) || (priceOnline && priceOnline > 0);
      const hasImage = Boolean(imageUrl && String(imageUrl).trim());
      const activeFlag = active === true;
      const canActivate = hasPrice && hasImage && baseCost !== null && Boolean(recipeId);
      if (activeFlag && !canActivate) {
        throw new Error("Product cannot be activated until it has an image, price, linked recipe, and base cost");
      }
      await tx.execute(sql`
        UPDATE product
        SET
          name = ${name},
          description = ${description || null},
          image_url = ${imageUrl || null},
          recipe_id = ${recipeId ? Number(recipeId) : null},
          base_cost = ${baseCost !== null ? Number(baseCost.toFixed(2)) : null},
          price_in_store = ${priceInStore},
          price_grab = ${prices?.find((p: any) => p.channel === "GRAB")?.price ?? null},
          price_online = ${priceOnline},
          category = ${category || null},
          active = ${activeFlag},
          visible_in_store = ${Boolean(visibility?.inStore)},
          visible_grab = ${Boolean(visibility?.grab)},
          visible_online = ${Boolean(visibility?.online)}
        WHERE id = ${id}
      `);
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[products] Update error:", error);
    if (error.message?.includes("Recipe must have valid serves") || error.message?.includes("Product cannot be activated")) {
      return res.status(400).json({ error: error.message });
    }
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
