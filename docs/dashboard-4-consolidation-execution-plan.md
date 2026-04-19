# Dashboard 4.0 Consolidation Execution Plan (Final Sweep Version)

## Plan intent
Governed cleanup execution plan after final readiness sweep. This document is planning-only and does not authorize runtime behavior changes by itself.

## Guardrails
- No deletions/refactors in implementation PR #1.
- No source-of-truth schema/data flow changes.
- No write-path changes for sales, stock, purchasing, ingredient authority, recipes/products.
- Bob read contracts remain immutable during first implementation slice.
- Agent governed read contracts (`/api/agent/read/*`) remain immutable during first implementation slice.

## Execution phases

### Phase 0 — Final sweep package (completed in this PR)
- Drift register
- Readiness report
- Readiness matrix
- Refreshed audit safety rails

### Phase 1 — Cleanup Implementation PR #1 (safe slice)
Scope:
- Documentation and route ownership normalization artifacts only.
- Additive governance files/checklists for runtime validation.
- Safety-rail corrections only (protection lists, drift register, hard-stop governance).
- No runtime code path changes.
- No deletes/moves/renames/merges/archives in this phase.

Exit criteria:
- Owner can approve deterministic runtime validation checklist for Phase 2.

### Phase 2 — Runtime-validated structural cleanup (blocked)
Potential future work (blocked until validations pass):
- Resolve shopping list family overlap.
- Resolve analysis family overlap.
- Rationalize menu/order/product surface ownership.
- Rationalize finance/expenses import ownership.

Required before Phase 2:
- Auth route matrix validation.
- Endpoint precedence tests.
- Daily cron and monitor execution verification.
- Email/PDF non-duplication verification.

## Explicit current status
- **Ready now:** Phase 1.
- **Blocked:** Phase 2+ runtime-affecting cleanup.
