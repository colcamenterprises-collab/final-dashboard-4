-- Convert money-ish ints to DECIMAL(10,2) if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ShoppingPurchaseV2' AND column_name='cost') THEN
    ALTER TABLE "ShoppingPurchaseV2" ALTER COLUMN "cost" TYPE DECIMAL(10,2)
      USING CASE WHEN "cost" IS NULL THEN NULL ELSE ("cost"::numeric) END;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='WageEntryV2' AND column_name='amount') THEN
    ALTER TABLE "WageEntryV2" ALTER COLUMN "amount" TYPE DECIMAL(10,2)
      USING CASE WHEN "amount" IS NULL THEN NULL ELSE ("amount"::numeric) END;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='OtherExpenseV2' AND column_name='amount') THEN
    ALTER TABLE "OtherExpenseV2" ALTER COLUMN "amount" TYPE DECIMAL(10,2)
      USING CASE WHEN "amount" IS NULL THEN NULL ELSE ("amount"::numeric) END;
  END IF;
END $$;
