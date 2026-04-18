# Route Consolidation Plan

## Objective
Create one canonical route path per function while preserving runtime behavior during transition.

## Constraints
- Frontend route truth comes from `client/src/router/RouteRegistry.ts` and `client/src/App.tsx`.
- Do not treat `docs/audit/page-inventory.csv` as authoritative for URL decisions.
- No route deletions until runtime and parity gates pass.

## Canonicalization Strategy
1. Build route ownership table from server mount points and frontend router definitions.
2. Group duplicates into:
   - canonical active path,
   - compatibility alias/redirect,
   - retirement candidate.
3. Keep compatibility aliases until:
   - deep-link telemetry/runtime checks show no usage,
   - regression suite passes,
   - owner approves retirement.

## Priority Route Areas
- Daily forms routes (`/operations/daily-sales*`, `/operations/daily-stock`).
- Shopping list routes (`/operations/shopping-list` and backend shopping list handlers).
- Analysis and receipts routes (including historical aliases).
- Finance/expense overlaps.
- Bob and AI-Ops routes (freeze-protected).

## Route Validation Checklist
- Route mounted in server composition.
- Endpoint returns expected auth/error contracts.
- Frontend route resolves correctly from router.
- Redirects/aliases preserve user navigation.
- Protected routes remain protected.

## Retirement Preconditions
A route alias can be retired only if all are true:
1. Canonical route exists and is proven stable.
2. No dependent frontend navigation relies on alias.
3. API consumers (if any) migrated/verified.
4. Runtime probe evidence attached.
5. Sign-off gate approved.

## Deliverables
- Canonical route matrix.
- Alias retirement queue.
- Route-level risk list tied to deletion safety matrix.
