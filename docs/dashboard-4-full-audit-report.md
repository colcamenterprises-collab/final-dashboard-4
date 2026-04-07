# Dashboard 4.0 – Full Audit Report Before Consolidation

Audit type: report-only static repository audit.

## A. Executive Summary
- App currently spans frontend (`client/`), backend (`server/` and `src/server/`), shared modules, scripts, archives, and package snapshots across **3338 tracked files**.
- Fragmentation status: VERIFIED HIGH (parallel trees, route overlap, legacy copies).
- Top 10 structural problems:
  - Monolithic `server/routes.ts` with many mounts and inline handlers (VERIFIED/LIKELY as noted in inventories).
  - Parallel code trees (`server/` and `src/server/`) (VERIFIED/LIKELY as noted in inventories).
  - Multiple package snapshots (`loyverse-ai-package*`) in-repo (VERIFIED/LIKELY as noted in inventories).
  - Archive/backup/asset trees co-located with active source (VERIFIED/LIKELY as noted in inventories).
  - Frontend has multiple route aliases and redirects (VERIFIED/LIKELY as noted in inventories).
  - Legacy/prototype files remain committed (VERIFIED/LIKELY as noted in inventories).
  - Many scripts/patches in root increase operational ambiguity (VERIFIED/LIKELY as noted in inventories).
  - Static analysis cannot prove runtime usage for all files (VERIFIED/LIKELY as noted in inventories).
  - Potential duplicate endpoint families by naming (VERIFIED/LIKELY as noted in inventories).
  - Potential duplicate page flows by route aliases (VERIFIED/LIKELY as noted in inventories).
- Top 10 critical areas to preserve:
  - Daily Sales (VERIFIED by file/route keyword mapping).
  - Daily Stock (VERIFIED by file/route keyword mapping).
  - Purchasing (VERIFIED by file/route keyword mapping).
  - Ingredients (VERIFIED by file/route keyword mapping).
  - Recipes (VERIFIED by file/route keyword mapping).
  - Products (VERIFIED by file/route keyword mapping).
  - Menu Management (VERIFIED by file/route keyword mapping).
  - Online Ordering (VERIFIED by file/route keyword mapping).
  - Receipts (VERIFIED by file/route keyword mapping).
  - Shift Reports + Finance (VERIFIED by file/route keyword mapping).

## B. Repository Structure Map
- `attached_assets`: 1607 files.
- `server`: 501 files.
- `client`: 344 files.
- `extracted_dashboard`: 301 files.
- `archive`: 170 files.
- `(root)`: 121 files.
- `uploads`: 47 files.
- `scripts`: 40 files.
- `docs`: 32 files.
- `loyverse-ai-package`: 28 files.
- `loyverse-ai-updated-package`: 21 files.
- `exports`: 19 files.
- `public`: 16 files.
- `online-ordering`: 15 files.
- `bob`: 10 files.
- `prisma`: 9 files.
- `src`: 9 files.
- `data`: 8 files.
- `sql_migrations`: 8 files.
- `migrations`: 7 files.
- `focused-export`: 5 files.
- `shared`: 5 files.
- `backups`: 4 files.
- `bob-workspace`: 4 files.
- `workers`: 3 files.
- `lib`: 1 files.
- `test`: 1 files.
- `tests`: 1 files.
- `tools`: 1 files.
Active vs likely legacy: active likely `client/`, `server/`, `shared/`, `scripts/`; likely legacy `archive/`, `backups/`, `extracted_dashboard/`, `loyverse-ai-package/`, `loyverse-ai-updated-package/` (LIKELY).

## C. Frontend Surface Audit
- Every discovered route is listed in `docs/audit/route-inventory.csv` (frontend rows).
- Navigation-linked status remains UNKNOWN unless statically linked in components; manual runtime navigation check required.
- Duplicate/alias routes are tagged in notes.

## D. Backend Surface Audit
- Route signatures were extracted from `server/**` and `src/server/**`; see `docs/audit/route-inventory.csv`.
- Registration center is `server/routes.ts` plus modular routers under `server/routes/` and `server/api/`.
- Dynamic imports and conditional startup behavior require manual confirmation.

## E. Data Flow Audit
### Daily Sales
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Daily Stock
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Purchasing
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Ingredients
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Recipes
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Products
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Menu / Online Ordering
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Receipts
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### Shift Reports
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

### AI / analysis modules
- source of truth: UNKNOWN / NEEDS MANUAL CONFIRMATION
- inputs: VERIFIED relevant files/routes exist
- transformations: LIKELY server services/forms/routes
- outputs: LIKELY API responses, report pages, exports/emails/PDFs
- known duplication/conflicts: see duplicate register
- confidence level: LIKELY

## F. Duplicate Systems Audit
- See `docs/audit/duplicate-conflict-register.md`.

## G. Dead Code / Legacy Audit
- See `docs/audit/delete-candidate-register.md` and `legacy_flag` in `docs/audit/file-inventory.csv`.

## H. Risk Register
- Without consolidation: conflicting logic and route drift risk.
- Aggressive deletion: hidden runtime dependency risk.
- Pre-cleanup migration: duplication carried into target platform risk.

## I. Proposed Cleanup Order
- See `docs/audit/consolidation-recommendation.md`.

## J. Replit Review Checklist
- [ ] Verify runtime-only dependencies not visible in static imports.
- [ ] Verify dynamic route mounts/lazy imports in backend registration.
- [ ] Verify all manually-entered URL pages in production.
- [ ] Verify endpoints unused by frontend through access logs.
- [ ] Verify cron/background workers actually enabled.
- [ ] Verify env var coverage for integrations and auth.
