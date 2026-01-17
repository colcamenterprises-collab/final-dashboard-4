# Product Menu Metadata Tables

## Tables
- `product_menu` — per-product menu metadata (category, ordering, visibility by channel).
- `product_recipe` — per-product linkage to a canonical recipe (`recipe` table).

## Upstream Sources
- Product management UI (`/products`) writes category, sort order, visibility, and recipe linkage.
- Product API endpoints (`/api/products`) accept the same fields and persist them.

## Rebuild Command
- Not automatically rebuildable. If a rebuild is required, re-enter metadata through the Product Editor or `/api/products`.

## Determinism Expectations
- Values are fully deterministic per product input. No inference or auto-mapping is applied.
- Missing metadata remains `NULL` or `false` and is surfaced as `UNMAPPED` in menu views.
