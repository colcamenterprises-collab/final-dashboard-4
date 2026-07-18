-- POS checkout capture: Grab order details, optional customer marketing consent, and staff-selected discounts.
-- This is additive only; it does not alter existing orders or historical sales data.

ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS grab_order_number TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_mobile TEXT,
  ADD COLUMN IF NOT EXISTS customer_first_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_name TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS ordering_orders_grab_order_number_unique
  ON ordering_orders(grab_order_number) WHERE grab_order_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS pos_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  value NUMERIC(10,2) NOT NULL CHECK (value > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_customer_marketing_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES ordering_orders(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  mobile_number TEXT,
  email TEXT,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (mobile_number IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS pos_discount_codes_active_lookup
  ON pos_discount_codes(active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS pos_customer_marketing_captures_created_at
  ON pos_customer_marketing_captures(created_at DESC);

INSERT INTO ordering_settings(key, value)
VALUES (
  'pos_marketing_prompt',
  to_jsonb('Are you a member? If you join you get 10% off every meal, starting with your next order'::text)
)
ON CONFLICT (key) DO NOTHING;
