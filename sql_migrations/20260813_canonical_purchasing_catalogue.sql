-- Canonical Purchasing Catalogue: additive, audit-safe migration
-- Existing purchasing_items rows remain untouched and selectable only while active.
BEGIN;

ALTER TABLE purchasing_items ADD COLUMN IF NOT EXISTS catalogue_code TEXT;
ALTER TABLE purchasing_items ADD COLUMN IF NOT EXISTS purchase_quantity NUMERIC(12,3);
ALTER TABLE purchasing_items ADD COLUMN IF NOT EXISTS base_unit TEXT;
ALTER TABLE purchasing_items ADD COLUMN IF NOT EXISTS purchase_cost_thb NUMERIC(12,2);
ALTER TABLE purchasing_items ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Preserve the previously displayed cost as the initial package cost where no
-- explicit canonical cost has yet been imported.
UPDATE purchasing_items
SET purchase_cost_thb = unit_cost
WHERE purchase_cost_thb IS NULL AND unit_cost IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchasing_items_catalogue_code_unique
  ON purchasing_items (catalogue_code)
  WHERE catalogue_code IS NOT NULL;

COMMIT;
