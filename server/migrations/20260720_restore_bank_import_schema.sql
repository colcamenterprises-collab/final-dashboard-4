BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_import_status') THEN
    CREATE TYPE bank_import_status AS ENUM ('pending', 'partially_approved', 'approved');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_txn_status') THEN
    CREATE TYPE bank_txn_status AS ENUM ('pending', 'approved', 'rejected', 'deleted');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS bank_import_batch (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at timestamp NOT NULL DEFAULT now(),
  source text NOT NULL,
  filename text NOT NULL,
  status bank_import_status NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS bank_txn (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_id varchar NOT NULL REFERENCES bank_import_batch(id) ON DELETE CASCADE,
  posted_at timestamp NOT NULL,
  description text NOT NULL,
  amount_thb numeric(12,2) NOT NULL,
  ref text,
  raw jsonb NOT NULL,
  status bank_txn_status NOT NULL DEFAULT 'pending',
  category text,
  supplier text,
  notes text,
  expense_id varchar,
  dedupe_key text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vendor_rule (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at timestamp NOT NULL DEFAULT now(),
  match_text text NOT NULL,
  category text NOT NULL,
  supplier text NOT NULL
);

CREATE INDEX IF NOT EXISTS bank_txn_batch_id_idx ON bank_txn(batch_id);
CREATE INDEX IF NOT EXISTS bank_txn_posted_at_idx ON bank_txn(posted_at DESC);
CREATE INDEX IF NOT EXISTS bank_txn_status_idx ON bank_txn(status);
CREATE INDEX IF NOT EXISTS bank_txn_category_idx ON bank_txn(category);
CREATE INDEX IF NOT EXISTS vendor_rule_match_text_idx ON vendor_rule(match_text);

COMMIT;
