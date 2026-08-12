# Bob Memory

## Top truths
- Canonical operational data is immutable source truth; derived outputs must be rebuildable.
- AI Ops Control is the command surface for task assignment, thread communication, review, and audit.
- Agent responsibilities and thresholds are defined in `bob/brain/agents.md` and `bob/brain/thresholds.md`.

## SBB GitHub → Hostinger deployment process
- Repository source of truth: `colcamenterprises-collab/final-dashboard-4`.
- Build work belongs on a task branch and is reviewed through its pull request. Do not make direct edits to the live Hostinger source checkout.
- Validate the exact branch locally with `npm run check` and `npm run build` before deployment.
- The GitHub Actions workflow named `Deploy SBB Production` runs on the self-hosted Hostinger runner labelled `hostinger` / `sbb-production`.
- The workflow accepts a Git ref. Deploy the validated task branch or SHA through workflow dispatch; do not require a merge to `main` merely to test a branch release.
- Hostinger production app path: `/opt/apps/sbb-app-production`; systemd service: `sbb-production`; public domain: `https://app.smashbrosburgers.com`.
- The production workflow creates an isolated build, runs `npm ci` and `npm run build`, atomically swaps `dist`, restarts `sbb-production`, checks local health, menu API, public app and `/order`, then rolls back automatically if a failure occurs.
- ChatGPT/Codex agents must implement, test, commit and push where authorised. Ask Cameron only for an unavoidable permission/login boundary; never send him routine GitHub Actions or Hostinger terminal steps.
- PR #329 (`codex/recipe-costing-catalogue`) is the reference recipe-costing release: its current remote head includes the TypeScript `ingredientId` declaration fix and passed local `npm run check` + `npm run build` on 2026-08-12.

## Where to find
- Decision history: `bob/memory/DECISIONS.md`
- Architecture context: `bob/brain/system_architecture.md`
- Core operating rules: `bob/brain/core_rules.md`
