-- Online Ordering Catalog source-of-truth table
-- Additive-only migration

DO $$ BEGIN
  CREATE TYPE online_catalog_source_type AS ENUM ('recipe', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS online_catalog_items (
  id BIGSERIAL PRIMARY KEY,
  source_type online_catalog_source_type NOT NULL,
  source_id BIGINT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS online_catalog_recipe_source_unique
  ON online_catalog_items (source_type, source_id)
  WHERE source_type = 'recipe' AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS online_catalog_published_idx
  ON online_catalog_items (is_published, category, sort_order, id);
