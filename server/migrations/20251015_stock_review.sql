-- idempotent schema (also created at runtime)
CREATE TABLE IF NOT EXISTS stock_ledger_day (
  day DATE PRIMARY KEY,
  rolls_prev_end INTEGER NOT NULL DEFAULT 0,
  rolls_purchased INTEGER NOT NULL DEFAULT 0,
  burgers_sold INTEGER NOT NULL DEFAULT 0,
  rolls_expected INTEGER NOT NULL DEFAULT 0,
  rolls_actual INTEGER NOT NULL DEFAULT 0,
  rolls_paid CHAR(1) NOT NULL DEFAULT 'N',
  meat_prev_end_g INTEGER NOT NULL DEFAULT 0,
  meat_purchased_g INTEGER NOT NULL DEFAULT 0,
  meat_sold_g INTEGER NOT NULL DEFAULT 0,
  meat_expected_g INTEGER NOT NULL DEFAULT 0,
  meat_actual_g INTEGER NOT NULL DEFAULT 0,
  meat_paid CHAR(1) NOT NULL DEFAULT 'N',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_ledger_drinks (
  day DATE NOT NULL,
  brand TEXT NOT NULL,
  prev_end INTEGER NOT NULL DEFAULT 0,
  purchased INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  expected INTEGER NOT NULL DEFAULT 0,
  actual INTEGER NOT NULL DEFAULT 0,
  variance INTEGER NOT NULL DEFAULT 0,
  paid CHAR(1) NOT NULL DEFAULT 'N',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (day, brand)
);
