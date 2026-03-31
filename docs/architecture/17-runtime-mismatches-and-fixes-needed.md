# 17) Runtime Mismatches and Fixes Needed

This file lists verified mismatches between architecture package claims and runtime truth.
No fixes are implemented in this task.

| Item | Expected per architecture docs | Actual runtime truth | Evidence | Severity | Exact fix needed later |
|---|---|---|---|---|---|
| Frontend access classification | `01-frontend-route-map.md` labels most application routes as `Public/unguarded`. | In `App.tsx`, most operations/finance/menu/analysis pages are wrapped in `<Guard>`. | Static route declarations vs architecture map baseline. | Medium | Regenerate route map from source automatically; stop using stale static access labels. |
| Effective auth enforcement for dashboard | Architecture map implies guarded/protected surface by route labeling. | Guard only validates pathname allowlist and does not verify token/session/user. | `Guard` + `isAllowedPath` code; runtime `GET /dashboard` unauth returns 200 app shell. | Critical | Replace allowlist-only guard with auth-aware guard (token/session validation + backend identity check). |
| Login-to-protection linkage | Login flow exists and stores token/user. | Stored token has no authoritative router gate consumption; direct URL access still renders guarded routes. | `Login.tsx` localStorage writes; guard code lacks token checks. | High | Introduce centralized auth state provider + mandatory auth guard for protected routes. |
| Backend endpoint availability claims | Architecture endpoint inventory implies broad registered surface. | Runtime probe shows broad mount surface but high degraded behavior: many 500s and timeouts when DB unavailable. | Runtime probe summary: 236 GET checked; 47 returned 500; 4 timed out. | High | Add fail-fast DB availability middleware and structured blocker responses for critical read endpoints. |
| Bob read readiness behavior | Bob read namespace should provide structured blocker contracts when missing dependencies. | Verified: missing `BOB_READONLY_TOKEN` yields structured 503 blocker payload (contract aligned). | Runtime probe + bobRead middleware behavior. | Low (aligned) | No functional fix; keep as canonical and propagate pattern to other critical read routes. |
| Public vs internal route separation | Architecture package does not clearly separate truly public app pages from internal operational pages lacking auth enforcement. | Several internal routes are not wrapped in Guard at all (e.g. `/operations/daily-sales`, POS/KDS/menu-v3/stock-live/analysis truth pages). | `App.tsx` route declarations. | High | Classify internal-only routes and enforce auth guard consistently; maintain explicit public allowlist. |
| Duplicate mount complexity | Legacy/duplicate systems are mapped in `10-legacy-dead-duplicate-map.md`. | Runtime still mounts multiple overlapping subsystems (`/api/system-health` mounted from index and routes; multiple purchasing/menu/stock paths). | `server/index.ts` and `server/routes.ts` mounts. | Medium | Add route ownership registry + de-duplication plan with explicit canonical owners. |
| Source-of-truth runtime proof depth | Architecture source-of-truth map is static. | Full runtime proof is blocked by missing DB env in this environment, so only structural verification possible for many domains. | Boot/runtime logs show Prisma/DATABASE_URL failures. | Medium | Re-run this audit in env with production-like read DB and capture endpoint-level data lineage checks. |

## Fix sequencing recommendation (for subsequent implementation task)
1. Auth hardening (Critical/High): convert route gating from allowlist-only to identity+session verification.
2. Runtime resilience: database-unavailable behavior should return deterministic blockers, not hangs/unhandled rejection paths.
3. Route ownership cleanup: remove duplicate mount ambiguity and explicitly document canonical endpoint owner per path.
4. Regenerate architecture artifacts from code + runtime probe outputs in CI.

