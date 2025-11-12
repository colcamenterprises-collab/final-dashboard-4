#!/usr/bin/env bash
set -euo pipefail
echo "== Rolls Ledger: shift_date-only simple wiring =="

mkdir -p prisma/migrations/20251112_rolls_shiftdate_simple

cat > prisma/migrations/20251112_rolls_shiftdate_simple/migration.sql <<'SQL'
-- 1) Ensure rolls_ledger exists (simple shape)
CREATE TABLE IF NOT EXISTS rolls_ledger (
  shift_date date PRIMARY KEY,
  rolls_start integer NOT NULL DEFAULT 0,
  rolls_purchased integer NOT NULL DEFAULT 0,
  burgers_sold integer NOT NULL DEFAULT 0,
  estimated_rolls_end integer NOT NULL DEFAULT 0,
  actual_rolls_end integer,
  waste_allowance integer NOT NULL DEFAULT 4,
  variance integer,
  status text NOT NULL DEFAULT 'PENDING',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Helper: does a table exist?
CREATE OR REPLACE FUNCTION table_exists(tbl text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=tbl)
$$;

-- 3) Recompute for a given shift_date (uses only shift_date; no time windows)
CREATE OR REPLACE FUNCTION recompute_rolls_ledger(p_date date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_start integer := 0;
  v_purchased integer := 0;
  v_sold integer := 0;
  v_est integer := 0;
  v_actual integer := NULL;
  v_prev date := (p_date - INTERVAL '1 day')::date;
  v_waste integer := 4;
  tmp int;
BEGIN
  -- Start: yesterday's Actual End from ledger
  SELECT rl.actual_rolls_end INTO tmp
  FROM rolls_ledger rl WHERE rl.shift_date = v_prev;
  IF tmp IS NOT NULL THEN
    v_start := tmp;
  ELSE
    -- fallback from daily stock v2 for previous day (common table: daily_stock_sales)
    IF table_exists('daily_stock_sales') THEN
      SELECT COALESCE(dss.burger_buns_stock, dss.rolls_end) INTO tmp
      FROM daily_stock_sales dss
      WHERE dss.shift_date = v_prev
      ORDER BY COALESCE(dss.updated_at, dss.created_at) DESC
      LIMIT 1;
      IF tmp IS NOT NULL THEN v_start := tmp; END IF;
    END IF;
  END IF;

  -- Purchased (shift_date): prefer dedicated roll_purchase if present, else expenses with bun/roll keyword
  IF table_exists('roll_purchase') THEN
    SELECT COALESCE(SUM(rp.quantity),0)::int INTO v_purchased
    FROM roll_purchase rp
    WHERE rp.shift_date = p_date;
  ELSIF table_exists('expenses') THEN
    -- Try to use quantity column if available; else treat as 0
    IF EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='expenses' AND column_name IN ('quantity','qty')
    ) THEN
      EXECUTE format($Q$
        SELECT COALESCE(SUM(%I),0)::int
        FROM expenses
        WHERE (lower(item) LIKE '%%bun%%' OR lower(item) LIKE '%%roll%%')
          AND (
            (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_schema='public' AND table_name='expenses' AND column_name='shift_date')
             THEN shift_date = $1
             ELSE (DATE(COALESCE(ts, created_at)) = $1) END)
          )
      $Q$, (SELECT CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
                                    WHERE table_schema='public' AND table_name='expenses' AND column_name='quantity')
                        THEN 'quantity' ELSE 'qty' END))
      INTO v_purchased
      USING p_date;
    ELSE
      v_purchased := 0;
    END IF;
  END IF;

  -- Burgers Sold: from analytics_shift_item (already computed above)
  IF table_exists('analytics_shift_item') THEN
    -- Prefer explicit rolls column; fallback to burger qty
    SELECT COALESCE(SUM(rolls),0)::int INTO v_sold
    FROM analytics_shift_item
    WHERE shift_date = p_date;

    IF v_sold = 0 THEN
      SELECT COALESCE(SUM(qty),0)::int INTO v_sold
      FROM analytics_shift_item
      WHERE shift_date = p_date AND lower(category) = 'burger';
    END IF;
  END IF;

  -- Estimated
  v_est := v_start + v_purchased - v_sold;

  -- Actual End: from daily_stock_sales for this shift_date
  IF table_exists('daily_stock_sales') THEN
    SELECT COALESCE(dss.burger_buns_stock, dss.rolls_end) INTO v_actual
    FROM daily_stock_sales dss
    WHERE dss.shift_date = p_date
    ORDER BY COALESCE(dss.updated_at, dss.created_at) DESC
    LIMIT 1;
  END IF;

  -- Status/variance
  IF v_actual IS NULL THEN
    -- PENDING until actual entered
    INSERT INTO rolls_ledger(shift_date, rolls_start, rolls_purchased, burgers_sold,
                             estimated_rolls_end, actual_rolls_end, waste_allowance,
                             variance, status, updated_at)
    VALUES (p_date, v_start, v_purchased, v_sold, v_est, NULL, v_waste, NULL, 'PENDING', now())
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start = EXCLUDED.rolls_start,
      rolls_purchased = EXCLUDED.rolls_purchased,
      burgers_sold = EXCLUDED.burgers_sold,
      estimated_rolls_end = EXCLUDED.estimated_rolls_end,
      actual_rolls_end = NULL,
      waste_allowance = EXCLUDED.waste_allowance,
      variance = NULL,
      status = 'PENDING',
      updated_at = now();
  ELSE
    INSERT INTO rolls_ledger(shift_date, rolls_start, rolls_purchased, burgers_sold,
                             estimated_rolls_end, actual_rolls_end, waste_allowance,
                             variance, status, updated_at)
    VALUES (p_date, v_start, v_purchased, v_sold, v_est, v_actual, v_waste,
            (v_actual - v_est),
            CASE WHEN abs(v_actual - v_est) <= v_waste THEN 'OK' ELSE 'ALERT' END,
            now())
    ON CONFLICT (shift_date) DO UPDATE SET
      rolls_start = EXCLUDED.rolls_start,
      rolls_purchased = EXCLUDED.rolls_purchased,
      burgers_sold = EXCLUDED.burgers_sold,
      estimated_rolls_end = EXCLUDED.estimated_rolls_end,
      actual_rolls_end = EXCLUDED.actual_rolls_end,
      waste_allowance = EXCLUDED.waste_allowance,
      variance = EXCLUDED.variance,
      status = EXCLUDED.status,
      updated_at = now();
  END IF;
