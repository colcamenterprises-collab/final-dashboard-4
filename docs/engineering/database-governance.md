# Database governance

## Current production status

Database changes are frozen while the production baseline is reconciled.

Evidence captured on 2026-08-12:

- PostgreSQL 16.14 contains 274 tables, 4 views, 123 foreign keys, 2,714 columns and 47 explicit check constraints.
- The repository `schema.prisma` contains 144 models and 16 enums.
- Production has no `_prisma_migrations` ledger.
- Prisma proposed dropping 130 tables, 56 foreign keys and 12 enums when comparing production to `schema.prisma`.
- Production introspection returned 273 models and 28 enums, but the result does not validate because an existing relation uses incompatible Prisma field types.
- PostgreSQL expression indexes, check constraints and comments are not fully represented by Prisma introspection.

The production PostgreSQL schema is the structural source of truth until a reviewed baseline is committed. Neither the checked-in Prisma schema nor the temporary introspection output is a migration authority.

## Prohibited operations

Do not run these commands against production during the freeze:

- `prisma migrate deploy`
- `prisma migrate dev`
- `prisma db push`
- `drizzle-kit push`
- generated schema-diff SQL

Do not add runtime DDL to application routes or startup code.

## Required database change process

1. Use an isolated PostgreSQL clone restored from a production backup.
2. Create an explicit, forward-only SQL migration.
3. Preserve PostgreSQL checks, expression indexes, foreign keys and comments.
4. Test migration apply, application smoke tests and rollback/recovery on the clone.
5. Add the `database-reviewed` label after independent review.
6. Back up production immediately before the approved maintenance window.
7. Record the migration identifier, merged commit SHA, operator and verification result.

## Baseline remediation

The remediation PR must select one canonical migration directory, archive—not execute—the conflicting historical paths, introduce a reviewed production baseline and establish a migration ledger without replaying historical DDL against production.
