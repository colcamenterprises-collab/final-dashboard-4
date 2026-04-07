# Final Consolidation Recommendation (Corrected)

## Keep
- Canonical business flows verified in routed pages + active server modules (daily sales/stock, purchasing, ingredients/recipes/products, receipts, shift reports, menu/ordering, Bob/AI-Ops read/control surfaces).

## Merge
- Frontend route aliases now resolved from `ROUTES.*`; merge duplicate aliases after route parity tests.
- Backend duplicate families in `server/routes.ts` inline handlers + mounted routers should be normalized under single owners.

## Retire
- Code candidates listed in `docs/audit/code-delete-candidates.csv` (after validation gates).

## Freeze until replaced
- High-risk write/ingestion paths and cron/job modules (`scheduler`, `cron`, `analysisBuildOrchestrator`, `monitorEngine`).

## Order
1. Route parity baseline (frontend/backend).
2. Protect Bob/AI-Ops + server/api surfaces.
3. Add tests around inline `server/routes.ts` families (`/api/daily-stock-sales`, `/api/manager-checklist`).
4. Retire legacy code trees in stages.

## Manual confirmations required
- Dynamic imports and runtime-only task schedulers, env-dependent integrations, and static-served operational pages.
