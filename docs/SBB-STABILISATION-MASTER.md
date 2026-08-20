# SBB Stabilisation Master Register

## Purpose and control rules

This is the permanent control register for the SBB stabilisation and lightening programme. The required sequence is **Document → Baseline → Protect → Prove → Remove → Measure → Consolidate → Optimise → Generalise**. Work must remain single-purpose, independently reversible, and behaviour-preserving unless an approved PR explicitly states otherwise.

The following controls apply throughout the programme:

- Never infer that a legacy-looking item is unused. Verify imports, dynamic imports, route and script registration, workflows, deployment, services, schedules, documentation, and discoverable manual use first.
- Classify uncertain cleanup items as `LEGACY — USAGE UNCONFIRMED`; retain them until evidence resolves the uncertainty.
- Do not modify production data, canonical table meanings, schemas, migrations, ingestion, POS/staff forms, order/payment semantics, reporting cutover, or rollback behaviour without explicit later approval.
- Do not combine cleanup with refactoring, dependency churn, schema work, UI work, feature work, or formatting churn.
- Derived systems must be deterministic, rebuildable, idempotent, explicit about missing data, and must not guess.
- Bob read routes remain GET-only, token-protected, read-only, and use structured blockers for missing data.

## Current baseline

- **Baseline date:** 2026-08-17
- **Measured repository SHA:** `06c57932090abcb6de40b3835fec850e14b3861e` (the Phase 0 PR parent)
- **Inventory tool source SHA:** `783e6cc1f23747372f678a2d09e469403c6359c1` (the Phase 0 PR revision containing the tool)
- **Measurement command:** `node /tmp/sbb-phase0-inventory.mjs`, run from a checkout of the measured parent SHA
**Scope note:** Counts are static repository measurements. Route registrations and table declarations are deliberately labelled as static counts rather than claims about the live production database or runtime surface.

| Measure | Baseline | Method / qualification |
|---|---:|---|
| Tracked files | 3,554 | `git ls-files` |
| Production source files | 754 | Tracked JS/TS under `client/src`, `server`, `shared`, and `lib` |
| All tracked source files | 1,200 | Tracked JS/JSX/MJS/CJS/TS/TSX |
| Archived/reference files | 517 | Tracked files under the explicitly listed historical/reference prefixes in the inventory script |
| Image assets | 899 | Tracked common raster/vector image extensions |
| SQL files | 77 | Tracked `.sql` files |
| Package manifests | 5 | Tracked `package.json` files |
| Direct dependencies | 134 | Root `package.json` |
| Development dependencies | 27 | Root `package.json` |
| TypeScript diagnostics | 1,539 across 206 files | Clean `npm run check -- --pretty false` after removing `node_modules/typescript/tsbuildinfo`; repository-wide check fails with exit code 2 |
| Automated test files | 7 | Static filename/directory count; not equivalent to executed test cases |
| Passing automated tests | Not established | Phase 0 does not invent a canonical test command or execute potentially data-dependent scripts; PR 2 owns that work |
| Static server route registrations | 629 | `app`/`router` HTTP method calls in tracked server source; dynamic registrations require separate inventory |
| Main application static imports | 63 | Static imports in `client/src/App.tsx` |
| Main application lazy/dynamic imports | 0 | `lazy(`/`import(` occurrences in `client/src/App.tsx` |
| Prisma models | 144 | Static `model` declarations in root `schema.prisma`; no database comparison performed |
| Drizzle table declarations | 152 | Static table factory calls in root, shared, and server schema files; overlaps are possible |
| Raw migration directories | 16 | Unique tracked directories containing SQL beneath `migrations` or `prisma/migrations` |
| Largest frontend JS chunk | 2,303,655 bytes minified / 641,811 bytes gzip | Production build artifact |
| Total frontend JS | 2,475,928 bytes | Production build artifacts |
| Frontend CSS | 172,030 bytes | Production build artifact |
| Server bundle | 2,143,636 bytes | Production build artifact |

### Baseline verification state

| Check | Result | Evidence |
|---|---|---|
| Production build | PASS | `npm run build`; Vite transformed 3,094 modules and esbuild produced `dist/index.js` |
| TypeScript check | FAIL (existing baseline) | A clean `npm run check -- --pretty false` reports 1,539 diagnostics across 206 files; no errors were repaired or suppressed in Phase 0 |
| Build warnings | PRESENT | Stale Browserslist data, mixed static/dynamic jsPDF import, frontend chunk over 500 kB, and esbuild server bundle size warning |
| Runtime behaviour | NOT CHANGED | Phase 0 adds documentation and a read-only inventory command only |
| Database impact | NONE | No schema, migration, query, canonical data, or production operation changed or executed |

### TypeScript baseline discrepancy verification

**Verified status:** the earlier Phase 0 claim of zero diagnostics was incorrect. The settled baseline for this checkout is **1,539 diagnostics across 206 files**, and `npm run check` fails.

