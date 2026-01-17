-- Add product menu metadata (category + visibility) and product-recipe linkage
CREATE TABLE IF NOT EXISTS "public"."product_menu" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "public"."product"("id") ON DELETE CASCADE,
  "category" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "visible_in_store" BOOLEAN NOT NULL DEFAULT FALSE,
  "visible_grab" BOOLEAN NOT NULL DEFAULT FALSE,
  "visible_online" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_menu_product_id_key" ON "public"."product_menu"("product_id");

CREATE TABLE IF NOT EXISTS "public"."product_recipe" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "public"."product"("id") ON DELETE CASCADE,
  "recipe_id" INTEGER NOT NULL REFERENCES "public"."recipe"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_recipe_product_id_key" ON "public"."product_recipe"("product_id");
