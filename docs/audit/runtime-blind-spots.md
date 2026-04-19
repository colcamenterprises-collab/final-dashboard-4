# Runtime Blind Spots (Final Sweep)

## Still blocked without runtime validation
- Effective auth behavior across mixed protected/public prefixes in `server/index.ts`.
- True endpoint precedence when duplicate or overlapping mounts exist in `server/routes.ts`.
- Scheduler and cron execution behavior under deployed timezone/runtime settings.
- Email/PDF delivery reliability and duplicate-email prevention in production integrations.
- AI-Ops and Bob control-plane behavior requiring live token + database state.

## Implication
Cleanup implementation that changes ownership, route wiring, or runtime scheduling remains blocked until these are validated in runtime test environments.
