# Service Consolidation Plan

## Objective
Consolidate overlapping services/libs/routes into canonical modules with zero behavior drift.

## Inputs
- Duplicate/conflict register
- Runtime import/mount verification
- Protected flow regression requirements

## Canonical Selection Rules
1. Prefer module currently mounted in runtime boot path.
2. Prefer module already used by protected production flows.
3. Prefer module with clearer deterministic behavior and fewer side effects.
4. If unclear, defer to Freeze and gather more runtime evidence.

## High-Priority Duplicate Groups
- Shopping list (route/service/root module overlap)
- Ingredient authority (admin/ops/lib overlap)
- Finance/forms API overlap
- Email/PDF service overlap
- Shift window utility overlap
- Recipe service overlap
- Ledger service overlaps (drinks/meat/rolls)

## Consolidation Procedure (Per Group)
1. Identify canonical owner candidate.
2. Trace all imports and route mounts.
3. Execute parity tests against current behavior.
4. Confirm downstream consumers unchanged.
5. Mark non-canonical modules as retire candidates (not immediate delete).
6. Apply deletion gate process before any destructive action.

## Risk Controls
- Never consolidate protected systems without explicit parity evidence.
- No write-path contract changes in ingestion/business-critical flows.
- Preserve auth and token behavior.
- Preserve scheduler-triggered integrations.

## Deliverables
- Service ownership matrix.
- Per-group parity report.
- Retire queue with gate status.
