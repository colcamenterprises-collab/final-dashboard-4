BEGIN;

CREATE TABLE IF NOT EXISTS financial_revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  settlement_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_revenue_sources_business_name_uq UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS financial_evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  provider_key TEXT,
  integration_type TEXT NOT NULL DEFAULT 'manual_import',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_evidence_sources_business_name_uq UNIQUE (business_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_evidence_sources_provider_uq
  ON financial_evidence_sources (business_id, provider_key)
  WHERE provider_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS financial_source_evidence_links (
  revenue_source_id UUID NOT NULL REFERENCES financial_revenue_sources(id) ON DELETE CASCADE,
  evidence_source_id UUID NOT NULL REFERENCES financial_evidence_sources(id) ON DELETE CASCADE,
  authority_role TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  required_for_close BOOLEAN NOT NULL DEFAULT FALSE,
  matching_rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (revenue_source_id, evidence_source_id, authority_role)
);

CREATE TABLE IF NOT EXISTS financial_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  evidence_source_id UUID NOT NULL REFERENCES financial_evidence_sources(id),
  original_filename TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  coverage_start TIMESTAMPTZ,
  coverage_end TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'validated',
  validation_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT financial_import_batches_source_file_uq UNIQUE (evidence_source_id, source_sha256)
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  revenue_source_id UUID REFERENCES financial_revenue_sources(id),
  evidence_source_id UUID NOT NULL REFERENCES financial_evidence_sources(id),
  import_batch_id UUID REFERENCES financial_import_batches(id),
  external_transaction_id TEXT,
  external_order_id TEXT,
  external_receipt_id TEXT,
  linked_external_transaction_id TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  transaction_at TIMESTAMPTZ NOT NULL,
  settlement_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'THB',
  gross_sales NUMERIC(14,2),
  merchant_funded_discount NUMERIC(14,2),
  provider_funded_discount NUMERIC(14,2),
  refund_amount NUMERIC(14,2),
  net_sales NUMERIC(14,2),
  commission NUMERIC(14,2),
  platform_fee NUMERIC(14,2),
  payment_fee NUMERIC(14,2),
  tax NUMERIC(14,2),
  tips NUMERIC(14,2),
  other_deduction NUMERIC(14,2),
  adjustment_amount NUMERIC(14,2),
  expected_settlement NUMERIC(14,2),
  actual_settlement NUMERIC(14,2),
  cogs_snapshot NUMERIC(14,2),
  original_record_json JSONB NOT NULL,
  source_record_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_transactions_source_hash_uq UNIQUE (evidence_source_id, source_record_hash)
);

CREATE INDEX IF NOT EXISTS financial_transactions_order_idx
  ON financial_transactions (business_id, external_order_id);
CREATE INDEX IF NOT EXISTS financial_transactions_at_idx
  ON financial_transactions (business_id, transaction_at);
CREATE INDEX IF NOT EXISTS financial_transactions_evidence_idx
  ON financial_transactions (evidence_source_id, transaction_at);

COMMENT ON TABLE financial_transactions IS
  'Provider-agnostic immutable financial evidence. Settlement and bank deposits are evidence, not duplicate revenue.';
COMMENT ON COLUMN financial_transactions.cogs_snapshot IS
  'NULL unless trustworthy restaurant costing evidence exists. Missing cost must never be represented as zero.';

COMMIT;
