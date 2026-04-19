# Protection Rules Refresh (Final Sweep)

## Non-negotiable hard-stops for cleanup execution
1. Do not alter daily sales/daily stock source ingest behavior.
2. Do not alter purchasing write paths without runtime validation plan approval.
3. Do not alter ingredient authority canonical mapping writes.
4. Do not alter recipes/products authority behavior.
5. Do not alter receipts/shift reports logic before baseline verification.
6. Do not alter Bob read GET-only contract under `/api/bob/read/*`.
7. Do not alter monitor/cron/reporting runtime jobs in cleanup PR #1.
8. Do not alter email/PDF flow behavior in cleanup PR #1.

## Critical file lock list
- `server/services/analysisBuildOrchestrator.ts`
- `server/services/monitorEngine.ts`
- `server/cron/dailyReportCron.ts`
- `server/routes/aiOpsControl.ts`
- `server/routes/bobRead.ts`
- `server/routes.ts`
- `client/src/router/RouteRegistry.ts`
- `server/api/forms.ts`

## Validation gate requirement (future runtime phases)
Any change touching locked files requires:
- route-level regression checks,
- auth checks,
- daily readiness check evidence,
- and rollback note before merge.
