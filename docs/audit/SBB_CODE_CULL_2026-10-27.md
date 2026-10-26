# SBB codebase cull — 2026-10-27

Baseline: `main` at `ac64eba3e9cc9db4a8022124137c0eb155b899d0` (2026-10-26).
Scope: SBB Final Dashboard 4, not Customli V3.
Objective: progressively eliminate nonoperational code while keeping the active shop running.

## Observed repository characteristics

- 3,283 tracked files in 269 directories in the inspected baseline.
- 1,717 files / approximately 167 MB under `attached_assets/` (including 930 TXT files and many screenshots). **Do not bulk-delete these without reference/data-retention checks:** some assets may be served by URL or referenced by the database.
- Root `package.json`: 134 runtime dependencies and 27 development dependencies; no dependency removals in this wave.
- `server/routes.ts` is approximately 227 KB and the server exposes many historical route versions; do not remove server endpoints based solely on UI navigation.
- `client/src/App.tsx` eagerly imports the page modules; bundle splitting of non-shift pages is a later optimization subject to build and tablet acceptance tests.
- `server/index.ts` disables HTTP caching widely; replacing this requires targeted validation of POS/online ordering state freshness and static assets, not blind changes.

## Wave 1: deleted unmounted frontend modules

No routes in the active `client/src/App.tsx` mount these pages, and the active `client/src/layouts/PageShell.tsx` uses `ModernSidebar`, not the legacy navigations.

| Removed file | Reason |
| --- | --- |
| `client/src/app/layout.tsx` | Alternate unmounted root layout |
| `client/src/archive/LoyverseLive.tsx` | Archived Loyverse view |
| `client/src/config/nav.ts` | Obsolete navigation config with old route paths |
| `client/src/components/Sidebar.tsx` | Legacy sidebar, replaced by ModernSidebar |
| `client/src/components/SimpleSidebar.tsx` | Unmounted alternate sidebar |
| `client/src/components/navigation/BottomNav.tsx` | Unmounted navigation experiment |
| `client/src/pages/auth/Login.tsx` | Unmounted login page (app uses PIN login gate) |
| `client/src/pages/menu/CostCalculator.tsx` | Unmounted cost calculator; route redirects to active recipes |
| `client/src/pages/operations/DailyCleaning.tsx` | Superseded by active DailyCleaningV2 |
| `client/src/pages/reports/HistoricalReports.tsx` | Unmounted old report page |
| `client/src/pages/reports/ReceiptAnalytics.tsx` | Unmounted old report page; canonical receipts report remains |
| `client/src/pages/reports/ShiftHistory.tsx` | Unmounted old shift page; canonical shift review remains |
| `client/src/pages/reports/ShiftReports.tsx` | Unmounted duplicate of shift reporting |

### Associated obsolete scripts removed
- `scripts/install-owner-shift-report-v1.mjs`: old source-mutating installer referencing the unmounted ShiftHistory page.
- `scripts/guard-build.js`: unused legacy “golden files” guard that expects already-missing routes/files. The active PR governance and build workflows are left intact.

### UI-only removal
- Nonfunctional “Upgrade to Premium” panel in `ModernSidebar`, unrelated to SBB operations.

## Preserved — active shift / revenue / financial truth

**Mandatory retain unless proved independent and regression tested**:

- POS register, cash/QR payments, refunds, receipt numbering, shift open/close, expenses, native bridge, Bluetooth printing and cash drawer.
- Kitchen displays, ticket preparation and ready states, customer-facing display.
- Grab import/mapping, drink/set modifiers, counter ordering, online ordering, checkout and order lifecycle.
- Sales reporting: overview, receipt lists, sales by item, shift summary/reconciliation, inventory usage, exports, supporting ledger and COGS.
- Menu, category and modifier data needed to sell current products; underlying database, schema, migration history, APIs and authentication.
- Daily shift forms, staff-input history, financial source data, and audit traces.

## Currently routed workflow inventory — investigate before deleting

These are real routes in `client/src/App.tsx`, not dead modules. **Not deleted in Wave 1.** Current route availability is not proof that a workflow is unused.

| Workflow group | Routes / functions | Assessment |
| --- | --- | --- |
| Operations | Daily cleaning, daily stock, stock analysis, purchasing, purchase lodgement, shopping list | May touch staff during shift or create stock/COGS data; confirm usage/dependency |
| Operations admin | Issue register, manager checklist, health & safety, Loyverse mirror | Candidate for decommissioning if no longer used; check scheduled jobs and historical records |
| Staff | Staff dashboard, members, roster, cleaning, attendance, settings, staff access | Candidate for consolidation, but payroll/auth may depend on it |
| Finance | Finance hub, P&L, expenses, expense import | Retain until reporting and payment reconciliation data flows are understood |
| Online growth | QR/partner venues, members, online ordering settings and catalog | Could affect live orders; map dependencies before removing |
| Menu authoring | Recipes, ingredients, modifiers, categories | May feed POS/catalog/COGS; retain core services |
| Redirects | Historical report aliases, old printer/menu paths | Remove redirects only after checking links, devices and deployed clients |

## Next engineering waves, ordered by risk

1. Audit `attached_assets/` for source-code and database URL references; archive source materials externally and delete only confirmed non-runtime duplicates.
2. Map each currently routed non-shift page to its API calls, jobs, navigation, external links, and data writes; decommission complete workflows end-to-end rather than deleting a visible page only.
3. Audit duplicate `archive/`, `legacy/`, `loyverse-ai-package/`, `loyverse-ai-updated-package/`, `online-ordering/`, and `src/` trees against build, deployment and script entrypoints.
4. Split noncritical frontend routes into lazy chunks, keeping POS, orders and printing acceptance tests unchanged.
5. Profile slow server requests and correct static asset caching in isolation; retain fresh responses for financial/order APIs.
6. Validate all production-shift flows, then merge and deploy through the SBB production deployment workflow with rollback protection.

## Acceptance / safety

- A merged PR is not equivalent to deployment. The production deployment workflow executes on explicit dispatch or a change to `.deploy/sbb-production-request.txt`; this wave does not edit the request file.
- Require passing TypeScript ratchet, production build, reporting regression and PR governance checks.
- Check deployed source SHA and endpoints after actual deployment. No statement of production success without a successful deployment run and production validation.
- No changes to Prisma/database schemas, migrations, protected ingredient/purchasing/costing files, or live financial source tables in Wave 1.
