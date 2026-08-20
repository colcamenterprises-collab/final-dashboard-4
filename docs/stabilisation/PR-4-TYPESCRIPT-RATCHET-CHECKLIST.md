# PR 4 review checklist

- [ ] TypeScript ratchet self-test passes.
- [ ] Base and head are both measured with `--incremental false`.
- [ ] Base dependencies are installed from the base lockfile.
- [ ] Existing TypeScript debt may remain.
- [ ] New or increased diagnostic signatures fail CI.
- [ ] Production build passes.
- [ ] Reporting regression suite passes when triggered.
- [ ] No runtime, schema, migration, dependency, lockfile, database, or deployment behaviour changes.
