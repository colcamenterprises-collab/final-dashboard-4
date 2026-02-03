ALTER TABLE purchasing_items
  ADD COLUMN IF NOT EXISTS pack_cost NUMERIC(10, 2);

ALTER TABLE recipe_ingredient
  ADD COLUMN IF NOT EXISTS portion_unit VARCHAR(50);

ALTER TABLE recipe_lines
  ADD COLUMN IF NOT EXISTS waste_percentage NUMERIC DEFAULT 5;

UPDATE purchasing_items
SET pack_cost = 349
WHERE pack_cost IS NULL
  AND (
    UPPER("supplierSku") LIKE '%CHEESE%'
    OR UPPER(brand) LIKE '%CHEESE%'
  );
