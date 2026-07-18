-- POS register shifts, cash movements, receipt linkage and hand-over audit.
-- Additive only: all historical orders remain intact and simply have no shift_id.

CREATE TABLE IF NOT EXISTS pos_register_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_code TEXT NOT NULL DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by_user_id INTEGER,
  opened_by_name TEXT NOT NULL,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  close_notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by_user_id INTEGER,
  closed_by_name TEXT,
  closing_counted_cash NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  cash_variance NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_register_shifts_one_open_register
  ON pos_register_shifts (register_code)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS pos_register_shifts_history_lookup
  ON pos_register_shifts (register_code, opened_at DESC);

CREATE TABLE IF NOT EXISTS pos_register_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES pos_register_shifts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  category TEXT NOT NULL CHECK (category IN (
    'shopping','wages','staff_payment','other',
    'owner_funding','refund','cash_correction'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id INTEGER,
  created_by_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pos_register_cash_movements_shift_created
  ON pos_register_cash_movements (shift_id, created_at);

ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES pos_register_shifts(id) ON DELETE SET NULL;
ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS collected_by_user_id INTEGER;
ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS collected_by_name TEXT;
CREATE INDEX IF NOT EXISTS ordering_orders_shift_created
  ON ordering_orders (shift_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sbb_prod_app') THEN
    GRANT SELECT, INSERT, UPDATE ON pos_register_shifts TO sbb_prod_app;
    GRANT SELECT, INSERT, UPDATE ON pos_register_cash_movements TO sbb_prod_app;
    GRANT SELECT, UPDATE (shift_id, collected_at, collected_by_user_id, collected_by_name)
      ON ordering_orders TO sbb_prod_app;
  END IF;
END $$;
