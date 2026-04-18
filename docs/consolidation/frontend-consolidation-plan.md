# Frontend Consolidation Plan

## Objective
Align frontend routes/pages to real runtime usage with canonical route truth and safe retire sequencing.

## Route Truth Policy
- Authoritative sources:
  - `client/src/router/RouteRegistry.ts`
  - `client/src/App.tsx`
- Non-authoritative for URL decisions:
  - `docs/audit/page-inventory.csv`

## Focus Areas
1. Route aliases and redirects that duplicate canonical paths.
2. Pages flagged as orphan candidates in static audit.
3. Legacy paths in operations/analysis/finance/menu domains.

## Validation Rules
- A page is not retire-safe until both are true:
  1. No active import/mount in app router.
  2. No active route resolving to it via alias/redirect.
- Static orphan status must be runtime-validated.

## Consolidation Steps
1. Build route-to-component matrix from App router mounts.
2. Tag each path as canonical, alias, or unknown.
3. Probe canonical and alias routes in runtime environment.
4. Resolve unknowns with import graph + navigation checks.
5. Freeze any ambiguous pages until proof is complete.

## Deliverables
- Frontend canonical route/page matrix.
- Alias retirement candidates.
- Orphan page archive/retire queue mapped to safety matrix.
