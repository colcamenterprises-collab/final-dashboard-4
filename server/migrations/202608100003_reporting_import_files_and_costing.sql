-- Complete the unified reporting import schema required by persistImport.ts.
-- Import files preserve per-file provenance for multi-file vendor imports.

CREATE TABLE IF NOT EXISTS reporting_import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES reporting_import_batches(id) ON DELETE RESTRICT,
  source_file TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  mime_type TEXT,
  role TEXT NOT NULL DEFAULT 'supporting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_file_sha256)
);

CREATE INDEX IF NOT EXISTS reporting_import_files_batch_idx
  ON reporting_import_files(batch_id);

ALTER TABLE reporting_import_files
  DROP CONSTRAINT IF EXISTS reporting_import_files_role_check;
ALTER TABLE reporting_import_files
  ADD CONSTRAINT reporting_import_files_role_check
  CHECK (role IN ('primary','supporting','control'));

-- Historical Loyverse receipt-item exports genuinely contain COGS and gross profit.
-- Preserve source-supplied costing; never manufacture missing values as zero.
ALTER TABLE reporting_historical_transaction_items
  ADD COLUMN IF NOT EXISTS cost_of_goods NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(14,2);

COMMENT ON TABLE reporting_import_files IS
  'Immutable source-file provenance for a reporting import batch; one hash may only be ingested once.';
COMMENT ON COLUMN reporting_historical_transaction_items.cost_of_goods IS
  'Source-supplied historical COGS. NULL means unavailable, never zero by assumption.';
COMMENT ON COLUMN reporting_historical_transaction_items.gross_profit IS
  'Source-supplied historical gross profit. NULL means unavailable.';
