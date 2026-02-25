# Online Ordering Catalog (Derived Table)

## Upstream sources
- `recipes` table (for recipe-sourced catalog rows via `POST /api/catalog/from-recipe/:recipeId`)
- Manual admin input (for non-recipe sellables via `POST /api/catalog/manual`)

## Rebuild command
- Idempotent schema setup runs automatically in API handlers by `ensureOnlineCatalogTable()`.
- Manual schema apply option:

```bash
psql "$DATABASE_URL" -f sql_migrations/2026-02-online-catalog-items.sql
```

## Determinism expectations
- Recipe upsert endpoint is idempotent on `(source_type='recipe', source_id=recipeId)`.
- Re-running recipe sync produces the same catalog row values from the current recipe record.
- Published feed (`GET /api/online/catalog`) is a direct filtered read (`is_published = true`) from `online_catalog_items`.
- No mutation of canonical recipe rows except explicit catalog sync metadata-free reads.
