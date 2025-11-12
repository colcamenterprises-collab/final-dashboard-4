-- CreateTable
CREATE TABLE IF NOT EXISTS ingestion_audit (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date       date NOT NULL,
  from_ts          timestamptz NOT NULL,
  to_ts            timestamptz NOT NULL,
  source           text NOT NULL,
  receipts_count   integer NOT NULL DEFAULT 0,
  line_items_count integer NOT NULL DEFAULT 0,
  modifiers_count  integer NOT NULL DEFAULT 0,
  duration_ms      integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'success',
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_ingest_audit_date ON ingestion_audit (shift_date);
