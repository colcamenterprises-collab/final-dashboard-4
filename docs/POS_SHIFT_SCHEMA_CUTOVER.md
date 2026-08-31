# POS shift schema cutover

Physical Customli POS acceptance on 2026-08-31 exposed that production `ordering_orders` lacked `pos_shift_id`. The POS checkout contract already writes the active `pos_shifts.id` into each new order and uses `(pos_shift_id, grab_order_number)` for per-shift Grab duplicate protection.

Production audit confirmed:

- `ordering_orders.pos_shift_id` was the only missing checkout column.
- `pos_shifts.id` is `uuid`.
- `ordering_orders` is owned by `sbb_prod_app`.
- `pos_shifts` is owned by `postgres`.
- `sbb_prod_app` has SELECT/INSERT/UPDATE/DELETE on `pos_shifts`, but not REFERENCES.
- Legacy global unique indexes existed on `grab_order_number` and `ticket_number`.

Apply `migrations/20260831_pos_shift_schema_cutover.sql` before retrying standalone POS checkout.

The migration:

1. Adds nullable `ordering_orders.pos_shift_id uuid`.
2. Removes the legacy global Grab and ticket uniqueness indexes.
3. Adds per-shift Grab uniqueness.
4. Adds a lookup index for `pos_shift_id`.

No foreign key is added because the production runtime role does not own `pos_shifts` and does not have REFERENCES permission. The application already resolves the active shift from `pos_shifts` before inserting the order and writes that UUID in the same checkout transaction.

Runtime DDL cleanup is intentionally deferred until physical checkout acceptance passes. The cutover migration makes the existing compatibility check idempotent and non-blocking for this schema.