The discrepancy was caused by the incremental compiler cache at `node_modules/typescript/tsbuildinfo`. The root configuration enables `incremental` and places its build-info file at that path. The first Phase 0 check reused the existing local build-info file and returned exit code 0 without reporting the repository's existing diagnostics. After deleting only that generated cache file and rerunning the unchanged command, TypeScript performed a clean analysis and returned exit code 2 with 1,539 diagnostics. This reproduces, rather than contradicts, the original audit's conclusion that repository-wide TypeScript checking fails.

Verification facts:

- Phase 0 HEAD before this documentation amendment was `ba3fc26b1b67c92fc457ebe34a785d06ac4677c7`; its parent/base is `06c57932090abcb6de40b3835fec850e14b3861e`.
- The Phase 0 commit added only this register and `scripts/stabilisation/inventory.mjs`; it did not change TypeScript source, `package.json`, either lockfile, `tsconfig.json`, Prisma schema/generated source, or dependencies.
- The root `package.json` command remains `"check": "tsc"` at HEAD and its parent.
- Root `tsconfig.json` still includes `client/src/**/*`, `shared/**/*`, and `server/**/*`; it excludes `node_modules`, `build`, `dist`, `archive`, and `**/*.test.ts`. Imported files outside those glob roots can still enter the compiler program through the import graph.
- The previously cited importer files `server/reporting/importers/loyverseControls.ts` and `server/reporting/importers/persistImport.ts` still exist and are present in `npx tsc --showConfig` output. The older `client/src/pages/IngredientManagement.tsx` cited by the February review no longer exists at this SHA, but extensive failures remain elsewhere.
- The 12 August safety audit was made against an earlier repository state; many production TypeScript commits landed between that review and the 17 August base SHA. However, those later commits did not settle the discrepancy: a clean check of the current source still fails extensively.
- TypeScript remains declared as `^5.9.2` and the installed compiler is 5.9.2. No Phase 0 dependency or Prisma-generated-type change explains the false pass.

For a trustworthy local baseline, remove the ignored incremental cache before measuring:

```bash
rm -f node_modules/typescript/tsbuildinfo
npm run check -- --pretty false
```

### Major application packages and directories

| Path | Current role / treatment |
|---|---|
| `client/src` | Production frontend source |
| `server` | Production server, routes, services, and operational scripts |
| `shared` | Shared production schemas/types |
| `lib` | Shared library code counted as production source |
| `schema.prisma`, `schema.ts` | Protected schema authorities; static inspection only in this phase |
| `migrations`, `prisma/migrations` | Protected historical migration records |
| `native` | Native/Android integration; operational status requires investigation before cleanup |
| `website` | Independent website package |
| `archive`, `extracted_dashboard`, `focused-export` | Historical/reference candidates; not approved for deletion |
| `loyverse-ai-package`, `loyverse-ai-updated-package` | Auxiliary/historical package candidates; operational status unconfirmed |
| `.github`, `.deploy`, `scripts` | Workflow, deployment, maintenance, audit, and operational tooling; usage proof required before any cleanup |

## Protected areas — DO NOT TOUCH without explicit approval and stronger evidence

- POS order creation, item persistence, modifiers, discounts, and totals.
- Payments, receipts, refunds, reconciliation, and monetary units.
- Kitchen lifecycle, customer status, and public ordering.
- Reporting ownership/cutover and historical Loyverse transaction imports.
- `daily_sales_v2`, `daily_stock_v2`, purchasing receipt/stock data, and daily operational forms.
- Recipe authority, ingredient authority, menu/POS recipe mapping, and product/menu authorities.
- Owner/staff authorization, authentication, and session semantics.
- Canonical schemas, tables, data ingestion, production data, and historical migrations.
- Deployment release and rollback behaviour.

## Source-of-truth register

Status is intentionally conservative. `PROBABLE` means repository evidence identifies a likely authority but writer/reader/table/runtime verification remains incomplete. `UNKNOWN` means the programme must not choose an authority yet.

| Domain | Status | Current evidence | Evidence still required |
|---|---|---|---|
| Orders | PROBABLE | Active POS/public ordering routes and schema surfaces exist | Writer/reader/table matrix, runtime route verification, lifecycle tests |
| Receipts | PROBABLE | Receipt routes/services and recent receipt reporting work exist | Canonical writer, refund relationship, historical fallback verification |
| Reporting | PROBABLE | Unified reporting documentation and current reporting routes exist | Cutover/source ownership matrix and old/new output fixtures |
| Daily sales | PROBABLE | `daily_sales_v2` is explicitly protected as current operational data | Canonical writer/revision selection and production manifest |
| Stock | UNKNOWN | Daily stock, ledger, purchasing, and legacy stock generations coexist | Writer/reader/table map and reconciliation fixtures |
| Purchasing | UNKNOWN | Purchasing schemas/services and receipt/stock relationships coexist | Canonical receipt writer, stock effect, and fallback map |
| Menu | UNKNOWN | Existing architecture audit identifies overlapping `products`, `productMenu`, `menuManagement`, `menu-v3`, online, and ordering authorities | Screen/API/writer/reader/table matrix and runtime usage evidence |
| Recipes | UNKNOWN | Recipe and menu/POS mapping generations coexist | Canonical recipe writer and mapping authority verification |
| Expenses | UNKNOWN | Existing audit identifies overlapping legacy and current expense APIs/imports | Monetary-unit proof and canonical writer/reader/table map |
| Labour | UNKNOWN | Multiple staff/labour/daily operational surfaces exist | Writer/reader/table map and authorization verification |
| Authentication | CONFIRMED | Existing architecture audit verifies auth users via `saas_tenant_users` and the Prisma auth service | Permission coverage remains required, but repository authority is documented |

