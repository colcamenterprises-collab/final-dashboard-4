-- Item Catalog System Migration
-- Creates tables for SKU-based item management and shift-level caching

CREATE TABLE IF NOT EXISTS item_catalog (
  sku         text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('burger','drink','side','modifier','bundle')),
  -- for burgers only:
  kind        text NULL CHECK (kind IN ('beef','chicken')),
  patties_per int  NULL,
  grams_per   int  NULL,
  rolls_per   int  NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_catalog_category ON item_catalog (category);
CREATE INDEX IF NOT EXISTS idx_item_catalog_kind ON item_catalog (kind);

-- Per-item shift cache (all categories)
CREATE TABLE IF NOT EXISTS analytics_shift_item (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  from_ts    timestamptz NOT NULL,
  to_ts      timestamptz NOT NULL,
  sku        text,
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN ('burger','drink','side','modifier','bundle')),
  qty        int NOT NULL DEFAULT 0,
  raw_hits   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asi_shift ON analytics_shift_item (shift_date, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asi_unique_sku ON analytics_shift_item (shift_date, category, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_asi_unique_name ON analytics_shift_item (shift_date, category, name) WHERE sku IS NULL;

-- Per-category summary
CREATE TABLE IF NOT EXISTS analytics_shift_category_summary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date  date NOT NULL,
  from_ts     timestamptz NOT NULL,
  to_ts       timestamptz NOT NULL,
  category    text NOT NULL CHECK (category IN ('burger','drink','side','modifier','bundle')),
  items_total int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_date, category)
);

CREATE INDEX IF NOT EXISTS idx_ascs_shift ON analytics_shift_category_summary (shift_date, category);
