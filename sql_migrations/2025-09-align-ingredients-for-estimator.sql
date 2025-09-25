-- 2025-09 Align ingredients table for estimator system
-- Adds missing columns and supporting tables for shopping list cost estimation
-- Safe: Uses IF NOT EXISTS, backfills from legacy data, inside transaction

BEGIN;

-- 1) Create suppliers table if missing
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2) Create shopping_list_items table if missing (for shopping list functionality)
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id SERIAL PRIMARY KEY,
  shopping_list_id INTEGER REFERENCES shopping_list(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  requested_qty DECIMAL(10,3),
  requested_unit VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3) Add new columns to ingredients table (IF NOT EXISTS for safety)
ALTER TABLE ingredients 
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS package_qty DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS package_unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS package_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS portion_qty DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS portion_unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS portion_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS last_review DATE,
  ADD COLUMN IF NOT EXISTS brand VARCHAR(255);

-- 4) Insert default suppliers from existing data
INSERT INTO suppliers (name) 
SELECT DISTINCT supplier 
FROM ingredients 
WHERE supplier IS NOT NULL 
  AND supplier != '' 
  AND supplier != 'N/A'
  AND NOT EXISTS (
    SELECT 1 FROM suppliers WHERE name = ingredients.supplier
  );

-- Add fallback supplier for missing data
INSERT INTO suppliers (name) 
SELECT 'Unknown Supplier'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Unknown Supplier');

-- 5) Update ingredients to link with suppliers
UPDATE ingredients 
SET supplier_id = s.id
FROM suppliers s
WHERE ingredients.supplier = s.name
  AND ingredients.supplier_id IS NULL;

-- Set fallback supplier for NULL/empty suppliers
UPDATE ingredients 
SET supplier_id = (SELECT id FROM suppliers WHERE name = 'Unknown Supplier')
WHERE supplier_id IS NULL;

-- 6) Backfill new columns from legacy data if present
-- Map legacy unit cost to package cost where available
UPDATE ingredients 
SET package_cost = COALESCE("unitCost", 0)
WHERE package_cost IS NULL 
  AND "unitCost" IS NOT NULL;

-- Default package quantities for existing items
UPDATE ingredients 
SET package_qty = 1,
    package_unit = COALESCE(unit, 'unit')
WHERE package_qty IS NULL;

-- Default portion data
UPDATE ingredients 
SET portion_qty = 1,
    portion_unit = COALESCE(unit, 'unit'),
    portion_cost = COALESCE(package_cost, 0)
WHERE portion_qty IS NULL;

-- 7) Ensure shopping_list_items has requested_unit defaulted
UPDATE shopping_list_items 
SET requested_unit = 'unit'
WHERE requested_unit IS NULL;

-- 8) Add helpful indexes for the estimator queries
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier_id ON ingredients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id ON shopping_list_items(shopping_list_id);

-- 9) Update any NULL costs to 0 for consistent calculations
UPDATE ingredients 
SET package_cost = 0 
WHERE package_cost IS NULL;

UPDATE ingredients 
SET portion_cost = 0 
WHERE portion_cost IS NULL;

COMMIT;

-- Post-migration summary
\echo 'Migration completed successfully!'
\echo 'Added columns: supplier_id, package_qty, package_unit, package_cost, portion_qty, portion_unit, portion_cost, last_review, brand'
\echo 'Created tables: suppliers, shopping_list_items (if missing)'
\echo 'Backfilled data from legacy columns where available'
\echo 'Added indexes for estimator performance'