CREATE TYPE IF NOT EXISTS "modifier_option_type" AS ENUM ('ADD', 'REMOVE', 'MULTIPLY', 'SWAP', 'ZERO');

CREATE TABLE IF NOT EXISTS "public"."product_recipe_authority" (
  "id" SERIAL PRIMARY KEY,
  "product_sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "base_yield" NUMERIC(10, 4),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."recipe_ingredient_authority" (
  "id" SERIAL PRIMARY KEY,
  "recipe_id" INTEGER NOT NULL REFERENCES "public"."product_recipe_authority"("id") ON DELETE CASCADE,
  "ingredient_id" INTEGER NOT NULL REFERENCES "public"."ingredients"("id"),
  "qty" NUMERIC(10, 4) NOT NULL,
  "unit" VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."modifier_option_authority" (
  "id" SERIAL PRIMARY KEY,
  "pos_modifier_id" TEXT NOT NULL,
  "pos_option_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "modifier_option_type" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."modifier_effect_authority" (
  "id" SERIAL PRIMARY KEY,
  "modifier_option_id" INTEGER NOT NULL REFERENCES "public"."modifier_option_authority"("id") ON DELETE CASCADE,
  "ingredient_id" INTEGER NOT NULL REFERENCES "public"."ingredients"("id"),
  "qty_delta" NUMERIC(10, 4) NOT NULL,
  "unit" VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."sale_canonical_authority" (
  "id" SERIAL PRIMARY KEY,
  "receipt_id" TEXT NOT NULL,
  "product_sku" TEXT NOT NULL,
  "modifier_option_ids" INTEGER[] NOT NULL DEFAULT '{}',
  "final_cost" NUMERIC(12, 4),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sale_canonical_authority_receipt_idx" ON "public"."sale_canonical_authority"("receipt_id");
CREATE INDEX IF NOT EXISTS "sale_canonical_authority_product_idx" ON "public"."sale_canonical_authority"("product_sku");
CREATE INDEX IF NOT EXISTS "modifier_effect_authority_option_idx" ON "public"."modifier_effect_authority"("modifier_option_id");

CREATE OR REPLACE VIEW "public"."v_daily_ingredient_usage" AS
WITH sale_base AS (
  SELECT
    sca.id AS sale_id,
    sca.created_at::date AS sale_date,
    sca.product_sku,
    sca.modifier_option_ids
  FROM "public"."sale_canonical_authority" sca
),
recipe_base AS (
  SELECT
    s.sale_id,
    s.sale_date,
    ria.ingredient_id,
    ria.qty AS base_qty,
    ria.unit
  FROM sale_base s
  JOIN "public"."product_recipe_authority" pra ON pra.product_sku = s.product_sku
  JOIN "public"."recipe_ingredient_authority" ria ON ria.recipe_id = pra.id
),
modifier_rows AS (
  SELECT
    s.sale_id,
    mea.ingredient_id,
    moa.type,
    mea.qty_delta,
    mea.unit
  FROM sale_base s
  JOIN "public"."modifier_option_authority" moa ON moa.id = ANY(s.modifier_option_ids)
  JOIN "public"."modifier_effect_authority" mea ON mea.modifier_option_id = moa.id
),
modifier_agg AS (
  SELECT
    sale_id,
    ingredient_id,
    BOOL_OR(type = 'ZERO') AS has_zero,
    SUM(CASE
      WHEN type = 'ADD' THEN qty_delta
      WHEN type = 'SWAP' THEN qty_delta
      WHEN type = 'REMOVE' THEN -qty_delta
      ELSE 0
    END) AS add_delta,
    EXP(SUM(LN(qty_delta)) FILTER (WHERE type = 'MULTIPLY' AND qty_delta > 0)) AS multiply_factor,
    MAX(unit) AS unit
  FROM modifier_rows
  GROUP BY sale_id, ingredient_id
),
resolved AS (
  SELECT
    r.sale_date,
    r.ingredient_id,
    (CASE WHEN COALESCE(m.has_zero, FALSE) THEN 0 ELSE r.base_qty * COALESCE(m.multiply_factor, 1) END + COALESCE(m.add_delta, 0)) AS quantity_used,
    COALESCE(m.unit, r.unit) AS unit
  FROM recipe_base r
  LEFT JOIN modifier_agg m ON m.sale_id = r.sale_id AND m.ingredient_id = r.ingredient_id
)
SELECT
  sale_date,
  ingredient_id,
  SUM(quantity_used) AS quantity_used,
  unit
FROM resolved
GROUP BY sale_date, ingredient_id, unit;

CREATE OR REPLACE VIEW "public"."v_product_margin" AS
WITH receipt_items AS (
  SELECT
    lr.receipt_id,
    lr.receipt_date::date AS sale_date,
    item->>'sku' AS sku,
    NULLIF((item->>'quantity')::numeric, 0) AS qty,
    (item->>'price')::numeric AS price,
    (item->>'total_money')::numeric AS total_money
  FROM "public"."loyverse_receipts" lr
  CROSS JOIN LATERAL jsonb_array_elements(lr.items) AS item
),
item_unit_price AS (
  SELECT
    receipt_id,
    sale_date,
    sku,
    COALESCE(total_money / NULLIF(qty, 0), price) AS unit_price
  FROM receipt_items
)
SELECT
  sca.product_sku,
  i.sale_date,
  COUNT(sca.id) AS units,
  SUM(i.unit_price) AS revenue,
  CASE WHEN SUM(CASE WHEN sca.final_cost IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(sca.final_cost) END AS cost,
  CASE WHEN SUM(CASE WHEN sca.final_cost IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(i.unit_price) - SUM(sca.final_cost) END AS margin
FROM "public"."sale_canonical_authority" sca
JOIN item_unit_price i ON i.receipt_id = sca.receipt_id AND i.sku = sca.product_sku
GROUP BY sca.product_sku, i.sale_date;

CREATE OR REPLACE VIEW "public"."v_modifier_usage" AS
SELECT
  sca.created_at::date AS sale_date,
  moa.id AS modifier_option_id,
  moa.name,
  moa.type,
  COUNT(*) AS usage_count
FROM "public"."sale_canonical_authority" sca
JOIN LATERAL UNNEST(sca.modifier_option_ids) AS modifier_option_id ON TRUE
JOIN "public"."modifier_option_authority" moa ON moa.id = modifier_option_id
GROUP BY sale_date, moa.id, moa.name, moa.type;

CREATE OR REPLACE VIEW "public"."v_stock_variance" AS
SELECT
  shift_id,
  ingredient,
  expected_qty,
  actual_qty,
  variance_qty,
  unit,
  status,
  created_at
FROM "public"."ingredient_variance";
