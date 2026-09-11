CREATE TABLE IF NOT EXISTS finance_duplicate_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key text NOT NULL UNIQUE,
  left_ref text NOT NULL,
  right_ref text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('keep_both', 'removed_left', 'removed_right', 'personal_left', 'personal_right')),
  reviewed_by text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS finance_duplicate_resolution_reviewed_at_idx
  ON finance_duplicate_resolution (reviewed_at DESC);
