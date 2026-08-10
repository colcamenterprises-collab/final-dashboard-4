-- Every uploaded source file gets immutable provenance, not just the primary file.

CREATE TABLE IF NOT EXISTS reporting_import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES reporting_import_batches(id) ON DELETE RESTRICT,
  source_file TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  mime_type TEXT,
  role TEXT,
  source_row_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_file_sha256)
);

CREATE INDEX IF NOT EXISTS reporting_import_files_batch_idx
  ON reporting_import_files(batch_id);

COMMENT ON TABLE reporting_import_files IS
  'Immutable provenance for every file participating in a reporting import batch; each SHA-256 may be accepted once only.';
