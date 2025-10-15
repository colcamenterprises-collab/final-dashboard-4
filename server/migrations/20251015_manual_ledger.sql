-- Patch V4.0 Manual Ledger - Idempotent create

CREATE TABLE IF NOT EXISTS manual_stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date DATE NOT NULL,
  completed_by TEXT,
  source_form_id UUID,
  total_sales NUMERIC(12,2),
  cash_sales NUMERIC(12,2),
  qr_sales NUMERIC(12,2),
  grab_sales NUMERIC(12,2),
  other_sales NUMERIC(12,2),
  shopping_total NUMERIC(12,2),
  wages_total NUMERIC(12,2),

  rolls_prev_end INT DEFAULT 0,
  rolls_purchased INT DEFAULT 0,
  burgers_sold INT DEFAULT 0,
  rolls_expected INT DEFAULT 0,
  rolls_actual INT DEFAULT 0,
  rolls_variance INT DEFAULT 0,
  rolls_paid BOOLEAN DEFAULT FALSE,

  meat_prev_end_g INT DEFAULT 0,
  meat_purchased_g INT DEFAULT 0,
  meat_sold_g INT DEFAULT 0,
  meat_expected_g INT DEFAULT 0,
  meat_actual_g INT DEFAULT 0,
  meat_variance_g INT DEFAULT 0,
  meat_paid BOOLEAN DEFAULT FALSE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_stock_ledger_shift_date
  ON manual_stock_ledger (shift_date);

CREATE TABLE IF NOT EXISTS drink_brand (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'can'
);

CREATE TABLE IF NOT EXISTS manual_drink_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES manual_stock_ledger(id) ON DELETE CASCADE,
  brand_id INT NOT NULL REFERENCES drink_brand(id) ON DELETE RESTRICT,
  prev_end INT DEFAULT 0,
  purchased INT DEFAULT 0,
  sold INT DEFAULT 0,
  expected INT DEFAULT 0,
  actual INT DEFAULT 0,
  variance INT DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_drink_ledger_shift_brand
  ON manual_drink_ledger (shift_id, brand_id);
