-- Clean orphans then enforce FK (safe if already present)
DELETE FROM daily_stock_v2 s
WHERE NOT EXISTS (SELECT 1 FROM daily_sales_v2 d WHERE d.id = s."salesId");

DO $$ BEGIN
  ALTER TABLE daily_stock_v2
  ADD CONSTRAINT fk_dailystock_sales
  FOREIGN KEY ("salesId") REFERENCES daily_sales_v2(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END $$;