## Cleanup candidate register

No candidate below is approved for deletion. Phase 0 records questions; Phase 9 will produce the first dedicated usage report.

| Path / family | Why suspected | Import usage | Route usage | Workflow/deployment usage | Operational usage | Confidence | Removal status |
|---|---|---|---|---|---|---|---|
| `client/src/App.tsx.backup` | Explicit backup naming cited by prior audit | Not yet reverified | Not applicable/unchecked | Not yet reverified | Unknown | LOW | LEGACY — USAGE UNCONFIRMED |
| `archive/**` | Explicit archive tree | Not yet reverified | Not yet reverified | Not yet reverified | Unknown | LOW | LEGACY — USAGE UNCONFIRMED |
| `extracted_dashboard/**` | Extracted application copy with dependencies | Not yet reverified | Not yet reverified | Not yet reverified | Unknown | LOW | LEGACY — USAGE UNCONFIRMED |
| `focused-export/**` | Auxiliary copy including tracked dependencies | Not yet reverified | Not yet reverified | Not yet reverified | Unknown | LOW | LEGACY — USAGE UNCONFIRMED |
| `loyverse-ai-package/**` and `loyverse-ai-updated-package/**` | Similar auxiliary package generations | Not yet reverified | Not yet reverified | Not yet reverified | Historical Loyverse relationship may remain material | LOW | LEGACY — USAGE UNCONFIRMED |
| Root patch scripts and patch reports | Historical/one-shot naming | Not yet reverified | Not applicable/unchecked | Not yet reverified | Unknown | LOW | LEGACY — USAGE UNCONFIRMED |

## Stabilisation PR register

| PR | Purpose | Risk | Before metrics | After metrics | Tests/checks | Result | Rollback | Status |
|---|---|---|---|---|---|---|---|---|
| PR 1 (number pending) | Establish baseline documentation and read-only inventory tooling | LOW | 3,554 tracked files; no master register/inventory command | 3,556 tracked files after commit; baseline reproducible via one read-only command | `node scripts/stabilisation/inventory.mjs`; clean `npm run check`; `npm run build` | Inventory/build pass; TypeScript fails at the documented existing baseline | Revert the single PR commit; no data or runtime rollback required | Ready for review |
| PR 2 (number pending) | Establish canonical safe tests and inventory existing validation infrastructure | LOW | No root `test` command; executable safety/status unproven | `npm test` runs 12 safe reporting cases; inventory and gaps documented | `npm test`; `npm run test:reporting`; inventory syntax/run; clean TypeScript check; production build | 12/12 tests pass; build passes; clean TypeScript check reproduces 1,539 diagnostics across 206 files | Revert the single PR commit; no data or runtime rollback required | Ready for review |

## Known unresolved risks

- Endpoint sprawl and duplicate signatures remain; the static baseline finds 629 registrations, while earlier audits used different scopes and reported other totals.
- Authentication/authorization enforcement is not yet inventoried or comprehensively regression-tested.
- Menu/products, expenses, analysis/reporting, recipes, stock, and purchasing have overlapping generations or uncertain ownership.
- Only seven test files are identified statically; breadth and safety of executable coverage remain unproven.
- The largest frontend JavaScript chunk is approximately 2.30 MB minified and triggers the existing Vite size warning.
- jsPDF is both dynamically and statically imported, preventing the dynamic import from isolating it in a separate chunk.
- Historical/reference copies and tracked artifacts add material repository weight, but their usage has not been proven absent.
- Prisma, Drizzle, and raw SQL/migration approaches coexist; no live database manifest or migration ledger comparison has been performed.
- Production schema/data ownership is not inferred from repository declarations and remains protected.
- Deployment, schedules, service references, and external/manual operational usage must be included in every future removal proof.

## Phase 0 reproduction

The inventory script does not exist in the measured parent revision. To reproduce the recorded parent baseline, use the tool from the Phase 0 PR revision while the working directory is a separate checkout of the parent. The script reads repository data relative to the current working directory, so invoking the copy in `/tmp` does not cause it to measure the tool revision.

From the repository containing the Phase 0 revision, create a disposable parent worktree:

