import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { pool } from "../db";
import { getOnlineProductsFlat } from "../services/onlineProductFeed";

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_STATUSES = ["NEW", "PREPARING", "READY"] as const;

const generateOrderRef = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

const parseTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const RECIPE_META_PREFIX = "RECIPE_CALC_V2:";

const parseRecipeMeta = (notes: string | null | undefined): Record<string, any> => {
  if (!notes || !notes.startsWith(RECIPE_META_PREFIX)) return {};
  try {
    return JSON.parse(notes.slice(RECIPE_META_PREFIX.length));
  } catch {
    return {};
  }
};

const buildRecipeMeta = (meta: Record<string, any>) => `${RECIPE_META_PREFIX}${JSON.stringify(meta ?? {})}`;

const cleanMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

async function loadRecipeForPublish(recipeId: number) {
  const result = await pool.query(
    `SELECT id, name, description, category, suggested_price, image_url, notes
     FROM recipes
     WHERE id = $1
     LIMIT 1`,
    [recipeId],
  );

  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const meta = parseRecipeMeta(row.notes);

  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? "Unmapped"),
    price: cleanMoney(meta?.pricing?.directPrice ?? row.suggested_price),
    imageUrl: String(meta?.imageUrl || row.image_url || ""),
    notes: String(row.notes ?? ""),
    meta,
  };
}

