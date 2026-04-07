# Business-Critical Keep Register

Must-keep runtime surfaces confirmed from router mounts and direct imports.

## API and orchestration
- `server/routes.ts` (primary API composition and mounts).
- `server/index.ts` (boot, middleware, scheduler wiring, static serves).
- `server/routes/aiOpsControl.ts` (AI-Ops and Bob proxy/read surface).
- `server/routes/bobRead.ts` (canonical `/api/bob/read/*` endpoints).

## Source-of-truth forms and ingestion
- `server/forms/dailySalesV2.ts` (daily sales ingest + audit trail hooks).
- `server/api/**` and mounted ingestion routes under `server/routes/**`.

## Frontend route authority
- `client/src/router/RouteRegistry.ts` (canonical ROUTES constants used for frontend path resolution).