```bash
ORIGINAL_WORKTREE=$(pwd)
TOOL_REVISION=783e6cc1f23747372f678a2d09e469403c6359c1
BASELINE_REVISION=06c57932090abcb6de40b3835fec850e14b3861e

git show "$TOOL_REVISION:scripts/stabilisation/inventory.mjs" \
  > /tmp/sbb-phase0-inventory.mjs
git worktree add --detach /tmp/sbb-phase0-baseline "$BASELINE_REVISION"
cd /tmp/sbb-phase0-baseline

npm ci
rm -f node_modules/typescript/tsbuildinfo
npm run check -- --pretty false
npm run build
node /tmp/sbb-phase0-inventory.mjs

cd "$ORIGINAL_WORKTREE"
git worktree remove /tmp/sbb-phase0-baseline
rm /tmp/sbb-phase0-inventory.mjs
```

`npm ci` installs the dependencies recorded by the measured revision without changing its lockfile. The inventory command reads Git metadata, tracked files, root package metadata, schema source text, route source text, and existing local build artifacts. It writes nothing and performs no database, migration, rebuild, or production operation. Build values are `null` until the local build has produced `dist` artifacts.

## Next approved sequence

Stop after PR 1 review. Do not automatically continue. The next separately reviewed task is PR 2: expose existing safe tests through one reproducible package command, without changing application behaviour.

## Test Inventory

### Canonical commands

| Command | Supported purpose | Explicit exclusions |
|---|---|---|
| `npm test` | Canonical safe suite. Delegates to `test:reporting`, executes all three reporting test files with Node's test runner through the already-installed `tsx`, and propagates any failure as a non-zero exit. | No database, network, credentials, deployed server, migrations, fixtures, seeds, or operational smoke scripts. |
| `npm run test:reporting` | Direct name for the same 12-case reporting regression suite, useful for reporting-focused CI. | Identical exclusions to `npm test`; it is an alias for the real supported family, not an additional suite. |
| `npm run test:burger-metrics` | Existing opt-in HTTP smoke command against `SERVER_URL` (default local port 5000) and expected seeded historical data. | Not safe/default: needs a running service and known data state. |
| `npm run test:stock-ledger-smoke` | Existing opt-in database smoke command which seeds rows and runs ledger upserts. | Not safe/default: requires an explicitly disposable database and mutates it. It was not executed during this PR. |

No `test:db`, `test:integration`, or `test:smoke` umbrella was added: the discovered scripts do not yet share a safe isolated environment or trustworthy common contract. Naming an unsafe collection would imply support that does not exist.

### Automated suite inventory

The inventory tool's Phase 0 count of seven is a filename/directory heuristic, not seven executable test programs. It consists of three current `*.test.ts` files, two historical daily-form scripts, and two fixture assets (`test/data/05-versions-space.pdf` and `tests/fixtures/test-image.jpg`). Only the three reporting files use an automated test runner and are supported by the canonical command.

| Family / traceable files | Purpose and domain | Class | Dependencies / requirements | Mutation risk | Deterministic | Result on 2026-08-20 | Default CI | Reason |
|---|---|---|---|---|---|---|---|---|
| Unified ledger/cutover: `server/reporting/unifiedLedger.test.ts` | Exact Bangkok time ranges and half-open Loyverse/SBB cutover ownership; reporting | B — Isolated application | Node, `tsx`, installed packages; DB **no**; network **no**; credentials **no** | None | Yes | 3/3 pass | YES | Assertions exercise pure range/cutover paths. Importing the application module initializes the no-database adapter and prints a missing-`DATABASE_URL` warning, but no tested path queries a database. |
| Loyverse importer: `server/reporting/importers/loyverse.test.ts` | Cancellation, refunds, modifiers, and cutover rejection from in-memory CSV; reporting/import | A — Pure unit | Node, `tsx`; DB **no**; network **no**; credentials **no** | None | Yes | 4/4 pass | YES | All source descriptors and CSV content are in memory; no external Loyverse request or persistence occurs. |
| Unified labour: `server/reporting/unifiedLabor.test.ts` | Wage summarisation and labour-efficiency calculations; labour/reporting | B — Isolated application | Node, `tsx`, installed packages; DB **no**; network **no**; credentials **no** | None | Yes | 5/5 pass | YES | Tested functions are calculation-only. Module loading prints the same no-database warning, but the cases do not execute database code. |
| Daily form scripts: `client/test/dailyFormTest.js`, `client/test/dailyFormTest.mjs` | Submit, read, print and delete daily-form records against localhost; daily sales/stock | G — Historical/legacy operational test | Running local HTTP app, Axios, application database; DB **yes via service**; network **localhost**; credentials **no explicit** | **High:** creates and deletes persistent records | No: depends on service/data and catches individual failures | Not run (production-safety exclusion) | NO | Duplicate CommonJS/ESM generations, stale route assumptions, persistent mutations, and failure handling are unsuitable for CI; later usage verification is required. |
| Fixture assets: `test/data/05-versions-space.pdf`, `tests/fixtures/test-image.jpg` | Input files only; PDF/image handling | Not executable (inventory artefacts) | Consumer unconfirmed | None by themselves | N/A | Not executable | NO | They contain no assertions or runner entry point and must not be counted as passing tests. |

