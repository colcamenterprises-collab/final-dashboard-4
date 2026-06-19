# RestaurantOS Engineering Rules
1. Prefer minimal, safe, reversible changes.
2. Do not change business logic when a docs-only or config-only fix is sufficient.
3. Keep schema, migrations, and runtime code in sync.
4. Verify repository state before claiming success.
5. Do not invent migrations or PRs; verify them in GitHub.
6. Prefer existing conventions in this repository.
7. If an auth or filesystem blocker exists, report it explicitly.
8. All money values are whole Thai Baht. Do not multiply by 100.
