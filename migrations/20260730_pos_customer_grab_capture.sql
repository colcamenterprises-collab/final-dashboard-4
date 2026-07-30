BEGIN;

CREATE TABLE IF NOT EXISTS pos_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  mobile text NOT NULL,
  email text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  member_since timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_customers_mobile_unique
  ON pos_customers ((regexp_replace(mobile, '\\D', '', 'g')));

ALTER TABLE ordering_orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES pos_customers(id),
  ADD COLUMN IF NOT EXISTS grab_order_number text,
  ADD COLUMN IF NOT EXISTS grab_customer_name text,
  ADD COLUMN IF NOT EXISTS grab_customer_mobile text;

CREATE INDEX IF NOT EXISTS ordering_orders_customer_id_idx
  ON ordering_orders(customer_id);

CREATE INDEX IF NOT EXISTS ordering_orders_grab_order_number_idx
  ON ordering_orders(grab_order_number)
  WHERE grab_order_number IS NOT NULL;

COMMIT;
