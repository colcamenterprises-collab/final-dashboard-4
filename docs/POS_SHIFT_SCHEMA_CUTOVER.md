# POS shift schema cutover

Physical Customli POS acceptance on 2026-08-31 exposed that production `ordering_orders` lacked `pos_shift_id`. The POS checkout contract already writes the active `pos_shifts.id` into each new order and uses `(pos_shift_id, grab_order_number)` for per-shift Grab duplicate protection.

Production audit confirmed:

- `ordering_orders.pos_shift_id` was the only missing checkout column.
- `pos_shifts.id` is `uuid`.
- The runtime DB user owns `ordering_orders`.
- Legacy global unique indexes existed on `grab_order_number` and `ticket_number`.

Apply `migrations/20260831_pos_shift_schema_cutover.sql` before deploying the backend code that assumes the cutover is complete.

The migration:

1. Adds nullable `ordering_orders.pos_shift_id uuid`.
2. Adds an FK to `pos_shifts(id)` with `ON DELETE SET NULL`.
3. Removes the legacy global Grab and ticket uniqueness indexes.
4. Adds per-shift Grab uniqueness.
5. Adds a lookup index for `pos_shift_id`.

Runtime request handlers must not perform DDL. Schema changes belong to controlled deployment/migration steps.
