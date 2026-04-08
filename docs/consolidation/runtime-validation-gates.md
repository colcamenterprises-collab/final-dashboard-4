# Runtime Validation Gates

## Purpose
Define mandatory runtime proof required before consolidation actions in risky areas.

## Gate 0 — Baseline Capture (Required Before Any Cleanup)
- Capture current route mounts, endpoint responses, and scheduled job startup evidence.
- Capture canonical frontend route map from:
  - `client/src/router/RouteRegistry.ts`
  - `client/src/App.tsx`
- Record baseline in sign-off packet.

---

## Gate 1 — Bob / AI-Ops Full Route Verification (Mandatory)
**Scope**
- All canonical Bob daily checks:
  1. `GET /api/bob/read/system-health`
  2. `GET /api/bob/read/system-map`
  3. `GET /api/bob/read/module-status`
  4. `GET /api/bob/read/build-status?date=YYYY-MM-DD`
  5. `GET /api/bob/read/shift-snapshot?date=YYYY-MM-DD`
- AI-Ops control endpoints and timers.

**Proof required**
- Token enforcement with `BOB_READONLY_TOKEN` verified.
- GET-only constraint verified.
- Structured blocker output verified for missing dependencies.

**No-touch rule if failed:** freeze entire Bob/AI-Ops area.

---

## Gate 2 — Shopping List Triple-Router Verification (Mandatory)
**Scope**
- `server/shoppingList.ts`
- `server/routes/shoppingList.ts`
- `server/services/shoppingList.ts`

**Proof required**
- Which file is mounted, called, and authoritative in runtime.
- Request/response parity between candidate paths.
- No hidden side-effects in non-canonical path.

**No-touch rule if failed:** classify as Merge Later + Freeze.

---

## Gate 3 — Background Jobs Validation (Mandatory)
**Scope**
- All cron/setInterval jobs in scheduler inventories.

**Proof required**
- Runtime startup logs proving job registration.
- Schedule execution evidence (or controlled trigger evidence).
- Dependency failure behavior documented (e.g., DB/env missing).

**Important constraint**
- Static job inventory is **not** deletion-safe evidence.
- No background job file can be retired/deleted without runtime proof.

---

## Gate 4 — Server/API Live Import and Mount Validation (Mandatory)
**Scope**
- `server/index.ts` boot chain
- `server/routes.ts` composition
- candidate route/service duplicates and `_old` variants

**Proof required**
- Import graph evidence for active route/module path.
- Mount table showing active endpoint ownership.
- Runtime request hit confirming active code path.

---

## Gate 5 — Frontend Route Truth Validation (Mandatory)
**Scope**
- Route ownership determined from:
  - `client/src/router/RouteRegistry.ts`
  - `client/src/App.tsx`

**Proof required**
- Concrete route probes for canonical paths.
- Redirect/alias behavior evidence.
- Orphan page candidate verification against actual imports/mounts.

**Important constraint**
- Do not use `docs/audit/page-inventory.csv` as source-of-truth for URL decisions.

---

## Gate 6 — `_old` and Legacy-Suffix Runtime Activity Validation (Mandatory)
**Scope**
- Files with `_old`, `legacy`, `backup`, `autopatch`, `harden` patterns where present.

**Proof required**
- Zero active import/mount/runtime usage OR explicit active-use evidence.
- If active, classify as Freeze/Do Not Touch.

---

## Gate 7 — Protected Flow Regression Gate (Mandatory)
**Scope**
- Daily sales, daily stock, purchasing, ingredient authority, recipes, products, receipts/shift reports, Bob/AI-Ops, critical jobs, email/PDF.

**Proof required**
- Pre/post consolidation parity checks for each protected flow.
- No regression in operational outcomes.

---

## Gate 8 — Pre-Deletion Approval Gate (Mandatory)
No deletion is permitted unless all of the following are true:
1. Candidate classification in deletion safety matrix allows deletion.
2. Runtime validation gates are passed for that candidate.
3. Parity tests are attached.
4. Codex + Replit verification complete.
5. Owner approval recorded.
