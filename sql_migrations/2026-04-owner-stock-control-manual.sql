-- Temporary owner-only hybrid stock control manual entries
-- Additive only, no changes to existing live form tables
CREATE TABLE IF NOT EXISTS owner_stock_control_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL,
  shift_label text NOT NULL DEFAULT '',
  item_name text NOT NULL,
  closing_count numeric,
  opening_override numeric,
  purchase_correction numeric,
  note text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_date, shift_label, item_name)
);

CREATE INDEX IF NOT EXISTS owner_stock_control_manual_date_idx
  ON owner_stock_control_manual (business_date DESC, shift_label);