END;
$$;

-- 4) Triggers: re-run for that shift_date when forms/expenses change

-- Daily Stock v2 (stored in daily_stock_sales with shift_date + rolls_end/burger_buns_stock)
DO $$
BEGIN
  IF table_exists('daily_stock_sales') THEN
    DROP TRIGGER IF EXISTS trg_rl_recompute_dss ON daily_stock_sales;
    CREATE TRIGGER trg_rl_recompute_dss
    AFTER INSERT OR UPDATE OF shift_date, burger_buns_stock, rolls_end, updated_at
    ON daily_stock_sales
    FOR EACH ROW EXECUTE FUNCTION
    -- tiny wrapper to call recompute on NEW.shift_date
    (SELECT
      (CREATE OR REPLACE FUNCTION _rl_cb_dss() RETURNS trigger AS $F$
       BEGIN PERFORM recompute_rolls_ledger(NEW.shift_date); RETURN NEW; END
       $F$ LANGUAGE plpgsql);
     '_rl_cb_dss'::regproc);
  END IF;
END$$;

-- Expenses: when a buns/rolls line is added/edited for a date, just recompute that date.
DO $$
BEGIN
  IF table_exists('expenses') THEN
    DROP TRIGGER IF EXISTS trg_rl_recompute_exp ON expenses;
    CREATE TRIGGER trg_rl_recompute_exp
    AFTER INSERT OR UPDATE
    ON expenses
    FOR EACH ROW EXECUTE FUNCTION
    (SELECT
      (CREATE OR REPLACE FUNCTION _rl_cb_exp() RETURNS trigger AS $F$
       DECLARE d date;
       BEGIN
         -- prefer shift_date column; else fall back to DATE(ts) or DATE(created_at)
         BEGIN
           d := NEW.shift_date;
         EXCEPTION WHEN undefined_column THEN
           BEGIN
             d := DATE(COALESCE(NEW.ts, NEW.created_at));
           EXCEPTION WHEN undefined_column THEN
             d := CURRENT_DATE;
           END;
         END;
         PERFORM recompute_rolls_ledger(d);
         RETURN NEW;
       END
       $F$ LANGUAGE plpgsql);
     '_rl_cb_exp'::regproc);
  END IF;
END$$;

SQL

# run migration
npx prisma migrate deploy || npx prisma db push

echo "== Done. Rolls Ledger now recomputes by shift_date only =="
echo "Checks:"
echo " 1) Insert/update Daily Stock v2 (shift_date, rolls_end/burger_buns_stock) => ledger row updates"
echo " 2) Add an expense with item including 'bun' or 'roll' for that date (+ quantity) => Purchased updates"
echo " 3) Burgers Sold comes from analytics_shift_item for that same shift_date"
