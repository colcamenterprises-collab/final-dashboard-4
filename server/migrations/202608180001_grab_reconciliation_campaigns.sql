BEGIN;

ALTER TABLE ordering_item_modifiers
  ADD COLUMN IF NOT EXISTS direct_price_delta numeric(12,2),
  ADD COLUMN IF NOT EXISTS grab_price_delta numeric(12,2),
  ADD COLUMN IF NOT EXISTS direct_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grab_enabled boolean NOT NULL DEFAULT true;

UPDATE ordering_item_modifiers
SET direct_price_delta = COALESCE(direct_price_delta, price_delta),
    grab_price_delta = COALESCE(grab_price_delta, price_delta)
WHERE direct_price_delta IS NULL OR grab_price_delta IS NULL;

CREATE TABLE IF NOT EXISTS reporting_grab_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_name_match text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

CREATE INDEX IF NOT EXISTS reporting_grab_campaigns_active_range_idx
  ON reporting_grab_campaigns(active, starts_at, ends_at);

COMMENT ON TABLE reporting_grab_campaigns IS
  'Temporary Grab marketing adjustments used only for reporting/reconciliation; does not alter canonical POS menu prices.';
COMMENT ON COLUMN ordering_item_modifiers.direct_price_delta IS
  'Direct/POS modifier price delta. Falls back to legacy price_delta where required.';
COMMENT ON COLUMN ordering_item_modifiers.grab_price_delta IS
  'Grab modifier price delta. Falls back to legacy price_delta where required.';

COMMIT;
