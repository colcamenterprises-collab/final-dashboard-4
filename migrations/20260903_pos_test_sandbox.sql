BEGIN;

CREATE TABLE IF NOT EXISTS public.pos_test_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT NOW(),
  closed_at timestamptz,
  starting_float numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash numeric(12,2),
  cash_banked numeric(12,2),
  expected_cash numeric(12,2),
  variance numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by text,
  closed_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_test_one_open_shift_idx
  ON public.pos_test_shifts ((status))
  WHERE status='open';

CREATE TABLE IF NOT EXISTS public.pos_test_shift_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.pos_test_shifts(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('cash_in','cash_out')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text
);

CREATE TABLE IF NOT EXISTS public.pos_test_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.pos_test_shifts(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  order_mode text NOT NULL CHECK (order_mode IN ('direct','grab')),
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','preparing','ready','completed','cancelled')),
  grab_order_number text,
  customer_name text,
  customer_mobile text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_test_shift_ticket_unique
  ON public.pos_test_orders(shift_id, ticket_number);

CREATE UNIQUE INDEX IF NOT EXISTS pos_test_shift_grab_unique
  ON public.pos_test_orders(shift_id, grab_order_number)
  WHERE grab_order_number IS NOT NULL;

COMMIT;
