#!/usr/bin/env bash
set -euo pipefail
echo "== Simplified Rolls Ledger Fix: roll_purchase ONLY =="

mkdir -p prisma/migrations/20251122c_rolls_simple

############################################
# DB migration: simplified recompute + triggers
############################################
cat > prisma/migrations/20251122c_rolls_simple/migration.sql <<'SQL'
-- Simplified recompute_rolls_ledger: purchases from roll_purchase ONLY
-- Triggers on roll_purchase and daily_stock_sales for auto-recompute

CREATE OR REPLACE FUNCTION tbl_exists(tbl text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=tbl)
$$;

CREATE OR REPLACE FUNCTION col_exists(tbl text, col text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=tbl AND column_name=col)
$$;

CREATE OR REPLACE FUNCTION first_existing_col(tbl text, cols text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    IF (SELECT col_exists(tbl, c)) THEN RETURN c; END IF;
  END LOOP;
  RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION recompute_rolls_ledger(p_date date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_prev date := (p_date - INTERVAL '1 day')::date;
  stock_tbl text := CASE
    WHEN tbl_exists('daily_stock_sales') THEN 'daily_stock_sales'
    WHEN tbl_exists('DailyStock') THEN 'DailyStock'
    ELSE NULL
  END;
  stock_end_col text;
  stock_date_col text;
  
  v_start int := 0;
  v_purchased int := 0;
  v_sold int := 0;
  v_est int := 0;
  v_actual int := NULL;
  v_var int := NULL;
  sql text;
  
  rp_date_col text;
BEGIN
  -- START = yesterday actual from ledger, else Daily Stock
  SELECT rl.actual_rolls_end INTO v_start FROM rolls_ledger rl WHERE rl.shift_date = v_prev;
  IF v_start IS NULL AND stock_tbl IS NOT NULL THEN
    stock_end_col := first_existing_col(stock_tbl, ARRAY['burger_buns_stock','rolls_end','buns_end','rolls_actual','buns_stock']);
    IF stock_end_col IS NOT NULL THEN
      IF stock_tbl = 'daily_stock_sales' THEN
        sql := format('SELECT %I FROM %I WHERE shift_date=$1 ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 1',
                      stock_end_col, stock_tbl);
        EXECUTE sql USING v_prev INTO v_start;
      ELSE
        stock_date_col := CASE WHEN col_exists('DailyStock','shift_date') THEN 'shift_date' ELSE NULL END;
        IF stock_date_col IS NOT NULL THEN
          sql := format('SELECT %I FROM "DailyStock" WHERE %I=$1 ORDER BY COALESCE("updatedAt","createdAt") DESC LIMIT 1',
                        stock_end_col, stock_date_col);
          EXECUTE sql USING v_prev INTO v_start;
        END IF;
      END IF;
    END IF;
  END IF;
  IF v_start IS NULL THEN v_start := 0; END IF;

  -- PURCHASED from roll_purchase ONLY
  IF tbl_exists('roll_purchase') THEN
    rp_date_col := first_existing_col('roll_purchase', ARRAY['shift_date','date','purchase_date','purchased_at','created_at','createdAt','purchase_ts']);
    IF rp_date_col IS NOT NULL THEN
      sql := format('SELECT COALESCE(SUM(quantity),0)::int FROM roll_purchase WHERE DATE(%I)=$1', rp_date_col);
      EXECUTE sql USING p_date INTO v_purchased;
    END IF;
  END IF;

  -- SOLD from analytics_shift_item (prefer rolls, fallback burger qty)
  IF tbl_exists('analytics_shift_item') THEN
    EXECUTE 'SELECT COALESCE(SUM(rolls),0)::int FROM analytics_shift_item WHERE shift_date=$1'
    USING p_date INTO v_sold;
    IF v_sold = 0 THEN
      EXECUTE 'SELECT COALESCE(SUM(qty),0)::int FROM analytics_shift_item WHERE shift_date=$1 AND lower(category)=''burger'''
      USING p_date INTO v_sold;
    END IF;
  END IF;

  -- ACTUAL end from Daily Stock
  IF stock_tbl IS NOT NULL THEN
    stock_end_col := first_existing_col(stock_tbl, ARRAY['burger_buns_stock','rolls_end','buns_end','rolls_actual','buns_stock']);
    IF stock_end_col IS NOT NULL THEN
      IF stock_tbl = 'daily_stock_sales' THEN
        sql := format('SELECT %I FROM %I WHERE shift_date=$1 ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 1',
                      stock_end_col, stock_tbl);
        EXECUTE sql USING p_date INTO v_actual;
      ELSE
        stock_date_col := CASE WHEN col_exists('DailyStock','shift_date') THEN 'shift_date' ELSE NULL END;
        IF stock_date_col IS NOT NULL THEN
          sql := format('SELECT %I FROM "DailyStock" WHERE %I=$1 ORDER BY COALESCE("updatedAt","createdAt") DESC LIMIT 1',
                        stock_end_col, stock_date_col);
          EXECUTE sql USING p_date INTO v_actual;
        END IF;
      END IF;
    END IF;
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

-- Trigger: roll_purchase changes → recompute that shift_date
DO $$
BEGIN
  IF tbl_exists('roll_purchase') THEN
    DROP TRIGGER IF EXISTS trg_rl_roll_purchase ON roll_purchase;
    
    CREATE OR REPLACE FUNCTION _rl_cb_roll_purchase() RETURNS trigger AS $F$
    DECLARE d date; date_col text;
    BEGIN
      date_col := first_existing_col('roll_purchase', ARRAY['shift_date','date','purchase_date','purchased_at','created_at','createdAt','purchase_ts']);
      IF TG_OP = 'DELETE' THEN
        EXECUTE format('SELECT DATE(%I) FROM roll_purchase WHERE id=$1', date_col) USING OLD.id INTO d;
      ELSE
        EXECUTE format('SELECT DATE(%I) FROM roll_purchase WHERE id=$1', date_col) USING NEW.id INTO d;
      END IF;
      IF d IS NOT NULL THEN PERFORM recompute_rolls_ledger(d); END IF;
      RETURN COALESCE(NEW, OLD);
    END
    $F$ LANGUAGE plpgsql;
    
    CREATE TRIGGER trg_rl_roll_purchase
    AFTER INSERT OR UPDATE OR DELETE ON roll_purchase
    FOR EACH ROW EXECUTE FUNCTION _rl_cb_roll_purchase();
  END IF;
END$$;

-- Trigger: daily_stock_sales changes → recompute that shift_date
DO $$
BEGIN
  IF tbl_exists('daily_stock_sales') THEN
    DROP TRIGGER IF EXISTS trg_rl_daily_stock ON daily_stock_sales;
    
    CREATE OR REPLACE FUNCTION _rl_cb_daily_stock() RETURNS trigger AS $F$
    BEGIN
      PERFORM recompute_rolls_ledger(NEW.shift_date);
      RETURN NEW;
    END
    $F$ LANGUAGE plpgsql;
    
    CREATE TRIGGER trg_rl_daily_stock
    AFTER INSERT OR UPDATE ON daily_stock_sales
    FOR EACH ROW EXECUTE FUNCTION _rl_cb_daily_stock();
  END IF;
END$$;
SQL

############################################
# Apply DB changes
############################################
npx prisma migrate deploy || npx prisma db push

echo "== Done. Rolls Ledger now reads purchases from roll_purchase ONLY =="
echo "Triggers active on: roll_purchase, daily_stock_sales"
