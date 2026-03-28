# AGENTS.md — Final Dashboard 4 Bob Read Layer

## Scope
These instructions apply to the full repository.

## Operating Rules
- Bob's canonical read namespace is `/api/bob/read/*`.
- Bob endpoints under this namespace are GET-only and token-protected via `BOB_READONLY_TOKEN`.
- Do not add writes to source-of-truth business tables from Bob routes.
- If data is missing, respond with structured blockers (`code`, `message`, `where`, `canonical_source`, `auto_build_attempted`) instead of guessed values.

## Canonical Daily Bob Checks
1. `GET /api/bob/read/system-health`
2. `GET /api/bob/read/system-map`
3. `GET /api/bob/read/module-status`
4. `GET /api/bob/read/build-status?date=YYYY-MM-DD`
5. `GET /api/bob/read/shift-snapshot?date=YYYY-MM-DD`

## Definition of Done for Bob Daily Read
- Each endpoint returns `ok`, `source`, `scope`, `status`, `data`, `warnings`, `blockers`, `last_updated`.
- Missing inputs or derived data are explicitly represented as blockers.
- Bob has broad read visibility without shell/file-system inference.
- Bob read token does not authorize writes.