**Reporting confirmation:** `npm test` executes exactly 12 cases across the three listed files: 12 passed, 0 failed, 0 skipped/cancelled/todo. Running with `DATABASE_URL` removed produces two informational `[db] DATABASE_URL missing. Server running in no-database mode.` messages. The missing variable does not skip, alter, or fail any case; it is a module-initialisation warning only. The suite performs no database or network operation.

### Other executable validation infrastructure

These commands were discovered beyond conventional test names. They are retained and explicitly excluded from the canonical suite; discovery is not an endorsement to execute them against production.

| Family / paths and commands | Domain / purpose | Class | Requirements (DB / network / credentials) | Mutation and determinism | Current result | Default CI / reason |
|---|---|---|---|---|---|---|
| Burger metrics: `server/scripts/run_burger_metrics_test.ts`; `npm run test:burger-metrics` | Receipt/burger totals over HTTP | E — Operational smoke | Indirect DB through server / localhost or configured server / none explicit | Read-only request but fixed historical state required; not deterministic from clean checkout | Not run: service/state requirement | NO — no isolated server fixture. |
| Stock ledger: `server/scripts/stock_ledger_smoke.ts`; `npm run test:stock-ledger-smoke` | Rolls, meat, drinks ledgers | C — Database integration | PostgreSQL and Prisma / DB connection / `DATABASE_URL` | Inserts expenses, purchase, stock, and daily-sales rows and upserts ledgers; unsafe unless disposable | Not run: mutation stop condition | NO — explicit database writes. |
| Golden/reporting acceptance: `server/scripts/golden_smoke_day.ts`, `golden_validate_vs_csv.ts`, `golden_validate_week.ts`, `validate_week_burgers.ts`, `labour_acceptance_check.ts`, `mm_reconcile_day.ts`, `test_mm_v1.ts` (invoke individually with `tsx`) | Reporting, historical CSV, labour and reconciliation checks | C/F — DB integration or manual diagnostic | PostgreSQL/Prisma and/or local CSV inputs; environment-specific | Several read or rebuild derived state; results depend on supplied dates/data | Not run: database/data requirement | NO — no disposable fixture contract; some are evidence diagnostics rather than test-runner suites. |
| Local/deployed HTTP smoke: `scripts/smoke_v3.mjs`, `scripts/smoke_v3_strict.mjs`, `RUN_SMOKE_V3.sh`, `simple-v3-test.sh`, `test-frontend-flow.sh`, `test-v3-canonical.sh`, `server/scripts/run_burger_metrics_test.ts` | Daily forms, manager checks, stock and receipts | E/G — Operational smoke or historical | Running HTTP service / localhost; some direct `psql`; shell tools | Creates operational records; wrappers may rewrite scripts; data/time dependent | Not run: mutation and service stop conditions | NO — persistent writes and historical route assumptions. |
| Production/deployment probes: `scripts/verify-production-access.mjs`, `scripts/architecture/verify-runtime.mjs`, `scripts/verify-shift-data.js`, `scripts/shift-go-live-audit.mjs`, `scripts/test_readonly.mjs`, `server/scripts/daily_readiness_check.js` and `scripts/run-daily-readiness.sh` | Auth, routes, release/readiness and live shift evidence | D/E/F — External integration, smoke, or manual diagnostic | Deployed/local service and/or DB; access tokens/owner credentials for some | Mostly read probes, but environment-dependent; not reproducible from clean checkout | Not run: production/external exclusion | NO — credentials/deployed systems required. Daily readiness remains read-only evidence, not a regression suite. |
| Bob/static policy checks: `scripts/verify_bob_read_layer.mjs`, `scripts/bob-check.js`, `bob-workspace/audit-check.mjs`, `scripts/ci/pr-policy.sh`, `scripts/deny-layout-hacks.js`, `scripts/deny-unsafe.sh`, `scripts/guard-build.js`, `scripts/architecture/verify-runtime.mjs` | Read-layer contract, repository policy and architecture diagnostics | F — Manual diagnostic (some static, some runtime) | Static scripts need repository files only; runtime variants need a server/token | Static results can be deterministic; they are separate policy diagnostics, not business tests | Inventory/static sources inspected; not promoted or executed as a suite | NO — mixed contracts and purposes require a later explicit CI decision. |
| Root patch/smoke wrapper: `PATCH_FIX_AND_SMOKE_20251011.sh` | Historical manager-check patch plus smoke | G — Historical/legacy | Shell, service and possibly DB | **High:** edits production source, creates scripts/migrations, may seed DB | Not run: prohibited production mutation | NO — it is a patch installer, not a safe test. |
| Validation/audit utilities under `scripts/audit/**`, `server/validate-live-db.ts`, `server/migrations/checkConflict.ts`, `server/scripts/checkSchema.js`, `server/scripts/verify_prisma.ts`, `workers/parityAudit.mjs` | Repository/database investigation | F — Manual diagnostic | Varies; live-DB utilities require a database and environment | Environment-dependent; database scripts may query live state | Not run: manual/environment-specific | NO — investigation tools are not deterministic automated tests. |
| Archived/auxiliary validation examples under `archive/**`, `extracted_dashboard/**`, `loyverse-ai-package/**`, `loyverse-ai-updated-package/**` | Superseded/reference generations | G — Historical/legacy | Varies, frequently service/database/API configuration | Usage and safety unconfirmed | Not run | NO — retained pending later usage verification. |
| Android/native workflows: `.github/workflows/build-sbb-pos-android.yml`, `build-sbb-pos-apk.yml`, `build-sbb-pos-launch-apk.yml` | Native packaging/build validation | E — Operational build/smoke infrastructure | GitHub runner, Android/Gradle tooling; signing/deployment inputs vary | Build-oriented, environment-dependent | Statically inspected; not run locally | NO — not an application regression test and not safe/default test scope. |

