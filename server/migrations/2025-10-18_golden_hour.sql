CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pos_receipt table for raw Loyverse data with Bangkok timestamps
CREATE TABLE IF NOT EXISTS pos_receipt (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         text NOT NULL,
  receipt_id       text NOT NULL,
  datetime         timestamptz NOT NULL,
  total            numeric(10,2) NOT NULL DEFAULT 0,
  items_json       jsonb NOT NULL DEFAULT '[]',
  payment          text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, receipt_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_receipt_datetime ON pos_receipt (datetime);
CREATE INDEX IF NOT EXISTS idx_pos_receipt_batch_id ON pos_receipt (batch_id);

-- per-item cache
CREATE TABLE IF NOT EXISTS analytics_shift_burger_item (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    text NULL,
  shift_date       date NOT NULL,
  from_ts          timestamptz NOT NULL,
  to_ts            timestamptz NOT NULL,
  normalized_name  text NOT NULL,
  qty              integer NOT NULL DEFAULT 0,
  patties          integer NOT NULL DEFAULT 0,
  red_meat_g       integer NOT NULL DEFAULT 0,
  chicken_g        integer NOT NULL DEFAULT 0,
  rolls            integer NOT NULL DEFAULT 0,
  raw_hits         jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, shift_date, normalized_name)
);
CREATE INDEX IF NOT EXISTS idx_asbi_shift ON analytics_shift_burger_item (shift_date);

-- shift summary cache
CREATE TABLE IF NOT EXISTS analytics_shift_burger_summary (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     text NULL,
  shift_date        date NOT NULL UNIQUE,
  from_ts           timestamptz NOT NULL,
  to_ts             timestamptz NOT NULL,
  burgers_total     integer NOT NULL DEFAULT 0,
  patties_total     integer NOT NULL DEFAULT 0,
  red_meat_g_total  integer NOT NULL DEFAULT 0,
  chicken_g_total   integer NOT NULL DEFAULT 0,
  rolls_total       integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
