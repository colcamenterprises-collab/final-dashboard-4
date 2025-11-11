-- Rolls Ledger per-shift reconciliation for burger buns ("rolls")

CREATE TABLE IF NOT EXISTS rolls_ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date         date NOT NULL UNIQUE,              -- logical shift date (BKK day at 17:00→03:00)
  from_ts            timestamptz NOT NULL,              -- 17:00 BKK = 10:00Z on shift_date
  to_ts              timestamptz NOT NULL,              -- 03:00 BKK next day = 20:00Z on shift_date
  rolls_start        integer NOT NULL DEFAULT 0,
  rolls_purchased    integer NOT NULL DEFAULT 0,
  burgers_sold       integer NOT NULL DEFAULT 0,
  estimated_rolls_end integer NOT NULL DEFAULT 0,
  actual_rolls_end   integer,                           -- from Daily Sales & Stock v2 "rolls end"
  waste_allowance    integer NOT NULL DEFAULT 4,
  variance           integer NOT NULL DEFAULT 0,        -- actual - estimated
  status             text    NOT NULL DEFAULT 'PENDING',-- PENDING/OK/ALERT
  source_sales_id    uuid,                              -- FK to DailySales (nullable)
  source_stock_id    uuid,                              -- FK to DailyStock (nullable)
  source_expense_id  uuid,                              -- FK to roll purchase record (nullable)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rolls_ledger_date ON rolls_ledger (shift_date);
