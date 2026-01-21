CREATE TABLE IF NOT EXISTS ingredient_authority (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT NOT NULL,
  purchase_quantity DECIMAL(12, 3) NOT NULL CHECK (purchase_quantity > 0),
  purchase_unit TEXT NOT NULL,
  purchase_cost_thb DECIMAL(12, 2) NOT NULL CHECK (purchase_cost_thb >= 0),
  portion_quantity DECIMAL(12, 3) NOT NULL CHECK (portion_quantity > 0),
  portion_unit TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingredient_authority_name_idx ON ingredient_authority (name);
