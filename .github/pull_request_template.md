## What changed

Describe the user-facing or operational outcome.

## Risk and rollback

- Risk level: low / medium / high
- Rollback method:
- Production data affected: yes / no

## Verification

- [ ] The production build passes.
- [ ] I tested the affected user journey.
- [ ] I did not commit secrets, generated artifacts, uploads, logs, or backups.
- [ ] This PR does not push directly to `main` or deploy while validating.
- [ ] Database changes are absent, or the PR has the `database-reviewed` label and a tested rollback plan.
- [ ] Deployment and production verification will use the merged commit SHA.