No standalone automated ordering, POS lifecycle, payment, receipt rendering, authentication, authorization, deployment rollback, or migration test suite was found. The reporting workflow previously ran the same three reporting files directly; the root command now provides the canonical repository interface without changing that workflow or production code.

### Meaningful coverage assessment

| Domain | Assessment | Evidence / gap |
|---|---|---|
| POS order creation | Not Covered | No safe automated order-creation assertion. |
| POS item persistence | Not Covered | No isolated persistence fixture or disposable DB suite. |
| Modifiers | Partial | Loyverse in-memory importer splitting is asserted; live POS modifier behaviour is not. |
| Discounts | Partial | Import parsing includes discount fields, but no dedicated discount calculation/lifecycle assertion exists. |
| Payments | Partial | Refund import status is asserted; payment creation/capture methods are not. |
| Receipts | Partial | In-memory Loyverse receipt/refund parsing is asserted; SBB receipt creation/rendering/persistence is not. |
| Refunds | Partial | Imported refund monetary mapping is asserted; operational refund workflow is not. |
| Kitchen lifecycle | Not Covered | No automated lifecycle suite found. |
| Public ordering | Not Covered | Subproject builds exist, but no behavioural tests. |
| Authentication | Not Covered | Deployed/manual probes are not deterministic automated protection. |
| Authorization | Not Covered | Static/manual probes do not assert the permission matrix in a safe suite. |
| Reporting | Partial | Range/cutover, Loyverse import cases, and labour calculations are protected; queries, persistence and full output remain untested. |
| Daily sales | Not Covered | Historical scripts mutate a service/database and are excluded. |
| Daily stock | Not Covered | The stock smoke mutates a database and is not safe automated coverage. |
| Purchasing | Not Covered | No safe behavioural assertions found. |
| Recipes/costing | Not Covered | No safe behavioural assertions found. |
| Expenses | Not Covered | No safe behavioural assertions found. |
| Labour | Partial | Summarisation and efficiency calculations have five assertions; data acquisition/persistence does not. |
| Deployment rollback | Not Covered | Operational scripts/workflows exist, but no automated rollback assertion. |

### Phase 1 metrics and controls

The pre-change and post-change Phase 1 inventories at repository SHA `bf4ce8d6d5bd8c0aa2275e716decb28af08e3849` report 3,556 tracked files, 754 production source files, 1,201 tracked source files, 517 archive/reference files, 899 images, 77 SQL files, five package manifests, 134 direct and 27 development dependencies, seven heuristic test files, 629 static route registrations, 144 Prisma models, 152 Drizzle declarations, 16 raw migration directories, 63 main-app static imports, and zero lazy imports. Relative to Phase 0, only the already-merged two Phase 0 infrastructure files explain tracked files 3,554 → 3,556 and source files 1,200 → 1,201. This PR adds no tracked file, dependency, source file, route, schema, migration, or lockfile; only root scripts and this register change. After the production build, artifacts are: server bundle 2,143,740 bytes; frontend JavaScript 2,477,736 bytes; largest frontend chunk 2,305,463 bytes minified / 642,340 bytes gzip; frontend CSS 172,030 bytes. The minor artifact changes from Phase 0 arise from source commits already present before this PR; this PR does not touch build inputs.

#### TypeScript baseline timeline and discrepancy resolution

| Repository state | Exact SHA | Clean reproducible result |
|---|---|---|
| Historical Phase 0 measured baseline (parent used by the Phase 0 register) | `06c57932090abcb6de40b3835fec850e14b3861e` | Exit 2; **1,539 diagnostics across 206 files** |
| PR #369 Phase 0 merge/squash commit and PR 2 base | `bf4ce8d6d5bd8c0aa2275e716decb28af08e3849` | Exit 2; **1,539 diagnostics across 206 files** |
| PR 2 initial HEAD before this verification amendment | `8bcee9f346b5bd22abe432ee4e6508e653ee1d6c` | Same source baseline; PR 2 changes only this register and root package scripts |

Both historical states were checked independently in detached temporary worktrees. Each worktree ran a fresh `npm ci`, removed `node_modules/typescript/tsbuildinfo`, and ran `npx tsc --pretty false --incremental false` with TypeScript 5.9.2. Both produced exactly 1,539 diagnostics across 206 files. The worktrees were removed after evidence collection.

