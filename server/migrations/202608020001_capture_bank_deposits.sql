BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bank_deposit (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bank_txn_id varchar NOT NULL UNIQUE REFERENCES bank_txn(id) ON DELETE CASCADE,
  batch_id varchar NOT NULL REFERENCES bank_import_batch(id) ON DELETE CASCADE,
  posted_at timestamp NOT NULL,
  description text NOT NULL,
  amount_thb numeric(12,2) NOT NULL CHECK (amount_thb > 0),
  ref text,
  source text NOT NULL,
  classification text NOT NULL DEFAULT 'Unclassified Deposit',
  include_in_pnl boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_deposit_posted_at_idx ON bank_deposit(posted_at DESC);
CREATE INDEX IF NOT EXISTS bank_deposit_batch_id_idx ON bank_deposit(batch_id);
CREATE INDEX IF NOT EXISTS bank_deposit_include_in_pnl_idx ON bank_deposit(include_in_pnl);

INSERT INTO bank_deposit (
  bank_txn_id,
  batch_id,
  posted_at,
  description,
  amount_thb,
  ref,
  source,
  classification,
  include_in_pnl
)
SELECT
  transaction.id,
  transaction.batch_id,
  transaction.posted_at,
  transaction.description,
  ABS(transaction.amount_thb),
  transaction.ref,
  batch.source,
  'Unclassified Deposit',
  false
FROM bank_txn transaction
JOIN bank_import_batch batch ON batch.id = transaction.batch_id
WHERE transaction.amount_thb < 0
  AND transaction.status <> 'deleted'
ON CONFLICT (bank_txn_id) DO NOTHING;

COMMIT;
