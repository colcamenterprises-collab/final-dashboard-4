# Cleanup Hard-Stop Rules (Dashboard 4.0)

## Purpose
This file is governance-only and blocks unsafe cleanup actions before runtime-validated phases.

## Orphan page hard-stop
- NEVER delete based on static inventory output alone.
- MUST check for re-exports.
- MUST check for lazy imports.
- MUST check for indirect imports.
- MUST preserve file until runtime usage is disproven.

## Duplicate endpoint hard-stop
- Router-local endpoint paths are not global duplicates by default.
- MUST resolve mount prefixes first.
- MUST compare final mounted runtime paths before any duplication claim.

## Frontend route hard-stop
- `docs/audit/page-inventory.csv` is not authoritative route truth by itself.
- MUST validate against both:
  - `client/src/router/RouteRegistry.ts`
  - `client/src/App.tsx`

## Governed read surface hard-stop
- Bob governed read: `/api/bob/read/*` remains protected.
- Agent governed read: `/api/agent/read/*` remains protected.
- `server/routes/agentRead.ts` and `server/middleware/agentAuth.ts` are lock-listed and excluded from cleanup PR #1 runtime scope.

## Scope lock for Cleanup Implementation PR #1
- Documentation/governance corrections only.
- No deletions.
- No runtime rewiring.
- No auth logic changes.
- No behavior changes.
