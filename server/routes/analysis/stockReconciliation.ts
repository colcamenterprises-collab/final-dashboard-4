import { db } from "../../db";
import { sql } from "drizzle-orm";

interface ReconciliationRow {
  shift_date: string;
  item_type: string;
  item_name: string;
  start_qty: number;
  purchased_qty: number;
  number_sold_qty: number;
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

  const dateFilter = date ? `WHERE q.shift_date = '${date}'::date` : "";

  const query = `
    WITH normalized_sales AS (
      SELECT
        d.id,
        COALESCE(
          d.shift_date::date,
          CASE
            WHEN NULLIF(d."shiftDate", '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN NULLIF(d."shiftDate", '')::date
            ELSE NULL
          END
        ) AS shift_date
      FROM daily_sales_v2 d
      WHERE d."deletedAt" IS NULL
    ),

    latest_form2 AS (
      SELECT
        ns.shift_date AS shift_date,
        dsv2."burgerBuns" AS buns_end,
        dsv2."meatWeightG" AS meat_end_g,
        COALESCE(dsv2."drinksJson", '{}'::jsonb) AS drinks_end,
        ROW_NUMBER() OVER (
          PARTITION BY ns.shift_date
          ORDER BY dsv2."createdAt" DESC
        ) AS rn
      FROM daily_stock_v2 dsv2
      JOIN normalized_sales ns ON ns.id = dsv2."salesId"
      WHERE dsv2."deletedAt" IS NULL
        AND ns.shift_date IS NOT NULL
    ),

    shift_data AS (
      SELECT shift_date, buns_end, meat_end_g, drinks_end
      FROM latest_form2
      WHERE rn = 1
    ),

    shift_sequence AS (
      SELECT
        shift_date,
        buns_end,
        meat_end_g,
        drinks_end,
        LAG(buns_end) OVER (ORDER BY shift_date) AS prev_buns_end,
        LAG(meat_end_g) OVER (ORDER BY shift_date) AS prev_meat_end_g,
        LAG(drinks_end) OVER (ORDER BY shift_date) AS prev_drinks_end
      FROM shift_data
    ),

    purchased_buns AS (
      SELECT
        date::date AS shift_date,
        COALESCE(SUM(CASE WHEN rolls_pcs > 0 THEN rolls_pcs ELSE 0 END), 0)::int AS purchased_qty
      FROM purchase_tally
      GROUP BY date::date
    ),

    purchased_meat AS (
      SELECT
        date::date AS shift_date,
        COALESCE(SUM(CASE WHEN meat_grams > 0 THEN meat_grams ELSE 0 END), 0)::int AS purchased_g
      FROM purchase_tally
      GROUP BY date::date
    ),

    purchased_drinks_raw AS (
      SELECT
        pt.date::date AS shift_date,
        ${normalizeDrinkNameSql("ptd.item_name")} AS item_name,
        COALESCE(SUM(ptd.qty), 0)::int AS purchased_qty
      FROM purchase_tally_drink ptd
      JOIN purchase_tally pt ON pt.id = ptd.tally_id
      GROUP BY pt.date::date, ${normalizeDrinkNameSql("ptd.item_name")}
    ),

    purchased_drinks AS (
      SELECT shift_date, item_name, SUM(purchased_qty)::int AS purchased_qty
      FROM purchased_drinks_raw
      GROUP BY shift_date, item_name
    ),

    prev_drinks AS (
      SELECT
        ss.shift_date,
        ${normalizeDrinkNameSql("e.key")} AS item_name,
        SUM((e.value)::numeric)::int AS start_qty
      FROM shift_sequence ss
      CROSS JOIN LATERAL jsonb_each_text(COALESCE(ss.prev_drinks_end, '{}'::jsonb)) e
      GROUP BY ss.shift_date, ${normalizeDrinkNameSql("e.key")}
    ),

    curr_drinks AS (
      SELECT
        ss.shift_date,
        ${normalizeDrinkNameSql("e.key")} AS item_name,
        SUM((e.value)::numeric)::int AS actual_end_qty
      FROM shift_sequence ss
      CROSS JOIN LATERAL jsonb_each_text(ss.drinks_end) e
      GROUP BY ss.shift_date, ${normalizeDrinkNameSql("e.key")}
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
        ss.shift_date::text,
        'buns' AS item_type,
        'Burger Buns' AS item_name,
        COALESCE(ss.prev_buns_end, 0)::int AS start_qty,
        COALESCE(pb.purchased_qty, 0)::int AS purchased_qty,
        COALESCE(ru.buns_sold, 0)::int AS number_sold_qty,
        (COALESCE(ss.prev_buns_end, 0) + COALESCE(pb.purchased_qty, 0) - COALESCE(ru.buns_sold, 0))::int AS expected_end_qty,
        COALESCE(ss.buns_end, 0)::int AS actual_end_qty,
        (COALESCE(ss.buns_end, 0) - (COALESCE(ss.prev_buns_end, 0) + COALESCE(pb.purchased_qty, 0) - COALESCE(ru.buns_sold, 0)))::int AS variance
      FROM shift_sequence ss
      LEFT JOIN purchased_buns pb ON pb.shift_date = ss.shift_date
      LEFT JOIN receipt_usage ru ON ru.shift_date = ss.shift_date

      UNION ALL

      SELECT
        ss.shift_date::text,
        'meat' AS item_type,
        'Meat (g)' AS item_name,
        COALESCE(ss.prev_meat_end_g, 0)::int AS start_qty,
        COALESCE(pm.purchased_g, 0)::int AS purchased_qty,
        COALESCE(ru.meat_sold_g, 0)::int AS number_sold_qty,
        (COALESCE(ss.prev_meat_end_g, 0) + COALESCE(pm.purchased_g, 0) - COALESCE(ru.meat_sold_g, 0))::int AS expected_end_qty,
        COALESCE(ss.meat_end_g, 0)::int AS actual_end_qty,
        (COALESCE(ss.meat_end_g, 0) - (COALESCE(ss.prev_meat_end_g, 0) + COALESCE(pm.purchased_g, 0) - COALESCE(ru.meat_sold_g, 0)))::int AS variance
      FROM shift_sequence ss
      LEFT JOIN purchased_meat pm ON pm.shift_date = ss.shift_date
      LEFT JOIN receipt_usage ru ON ru.shift_date = ss.shift_date

      UNION ALL

      SELECT
        dk.shift_date::text,
        'drinks' AS item_type,
        dk.item_name,
        COALESCE(pd.start_qty, 0)::int AS start_qty,
        COALESCE(prd.purchased_qty, 0)::int AS purchased_qty,
        COALESCE(ds.number_sold, 0)::int AS number_sold_qty,
        (COALESCE(pd.start_qty, 0) + COALESCE(prd.purchased_qty, 0) - COALESCE(ds.number_sold, 0))::int AS expected_end_qty,
        COALESCE(cd.actual_end_qty, 0)::int AS actual_end_qty,
        (COALESCE(cd.actual_end_qty, 0) - (COALESCE(pd.start_qty, 0) + COALESCE(prd.purchased_qty, 0) - COALESCE(ds.number_sold, 0)))::int AS variance
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
