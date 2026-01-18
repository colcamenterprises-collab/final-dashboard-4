-- Product truth layer: ensure product table has required fields
-- Additive-only migration. Safe to re-run.

CREATE TABLE IF NOT EXISTS "public"."product" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image_url" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "recipe_id" INTEGER REFERENCES "public"."recipe"("id"),
  "base_cost" NUMERIC(10, 2),
  "price_in_store" NUMERIC(10, 2),
  "price_online" NUMERIC(10, 2),
  "price_grab" NUMERIC(10, 2),
  "category" TEXT,
  "visible_in_store" BOOLEAN NOT NULL DEFAULT FALSE,
  "visible_grab" BOOLEAN NOT NULL DEFAULT FALSE,
  "visible_online" BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "recipe_id" INTEGER REFERENCES "public"."recipe"("id");
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "base_cost" NUMERIC(10, 2);
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "price_in_store" NUMERIC(10, 2);
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "price_online" NUMERIC(10, 2);
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "price_grab" NUMERIC(10, 2);
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "visible_in_store" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "visible_grab" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "visible_online" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill recipe linkage from legacy product_recipe
UPDATE "public"."product" p
SET recipe_id = pr.recipe_id
FROM "public"."product_recipe" pr
WHERE pr.product_id = p.id
  AND p.recipe_id IS NULL;

-- Backfill category + visibility from legacy product_menu
UPDATE "public"."product" p
SET
  category = pm.category,
  visible_in_store = pm.visible_in_store,
  visible_grab = pm.visible_grab,
  visible_online = pm.visible_online
FROM "public"."product_menu" pm
WHERE pm.product_id = p.id
  AND (p.category IS NULL OR (p.visible_in_store = FALSE AND p.visible_grab = FALSE AND p.visible_online = FALSE));

-- Backfill prices from legacy product_price
UPDATE "public"."product" p
SET price_in_store = pp.price
FROM "public"."product_price" pp
WHERE pp.product_id = p.id
  AND pp.channel = 'IN_STORE'
  AND p.price_in_store IS NULL;

UPDATE "public"."product" p
SET price_grab = pp.price
FROM "public"."product_price" pp
WHERE pp.product_id = p.id
  AND pp.channel = 'GRAB'
  AND p.price_grab IS NULL;

UPDATE "public"."product" p
SET price_online = pp.price
FROM "public"."product_price" pp
WHERE pp.product_id = p.id
  AND pp.channel = 'ONLINE'
  AND p.price_online IS NULL;

-- Backfill base_cost from recipe ingredients when possible
UPDATE "public"."product" p
SET base_cost = recipe_cost.cost
FROM (
  SELECT pr.product_id,
         SUM(ri.portion_qty::numeric * COALESCE(i.unit_cost_per_base::numeric, 0)) AS cost
  FROM "public"."product_recipe" pr
  JOIN "public"."recipe_ingredient" ri ON pr.recipe_id = ri.recipe_id
  JOIN "public"."ingredients" i ON ri.ingredient_id = i.id
  GROUP BY pr.product_id
) recipe_cost
WHERE recipe_cost.product_id = p.id
  AND p.base_cost IS NULL;

UPDATE "public"."product" p
SET base_cost = recipe_cost.cost
FROM (
  SELECT ri.recipe_id,
         SUM(ri.portion_qty::numeric * COALESCE(i.unit_cost_per_base::numeric, 0)) AS cost
  FROM "public"."recipe_ingredient" ri
  JOIN "public"."ingredients" i ON ri.ingredient_id = i.id
  GROUP BY ri.recipe_id
) recipe_cost
WHERE recipe_cost.recipe_id = p.recipe_id
  AND p.base_cost IS NULL;
