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

**Baseline date:** 2026-08-17  
**Repository SHA:** `06c57932090abcb6de40b3835fec850e14b3861e`  
**Measurement command:** `node scripts/stabilisation/inventory.mjs`  
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
| TypeScript diagnostics | 0 across 0 files | `npm run check` completed successfully on 2026-08-17; this measured checkout differs from the earlier audit finding and supersedes it only for this SHA |
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
| TypeScript check | PASS | `npm run check`; zero diagnostics |
| Build warnings | PRESENT | Stale Browserslist data, mixed static/dynamic jsPDF import, frontend chunk over 500 kB, and esbuild server bundle size warning |
| Runtime behaviour | NOT CHANGED | Phase 0 adds documentation and a read-only inventory command only |
| Database impact | NONE | No schema, migration, query, canonical data, or production operation changed or executed |

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
| PR 1 (number pending) | Establish baseline documentation and read-only inventory tooling | LOW | 3,554 tracked files; no master register/inventory command | 3,556 tracked files after commit; baseline reproducible via one read-only command | `node scripts/stabilisation/inventory.mjs`; `npm run check`; `npm run build` | PASS; warnings recorded above | Revert the single PR commit; no data or runtime rollback required | Ready for review |

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

From a clean checkout at the baseline SHA with dependencies installed:

```bash
npm run check
npm run build
node scripts/stabilisation/inventory.mjs
```

The inventory command reads Git metadata, tracked files, root package metadata, schema source text, route source text, and existing local build artifacts. It writes nothing and performs no network, database, migration, rebuild, or production operation. Build values are `null` until a local build has produced `dist` artifacts.

## Next approved sequence

Stop after PR 1 review. Do not automatically continue. The next separately reviewed task is PR 2: expose existing safe tests through one reproducible package command, without changing application behaviour.
