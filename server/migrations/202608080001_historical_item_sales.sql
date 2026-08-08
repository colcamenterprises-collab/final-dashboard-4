-- Historical aggregate Item Sales archive.
-- The archived source is the final Loyverse CSV export retained in server/data.
-- This table stores aggregates only; it never manufactures receipt-level history.

CREATE TABLE IF NOT EXISTS historical_item_sales (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  item_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  items_sold INTEGER NOT NULL DEFAULT 0,
  gross_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  items_refunded INTEGER NOT NULL DEFAULT 0,
  refunds NUMERIC(14,2) NOT NULL DEFAULT 0,
  discounts NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_of_goods NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(8,2),
  taxes NUMERIC(14,2) NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, sku, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS historical_item_sales_period_idx
  ON historical_item_sales(period_start, period_end);

COMMENT ON TABLE historical_item_sales IS
  'Read-only aggregate archive imported from retired POS systems. No live POS integration may write here.';