router.post("/online/products/upsert-from-recipe", async (req, res) => {
  try {
    const recipeId = Number(req.body?.recipeId);
    if (!Number.isFinite(recipeId)) {
      return res.status(400).json({ error: "recipeId is required" });
    }

    const recipe = await loadRecipeForPublish(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const existing = await pool.query(
      `SELECT id
       FROM product
       WHERE recipe_id = $1
       LIMIT 1`,
      [recipeId],
    );

    let productId = 0;
    let action: "created" | "updated" = "updated";

    if (existing.rows[0]) {
      productId = Number(existing.rows[0].id);
      await pool.query(
        `UPDATE product
         SET name = $2,
             description = $3,
             image_url = $4,
             category = $5,
             price_online = $6,
             visible_online = true,
             active = true,
             updated_at = now()
         WHERE id = $1`,
        [productId, recipe.name, recipe.description, recipe.imageUrl, recipe.category, recipe.price],
      );
    } else {
      action = "created";
      const inserted = await pool.query(
        `INSERT INTO product (
           name,
           description,
           image_url,
           recipe_id,
           category,
           price_online,
           visible_online,
           active
         )
         VALUES ($1, $2, $3, $4, $5, $6, true, true)
         RETURNING id`,
        [recipe.name, recipe.description, recipe.imageUrl, recipe.id, recipe.category, recipe.price],
      );
      productId = Number(inserted.rows[0].id);
    }

    const nextMeta = {
      ...recipe.meta,
      onlinePublishing: {
        productId,
        published: true,
        publishedAt: new Date().toISOString(),
      },
    };

    await pool.query(
      `UPDATE recipes
       SET notes = $2,
           updated_at = now()
       WHERE id = $1`,
      [recipe.id, buildRecipeMeta(nextMeta)],
    );

    console.log("[online/products/upsert-from-recipe] synced", { recipeId, productId, action });
    res.json({ ok: true, productId, action });
  } catch (error) {
    console.error("Error upserting online product from recipe:", error);
    res.status(500).json({ error: "Failed to publish recipe to online ordering" });
  }
});

router.post("/online/products/unpublish-from-recipe", async (req, res) => {
  try {
    const recipeId = Number(req.body?.recipeId);
    if (!Number.isFinite(recipeId)) {
      return res.status(400).json({ error: "recipeId is required" });
    }

    const recipe = await loadRecipeForPublish(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const existing = await pool.query(
      `SELECT id
       FROM product
       WHERE recipe_id = $1
       LIMIT 1`,
      [recipeId],
    );

    const productId = existing.rows[0] ? Number(existing.rows[0].id) : 0;

    if (productId > 0) {
      await pool.query(
        `UPDATE product
         SET visible_online = false,
             updated_at = now()
         WHERE id = $1`,
        [productId],
      );
    }

    const nextMeta = {
      ...recipe.meta,
      onlinePublishing: {
        productId: productId || null,
        published: false,
        publishedAt: recipe.meta?.onlinePublishing?.publishedAt ?? null,
        unpublishedAt: new Date().toISOString(),
      },
    };

    await pool.query(
      `UPDATE recipes
       SET notes = $2,
           updated_at = now()
       WHERE id = $1`,
      [recipe.id, buildRecipeMeta(nextMeta)],
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error unpublishing recipe from online ordering:", error);
    res.status(500).json({ error: "Failed to unpublish recipe from online ordering" });
  }
});

router.get("/online/products", async (_req, res) => {
  try {
    const itemsResult = await pool.query(
      `SELECT id, name, description, image_url, category, price_online, visible_online
       FROM product
       WHERE active = true
         AND visible_online = true
         AND price_online IS NOT NULL
         AND price_online > 0
       ORDER BY category ASC NULLS LAST, name ASC`,
    );

    const grouped = new Map<string, Array<any>>();
    for (const row of itemsResult.rows) {
      const category = String(row.category ?? "UNMAPPED").trim() || "UNMAPPED";
      const existing = grouped.get(category) || [];
      existing.push({
        id: Number(row.id),
        name: String(row.name ?? ""),
        description: row.description == null ? null : String(row.description),
        image: row.image_url == null ? null : String(row.image_url),
        imageUrl: row.image_url == null ? null : String(row.image_url),
        price: row.price_online == null ? null : Number(row.price_online),
        price_online: row.price_online == null ? null : Number(row.price_online),
        online_category: category,
        visible_online: true,
      });
      grouped.set(category, existing);
    }

    const categories = Array.from(grouped.entries()).map(([name, categoryItems]) => ({
      name,
      items: categoryItems,
    }));

    res.json({ categories });
  } catch (error) {
    console.error("Error fetching online products:", error);
    res.status(500).json({ error: "Failed to fetch online products" });
  }
});

router.get("/online/products/catalog", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, image_url, category, price_online, visible_online, active
       FROM product
       WHERE active = true
       ORDER BY category ASC NULLS LAST, name ASC`,
    );

    const items = result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ""),
      description: row.description == null ? null : String(row.description),
      imageUrl: row.image_url == null ? null : String(row.image_url),
      online_category: row.category == null ? null : String(row.category),
      price_online: row.price_online == null ? null : Number(row.price_online),
      visible_online: row.visible_online === true,
      active: row.active === true,
    }));

    res.json({ items });
  } catch (error) {
    console.error("Error fetching online product catalog:", error);
    res.status(500).json({ error: "Failed to fetch online product catalog" });
  }
});

router.patch("/online/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const body = req.body ?? {};
    const allowedKeys = ["visible_online", "price_online", "online_category", "description", "imageUrl", "name"] as const;

    const hasAnyAllowedField = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
    if (!hasAnyAllowedField) {
      return res.status(400).json({ error: "No supported fields in payload" });
    }

    const currentResult = await pool.query(
      `SELECT id, name, description, image_url, category, price_online, visible_online
       FROM product
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ error: "Product not found" });
    }

    const name = Object.prototype.hasOwnProperty.call(body, "name") ? String(body.name ?? "").trim() : String(current.name ?? "");
    const description = Object.prototype.hasOwnProperty.call(body, "description") ? (body.description == null ? null : String(body.description)) : current.description;
    const imageUrl = Object.prototype.hasOwnProperty.call(body, "imageUrl") ? (body.imageUrl == null ? null : String(body.imageUrl)) : current.image_url;
    const onlineCategory = Object.prototype.hasOwnProperty.call(body, "online_category") ? (body.online_category == null ? null : String(body.online_category).trim()) : current.category;

    let priceOnline = current.price_online == null ? null : Number(current.price_online);
    if (Object.prototype.hasOwnProperty.call(body, "price_online")) {
      const parsed = Number(body.price_online);
      priceOnline = Number.isFinite(parsed) ? parsed : null;
    }

    const visibleOnline = Object.prototype.hasOwnProperty.call(body, "visible_online")
      ? Boolean(body.visible_online)
      : current.visible_online === true;

    if (visibleOnline && (!(typeof priceOnline === "number") || priceOnline <= 0)) {
      return res.status(400).json({ error: "Online price required" });
    }

    if (visibleOnline && (!onlineCategory || !String(onlineCategory).trim())) {
      return res.status(400).json({ error: "Missing category" });
    }

    const updated = await pool.query(
      `UPDATE product
       SET name = $2,
           description = $3,
           image_url = $4,
           category = $5,
           price_online = $6,
           visible_online = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, image_url, category, price_online, visible_online`,
      [id, name, description, imageUrl, onlineCategory, priceOnline, visibleOnline],
    );

    const row = updated.rows[0];
    return res.json({
      item: {
        id: Number(row.id),
        name: String(row.name ?? ""),
        description: row.description == null ? null : String(row.description),
        imageUrl: row.image_url == null ? null : String(row.image_url),
        online_category: row.category == null ? null : String(row.category),
        price_online: row.price_online == null ? null : Number(row.price_online),
        visible_online: row.visible_online === true,
      },
    });
  } catch (error) {
    console.error("Error updating online product:", error);
    return res.status(500).json({ error: "Failed to update online product" });
  }
});

