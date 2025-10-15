-- rolls + submitted columns (idempotent)
ALTER TABLE stock_ledger_day
  ADD COLUMN IF NOT EXISTS rolls_prev_end    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_purchased   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_sold        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_expected    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_actual      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolls_paid        char(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS submitted         boolean DEFAULT false;
