CREATE TABLE IF NOT EXISTS "receipt_truth_usage_rule" (
  "id" serial PRIMARY KEY NOT NULL,
  "sku" varchar(255),
  "item_name" varchar(255),
  "direct_drink_code" varchar(50),
  "requires_drink_modifier" boolean NOT NULL DEFAULT false,
  "buns_per_unit" numeric(10, 4),
  "beef_serves_per_unit" numeric(10, 4),
  "beef_grams_per_unit" numeric(10, 4),
  "chicken_serves_per_unit" numeric(10, 4),
  "chicken_grams_per_unit" numeric(10, 4),
  "notes" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "receipt_truth_daily_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_date" date NOT NULL,
  "shift_key" varchar(100) NOT NULL,
  "category_name" varchar(255) NOT NULL,
  "sku" varchar(255),
  "item_name" varchar(255) NOT NULL,
  "quantity_sold" numeric(12, 4) NOT NULL,
  "buns_used" numeric(12, 4),
  "beef_serves_used" numeric(12, 4),
  "beef_grams_used" numeric(12, 4),
  "chicken_serves_used" numeric(12, 4),
  "chicken_grams_used" numeric(12, 4),
  "coke_used" numeric(12, 4),
  "coke_zero_used" numeric(12, 4),
  "sprite_used" numeric(12, 4),
  "water_used" numeric(12, 4),
  "fanta_orange_used" numeric(12, 4),
  "fanta_strawberry_used" numeric(12, 4),
  "schweppes_manao_used" numeric(12, 4),
  "built_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "receipt_truth_daily_usage_business_date_idx"
  ON "receipt_truth_daily_usage" ("business_date");

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_truth_daily_usage_unique_row_idx"
  ON "receipt_truth_daily_usage" ("business_date", "category_name", COALESCE("sku", ''), "item_name");

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_truth_usage_rule_sku_unique_idx"
  ON "receipt_truth_usage_rule" ("sku")
  WHERE "sku" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_truth_usage_rule_item_name_unique_idx"
  ON "receipt_truth_usage_rule" ("item_name")
  WHERE "item_name" IS NOT NULL;
