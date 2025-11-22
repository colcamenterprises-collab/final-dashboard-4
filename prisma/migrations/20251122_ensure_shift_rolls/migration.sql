-- Keep it minimal and safe.
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

-- Helpers to discover real schema/columns (no hard assumptions).
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
    IF (SELECT col_exists(tbl, c)) THEN
      RETURN c;
    END IF;
  END LOOP;
  RETURN NULL;
END$$;

-- Core recompute strictly by shift_date (yesterday's actual = start, purchased from expenses/roll_purchase,
-- sold from analytics_shift_item, actual from daily_stock_sales). No time windows.
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

  use_roll_purchase boolean := tbl_exists('roll_purchase');
  exp_qty_col text; exp_item_col text; exp_date_col text;

  v_start int := 0;
  v_purchased int := 0;
  v_sold int := 0;
  v_est int := 0;
  v_actual int := NULL;
  v_waste int := 4;
  v_var int := NULL;

  sql text;
BEGIN
  -- START = yesterday actual (ledger), else Daily Stock prev.
  SELECT rl.actual_rolls_end INTO v_start
  FROM rolls_ledger rl WHERE rl.shift_date = v_prev;

  IF v_start IS NULL THEN
    IF stock_tbl IS NOT NULL THEN
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
          ELSE
            sql := format('SELECT %I FROM "DailyStock"
                           WHERE DATE(COALESCE("updatedAt","createdAt"))=$1
                           ORDER BY COALESCE("updatedAt","createdAt") DESC LIMIT 1', stock_end_col);
            EXECUTE sql USING v_prev INTO v_start;
          END IF;
        END IF;
      END IF;
    END IF;
    IF v_start IS NULL THEN v_start := 0; END IF;
  END IF;

  -- PURCHASED = roll_purchase.quantity OR expenses rows where item contains bun/roll on that shift_date
  IF use_roll_purchase THEN
    IF col_exists('roll_purchase','shift_date') THEN
      EXECUTE 'SELECT COALESCE(SUM(quantity),0)::int FROM roll_purchase WHERE shift_date=$1'
      USING p_date INTO v_purchased;
    ELSE
      EXECUTE 'SELECT COALESCE(SUM(quantity),0)::int FROM roll_purchase WHERE DATE(purchase_ts)=$1'
      USING p_date INTO v_purchased;
    END IF;
  ELSIF tbl_exists('expenses') THEN
    exp_qty_col  := first_existing_col('expenses', ARRAY['quantity','qty','units','number']);
    exp_item_col := first_existing_col('expenses', ARRAY['item','name','description','product']);
    exp_date_col := first_existing_col('expenses', ARRAY['shift_date','date','ts','created_at','createdAt']);
    IF exp_qty_col IS NOT NULL AND exp_item_col IS NOT NULL AND exp_date_col IS NOT NULL THEN
      sql := format($SQL$
        SELECT COALESCE(SUM(%I),0)::int
        FROM expenses
        WHERE (lower(%I) LIKE '%%bun%%' OR lower(%I) LIKE '%%roll%%')
          AND DATE(%I) = $1
      $SQL$, exp_qty_col, exp_item_col, exp_item_col, exp_date_col);
      EXECUTE sql USING p_date INTO v_purchased;
    END IF;
  END IF;

  -- SOLD = analytics_shift_item for that shift_date (prefer rolls, fallback burgers qty)
  IF tbl_exists('analytics_shift_item') THEN
    EXECUTE 'SELECT COALESCE(SUM(rolls),0)::int FROM analytics_shift_item WHERE shift_date=$1'
    USING p_date INTO v_sold;

    IF v_sold = 0 THEN
      EXECUTE $$SELECT COALESCE(SUM(qty),0)::int
               FROM analytics_shift_item
               WHERE shift_date=$1 AND lower(category)='burger'$$
      USING p_date INTO v_sold;
    END IF;
  END IF;

  -- ACTUAL = Daily Stock for that shift_date (end-of-rolls column auto-detected)
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
        ELSE
          sql := format('SELECT %I FROM "DailyStock"
                         WHERE DATE(COALESCE("updatedAt","createdAt"))=$1
                         ORDER BY COALESCE("updatedAt","createdAt") DESC LIMIT 1', stock_end_col);
          EXECUTE sql USING p_date INTO v_actual;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Estimate + status
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

-- Triggers: recompute the exact shift_date when relevant data changes.
DO $$
BEGIN
  IF tbl_exists('daily_stock_sales') THEN
    DROP TRIGGER IF EXISTS trg_rl_recompute_dss ON daily_stock_sales;
    CREATE TRIGGER trg_rl_recompute_dss
    AFTER INSERT OR UPDATE OF shift_date, burger_buns_stock, rolls_end, updated_at, created_at
    ON daily_stock_sales
    FOR EACH ROW EXECUTE FUNCTION (
      SELECT (CREATE OR REPLACE FUNCTION _rl_cb_dss() RETURNS trigger AS $F$
        BEGIN PERFORM recompute_rolls_ledger(NEW.shift_date); RETURN NEW; END
      $F$ LANGUAGE plpgsql); '_rl_cb_dss'::regproc
    );
  END IF;
END$$;

DO $$
BEGIN
  IF tbl_exists('expenses') THEN
    DROP TRIGGER IF EXISTS trg_rl_recompute_exp ON expenses;
    CREATE TRIGGER trg_rl_recompute_exp
    AFTER INSERT OR UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION (
      SELECT (CREATE OR REPLACE FUNCTION _rl_cb_exp() RETURNS trigger AS $F$
        DECLARE d date; itm text; has_sd boolean;
        BEGIN
          has_sd := EXISTS(SELECT 1 FROM information_schema.columns
                           WHERE table_schema='public' AND table_name='expenses' AND column_name='shift_date');
          IF has_sd THEN d := NEW.shift_date;
          ELSE
            BEGIN d := DATE(NEW.ts);
            EXCEPTION WHEN undefined_column THEN d := DATE(COALESCE(NEW.created_at, NEW."createdAt")); END;
          END IF;

          BEGIN itm := lower(COALESCE(NEW.item, NEW.name::text, NEW.description, ''));
          EXCEPTION WHEN undefined_column THEN itm := '';
          END;

          IF (itm LIKE '%bun%' OR itm LIKE '%roll%') THEN
            PERFORM recompute_rolls_ledger(d);
          END IF;
          RETURN NEW;
        END
      $F$ LANGUAGE plpgsql); '_rl_cb_exp'::regproc
    );
  END IF;
END$$;

