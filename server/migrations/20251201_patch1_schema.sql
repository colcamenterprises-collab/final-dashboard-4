-- PATCH 1 — Schema enforcement for ingredient yield + product recipe truth
-- Additive-only migration. Safe to re-run.

-- 1) Ingredient yield enforcement (mandatory for costing)
ALTER TABLE IF EXISTS "public"."ingredients"
  ADD COLUMN IF NOT EXISTS "purchase_unit" TEXT
    CHECK (purchase_unit IN ('kg', 'litre', 'pack', 'each')),
  ADD COLUMN IF NOT EXISTS "purchase_cost" NUMERIC(10,2)
    CHECK (purchase_cost >= 0),
  ADD COLUMN IF NOT EXISTS "yield_unit" TEXT
    CHECK (yield_unit IN ('grams', 'ml', 'slices', 'units')),
  ADD COLUMN IF NOT EXISTS "yield_per_purchase" NUMERIC(10,2)
    CHECK (yield_per_purchase > 0),
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ingredients'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ingredient_yield_required'
  ) THEN
    ALTER TABLE "public"."ingredients"
      ADD CONSTRAINT ingredient_yield_required
      CHECK (
        (yield_unit IS NOT NULL AND yield_per_purchase IS NOT NULL)
        OR active = FALSE
      );
  END IF;
END $$;

-- 2) Product (recipe truth source)
CREATE TABLE IF NOT EXISTS "public"."product" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "prep_notes" TEXT,
  "image_url" TEXT,
  "category" TEXT,
  "sale_price" NUMERIC(10,2)
    CHECK (sale_price >= 0),
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_product_active"
  ON "public"."product"("active");

CREATE INDEX IF NOT EXISTS "idx_product_category"
  ON "public"."product"("category");

-- 3) Product ingredient (line-by-line reality)
CREATE TABLE IF NOT EXISTS "public"."product_ingredient" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL
    REFERENCES "public"."product"("id") ON DELETE CASCADE,
  "ingredient_id" INTEGER NOT NULL
    REFERENCES "public"."ingredients"("id"),
  "quantity_used" NUMERIC(10,2) NOT NULL
    CHECK (quantity_used > 0),
  "prep_note" TEXT,
  "unit_cost_derived" NUMERIC(10,4) NOT NULL,
  "line_cost_derived" NUMERIC(10,4) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_product_ingredient_product"
  ON "public"."product_ingredient"("product_id");
