# Dashboard 4.0 – Full Audit Report Before Consolidation (Corrected)

Audit mode: report-only correction after second sign-off review. No runtime logic changed.

## 1. Audit Corrections Applied
- C1: Added verified Bob / AI-Ops route surface from `server/routes/aiOpsControl.ts`, `server/routes/bobRead.ts`, `server/index.ts`, plus mounted aliases in route inventory.
- C2: Walked full `server/api/` tree; each file now has import evidence and role/delete-risk notes in `file-inventory.csv` plus explicit `docs/audit/server-api-inventory.csv` columns (imported, imported_from, likely_role, delete_risk, confidence).
- C3: Resolved `ROUTES.*` constants via `client/src/router/RouteRegistry.ts` into concrete frontend paths in inventories.
- C4: Expanded inline backend route capture for `server/routes.ts` and `server/index.ts` including `/api/daily-stock-sales` and `/api/manager-checklist` families.
- C5: Added `background-jobs-inventory.csv` covering dynamic imports, cron, schedulers, and monitor triggers.
- C6: Added `static-served-pages-inventory.csv` for operational HTML pages under `public/` and their exposure mechanisms.
- C7: Rewrote data flow section with source-of-truth evidence where derivable.
- C8: Reduced delete-candidate noise by splitting code candidates (`code-delete-candidates.csv`) vs asset/archive duplication evidence.
- C9: Corrected page status (`AnalysisPrototype` legacy), added `DailyReview.tsx` presence note, and removed bob workspace false duplicate framing.

## 2. Bob / AI-Ops Surface
- Mounted prefixes: `/api/ai-ops/*`, `/api/ops/ai/*`, `/api/bob/*`, `/api/bob/read/*` (VERIFIED from `server/index.ts`).
- Verified Bob/AI-Ops endpoints include `/api/ai-ops/bob/health`, `/manifest`, `/onboarding-context`, `/proxy-read`, `/file-read`, `/file-list`, `/analysis`, `/analysis/:date`, `/email/trigger`, `/analysis-csv/:date`, `/tasks`, `/chat/threads/:id/messages`, `/process-registry`, `/monitors/run` (VERIFIED from route modules).
- Business impact: these endpoints drive AI governance, read visibility, monitoring, and analysis workflows; omission would understate consolidation risk.

## 3. Dynamic Imports / Scheduled Jobs
- See `docs/audit/background-jobs-inventory.csv` for job-level evidence and schedule timings.
- Dynamic imports in orchestrators/services make some dependencies invisible to basic static import graphs.

## 4. Static-Served Operational Pages
- See `docs/audit/static-served-pages-inventory.csv`. Includes `tablet-nuclear.html`, `tablet-reload.html`, and chatbox pages with `express.static` and dedicated route exposure where present.

## 5. Route Resolution Improvements
- Frontend `ROUTES.*` constants resolved to concrete strings; unresolved placeholders removed where resolvable.
- Backend inventory includes both mounted router paths and inline `app.get/post/patch/delete` handlers.

## 6. Data Flow Audit (Corrected)
### Daily Sales
- Source of truth: `daily_sales_v2` evidence via Bob read endpoints and route comments (`server/routes/bobRead.ts`, `server/routes.ts`).
- Inputs: form submit APIs (`/api/daily-sales`, `/api/daily-shift-forms`, `/api/forms/daily-sales/v3`).
- Transformations: analysis builders and report modules in `server/routes.ts` + services.
- Outputs: library/read endpoints (`/api/library/daily-sales`, `/api/bob/read/forms/daily-sales`) and email/report flows.
- Confidence: VERIFIED for table/endpoint presence; runtime write path ownership remains LIKELY.

### Daily Stock
- Source of truth: `daily_stock_v2` and `daily_stock_sales` surfaces evidenced by routes and monitor checks.
- Inputs: `/api/daily-stock`, `/api/daily-stock-sales` family, manager checklist workflows.
- Transformations: shopping list generation hooks + variance monitors (`monitorEngine`).
- Outputs: stock analysis and Bob read module status endpoints.
- Confidence: VERIFIED for route/module presence; exact canonical table precedence across all paths is LIKELY.

### Purchasing
- Source tables indicated in Bob map: `purchasing_items`, `purchasing_shift_items`; routes under `/api/purchasing*` and shopping list routes.
- Confidence: LIKELY (table claims from curated map, requires DB schema/runtime confirmation).

### Ingredients / Recipes / Products
- Evidence: active routes in `server/routes.ts` and dedicated modules (`menuManagement`, `products`, `productIngredients`, ingredient upload/import endpoints).
- Confidence: VERIFIED for route/module surfaces; canonical ownership between legacy/new ingredient routes is LIKELY.

### Rolls / Meat Tally Sources
- Evidence: scheduled ledger rebuilds in `server/jobs/cron.ts` and ledger routes imported in `server/routes.ts` (`rollsLedger`, `meatLedger`, `drinksLedger`).
- Confidence: VERIFIED for scheduled rebuild + endpoint presence.

### Online Ordering
- Evidence: frontend routes (`/order`, `/online-ordering/*`, `/marketing/online-ordering`) and backend modules (`onlineOrderingV2`, `ordersV2Routes`, `menuOrderingRoutes`, online catalog).
- Confidence: VERIFIED for routing surfaces; primary vs legacy ordering stack remains LIKELY.

## 7. Remaining Blind Spots After Correction
- Runtime activation of scheduled jobs depends on bootstrap path and environment toggles.
- Dynamic imports can bypass static import-only usage maps.
- True endpoint usage frequency still requires production/API logs.
- Some source-of-truth claims require direct DB schema/data verification at runtime.
- Confidence labels applied as VERIFIED/LIKELY/UNKNOWN per evidence strength.


## 8. Replit Review Checklist (Post-Correction)
- [ ] Validate dynamic-import paths observed in `docs/audit/background-jobs-inventory.csv` against runtime startup logs.
- [ ] Confirm `/api/ai-ops/*` and `/api/bob/read/*` endpoint reachability in deployed environment.
- [ ] Confirm `server/api/*.ts` modules marked `imported=no` are not loaded via non-static mechanisms.
- [ ] Confirm static operational pages under `/public/*` and dedicated tablet routes are still intentionally exposed.
