-- Timestamped historical transaction ledger for retired/external POS systems.
-- Live SBB POS remains in ordering_orders; reporting queries will UNION the two
-- sources across a non-overlapping cutover boundary.

CREATE TABLE IF NOT EXISTS reporting_historical_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_key TEXT NOT NULL DEFAULT 'sbb-rawai',
  source_system TEXT NOT NULL,
  source_transaction_id TEXT NOT NULL,
  source_receipt_number TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  business_timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  channel TEXT,
  order_mode TEXT,
  payment_status TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  staff_name TEXT,
  source_import_batch_id UUID NOT NULL REFERENCES reporting_import_batches(id) ON DELETE RESTRICT,
  source_payload JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_key, source_system, source_transaction_id)
);

CREATE INDEX IF NOT EXISTS reporting_historical_transactions_time_idx
  ON reporting_historical_transactions(venue_key, occurred_at);
CREATE INDEX IF NOT EXISTS reporting_historical_transactions_receipt_idx
  ON reporting_historical_transactions(venue_key, source_receipt_number);
CREATE INDEX IF NOT EXISTS reporting_historical_transactions_batch_idx
  ON reporting_historical_transactions(source_import_batch_id);

CREATE TABLE IF NOT EXISTS reporting_historical_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES reporting_historical_transactions(id) ON DELETE CASCADE,
  source_line_id TEXT,
  source_item_id TEXT,
  item_name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2),
  gross_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_set_component BOOLEAN NOT NULL DEFAULT FALSE,
  source_payload JSONB,
  UNIQUE(transaction_id, source_line_id)
);

CREATE INDEX IF NOT EXISTS reporting_historical_transaction_items_tx_idx
  ON reporting_historical_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS reporting_historical_transaction_items_sku_idx
  ON reporting_historical_transaction_items(sku);

CREATE TABLE IF NOT EXISTS reporting_historical_transaction_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_item_id UUID NOT NULL REFERENCES reporting_historical_transaction_items(id) ON DELETE CASCADE,
  source_modifier_id TEXT,
  modifier_group TEXT,
  modifier_name TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  price_delta NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_payload JSONB,
  UNIQUE(transaction_item_id, source_modifier_id)
);

CREATE INDEX IF NOT EXISTS reporting_historical_transaction_modifiers_item_idx
  ON reporting_historical_transaction_modifiers(transaction_item_id);

CREATE TABLE IF NOT EXISTS reporting_historical_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES reporting_historical_transactions(id) ON DELETE CASCADE,
  source_payment_id TEXT,
  payment_method TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_at TIMESTAMPTZ,
  source_payload JSONB,
  UNIQUE(transaction_id, source_payment_id)
);

CREATE INDEX IF NOT EXISTS reporting_historical_payments_tx_idx
  ON reporting_historical_payments(transaction_id);
CREATE INDEX IF NOT EXISTS reporting_historical_payments_paid_at_idx
  ON reporting_historical_payments(paid_at);

COMMENT ON TABLE reporting_historical_transactions IS
  'Timestamped retired/external POS transactions used by the unified reporting layer before the venue cutover boundary.';
COMMENT ON TABLE reporting_historical_transaction_items IS
  'Historical receipt line items. Aggregate Item Sales files must never be inserted here without receipt linkage.';
COMMENT ON TABLE reporting_historical_payments IS
  'Historical payment allocations linked to canonical historical transactions; supports split tender.';
