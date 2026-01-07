CREATE OR REPLACE VIEW v_stock_reconciliation AS
WITH
shift_dates AS (
  SELECT DISTINCT DATE("createdAt") AS shift_date
  FROM daily_stock_v2
  WHERE "deletedAt" IS NULL
),

prev_stock AS (
  SELECT
    DATE("createdAt") AS shift_date,
    "burgerBuns" AS rolls_end,
    "meatWeightG" AS meat_end_g,
    "drinksJson" AS drinks_end
  FROM daily_stock_v2
  WHERE "deletedAt" IS NULL
),

purchased_rolls AS (
  SELECT
    shift_date,
    SUM(qty) AS purchased_qty
  FROM stock_received_log
  WHERE item_type = 'rolls'
  GROUP BY shift_date
),

purchased_meat AS (
  SELECT
    shift_date,
    SUM(weight_g) AS purchased_g
  FROM stock_received_log
  WHERE item_type = 'meat'
  GROUP BY shift_date
),

purchased_drinks AS (
  SELECT
    shift_date,
    item_name,
    SUM(qty) AS purchased_qty
  FROM stock_received_log
  WHERE item_type = 'drinks'
  GROUP BY shift_date, item_name
)

SELECT
  curr.shift_date,
  'rolls' AS item_type,
  'Burger Buns' AS item_name,
  COALESCE(prev.rolls_end, 0) AS start_qty,
  COALESCE(pr.purchased_qty, 0) AS purchased_qty,
  0 AS used_qty,
  (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0)) AS expected_end_qty,
  COALESCE(curr.rolls_end, 0) AS actual_end_qty,
  COALESCE(curr.rolls_end, 0) - (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0)) AS variance
FROM prev_stock curr
LEFT JOIN prev_stock prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
LEFT JOIN purchased_rolls pr ON pr.shift_date = curr.shift_date

UNION ALL

SELECT
  curr.shift_date,
  'meat' AS item_type,
  'Minced Meat' AS item_name,
  COALESCE(prev.meat_end_g, 0) AS start_qty,
  COALESCE(pm.purchased_g, 0) AS purchased_qty,
  0 AS used_qty,
  (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0)) AS expected_end_qty,
  COALESCE(curr.meat_end_g, 0) AS actual_end_qty,
  COALESCE(curr.meat_end_g, 0) - (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0)) AS variance
FROM prev_stock curr
LEFT JOIN prev_stock prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
LEFT JOIN purchased_meat pm ON pm.shift_date = curr.shift_date;
