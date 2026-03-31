# 14) Runtime Verification Audit

## Verification Scope
This audit verified the existing architecture pack (`docs/architecture/00` through `13`) against:
1. live server boot/runtime behavior,
2. actual frontend route declarations and guards,
3. backend endpoint runtime reachability (GET-safe probe set),
4. auth/guard behavior in practice,
5. source-of-truth and duplicate/dead-system claims carried in the architecture machine-readable baseline.

## What was actually run

### Commands executed
- `NODE_ENV=development npx tsx server/index.ts`
- `curl --max-time 5 -i http://127.0.0.1:8080/tablet-reload`
- `curl --max-time 5 -i http://127.0.0.1:8080/api/system-health`
- `node scripts/architecture/verify-runtime.mjs`
- `node -e ...` (multiple read-only analysis commands against `docs/architecture/architecture-machine-readable.json`)

### Runtime observations from boot logs
- Server reached `✅ Server listening on port 8080`.
- Startup background services were attempted.
- Multiple background failures occurred due missing `DATABASE_URL` (Prisma initialization errors).
- API route execution can fail/hang if handler path assumes DB availability and does not fail fast.

## What was statically verified only
- Full frontend route topology and guard/wrapper placement from `client/src/App.tsx`.
- Allowlist guard semantics from `client/src/router/RouteRegistry.ts`.
- Login persistence behavior from `client/src/pages/auth/Login.tsx`.
- Bob read-only contract enforcement semantics from `server/routes/bobRead.ts`.
- Endpoint baseline list and source-of-truth/dead/duplicate lists from `docs/architecture/architecture-machine-readable.json`.

## What was runtime verified
- 107 concrete frontend route URLs were probed via HTTP on running app.
- 236 concrete GET endpoints from the architecture baseline were probed.
- Auth probes executed:
  - `POST /api/auth/login` with invalid credentials payload.
  - `GET /api/finance/summary/today` without auth headers.
  - `GET /api/bob/read/system-health` without token.
  - `GET /dashboard` without login session.

## Pass/fail summary by area

| Area | Result | Evidence-backed note |
|---|---|---|
| Frontend routes | **Partial pass** | Router compiles; 107/107 concrete route probes returned non-5xx transport responses. Guarding differs from architecture map labels. |
| Backend endpoints | **Partial fail** | 236 GET endpoints probed: 232 non-404 responses, including many 500s; 4 endpoints timed out. |
| Auth | **Fail (security model mismatch)** | Frontend `Guard` is allowlist-only path validation, not auth validation; `/dashboard` reachable without token/session gate. |
| Providers/state | **Pass (declaration-level)** | `QueryClientProvider`, `TooltipProvider`, `ErrorBoundary`, `BrowserRouter` consistently mounted at app root. |
| Integrations | **Partial fail** | Runtime shows integration startup depends on DB/env; multiple integration jobs error when `DATABASE_URL` missing. |
| Source-of-truth claims | **Partial / mostly static** | Source claims enumerated in architecture baseline; runtime verification limited where DB unavailable. |

## Evidence-backed conclusions
1. The architecture docs understate current route guard wrapping. Most operational routes are wrapped in `Guard`, but the `Guard` does **not** enforce authentication; it only checks route allowlisting.
2. Runtime endpoint registration is broad (high non-404 hit rate), but effective availability is degraded by DB dependency paths and missing DB fail-fast behavior.
3. Bob read namespace contract is implemented as GET-only + token middleware and returns structured blockers when token/env is missing.
4. The current dashboard protection is superficial at frontend-route level and not a true auth wall.