router.post("/online/orders", async (req, res) => {
  try {
    const { items, channel, timestamp } = req.body || {};

    if (channel !== "ONLINE") {
      return res.status(400).json({ error: "Channel must be ONLINE" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    if (!timestamp || typeof timestamp !== "string") {
      return res.status(400).json({ error: "timestamp is required" });
    }

    const parsedTimestamp = parseTimestamp(timestamp);
    if (!parsedTimestamp) {
      return res.status(400).json({ error: "timestamp must be a valid ISO string" });
    }

    const onlineProducts = await getOnlineProductsFlat();
    const productMap = new Map<number, (typeof onlineProducts)[number]>();
    for (const product of onlineProducts) {
      productMap.set(product.id, product);
    }

    const errors: Array<{ productId: number; error: string }> = [];
    const lineItems: Array<{
      itemId: string;
      name: string;
      qty: number;
      basePrice: number;
      lineTotal: number;
    }> = [];

    for (const item of items) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);
      const priceAtTime = Number(item?.priceAtTimeOfSale);

      if (!Number.isInteger(productId)) {
        errors.push({ productId, error: "Invalid productId" });
        continue;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors.push({ productId, error: "Invalid quantity" });
        continue;
      }

      const product = productMap.get(productId);
      if (!product) {
        errors.push({ productId, error: "Product not available online" });
        continue;
      }

      if (!Number.isFinite(product.price)) {
        errors.push({ productId, error: "Online price is invalid" });
        continue;
      }

      const priceOnline = product.price as number;
      if (!Number.isFinite(priceAtTime) || priceAtTime !== priceOnline) {
        errors.push({ productId, error: "Price mismatch. Refresh menu before checkout." });
        continue;
      }

      const lineTotal = priceOnline * quantity;
      lineItems.push({
        itemId: String(product.id),
        name: product.name,
        qty: quantity,
        basePrice: priceOnline,
        lineTotal,
      });
    }

    if (errors.length > 0) {
      return res.status(409).json({ error: "Order blocked due to product changes", details: errors });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    if (!Number.isFinite(subtotal)) {
      return res.status(400).json({ error: "Subtotal is invalid" });
    }

    const order = await prisma.orderOnline.create({
      data: {
        ref: generateOrderRef(),
        status: "NEW",
        subtotal,
        vatAmount: 0,
        total: subtotal,
        rawPayload: {
          channel,
          timestamp,
          items,
        },
        lines: {
          create: lineItems,
        },
      },
      include: {
        lines: true,
      },
    });

    res.status(201).json({
      orderId: order.id,
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Error creating online order:", error);
    res.status(500).json({ error: "Failed to submit order" });
  }
});

router.get("/online/orders", async (_req, res) => {
  try {
    const orders = await prisma.orderOnline.findMany({
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });

    res.json({
      orders: orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        status: order.status ?? "NEW",
        channel: "ONLINE",
        items: order.lines.map((line) => ({
          productId: line.itemId,
          name: line.name,
          quantity: line.qty ?? 1,
          priceAtTimeOfSale: line.basePrice,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching online orders:", error);
    res.status(500).json({ error: "Failed to fetch online orders" });
  }
});

router.patch("/online/orders/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "").toUpperCase();
    if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await prisma.orderOnline.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({
      id: order.id,
      status: order.status,
    });
  } catch (error) {
    console.error("Error updating online order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

router.get("/ordering/menu", async (_req, res) => {
  try {
    const items = await getOnlineProductsFlat();
    const grouped = new Map<string, Array<any>>();

    for (const item of items) {
      const category = (item.category || "Unmapped").trim() || "Unmapped";
      const existing = grouped.get(category) || [];
      existing.push({
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: item.image,
        price: item.price,
        category,
      });
      grouped.set(category, existing);
    }

    const categories = Array.from(grouped.entries()).map(([name, categoryItems]) => ({
      name,
      items: categoryItems,
    }));

    res.json({ deprecated: true, categories });
  } catch (error) {
    console.error("Error fetching ordering menu (deprecated):", error);
    res.status(500).json({ error: "Menu not found" });
  }
});

// Deprecated: legacy file-backed order endpoint. Use /api/online/orders instead.
router.post("/ordering/orders", (_req, res) => {
  res.status(410).json({ error: "Deprecated. Submit orders via /api/online/orders." });
});

// Deprecated: legacy file-backed order endpoint. Use /api/online/orders instead.
router.get("/ordering/orders", (_req, res) => {
  res.status(410).json({ error: "Deprecated. Fetch orders via /api/online/orders." });
});

export default router;
