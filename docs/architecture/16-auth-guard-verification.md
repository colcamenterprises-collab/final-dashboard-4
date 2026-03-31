# 16) Auth / Guard Verification

## Verification method
- Static verification of frontend guard logic (`client/src/App.tsx`, `client/src/router/RouteRegistry.ts`, `client/src/pages/auth/Login.tsx`).
- Runtime probe verification on live app server:
  - `POST /api/auth/login` (invalid credentials payload)
  - `GET /dashboard` without logged-in state
  - `GET /api/finance/summary/today` without auth headers
  - `GET /api/bob/read/system-health` without Bob token

## Explicit checks

### 1) Login route behavior
- Route `/login` is declared in public route block.
- Login form submits to `/api/auth/login` and on success stores:
  - `localStorage.authToken`
  - `localStorage.authUser`
- Post-login redirect is hard redirect to `/dashboard`.

### 2) Post-login redirect
- Verified in source: `window.location.href = "/dashboard"` in login success path.

### 3) Token/session storage
- Frontend persistence is localStorage-based.
- No route-level session context/provider checks token before rendering guarded routes.

### 4) Guard implementation
- `Guard` implementation returns children if `isAllowedPath(pathname)` else `NotFound`.
- `isAllowedPath` validates pathname against static allowlist (`ROUTES` values), including param matching for `:id` segments.
- Guard does **not** check token validity, auth user existence, or server session.

### 5) Protected route bypass risk
- `/dashboard` request without auth returns app shell HTML (runtime probe status 200).
- Since Guard is allowlist-only, knowing an allowed path is sufficient to render route component client-side.
- This is a **superficial route guard**, not authentication enforcement.

### 6) Membership/public separation
- Public `/membership` exists (marketing/public membership page).
- `/membership/dashboard` and `/membership/register` are wrapped with Guard.
- Because Guard is allowlist-only, separation is route-name separation, not identity-auth separation.

### 7) Internal dashboard exposure risk
- High risk: operations, finance, analysis pages are discoverable and renderable by URL if route exists in allowlist.
- Backend endpoint protections are inconsistent by module (some protected, some public, some DB-failing before auth path).

## Severity-ranked auth findings

| Severity | Finding | Evidence |
|---|---|---|
| Critical | Frontend dashboard guard does not enforce authentication; only allowlist path validation. | `Guard` + `isAllowedPath` implementation in App/RouteRegistry; runtime `GET /dashboard` without auth returned 200 HTML. |
| High | Token persistence (`authToken`) is not consumed by a global auth gate in router. | Login writes localStorage; no auth provider/guard reads token before route render. |
| High | Mixed backend protection posture: some routes enforce headers/token, some are explicitly public, some fail due DB before clear auth behavior. | Runtime probes: `/api/finance/summary/today` returns 200 unauth; `/api/bob/read/system-health` enforces token/env contract with 503/401 behavior. |
| Medium | Membership/public separation is path-based, not identity-based. | `/membership` public plus membership dashboard/register under allowlist guard only. |
| Medium | Internal operational pages inside `PageShell` include a subset that are entirely unguarded (`/operations/daily-sales`, POS/KDS/menu-v3/etc). | Route declarations in `App.tsx`. |

