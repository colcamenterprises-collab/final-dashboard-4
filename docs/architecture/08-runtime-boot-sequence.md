# Runtime Boot Sequence

1. Process-level rejection/exception handlers are registered (`server/index.ts`).
2. Express app created; middleware order applied: reqId -> timing -> body parsers -> tenantResolver -> cache headers -> timeout -> static mounts -> tenantContext -> bot-token parser -> API logger.
3. `registerRoutes(app)` called from `server/routes.ts`.
4. Additional routers mounted in async startup block (`server/index.ts`).
5. Error guard mounted last.
6. Dev mode uses `setupVite`; production uses `serveStatic`.
7. HTTP server listens on `PORT || 8080`.
8. Deferred startup starts schema checks, auto-seed, schedulers, cron jobs, startup backfills, tenant/admin bootstrap.
