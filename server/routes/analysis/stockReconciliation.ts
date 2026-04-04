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

function normalizeDrinkNameSql(expr: string): string {
  return `
    CASE
      WHEN lower(trim(${expr})) IN ('coke') THEN 'Coke'
      WHEN lower(trim(${expr})) IN ('coke zero') THEN 'Coke Zero'
      WHEN lower(trim(${expr})) IN ('sprite') THEN 'Sprite'
      WHEN lower(trim(${expr})) IN ('water', 'bottled water', 'bottle water', 'soda water') THEN 'Water'
      WHEN lower(trim(${expr})) IN ('fanta orange', 'orange fanta') THEN 'Fanta Orange'
      WHEN lower(trim(${expr})) IN ('fanta strawberry', 'strawberry fanta') THEN 'Fanta Strawberry'
      WHEN lower(trim(${expr})) IN ('schweppes manow', 'schweppes manao', 'schweppes lime') THEN 'Schweppes Manao'
      ELSE trim(${expr})
    END
  `;
}

export async function getStockReconciliation(date?: string): Promise<ReconciliationRow[]> {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const dateFilter = date ? `WHERE q.shift_date = '${date}'::date` : '';

  const query = `
    WITH latest_form2 AS (
      SELECT
        ds.shift_date::date AS shift_date,
        dsv2."burgerBuns" AS rolls_end,
        dsv2."meatWeightG" AS meat_end_g,
        COALESCE(dsv2."drinksJson", '{}'::jsonb) AS drinks_end,
        ROW_NUMBER() OVER (
          PARTITION BY ds.shift_date::date
          ORDER BY dsv2."createdAt" DESC
        ) AS rn
      FROM daily_stock_v2 dsv2
      JOIN daily_sales_v2 ds ON ds.id = dsv2."salesId"
      WHERE dsv2."deletedAt" IS NULL
    ),

    shift_data AS (
      SELECT shift_date, rolls_end, meat_end_g, drinks_end
      FROM latest_form2
      WHERE rn = 1
    ),

    purchased_rolls AS (
      SELECT
        date::date AS shift_date,
        COALESCE(SUM(CASE WHEN rolls_pcs > 0 THEN rolls_pcs ELSE 0 END), 0) AS purchased_qty
      FROM purchase_tally
      GROUP BY date::date
    ),

    purchased_meat AS (
      SELECT
        date::date AS shift_date,
        COALESCE(SUM(CASE WHEN meat_grams > 0 THEN meat_grams ELSE 0 END), 0) AS purchased_g
      FROM purchase_tally
      GROUP BY date::date
    ),

    purchased_drinks_raw AS (
      SELECT
        pt.date::date AS shift_date,
        ${normalizeDrinkNameSql('ptd.item_name')} AS item_name,
        COALESCE(SUM(ptd.qty), 0) AS purchased_qty
      FROM purchase_tally_drink ptd
      JOIN purchase_tally pt ON pt.id = ptd.tally_id
      GROUP BY pt.date::date, ${normalizeDrinkNameSql('ptd.item_name')}
    ),

    purchased_drinks AS (
      SELECT shift_date, item_name, SUM(purchased_qty)::int AS purchased_qty
      FROM purchased_drinks_raw
      GROUP BY shift_date, item_name
    ),

    prev_drinks AS (
      SELECT
        curr.shift_date,
        ${normalizeDrinkNameSql('e.key')} AS item_name,
        SUM((e.value)::numeric)::int AS start_qty
      FROM shift_data curr
      JOIN shift_data prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
      CROSS JOIN LATERAL jsonb_each_text(prev.drinks_end) e
      GROUP BY curr.shift_date, ${normalizeDrinkNameSql('e.key')}
    ),

    curr_drinks AS (
      SELECT
        curr.shift_date,
        ${normalizeDrinkNameSql('e.key')} AS item_name,
        SUM((e.value)::numeric)::int AS actual_end_qty
      FROM shift_data curr
      CROSS JOIN LATERAL jsonb_each_text(curr.drinks_end) e
      GROUP BY curr.shift_date, ${normalizeDrinkNameSql('e.key')}
    ),

    receipt_usage AS (
      SELECT
        business_date::date AS shift_date,
        COALESCE(SUM(COALESCE(buns_used, 0)), 0)::int AS buns_sold,
        COALESCE(SUM(COALESCE(beef_grams_used, 0)), 0)::int AS meat_sold_g,
        COALESCE(SUM(COALESCE(coke_used, 0)), 0)::int AS coke_sold,
        COALESCE(SUM(COALESCE(coke_zero_used, 0)), 0)::int AS coke_zero_sold,
        COALESCE(SUM(COALESCE(sprite_used, 0)), 0)::int AS sprite_sold,
        COALESCE(SUM(COALESCE(water_used, 0)), 0)::int AS water_sold,
        COALESCE(SUM(COALESCE(fanta_orange_used, 0)), 0)::int AS fanta_orange_sold,
        COALESCE(SUM(COALESCE(fanta_strawberry_used, 0)), 0)::int AS fanta_strawberry_sold,
        COALESCE(SUM(COALESCE(schweppes_manao_used, 0)), 0)::int AS schweppes_manao_sold
      FROM receipt_truth_daily_usage
      GROUP BY business_date::date
    ),

    drink_sold AS (
      SELECT shift_date, 'Coke'::text AS item_name, coke_sold AS number_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Coke Zero', coke_zero_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Sprite', sprite_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Water', water_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Fanta Orange', fanta_orange_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Fanta Strawberry', fanta_strawberry_sold FROM receipt_usage
      UNION ALL SELECT shift_date, 'Schweppes Manao', schweppes_manao_sold FROM receipt_usage
    ),

    drink_keys AS (
      SELECT shift_date, item_name FROM prev_drinks
      UNION
      SELECT shift_date, item_name FROM curr_drinks
      UNION
      SELECT shift_date, item_name FROM purchased_drinks
      UNION
      SELECT shift_date, item_name FROM drink_sold
    )

    SELECT *
    FROM (
      SELECT
        curr.shift_date::text,
        'rolls' AS item_type,
        'Burger Buns' AS item_name,
        COALESCE(prev.rolls_end, 0)::int AS start_qty,
        COALESCE(pr.purchased_qty, 0)::int AS purchased_qty,
        (COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0) - COALESCE(curr.rolls_end, 0))::int AS used_qty,
        COALESCE(ru.buns_sold, 0)::int AS expected_end_qty,
        COALESCE(curr.rolls_end, 0)::int AS actual_end_qty,
        ((COALESCE(prev.rolls_end, 0) + COALESCE(pr.purchased_qty, 0) - COALESCE(curr.rolls_end, 0)) - COALESCE(ru.buns_sold, 0))::int AS variance
      FROM shift_data curr
      LEFT JOIN shift_data prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
      LEFT JOIN purchased_rolls pr ON pr.shift_date = curr.shift_date
      LEFT JOIN receipt_usage ru ON ru.shift_date = curr.shift_date

      UNION ALL

      SELECT
        curr.shift_date::text,
        'meat' AS item_type,
        'Minced Meat (g)' AS item_name,
        COALESCE(prev.meat_end_g, 0)::int AS start_qty,
        COALESCE(pm.purchased_g, 0)::int AS purchased_qty,
        (COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0) - COALESCE(curr.meat_end_g, 0))::int AS used_qty,
        COALESCE(ru.meat_sold_g, 0)::int AS expected_end_qty,
        COALESCE(curr.meat_end_g, 0)::int AS actual_end_qty,
        ((COALESCE(prev.meat_end_g, 0) + COALESCE(pm.purchased_g, 0) - COALESCE(curr.meat_end_g, 0)) - COALESCE(ru.meat_sold_g, 0))::int AS variance
      FROM shift_data curr
      LEFT JOIN shift_data prev ON prev.shift_date = curr.shift_date - INTERVAL '1 day'
      LEFT JOIN purchased_meat pm ON pm.shift_date = curr.shift_date
      LEFT JOIN receipt_usage ru ON ru.shift_date = curr.shift_date

      UNION ALL

      SELECT
        dk.shift_date::text,
        'drinks' AS item_type,
        dk.item_name,
        COALESCE(pd.start_qty, 0)::int AS start_qty,
        COALESCE(prd.purchased_qty, 0)::int AS purchased_qty,
        (COALESCE(pd.start_qty, 0) + COALESCE(prd.purchased_qty, 0) - COALESCE(cd.actual_end_qty, 0))::int AS used_qty,
        COALESCE(ds.number_sold, 0)::int AS expected_end_qty,
        COALESCE(cd.actual_end_qty, 0)::int AS actual_end_qty,
        ((COALESCE(pd.start_qty, 0) + COALESCE(prd.purchased_qty, 0) - COALESCE(cd.actual_end_qty, 0)) - COALESCE(ds.number_sold, 0))::int AS variance
      FROM drink_keys dk
      LEFT JOIN prev_drinks pd ON pd.shift_date = dk.shift_date AND pd.item_name = dk.item_name
      LEFT JOIN curr_drinks cd ON cd.shift_date = dk.shift_date AND cd.item_name = dk.item_name
      LEFT JOIN purchased_drinks prd ON prd.shift_date = dk.shift_date AND prd.item_name = dk.item_name
      LEFT JOIN drink_sold ds ON ds.shift_date = dk.shift_date AND ds.item_name = dk.item_name
    ) q
    ${dateFilter}
    ORDER BY shift_date DESC, item_type, item_name;
  `;

  const result = await db.execute(sql.raw(query));
  return result.rows as ReconciliationRow[];
}
