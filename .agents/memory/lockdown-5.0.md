---
name: Final Dashboard 5.0 Lockdown
description: Absolute lockdown policy for all stable systems — no modifications without explicit approval and regression check.
---

# Final Dashboard 5.0 — Lockdown Policy

**Why:** System reached verified stable baseline on 05/06/2026 after full regression sweep. All 28 pages PASS, all removed systems confirmed absent, all cron jobs confirmed. This is the production recovery point.

## Recovery Point
- Tag: `final-dashboard-5.0-stable`
- Branch: `production-baseline-5.0`
- Commit: `f0dbc18b9388019b347dc18cf5ffbc3b3266c47d`
- Repo: `colcamenterprises-collab/final-dashboard-4`

## LOCKED SYSTEMS — DO NOT MODIFY
These systems are read-only unless a verified production bug exists:
- Daily Sales V2
- Daily Stock V2
- Purchasing
- Form Library
- Finance
- Menu
- Online Ordering
- Staff (all pages + APIs)
- Reports
- Loyverse Sync

## Rules (absolute, non-negotiable)

1. **No existing route may be changed** without explicit user approval.
2. **No existing database schema may be modified** without explicit user approval.
3. **No existing API response shape may be modified** without explicit user approval.
4. **All future work must be isolated**: new route, new table, new service — never touching existing ones.
5. **Before any future patch**: run regression verification, confirm no stable routes or tables are impacted.
6. **If uncertain**: preserve existing behaviour. Do not refactor, optimise, or restructure.

## How to apply
- Before ANY edit, ask: "Does this touch a locked system?" If yes → stop, get explicit approval first.
- New features get their own route prefix, their own DB tables, their own service files.
- Treat locked file paths as if they have a `// DO NOT MODIFY` header on every line.
