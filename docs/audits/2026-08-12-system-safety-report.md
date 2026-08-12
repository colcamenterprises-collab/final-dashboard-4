# SBB System Safety and Work Report — 12 August 2026

**Repository:** `colcamenterprises-collab/final-dashboard-4`  
**Production host:** Hostinger, `/opt/apps/sbb-app-production`  
**Review scope:** GitHub governance and workflows, production service state, PostgreSQL/Prisma safety, reporting controls, and changes completed during the review.

## Executive conclusion

The repository is substantially safer than it was at the beginning of this review. Direct and automated mutation of `main` has been restricted, destructive legacy workflows have been removed, pull requests are protected by required checks, and the reporting update was merged only after its dedicated validation passed.

The application service was running during the Hostinger inspection. However, the production database remains the principal unresolved risk. The checked-in Prisma model does not represent the live database, production has no Prisma migration ledger, and a generated Prisma migration diff would delete a large amount of live schema. Database migrations must remain frozen until the production schema is baselined and reconciled.

**Current safety assessment:**

| Area | Status | Assessment |
|---|---|---|
| GitHub branch governance | Improved / controlled | Active ruleset protects the default branch |
| GitHub Actions | Improved / controlled | Unsafe self-modifying workflows removed |
| PR validation | Controlled | Required policy, build and formatting checks active |
| Reporting change | Completed | Merged after reporting-specific validation |
| Production application service | Operational when inspected | systemd service active and running |
| Production deployment parity | Requires verification | Host checkout observed before today's GitHub merges |
| Prisma migration safety | Critical unresolved risk | Migrations frozen pending reconciliation |
| Production filesystem hygiene | Requires remediation | Runtime files and backups are mixed into the Git worktree |

## Work completed

### 1. GitHub repository governance

An active branch ruleset named **SBB Ruleset** was configured for the default branch with:

- pull requests required before merging;
- required status checks;
- branches required to be current before merging;
- conversation resolution required;
- branch deletion restricted;
- force pushes blocked;
- bypass list left empty;
- squash merge as the only permitted merge method.

The required checks are:

1. **Policy and migration safety**
2. **Production build**
3. **Workflow formatting**

GitHub Actions workflow permissions were also reduced to read-only repository contents and packages, preventing legacy workflows from using the default token to push changes to `main`.

### 2. Pull requests completed

