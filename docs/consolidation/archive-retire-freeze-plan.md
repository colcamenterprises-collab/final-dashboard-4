# Archive / Retire / Freeze Plan

## Objective
Apply non-destructive consolidation first, then controlled retirement, then gated deletion.

## Freeze Policy
Freeze applies to:
- Bob/AI-Ops surfaces
- Scheduler/background jobs
- Protected core business flows
- Server boot/mount orchestration
- Frontend route truth authority files

No retire/delete actions are allowed in frozen areas until explicit freeze release criteria are met.

## Archive-First Policy
Archive-first targets:
- `archive/**`
- `attached_assets/**`
- `tmp/**`

Archive actions are preferred over deletion in early consolidation phases.

## Retire Policy
Retire candidate criteria:
1. Canonical replacement exists and is runtime-proven.
2. Parity tests pass.
3. No unresolved dependencies.
4. Sign-off gate approved.

Retire is a state transition; physical deletion remains separately gated.

## Freeze Release Criteria
A frozen area can move to merge/retire workflow only when:
- runtime validation gates passed,
- parity checks completed,
- risk reviewed and accepted,
- owner gate approved.

## Deletion Preconditions
Deletion is allowed only if classification permits and all gate evidence exists:
- runtime proof,
- parity proof,
- rollback plan,
- final approval gate.

## Deliverables
- Freeze register
- Archive ledger
- Retire queue with gate status
- Deletion candidates packet (post-approval only)