The earlier zero result was **C — local environment/dependency-state related**, not repository improvement and not a trustworthy new baseline. Although the compiler, configuration, declared package versions, Prisma declaration checksums, and 725-file compiler input list matched, the existing main-worktree `node_modules` state returned the false zero. Running the lockfile-authoritative `npm ci` in that same worktree, followed by the identical cache removal and explicitly non-incremental compiler command, immediately restored exit 2 and the exact 1,539/206 baseline. Therefore zero is not recorded as a baseline; clean installation is part of the reproducibility requirement.

The complete repository diff from the historical measured SHA to the PR 2 base contains four files. Commit `f5412f59b60bfac2d2d8f24a7890642edd8287fa` changes `client/src/pages/reports/ReceiptsReport.tsx`; commit `5418c8ef349cb8a6db37573a94c58b72db7ddce3` changes `server/middleware/sessionAuth.ts`; and PR #369 adds this register plus `scripts/stabilisation/inventory.mjs`. No `shared/**`, `lib/**`, `tsconfig*.json`, package manifest, lockfile, schema, generated/type configuration, or dependency declaration changes occur in that interval. The independent result at both endpoints proves the two production commits did not remove the TypeScript debt.

The PR 2 base-to-HEAD diff contains only `package.json` (the canonical test scripts) and this register. It contains no production TypeScript, TypeScript configuration, schema, dependency declaration, lockfile, test assertion, or runtime-code change. The checkout has no `origin` remote or `origin/main` ref, so `git merge-base HEAD origin/main` and `git rev-parse origin/main` cannot be resolved locally; the exact local ancestry above is used without inventing a remote SHA.

This PR intentionally changes no application/runtime behaviour, production data, database schema, migration, dependency, lockfile, or test assertion. Risk is **LOW**. Rollback is a single commit revert; no data or deployment rollback is required.

## PR 3 — Critical Financial and Calculation Invariants

### Purpose and result

PR 3 adds deterministic, production-independent regression protection around the existing reporting importer, source cutover, money conversion, payment classification, and banking calculation helpers. The change is test protection only: no production calculation, query, route, schema, migration, ingestion path, dependency, or lockfile was changed.

| Control | PR 3 result |
|---|---|
| Risk | **LOW** |
| Files | Added `server/reporting/financialInvariants.test.ts` and the opt-in `server/reporting/unifiedLedger.db.test.ts`; updated root reporting test commands in `package.json`; updated this register |
| Tests added | 16 pure deterministic cases plus two PostgreSQL-backed production-query cases with explicit, human-checkable fixtures |
| Safe test count | 28 pure/default tests: 28 passed, 0 failed, 0 skipped/cancelled/todo; two additional opt-in database integration tests |
| `npm test` | PASS; 28/28 |
| `npm run test:reporting` | PASS; 28/28 |
| `npm run test:reporting:db` | **PENDING EXTERNAL VERIFICATION**; the fail-closed test target was exercised, but no local PostgreSQL server was available and package installation was blocked by the environment proxy |
| TypeScript baseline | Expected non-zero baseline reproduced after `npm ci`: exit 2, **1,539 diagnostics across 206 files**; no new diagnostics (test files remain excluded by the existing compiler configuration) |
| Production build | PASS; only the previously accepted Browserslist, mixed jsPDF import, chunk-size, and server-bundle warnings remain |
| Runtime impact | **NONE**; only tests, the safe test command's file list, and documentation changed |
| Database impact | **NONE on application/production data and schema**; the opt-in harness creates and drops minimal fixture tables only inside the guarded disposable `sbb_reporting_test` database and runs no production migration |
| Dependency impact | **NONE**; `npm ci` was lockfile-authoritative and neither manifest dependencies nor lockfiles changed |
| Rollback | Revert the PR 3 commits. No production data, schema, migration, dependency, or deployment rollback is required. |

### Financial Invariants Protected

