# System Overview

## Verified runtime scope
- Frontend runtime entrypoint: `client/src/main.tsx` -> `client/src/App.tsx`.
- Backend runtime entrypoint: `server/index.ts`.
- Route composition layer: `server/routes.ts` via `registerRoutes(app)`.
- Public static paths: `/attached_assets`, `/uploads`, `/public`, `/online-ordering`.

## Application layers
- Public website/order layer: `/order`, `/online-ordering/*`, `/marketing/*`, membership pages.
- Internal dashboard layer: PageShell-wrapped routes in `App.tsx`.
- Backend API layer: direct endpoints in `server/index.ts` + mounted routers from `server/routes.ts` and route modules.

## Tech stack in active runtime
- Node.js + Express (server)
- React + React Router + TanStack Query (client)
- Prisma + Drizzle coexistence
- PostgreSQL (via Prisma/pg/drizzle)
- Cron/background jobs via `node-cron` and timers

## Source-of-truth summary (verified)
- Multiple overlapping data authorities exist (Prisma models + Drizzle tables + legacy routes).
- Canonical Bob read namespace exists at `/api/bob/read/*` and is mounted in `server/index.ts`.
- Auth token generation and verification lives in `server/services/auth/authService.ts`; login UI stores token in `localStorage`.

## Top fragility summary
- 665 endpoint declarations across server files; duplicate method+path declarations exist.
- Frontend route guard (`Guard`) checks path allowlist, not auth token validity.
- Legacy and current page modules overlap; 69 page files are not imported by `App.tsx`.

## Top-level system diagram
```mermaid
flowchart TD
  Browser[Browser Client] --> ReactApp[client/src/main.tsx -> App.tsx]
  ReactApp --> Shell[PageShell + RouteRegistry Guard]
  ReactApp --> PublicRoutes[Public routes: /login, /order, checkout]
  Shell --> ApiCalls[/api/* requests]
  ApiCalls --> Express[server/index.ts]
  Express --> RegisterRoutes[registerRoutes(app) in server/routes.ts]
  RegisterRoutes --> Routers[server/routes/* mounted routers]
  Express --> DirectEndpoints[direct app.get/app.post in index.ts]
  Routers --> DB[(Postgres via Prisma + Drizzle + pg pool)]
  Express --> Cron[Startup schedulers + cron jobs]
  Express --> Bob[/api/bob/read/*]
```
