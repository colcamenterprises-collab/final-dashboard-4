# PR 4 — TypeScript Debt Ratchet

## Purpose

Prevent the existing repository-wide TypeScript debt from increasing while allowing stabilisation work to proceed incrementally.

The verified baseline before this PR is **1,539 TypeScript diagnostics across 206 files**. This PR does not attempt to repair that historical debt. Instead, every pull request is compared against its own base revision so existing diagnostics may remain, reductions are allowed, and new/increased production diagnostic signatures fail CI.

## Scope

This is CI/tooling only. It does not change application runtime behaviour, database access, schemas, migrations, dependencies, lockfiles, POS, ordering, kitchen, reporting calculations, authentication, or deployment behaviour.

## Ratchet design

`scripts/stabilisation/typescript-ratchet.mjs`:

1. Resolves the merge-base between the PR head and its base branch.
2. Runs only when TypeScript-impacting production inputs changed.
3. Creates a detached temporary worktree at the exact base SHA.
4. Runs `npm ci` in that worktree so the base is measured from its own lockfile-authoritative dependency state.
5. Runs TypeScript with `--incremental false` against both base and head, preventing stale `tsbuildinfo` from producing a false green result.
6. Parses diagnostics only for production source under `client/src`, `server`, and `shared`.
7. Compares diagnostic signatures by file + TypeScript code + message while ignoring line/column movement.
8. Compares counts as well as signatures, so duplicating an existing error still fails.
9. Fails if any diagnostic signature is new or increases relative to the PR base.
10. Allows existing diagnostics to remain and allows diagnostic counts to decrease.
11. Removes the temporary worktree afterward.

This is deliberately a live base-vs-head comparison rather than a permanently stored list of 1,539 errors. Therefore, when an error is fixed on `main`, the lower debt automatically becomes the new baseline and later reintroduction is blocked.

## CI integration

`PR Governance` now includes a `TypeScript debt ratchet` job using Node 22, matching the existing governance build environment.

The older reporting-only TypeScript check has been removed from `Reporting Overhaul Check`. Reporting PRs now use the same repository-wide ratchet as every other PR instead of failing merely because a changed file already contained historical debt.

Reporting regression execution now uses the canonical `npm test` command introduced during stabilisation PR 2.

## Safety behaviour

The ratchet is fail-closed for execution problems. If TypeScript exits unexpectedly or its failure cannot be parsed into production diagnostics, the ratchet fails rather than reporting a false pass.

Changes to `package.json`, `package-lock.json`, `tsconfig*`, `schema.prisma`, production TypeScript, the ratchet script, or PR governance are treated as TypeScript-impacting inputs.

No production database or external service is used.

## Verification required on this PR

GitHub Actions must demonstrate:

- PR Governance / Policy and migration safety — PASS
- PR Governance / TypeScript debt ratchet — PASS
- PR Governance / Production build — PASS
- PR Governance / Workflow formatting — PASS
- Reporting Overhaul Check, if triggered — PASS

The ratchet job also runs its built-in deterministic self-test before comparing repository states.

## Rollback

Revert this PR. There is no database, data, dependency, build-artifact, or production-runtime rollback requirement.

## Risk

**LOW** — CI/tooling only.

## Next stage

After owner review and merge, proceed to the route/authorization inventory. Do not begin runtime cleanup as part of this PR.
