DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='shopping_total'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN shopping_total DECIMAL(10,2) DEFAULT 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='wages_total'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN wages_total DECIMAL(10,2) DEFAULT 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='others_total'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN others_total DECIMAL(10,2) DEFAULT 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='total_expenses'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN total_expenses DECIMAL(10,2) DEFAULT 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='rolls_end'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN rolls_end INTEGER DEFAULT 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='daily_shift_summary' AND column_name='meat_end_g'
  ) THEN ALTER TABLE daily_shift_summary ADD COLUMN meat_end_g INTEGER DEFAULT 0; END IF;
END $$;
