#!/usr/bin/env bash
set -euo pipefail
echo "== Rolls Ledger Fix: Read from purchase_tally.rolls_pcs =="

mkdir -p prisma/migrations/20251122d_purchase_tally

cat > prisma/migrations/20251122d_purchase_tally/migration.sql <<'SQL'
-- Update recompute_rolls_ledger to read from purchase_tally.rolls_pcs

CREATE OR REPLACE FUNCTION recompute_rolls_ledger(p_date date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_prev date := (p_date - INTERVAL '1 day')::date;
  stock_tbl text := CASE
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='daily_stock_sales') THEN 'daily_stock_sales'
    ELSE NULL
  END;
  stock_end_col text;
  
  v_start int := 0;
  v_purchased int := 0;
  v_sold int := 0;
  v_est int := 0;
  v_actual int := NULL;
  v_var int := NULL;
  sql text;
BEGIN
  -- START = yesterday actual from ledger, else Daily Stock
  SELECT rl.actual_rolls_end INTO v_start FROM rolls_ledger rl WHERE rl.shift_date = v_prev;
  
  IF v_start IS NULL AND stock_tbl IS NOT NULL THEN
    SELECT burger_buns_stock INTO v_start 
    FROM daily_stock_sales 
    WHERE shift_date = v_prev 
    ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 1;
  END IF;
  
  IF v_start IS NULL THEN v_start := 0; END IF;

  -- PURCHASED from purchase_tally.rolls_pcs
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='purchase_tally') THEN
    SELECT COALESCE(SUM(rolls_pcs),0)::int INTO v_purchased
    FROM purchase_tally
    WHERE date = p_date;
  END IF;

  -- SOLD from analytics_shift_item (prefer rolls, fallback burger qty)
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='analytics_shift_item') THEN
    SELECT COALESCE(SUM(rolls),0)::int INTO v_sold
    FROM analytics_shift_item 
    WHERE shift_date = p_date;
    
    IF v_sold = 0 THEN
      SELECT COALESCE(SUM(qty),0)::int INTO v_sold
      FROM analytics_shift_item 
      WHERE shift_date = p_date AND lower(category) = 'burger';
    END IF;
  END IF;

  -- ACTUAL end from daily_stock_sales
  IF stock_tbl IS NOT NULL THEN
    SELECT burger_buns_stock INTO v_actual
    FROM daily_stock_sales 
    WHERE shift_date = p_date 
    ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 1;
  END IF;

  -- Compute
  v_est := v_start + v_purchased - v_sold;

  IF v_actual IS NULL THEN
    INSERT INTO rolls_ledger(shift_date, rolls_start, rolls_purchased, burgers_sold,
                             estimated_rolls_end, actual_rolls_end, waste_allowance,
                             variance, status, updated_at)
    VALUES (p_date, v_start, v_purchased, v_sold, v_est, NULL, 4, NULL, 'PENDING', now())
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start=EXCLUDED.rolls_start, rolls_purchased=EXCLUDED.rolls_purchased,
      burgers_sold=EXCLUDED.burgers_sold, estimated_rolls_end=EXCLUDED.estimated_rolls_end,
      actual_rolls_end=NULL, variance=NULL, status='PENDING', updated_at=now();
  ELSE
    v_var := v_actual - v_est;
    INSERT INTO rolls_ledger(shift_date, rolls_start, rolls_purchased, burgers_sold,
                             estimated_rolls_end, actual_rolls_end, waste_allowance,
                             variance, status, updated_at)
    VALUES (p_date, v_start, v_purchased, v_sold, v_est, v_actual, 4,
            v_var, CASE WHEN abs(v_var)<=4 THEN 'OK' ELSE 'ALERT' END, now())
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start=EXCLUDED.rolls_start, rolls_purchased=EXCLUDED.rolls_purchased,
      burgers_sold=EXCLUDED.burgers_sold, estimated_rolls_end=EXCLUDED.estimated_rolls_end,
      actual_rolls_end=EXCLUDED.actual_rolls_end, variance=EXCLUDED.variance,
      status=EXCLUDED.status, updated_at=now();
  END IF;
END;
$$;

-- Trigger: purchase_tally changes → recompute that date
DROP TRIGGER IF EXISTS trg_rl_purchase_tally ON purchase_tally;

CREATE OR REPLACE FUNCTION _rl_cb_purchase_tally() RETURNS trigger AS $$
DECLARE d date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    d := OLD.date;
  ELSE
    d := NEW.date;
  END IF;
  IF d IS NOT NULL THEN PERFORM recompute_rolls_ledger(d); END IF;
  RETURN COALESCE(NEW, OLD);
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rl_purchase_tally
AFTER INSERT OR UPDATE OR DELETE ON purchase_tally
FOR EACH ROW EXECUTE FUNCTION _rl_cb_purchase_tally();

-- Trigger: daily_stock_sales changes → recompute that shift_date  
DROP TRIGGER IF EXISTS trg_rl_daily_stock ON daily_stock_sales;

CREATE OR REPLACE FUNCTION _rl_cb_daily_stock() RETURNS trigger AS $$
BEGIN
  PERFORM recompute_rolls_ledger(NEW.shift_date);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rl_daily_stock
AFTER INSERT OR UPDATE ON daily_stock_sales
FOR EACH ROW EXECUTE FUNCTION _rl_cb_daily_stock();
SQL

npx prisma migrate deploy || npx prisma db push

echo "== Done. Rolls Ledger now reads from purchase_tally.rolls_pcs =="
echo "Triggers active on: purchase_tally, daily_stock_sales"
