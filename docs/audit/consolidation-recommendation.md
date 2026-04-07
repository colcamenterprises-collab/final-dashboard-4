# Final Consolidation Recommendation

## Keep
- Core ops routes/pages for daily sales, daily stock, purchasing, ingredients, recipes, products, shift reports, receipts, expenses, menu and ordering.

## Merge
- Route aliases and duplicate endpoint families listed in route and duplicate registers.

## Retire
- Legacy/archive/package-copy paths after parity validation.

## Rebuild
- Derived analytics/read-model layers with deterministic idempotent rebuild scripts.

## Freeze until replaced
- High-risk write paths and ingestion routes.

## Recommended cleanup order
1. Baseline tests for business-critical flows.
2. Lock canonical route map.
3. De-duplicate frontend route aliases.
4. De-duplicate backend endpoints.
5. Remove legacy copies in guarded batches.
6. Archive non-runtime assets before platform migration.

## Areas too risky without tests
- Daily sales writes, daily stock writes, purchasing commits, receipt ingestion, shift approvals, P&L snapshots.