- A normal completed Loyverse sale keeps THB 500 gross, THB 50 discount, and THB 450 net, with `net = gross - discount - refund` for that sale representation.
- A sale plus its full refund preserves the original positive gross history, records the refund explicitly, and produces zero combined net sales without adding refund gross as another sale.
- A discounted sale plus full refund preserves THB 500 gross and THB 50 discount, refunds the THB 450 actually paid, and produces zero combined net sales.
- A single canonical payment allocation equals its receipt total; a refund payment remains negative while reporting refund amount remains explicit and positive.
- Loyverse CSV reporting values are THB major units at the canonical importer boundary. Loyverse API money objects containing `amount` or `value` are minor units divided by 100 exactly once, while scalar values remain major units.
- Historical Loyverse ownership strictly before the unchanged cutover and SBB POS ownership beginning exactly at the cutover remain protected at helper level. SQL-backed fixtures have now been added for `queryUnifiedOverview`, `queryUnifiedReceipts`, `queryUnifiedItemSales`, and `queryUnifiedOverviewBreakdowns`; production-query protection status remains **PENDING EXTERNAL VERIFICATION** until the explicit database suite passes on disposable PostgreSQL.
- Helper-level equivalent-source ownership remains protected. The new SQL suite is designed to prove that equivalent logical copies on both sides of each cutover fixture produce exactly one transaction and item through all four query paths; cross-source duplicate-inclusion status remains **PENDING EXTERNAL VERIFICATION** until that suite passes.
- The half-open `[from, to)` rule remains protected at resolver/helper-fixture level. The new SQL suite adds records immediately before `from`, exactly at `from`, inside, immediately before `to`, exactly at `to`, and immediately after `to`; production-SQL membership status remains **PENDING EXTERNAL VERIFICATION** until that suite passes. The 17:00–03:00 Asia/Bangkok range remains only an SBB fixture supplied to the configurable resolver, not a platform-wide restaurant-hours rule.
- Known payment classifications preserve Cash, QR/PromptPay, Grab, and Other. Unknown tenders remain explicitly unmapped even though their fallback reporting bucket is Other.
- A Grab sales channel remains a separate transaction field from a Cash payment method. The current Loyverse adapter also maps the same source `Dining option` value to `orderMode`; the test records this current representation without claiming those concepts are universally equivalent.
- Existing banking arithmetic is protected for a normal shift, zero cash sales with retained float, cash expenses/pay-outs, a cash overage, and the existing non-negative deposit floor.
- Existing labour tests continue to protect paid wage totals from reimbursements and tips; PR 3 does not duplicate those established assertions.

### Financial Invariants Still Unprotected

- **PARTIAL REFUND — NOT CURRENTLY REPRESENTED AS A VERIFIED CANONICAL INVARIANT.** No safe fixture proved an authoritative partial-refund lifecycle across current SBB reporting sources.
- Split payments are not protected. The current isolated Loyverse CSV adapter creates one payment from one receipt-level payment method; PR 3 does not invent multi-tender support.
- Grab gross, staff-entered Grab totals, POS Grab totals, and settlement payout remain separate concepts requiring later reconciliation evidence. No current isolated canonical helper accepts all three, so this PR neither sums them nor claims settlement coverage.
- Official Grab settlement reconciliation and bank-statement reconciliation remain unprotected.
- POS sales versus `daily_sales_v2` staff-entered sales requires a later integration/reconciliation test. No suitable isolated canonical calculation surface was found, and `daily_sales_v2` was not touched.
- Database transaction integrity, payment persistence, refund workflow persistence, reporting SQL aggregation, and live cutover query behavior require a disposable integration-test environment and remain outside the safe default suite.
- SQL numeric/decimal money boundaries outside the confirmed importer/API helper boundaries remain unresolved; no repository-wide money-unit standardisation is claimed.
- Channel, payment method, and order mode are distinct concepts, but the historical adapter currently derives both channel and order mode from `Dining option`. That representation risk is documented rather than redesigned.
- Paid labour versus all expense-ledger category interactions remain only partially protected beyond the existing pure labour summarisation tests.

### Contradictions and stop-condition review

No tested current invariant contradicted another and no existing financial defect was exposed by the deterministic fixtures. The investigation did not establish canonical partial-refund, split-payment, Grab-settlement, daily-form/POS reconciliation, or database-integrity semantics; those gaps are explicitly left unprotected rather than guessed. Production calculations did not need to change.

### PR 3 review correction — production SQL boundary coverage

The original PR 3 boundary cases protected `sourceOwnsTimestamp` and a local half-open membership expression only. Review correctly identified that those tests could remain green if one of the independently encoded production SQL predicates regressed. The opt-in command below now executes the actual four production reporting query functions against a dedicated local PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://localhost/sbb_reporting_test npm run test:reporting:db
```

`server/reporting/unifiedLedger.db.test.ts` refuses to start unless `TEST_DATABASE_URL` uses `localhost`, `127.0.0.1`, or `::1` and the exact database name `sbb_reporting_test`. It ignores any ambient production `DATABASE_URL`, assigns the validated local URL before importing production reporting modules, creates only minimal disposable fixture tables in that dedicated database, and removes the disposable schema after the tests. It does not run production migrations or read application data. The explicit database suite is not included in `npm test`, because PostgreSQL is not guaranteed in every checkout.

When run successfully on disposable PostgreSQL, the SQL-backed cases verify:

- immediately before cutover: exactly the historical copy is returned;
- exactly at and immediately after cutover: exactly the SBB POS copy is returned;
- duplicate logical representations across both fixture sources never produce more than one returned receipt or item;
- immediately before `from` is excluded, exactly `from` is included, an interior record is included, immediately before `to` is included, and exactly/after `to` are excluded;
- `queryUnifiedOverview`, `queryUnifiedReceipts`, `queryUnifiedItemSales`, and `queryUnifiedOverviewBreakdowns` all agree on transaction/item membership.

The local verification environment did not contain PostgreSQL, and its package mirrors rejected installation through the environment proxy. The DB-backed command therefore remains an explicit required CI/reviewer check on a disposable PostgreSQL service; no production or remotely hosted database was substituted. This environment limitation does not weaken the fail-closed database-target guard or add the suite to the default command prematurely.
