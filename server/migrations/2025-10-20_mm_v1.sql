-- Meekong Mumba v1.0 Migration
-- Normalized receipt system with complete SKU tracking

-- 1) Normalized receipts
CREATE TABLE IF NOT EXISTS lv_receipt (
  receipt_id    text PRIMARY KEY,
  datetime_bkk  timestamptz NOT NULL,
  staff_name    text,
  customer_id   text,
  total_amount  numeric(12,2),
  payment_json  jsonb DEFAULT '{}'::jsonb,
  raw_json      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lv_line_item (
  receipt_id    text NOT NULL,
  line_no       int  NOT NULL,
  sku           text,
  name          text NOT NULL,
  qty           int  NOT NULL,
  unit_price    numeric(12,2),
  category_hint text,
  raw_json      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (receipt_id, line_no),
  FOREIGN KEY (receipt_id) REFERENCES lv_receipt(receipt_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lv_modifier (
  receipt_id    text NOT NULL,
  line_no       int  NOT NULL,
  mod_no        int  NOT NULL,
  sku           text,
  name          text NOT NULL,
  qty           int  NOT NULL DEFAULT 1,
  raw_json      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (receipt_id, line_no, mod_no),
  FOREIGN KEY (receipt_id, line_no) REFERENCES lv_line_item(receipt_id, line_no) ON DELETE CASCADE
);

-- 2) Update item_catalog (add active field if missing)
ALTER TABLE item_catalog ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 3) Import runs & versioning
CREATE TABLE IF NOT EXISTS import_log (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  from_ts         timestamptz NOT NULL,
  to_ts           timestamptz NOT NULL,
  receipts_fetched int NOT NULL DEFAULT 0,
  receipts_upserted int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'ok',
  message         text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

-- 4) Create unique index on new tables
CREATE UNIQUE INDEX IF NOT EXISTS ux_lv_receipt ON lv_receipt(receipt_id);

-- 5) Analytics version tracking (already exists from previous migration)
-- analytics_version table already created
-- item_catalog table already created
-- analytics_shift_item table already created
-- analytics_shift_category_summary table already created
