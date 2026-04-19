# Dashboard 4.0 Change Drift Register (Final Sweep)

## Baseline
- Prior corrected audit package point: `41f5b59`.
- Drift window reviewed: `41f5b59..HEAD`.

## Drift items identified

| Drift ID | Area | What changed since audit package | Impact on prior docs | Status |
|---|---|---|---|---|
| DRIFT-001 | Bob auth/read | Bob read auth evolved (agent token path + legacy fallback) and read layer expanded | Prior audit text was partially high-level; needed explicit reconfirmation of GET-only/token model | Reconciled |
| DRIFT-002 | AI/Ops control | AI/Ops control and monitor-facing surfaces remained active and mounted | Needed refreshed safety-rail lock list and ownership doc | Reconciled |
| DRIFT-003 | Route ownership | Ongoing route additions/edits in `server/index.ts`, `server/routes.ts`, and `App.tsx` | Prior inventories risk stale route ownership assumptions | Reconciled (docs refreshed; runtime validation still pending) |
| DRIFT-004 | Analysis/drinks | New analysis/drinks work and related routes/pages landed post-audit | Duplicate/conflict register needed focused refresh on active overlap families | Reconciled |
| DRIFT-005 | Planning package completeness | `docs/dashboard-4-consolidation-execution-plan.md` and `docs/consolidation/*` absent | Package was incomplete for controlled execution handoff | Reconciled (files created) |
| DRIFT-006 | Runtime certainty | Auth precedence, mount precedence, cron/scheduler behavior still not provable by static review only | Prior and current docs must preserve explicit runtime block conditions | Open (intentionally blocked) |
| DRIFT-007 | Agent governed read surface | Agent read surface and auth controls now require explicit governance protection: `/api/agent/read`, `server/routes/agentRead.ts`, `server/middleware/agentAuth.ts`, `agent_tokens`, `BOB_READONLY_TOKEN` fallback, `.openclaw/workspace/core/APP_READ_SURFACE.md` | Existing drift docs did not explicitly capture the governed agent read safety surface | Reconciled |
| DRIFT-008 | Staff access rebuild | Staff access path changed via `role_permissions`, `internal_users` schema updates, `pinAuth.ts` updates, and login flow changes | Prior docs needed explicit caution flags for auth/access ownership and cleanup blocking | Reconciled (governance only; runtime untouched) |

## Notes
- No runtime code behavior was altered during this final sweep.
- This register is documentation-only evidence for readiness gating.
