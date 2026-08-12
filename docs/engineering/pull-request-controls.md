# Pull request and release controls

## Merge requirements

Configure the `main` branch to require:

- Pull requests with at least one approval.
- Dismissal of stale approvals after new commits.
- Resolution of all review conversations.
- `Policy and migration safety`.
- `Production build`.
- `Workflow formatting`.
- Branches up to date before merge.
- No force pushes and no branch deletion.

Administrators and automation should not bypass these controls for routine releases.

## Workflow rules

- Validation workflows receive read-only repository permissions.
- Workflows must not commit generated patches or push to `main`.
- Production deployment starts only from an approved merge or explicit protected release action.
- Deployment must record and verify the exact commit SHA running in production.
- Database changes require independent review and clone-based testing.

## Commit discipline

- Keep each PR focused on one outcome.
- Separate feature, refactor, database and generated-asset changes.
- Do not commit runtime uploads, logs, backups or environment files.
- Prefer small reversible commits with an explicit rollback path.
- Use draft PRs until the implementation and verification evidence are ready.
