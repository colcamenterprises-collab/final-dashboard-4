-- Mekong Mamba v1.0 — All Items + Modifiers Fix Migration
-- Idempotent schema updates for SKU-first resolution and meal-set deduplication

-- Core alias (if not already)
CREATE TABLE IF NOT EXISTS item_alias (
  alias_name  text PRIMARY KEY,           -- exact receipt line name
  sku         text NOT NULL               -- resolves to catalog SKU
);

-- Catalog extensions: meal-deals, and ensure essentials exist
ALTER TABLE item_catalog
  ADD COLUMN IF NOT EXISTS is_meal_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_sku   text NULL;

-- Known meal-deal -> base SKU links (verify)
UPDATE item_catalog SET is_meal_set=true, base_sku='10019' WHERE sku='10036'; -- Super Double Set -> Super Double
UPDATE item_catalog SET is_meal_set=true, base_sku='10004' WHERE sku='10033'; -- Single Set  -> Single
UPDATE item_catalog SET is_meal_set=true, base_sku='10009' WHERE sku='10034'; -- Triple Set  -> Triple
UPDATE item_catalog SET is_meal_set=true, base_sku='10006' WHERE sku='10032'; -- Double Set  -> Ultimate Double
UPDATE item_catalog SET is_meal_set=true, base_sku='10070' WHERE sku='10071'; -- Karaage Meal -> Karaage Burger
-- Mix & Match is a generic bundle, do not map to a base burger:
UPDATE item_catalog SET is_meal_set=true, base_sku=NULL   WHERE sku='10069';

-- Normalized receipts: helpful indexes (safe if they exist)
CREATE INDEX IF NOT EXISTS ix_lv_receipt_bkk ON lv_receipt(datetime_bkk);
CREATE INDEX IF NOT EXISTS ix_lv_line_item_sku ON lv_line_item(sku);
CREATE INDEX IF NOT EXISTS ix_lv_line_item_receipt ON lv_line_item(receipt_id);

-- Modifiers table (per LOYVERSE line modifiers), if not present
-- Expected columns: receipt_id, parent_line_no, name, sku (nullable), qty, unit_price
-- If your table already exists with different names, adapt the views below instead of creating.
CREATE TABLE IF NOT EXISTS lv_modifier (
  receipt_id   text NOT NULL,
  parent_line_no int NOT NULL,
  name         text NOT NULL,
  sku          text NULL,
  qty          numeric NOT NULL DEFAULT 1,
  unit_price   numeric NULL,
  PRIMARY KEY (receipt_id, parent_line_no, name)
);

-- Analytics tables for modifiers
CREATE TABLE IF NOT EXISTS analytics_shift_modifier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  sku text NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'modifier',
  qty integer NOT NULL,
  raw_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index with COALESCE expression
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_shift_modifier_unique 
  ON analytics_shift_modifier (shift_date, COALESCE(sku, name));
