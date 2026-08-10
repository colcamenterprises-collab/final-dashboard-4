-- Preserve factual historical profitability supplied by source POS exports.
-- Missing historical cost remains NULL; it must never be inferred as zero.

ALTER TABLE reporting_historical_transaction_items
  ADD COLUMN IF NOT EXISTS cost_of_goods NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(14,2);

COMMENT ON COLUMN reporting_historical_transaction_items.cost_of_goods IS
  'Source-supplied historical COGS for this receipt line; NULL means unavailable, never zero by assumption.';
COMMENT ON COLUMN reporting_historical_transaction_items.gross_profit IS
  'Source-supplied historical gross profit for this receipt line; NULL means unavailable.';
