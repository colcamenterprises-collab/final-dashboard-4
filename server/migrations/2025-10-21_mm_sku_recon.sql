-- Meekong Mumba v1.0 — SKU Reconciliation Migration
-- 1) Alias table: map name-only lines to a SKU (manual safety net)
CREATE TABLE IF NOT EXISTS item_alias (
  alias_name text PRIMARY KEY,          -- exact match on line-item name from Loyverse
  sku        text NOT NULL REFERENCES item_catalog(sku) ON UPDATE CASCADE
);

-- 2) Helpful indexes for normalized tables (if not already present)
CREATE INDEX IF NOT EXISTS ix_lv_receipt_datetime ON lv_receipt(datetime_bkk);
CREATE INDEX IF NOT EXISTS ix_lv_line_item_receipt  ON lv_line_item(receipt_id);
CREATE INDEX IF NOT EXISTS ix_lv_line_item_sku      ON lv_line_item(sku);

-- 3) Reaffirm PK/uniqueness to prevent duplicate lines
-- lv_line_item already has PRIMARY KEY (receipt_id, line_no)
-- lv_receipt already has PRIMARY KEY (receipt_id)

-- 4) Guard analytics cache uniqueness (already set, but ensure present)
-- UNIQUE (shift_date, COALESCE(sku, name)) exists on analytics_shift_item
