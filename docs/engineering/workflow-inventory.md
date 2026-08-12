# Workflow inventory

## Supported workflows

| Workflow | Purpose | Production write access |
|---|---|---|
| `pr-governance.yml` | Required PR policy, build and workflow checks | None |
| `deploy-sbb-production.yml` | Protected Hostinger deployment with exact-ref build, health checks and rollback | Compiled release and service restart |
| `build-sbb-pos-android.yml` | Manual Android APK build | None |
| `build-sbb-pos-apk.yml` | POS-change APK validation | None |
| `build-sbb-pos-launch-apk.yml` | Manual launch APK build | None |
| `reporting-overhaul-check.yml` | Reporting-specific validation | None |

The Android workflows remain temporarily separate so current release work is not interrupted. They should be consolidated after the active Android changes are complete.

## Retired one-shot workflows

The following workflows were removed on 2026-08-12:

- `apply-dashboard-small-fixes.yml`
- `emergency-pos-launch-hotfix.yml`
- `pos-instant-display-ticket-fix.yml`
- `pos-launch-patch-cloud.yml`
- `pos-launch-ticket-options-fix.yml`
- `pos-production-db-hotfix.yml`

These files embedded historical patches inside GitHub Actions. Five could commit generated code and push it directly to `main`; one executed DDL directly against production. They are preserved in Git history but must not be restored or reused.

## Release path for current updates

1. Implement each update on an isolated branch.
2. Open a pull request and wait for every required check.
3. Resolve review conversations and squash-merge.
4. Deploy the merged commit SHA through `Deploy SBB Production` using manual dispatch.
5. Record the deployed SHA and verify the local and public health checks.

Do not trigger releases by committing request-marker files. Do not place application patches inside workflow YAML.