| PR | Result | Purpose |
|---|---|---|
| [#330](https://github.com/colcamenterprises-collab/final-dashboard-4/pull/330) | Merged | Corrected malformed Android workflow YAML |
| [#331](https://github.com/colcamenterprises-collab/final-dashboard-4/pull/331) | Merged | Added PR governance and database migration safety controls |
| [#332](https://github.com/colcamenterprises-collab/final-dashboard-4/pull/332) | Merged | Removed unsafe self-modifying and production-hotfix workflows |
| [#334](https://github.com/colcamenterprises-collab/final-dashboard-4/pull/334) | Merged | Repaired reporting TypeScript validation to block errors in changed files while exposing existing debt as warnings |
| [#333](https://github.com/colcamenterprises-collab/final-dashboard-4/pull/333) | Merged | Redesigned Reporting Overview and added gross sales, labor metrics and hourly bar reporting |

The reporting update was merged as commit `3673e47ea7d2d54d4d2fc752156d1081e74330d3`.

### 3. GitHub Actions cleanup

Six unsafe or redundant workflows were removed:

- `apply-dashboard-small-fixes`
- `emergency-pos-launch-hotfix`
- `pos-instant-display-ticket-fix`
- `pos-launch-patch-cloud`
- `pos-launch-ticket-options-fix`
- `pos-production-db-hotfix`

These workflows could bypass normal review or mutate production/code from CI. The retained workflow inventory was checked for:

- `contents: write`;
- `git push`;
- `git reset --hard`;
- Prisma DDL or migration commands;
- malformed YAML.

The remaining six workflows passed the final scan. Exact-reference deployment and the required Android APK builders were retained.

### 4. Reporting Overview completed

The Reporting Overview now includes:

- Gross Sales as a primary KPI;
- Net Sales;
- Orders;
- Average Order;
- Labor Cost and Labor Cost %;
- payment mix;
- category mix;
- top-product panels;
- a cleaner, more colourful dark dashboard presentation;
- one vertical hourly-sales bar per hour;
- venue-local time labels such as `5pm`;
- zero-sales hours retained within the reporting window.

Labor currently uses positive, named `WAGES`, `OVERTIME` and `BONUS` entries recorded in Daily Sales & Stock V2. Reimbursements and tips are excluded. This is intentionally labelled as form-recorded labor and should eventually be replaced by attendance/timekeeping as the payroll authority.

The reporting validation includes labor regression tests. All governance, formatting, production-build and reporting checks passed before merge.

## Hostinger and production findings

### Application service

At the time of inspection:

- deployed checkout: `03a7314e05cc5d66b1e9aad94f75f50f5fc81b9b`;
- branch: `main`, aligned with `origin/main` at that inspection point;
- systemd unit: `sbb-production`;
- state: `active (running)`;
- process start timestamp: `2026-08-10 21:32:30 UTC`;
- Node.js: `v22.22.2`;
- npm: `10.9.7`;
- PostgreSQL: `16.14`.

This confirms service availability at inspection time, not that today's later GitHub merges are deployed. Production should only be updated through the controlled exact-reference deployment process after a deployment decision and post-deployment checks.

### Production worktree hygiene

The production Git worktree contained untracked operational files, including:

- `.env` and an environment backup;
- deployment backups;
- logs;
- a server source backup;
- cleaning uploads;
- menu-item uploads.

These files were not deleted or modified during the review. They should be moved out of the Git checkout or formally excluded with safe repository rules. Secrets must never be committed. Uploads and logs should use dedicated persistent runtime directories.

## Database safety investigation

### Live database inventory

The production PostgreSQL `public` schema contained:

| Object | Count |
|---|---:|
| Base tables | 274 |
| Views | 4 |
| Columns | 2,714 |
| Foreign keys | 123 |
| Explicit PostgreSQL check constraints | 47 |
| Expression indexes | 2 |
| Tables without primary keys | 0 |

Installed PostgreSQL extensions were `pgcrypto 1.3` and `plpgsql 1.0`.

### Prisma mismatch

The repository Prisma schema contained:

- 144 models;
- 16 enums;
- no Prisma views.

A temporary production introspection produced:

- 273 models;
- 28 enums.

The introspected model could not be validated because `ordering_item_modifiers.recipe_id` and the referenced `recipes.id` use incompatible types.

The production database does not contain `public._prisma_migrations`. Prisma therefore has no trustworthy migration history for this database.

Four checked-in migrations were reported as unapplied:

- `20250826075216_add_wages_source`
- `20251127090000_add_product_menu`
- `20251201090000_add_rma_authority`
- `20260323120000_add_receipt_truth_daily_usage`

Their “unapplied” status cannot be treated as evidence that the associated production changes are absent because the migration ledger itself is missing.

### Destructive diff evidence

Comparing the live datasource against the checked-in Prisma model produced a 695-line SQL diff containing:

| Operation | Count |
|---|---:|
| Drop table | 130 |
| Drop foreign key | 56 |
| Drop enum | 12 |
| Alter table | 11 |
| Add foreign key | 6 |
| Create table | 1 |
| Create index | 1 |

The diff included destructive column removals and deletion of operational, reporting, AI, stock, staff, ordering and financial tables.

**Safety decision:** do not run any of the following against production until reconciliation is completed:

- `prisma migrate deploy`;
- `prisma migrate dev`;
- `prisma db push`;
- the generated migration diff;
- any command that marks migrations applied without proving the live schema matches them.

### Backup evidence

A schema-only production snapshot was created:

- host path: `/root/sbb-production-schema-20260812-025123.sql`;
- size: approximately 354 KB;
- SHA-256: `3a64464da8fbac9ee7f497581c3bc1581763e5811e0c125a66ddbc8964664979`;
- dump inventory matched the live counts: 274 tables, 4 views and 123 foreign keys;
- the dump ended with PostgreSQL's completion marker.

This is a schema snapshot, not a full data backup. A tested full backup and restore procedure is still required.

## Open issues and risk register

### Critical

1. **Prisma schema and production database are not aligned.**
   - Impact: a routine migration command could delete live structures or data.
   - Control: production migrations remain frozen.
   - Required resolution: establish an authoritative production baseline, reconcile model types and create a reviewed migration history without destructive changes.

2. **No Prisma migration ledger exists in production.**
   - Impact: migration status is not trustworthy.
   - Required resolution: reconstruct and document the baseline only after schema-by-schema verification.

### High

3. **Production runtime files are stored inside the Git checkout.**
   - Impact: accidental inclusion, overwritten uploads, secrets exposure and unreliable deployments.
   - Required resolution: move uploads, logs, backups and environment files into dedicated protected runtime paths.

4. **A schema-only backup is not sufficient disaster recovery.**
   - Impact: data cannot be restored from the recorded snapshot alone.
   - Required resolution: implement encrypted full backups, retention, off-host copies and periodic restore tests.

5. **Production deployment parity has not been confirmed after today's merges.**
   - Impact: GitHub `main` and the running Hostinger release may differ.
   - Required resolution: deploy an exact approved commit, then record service health, application health endpoint, logs and database connectivity.

### Medium

6. **Repository-wide TypeScript debt remains.**
   - Confirmed existing errors include iterator-target errors in:
     - `server/reporting/importers/loyverseControls.ts`;
     - `server/reporting/importers/persistImport.ts`.
   - Current control: new errors in changed reporting files block PRs; existing untouched debt remains visible as warnings.
   - Required resolution: repair the importer errors in an isolated PR.

7. **Labor reporting still depends on shift-form expense records.**
   - Impact: missing or inconsistent form entries reduce labor accuracy.
   - Required resolution: use attendance/timekeeping plus wage rates as the labor authority; retain the shift form only for exceptions and sign-off.

8. **Hourly reporting boundaries use the selected reporting window.**
   - Impact: exact shift opening/closing boundaries depend on how the report range is selected.
   - Required resolution: connect hourly bounds to authoritative shift-session opening and closing timestamps.

## Recommended execution order

1. Keep production Prisma migrations frozen.
2. Create and test full database backup and restore procedures.
3. Move runtime data and secrets out of the production Git checkout.
4. Reconcile the production schema and create a formally reviewed Prisma baseline.
5. Repair existing TypeScript importer errors.
6. Deploy the approved reporting commit by exact SHA and complete post-deployment verification.
7. Redesign Daily Sales & Stock V2:
   - POS supplies sales, payments, discounts, refunds and hourly activity automatically;
   - staff confirm cash, shift expenses, exceptions and incidents;
   - attendance supplies labor;
   - venue-configurable cleaning templates replace SBB-only fields;
   - configurable critical-item counts replace full manual stock entry;
   - requisitions are suggested automatically and confirmed by staff.

## Change and access statement

No production database migration, schema mutation, data deletion or automatic production deployment was performed during this review. Hostinger evidence was collected from read-only and backup commands run in the production environment. GitHub changes were submitted through isolated pull requests and merged only after the configured checks passed.

The ChatGPT environment did not have the local `gh` executable installed. GitHub repository reads, branch creation, commits, PR creation, checks inspection and protected merges were completed through the integrated GitHub connection.
