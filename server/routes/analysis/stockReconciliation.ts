import { db } from "../../db";
import { sql } from "drizzle-orm";

interface ReconciliationRow {
  shift_date: string;
  item_type: string;
  item_name: string;
  start_qty: number;
  purchased_qty: number;
  used_qty: number;
  expected_end_qty: number;
  actual_end_qty: number;
  variance: number;
}

export async function getStockReconciliation(date?: string): Promise<ReconciliationRow[]> {
  const query = `
    WITH
    shift_data AS (
      SELECT
        DATE("createdAt") AS shift_date,
        "burgerBuns" AS rolls_end,
        "meatWeightG" AS meat_end_g,
        "drinksJson" AS drinks_end
      FROM daily_stock_v2
      WHERE "deletedAt" IS NULL
      ${date ? `AND DATE("createdAt") = '${date}'` : ''}
      ORDER BY "createdAt" DESC
    ),

    prev_shift_data AS (
      SELECT
        DATE("createdAt") AS shift_date,
        "burgerBuns" AS rolls_end,
        "meatWeightG" AS meat_end_g,
        "drinksJson" AS drinks_end
      FROM daily_stock_v2
      WHERE "deletedAt" IS NULL
    ),

    purchased_rolls AS (
      SELECT shift_date, SUM(qty) AS purchased_qty
      FROM stock_received_log WHERE item_type = 'rolls'
      ${date ? `AND shift_date = '${date}'` : ''}
      GROUP BY shift_date
    ),

    purchased_meat AS (
      SELECT shift_date, SUM(weight_g) AS purchased_g
      FROM stock_received_log WHERE item_type = 'meat'
      ${date ? `AND shift_date = '${date}'` : ''}
      GROUP BY shift_date
    ),

    purchased_drinks AS (
      SELECT shift_date, item_name, SUM(qty) AS purchased_qty
      FROM stock_received_log WHERE item_type = 'drinks'
      ${date ? `AND shift_date = '${date}'` : ''}
      GROUP BY shift_date, item_name
    )

    SELECT
      curr.shift_date::text,
      'rolls' AS item_type,
      'Burger Buns' AS item_name,
      COALESCE(prev.rolls_end, 0)::int AS start_qty,
      COALESCE(pr.purchased_qty, 0)::int AS purchased_qty,
      (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0) - COALESCE(curr.rolls_end, 0))::int AS used_qty,
      (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0))::int AS expected_end_qty,
      COALESCE(curr.rolls_end, 0)::int AS actual_end_qty,
      (COALESCE(curr.rolls_end, 0) - (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0)))::int AS variance
    FROM shift_data curr
    LEFT JOIN prev_shift_data prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
    LEFT JOIN purchased_rolls pr ON pr.shift_date = curr.shift_date

    UNION ALL

    SELECT
      curr.shift_date::text,
      'meat' AS item_type,
      'Minced Meat (g)' AS item_name,
      COALESCE(prev.meat_end_g, 0)::int AS start_qty,
      COALESCE(pm.purchased_g, 0)::int AS purchased_qty,
      (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0) - COALESCE(curr.meat_end_g, 0))::int AS used_qty,
      (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0))::int AS expected_end_qty,
      COALESCE(curr.meat_end_g, 0)::int AS actual_end_qty,
      (COALESCE(curr.meat_end_g, 0) - (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0)))::int AS variance
    FROM shift_data curr
    LEFT JOIN prev_shift_data prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
    LEFT JOIN purchased_meat pm ON pm.shift_date = curr.shift_date

    ORDER BY shift_date DESC, item_type
  `;

  const result = await db.execute(sql.raw(query));
  return result.rows as ReconciliationRow[];
}
