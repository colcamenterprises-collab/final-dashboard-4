# Auth / Session / Access Map

## Login + token issuance
- `POST /api/auth/login` in `server/routes/auth/authRoutes.ts` delegates to `AuthService.login`.
- `AuthService.login` validates bcrypt hash and signs JWT with `JWT_SECRET`.
- `client/src/pages/auth/Login.tsx` stores `authToken` and `authUser` in `localStorage`.

## Registration
- `POST /api/auth/register` creates rows in `saas_tenant_users`.

## Guarding behavior in frontend
- `Guard` in `client/src/App.tsx` only checks `isAllowedPath(pathname)`.
- Route allowlist comes from `client/src/router/RouteRegistry.ts`.
- No runtime token verification occurs in `Guard`.

## Server-side auth middleware availability
- `server/middleware/authGuard.ts` verifies Bearer JWT and sets `req.user`/`req.tenantId`.
- `server/middleware/roleGuard.ts` enforces permission matrix.
- Use is route-dependent; not globally attached in `server/index.ts`.

## Bot token handling
- Middleware in `server/index.ts` validates `BOB_READONLY_TOKEN` / `BOBS_LOYVERSE_TOKEN` and sets `res.locals.isBotRequest`.

## Logout
- No dedicated backend logout route discovered; client-side token clearing must be handled in UI modules.
