-- Unified reporting ingestion provenance.
-- Historical sales data must be validated here before it becomes reportable.

CREATE TABLE IF NOT EXISTS reporting_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  import_type TEXT NOT NULL,
  stated_period_start TIMESTAMPTZ,
  stated_period_end TIMESTAMPTZ,
  source_row_count INTEGER,
  imported_row_count INTEGER,
  source_gross_sales NUMERIC(14,2),
  imported_gross_sales NUMERIC(14,2),
  source_discounts NUMERIC(14,2),
  imported_discounts NUMERIC(14,2),
  source_refunds NUMERIC(14,2),
  imported_refunds NUMERIC(14,2),
  source_net_sales NUMERIC(14,2),
  imported_net_sales NUMERIC(14,2),
  validation_status TEXT NOT NULL DEFAULT 'pending',
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_file_sha256)
);

CREATE INDEX IF NOT EXISTS reporting_import_batches_source_period_idx
  ON reporting_import_batches(source_system, stated_period_start, stated_period_end);

ALTER TABLE reporting_import_batches
  DROP CONSTRAINT IF EXISTS reporting_import_batches_validation_status_check;
ALTER TABLE reporting_import_batches
  ADD CONSTRAINT reporting_import_batches_validation_status_check
  CHECK (validation_status IN ('pending','validated','rejected','quarantined'));

COMMENT ON TABLE reporting_import_batches IS
  'Immutable provenance and reconciliation evidence for historical reporting imports. Duplicate source SHA-256 values are not allowed.';
