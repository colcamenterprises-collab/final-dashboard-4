# Business-Critical Keep Register (Final Sweep)

## Purpose
Runtime-protection register for Dashboard 4 cleanup sequencing. Items listed here are protected from cleanup PR #1 scope.

## Hard-stop protected systems
- Daily sales source capture and library read surfaces.
- Daily stock source capture and reconciliation surfaces.
- Purchasing pipeline (list, mapping, shift log, analytics).
- Ingredient authority and canonical ingredient mapping controls.
- Recipes and product/menu linkage surfaces.
- Receipts, shift reports, and shift snapshot/reporting surfaces.
- Bob / AI-Ops operational control and read planes.
- Critical background jobs and schedulers.
- Email/PDF report generation flows.

## Mandatory keep files (runtime-protected)
- `server/services/analysisBuildOrchestrator.ts`
- `server/services/monitorEngine.ts`
- `server/cron/dailyReportCron.ts`
- `server/routes/aiOpsControl.ts`
- `server/routes/bobRead.ts`
- `server/routes.ts`
- `client/src/router/RouteRegistry.ts`
- `server/api/forms.ts`

## Protection rationale
- These files anchor either source-of-truth intake, daily operational readiness signaling, or executive reporting outputs.
- Any cleanup touching these files requires explicit runtime validation gates before merge.

## Verification note
Final sweep confirms these files are present in the current repository and remain referenced by active routing/scheduler wiring.
