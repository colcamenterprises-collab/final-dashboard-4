DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='ingredients' AND column_name='purchase_qty'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN purchase_qty NUMERIC;
  END IF;
END $$;
