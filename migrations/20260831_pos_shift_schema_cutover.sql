BEGIN;

ALTER TABLE public.ordering_orders
  ADD COLUMN IF NOT EXISTS pos_shift_id uuid;

DROP INDEX IF EXISTS public.ordering_orders_grab_order_number_unique;
DROP INDEX IF EXISTS public.ordering_orders_ticket_number_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ordering_orders_shift_grab_order_number_unique
  ON public.ordering_orders (pos_shift_id, grab_order_number)
  WHERE pos_shift_id IS NOT NULL
    AND grab_order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS ordering_orders_pos_shift_id_idx
  ON public.ordering_orders (pos_shift_id)
  WHERE pos_shift_id IS NOT NULL;

COMMIT;
