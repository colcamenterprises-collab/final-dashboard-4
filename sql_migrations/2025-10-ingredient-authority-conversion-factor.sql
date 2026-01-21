ALTER TABLE ingredient_authority
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(12, 4);
