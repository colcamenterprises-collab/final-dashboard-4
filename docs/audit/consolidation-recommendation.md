# Consolidation Recommendation

1. Keep runtime inventories authoritative in `docs/audit/*.csv` generated from active `server/**` and `client/src/**` trees.
2. Keep archive/asset duplication analysis separate from runtime delete guidance to avoid false-positive code removals.
3. Use `client/src/router/RouteRegistry.ts` as canonical frontend route map; avoid unresolved `ROUTES.*` references in reports.
4. Treat Bob read namespace `/api/bob/read/*` and AI-Ops proxy surface as mandatory daily-read coverage.
5. Keep background jobs/schedulers in dedicated inventory files to prevent omission in future audits.