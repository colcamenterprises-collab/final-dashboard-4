# Dashboard 4.0 Consolidation Execution Plan

## Planning Scope and Constraints
- **Planning-only PR**: no runtime code changes, no deletions, no refactors, no behavior changes.
- Plan is based on completed audit outputs and Replit final review: **APPROVED WITH MINOR CORRECTIONS**.
- Replit correction constraints are enforced in this blueprint:
  1. `docs/audit/page-inventory.csv` is **not** authoritative for frontend route URLs.
  2. `docs/audit/background-jobs-inventory.csv` is **not** deletion-safe by itself; runtime validation is mandatory.

## A) Executive Consolidation Objective
Dashboard 4.0 must become a **single-canonical, runtime-verified, deletion-safe** product base where every production-critical function has one clear owner path, duplicated paths are either merged or frozen, and legacy assets are archived without affecting live operations.

### Definition of Done (before Dashboard 5 starts)
1. Canonical runtime paths for routes, services, and modules are explicitly documented and runtime-proven.
2. Protected operations remain fully stable during consolidation.
3. High-risk duplicates are merged only after parity tests and runtime proofs.
4. Legacy/unused assets are archived first, then retired/deleted only under deletion gates.
5. All cleanup actions are recorded in the decision register with sign-off evidence.
6. Final deletion approval gate is passed before any destructive cleanup.
7. Final platform-readiness gate is passed before any Dashboard 5 or migration work.

## B) Protected Systems (Do Not Break)
The following are protected throughout consolidation:
- Daily sales flows
- Daily stock flows
- Purchasing
- Ingredient authority
- Recipes
- Products
- Receipts / shift reports
- Bob / AI-Ops
- Critical scheduled jobs
- Email / PDF outputs

**Protection rule:** any planned cleanup touching these systems requires runtime validation gate evidence first, then staged parity proof, then sign-off.

## C) Freeze List (Frozen Until Replacement Is Live)
Freeze means: no delete/rename/retire until replacement path is runtime-proven.

- Bob read and AI-Ops control surfaces (`/api/bob/read/*`, AI-Ops control routes).
- Scheduler/cron/timer entrypoints and job launch wiring.
- Daily sales + daily stock ingest paths and their primary route mounts.
- Purchasing core routes and ingredient-purchasing routes.
- Recipe/product/ingredient authority source routes and service layers.
- Receipts, shift reports, email/PDF generation paths.
- `server/routes.ts` and `server/index.ts` mount/boot orchestration.
- Frontend route authority chain (`client/src/router/RouteRegistry.ts` + `client/src/App.tsx`) as route truth.

## D) Merge List (Canonical Owner Targets)
These overlap groups are merge candidates; each must pick one canonical owner before retirement of alternates:
- Shopping list surface (triple path): `server/shoppingList.ts`, `server/routes/shoppingList.ts`, `server/services/shoppingList.ts`.
- Ingredient authority overlap (`server/routes/ingredientAuthority.ts`, `server/routes/admin/ingredientAuthority.ts`, `server/lib/ingredientAuthority.ts`).
- Finance/forms route overlap (`server/routes/finance.ts` + `server/api/finance.ts`, `server/routes/forms.ts` + `server/api/forms.ts`).
- Shift window utilities (`server/lib/shiftWindow.ts`, `server/services/time/shiftWindow.ts`, `server/utils/shiftWindow.ts`).
- Email/PDF stacks (`server/lib/email.ts` + `server/services/email.ts`; `server/lib/pdf.ts` + `server/services/pdf.ts` + route-specific PDF handlers).
- Recipe service duplication (`server/services/recipeService.ts`, `server/services/menu/recipeService.ts`).
- Ledger duplicates (drinks/meat/rolls route+service pairs).

## E) Retire List (Only After Verified Replacement)
Retire only after canonical replacement is active and parity-tested:
- Any duplicate implementation in the overlap register not selected as canonical.
- Unmounted route files listed in legacy/dead map only after runtime mount/import checks confirm no dynamic usage.
- Legacy alias routes once canonical URLs and redirects are verified stable.

## F) Archive List (Archive Before Any Deletion)
Archive-first candidates:
- `archive/**` legacy snapshots.
- `attached_assets/**` transcript/artifact payloads.
- `tmp/**` generated outputs and one-off logs.
- Historical investigation documents not used by runtime pathing.

## G) Runtime Validation Requirements (Gate-driven)
All risky changes must pass the runtime validation gates documented in:
- `docs/consolidation/runtime-validation-gates.md`
- `docs/consolidation/deletion-safety-matrix.csv`

## H) Workstreams
Execution is partitioned into practical workstreams (see `docs/consolidation/consolidation-workstreams.md`):
1. Route normalization
2. Service/module consolidation
3. Daily forms consolidation
4. Analysis/shift systems cleanup
5. Purchasing/ingredient/product boundary cleanup
6. Frontend route/page consolidation
7. Archive/retire pass
8. Tests and sign-off

## I) Execution Order (Strict Sequence)
1. Baseline lock + freeze markers
2. Runtime truth capture (routes/mounts/jobs/Bob)
3. Route normalization decisions
4. Service/module canonicalization
5. Domain consolidations (forms, analysis/shift, purchasing/ingredient/product)
6. Frontend route consolidation against RouteRegistry/App truth
7. Archive-first pass
8. Retire/delete pass (gated)
9. Final regression + sign-off gates

## J) Deletion Safety Model
Every candidate area must be classified using:
- Do not touch
- Freeze
- Merge later
- Archive first
- Delete only after runtime validation
- Safe to remove after parity test

Classification lives in `docs/consolidation/deletion-safety-matrix.csv`.

## K) Sign-off Model
Required gates are formalized in `docs/consolidation/test-and-signoff-plan.md`:
1. Codex implementation gate
2. Replit runtime verification gate
3. Final approval before deletions
4. Final approval before Dashboard 5

## Out of Scope (This PR)
- No cleanup implementation
- No file deletion
- No runtime refactor
- No route behavior changes
- No platform migration actions
