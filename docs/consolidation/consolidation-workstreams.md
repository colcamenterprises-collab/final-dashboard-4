# Consolidation Workstreams

## WS1 — Route Normalization
**Goal:** one canonical backend and frontend route per function.

**In-scope**
- Normalize duplicate endpoint signatures and alias paths.
- Resolve canonical frontend route truth from `RouteRegistry.ts` and `App.tsx` (not page-inventory CSV).
- Document redirect retention/removal criteria.

**Runtime gates required**
- Server mount/import validation.
- Frontend navigation + deep-link validation.

**Deliverable**
- Canonical route ownership map with merge/retire candidates.

---

## WS2 — Service/Module Consolidation
**Goal:** one canonical implementation per service domain.

**In-scope**
- Resolve duplicate route/service/lib modules from duplicate conflict register.
- Select canonical service owner and stage parity testing.

**Runtime gates required**
- Import graph + runtime execution proof of canonical path.
- Parity test outputs before retire/delete.

**Deliverable**
- Canonical service matrix and retirement queue.

---

## WS3 — Daily Forms Consolidation
**Goal:** protect and simplify daily sales/stock ingestion surfaces without behavior change.

**In-scope**
- Daily sales v2, daily stock, form aliases, and posting paths.
- Confirm active form endpoints and ingestion contracts.

**Runtime gates required**
- End-to-end submission smoke tests in runtime environment.
- Data write-path preservation checks.

**Deliverable**
- Verified canonical daily forms path set and freeze release notes.

---

## WS4 — Analysis / Shift Systems Cleanup
**Goal:** reduce overlap across analysis, receipts, shift reports, and shift utilities.

**In-scope**
- Shift analytics/reporting overlaps.
- Receipts and burger/shift item analysis aliases.
- `shiftWindow` utility canonicalization.

**Runtime gates required**
- Shift report generation parity.
- Receipts/analysis endpoint parity.

**Deliverable**
- Consolidated analysis/shift surface map.

---

## WS5 — Purchasing / Ingredient / Product Boundary Cleanup
**Goal:** separate and stabilize ownership boundaries.

**In-scope**
- Purchasing core and ingredient-purchasing surfaces.
- Ingredient authority/admin overlaps.
- Product + recipe dependencies crossing operations/menu domains.

**Runtime gates required**
- Purchasing flow functional validation.
- Ingredient authority read/write behavior parity.
- Product/recipe integration smoke tests.

**Deliverable**
- Domain boundary contract map + canonical owners.

---

## WS6 — Frontend Page/Route Consolidation
**Goal:** align page usage with active route topology.

**In-scope**
- Route-to-page mount truth from app router.
- Orphan page verification before retire/archive decisions.

**Runtime gates required**
- App route probing for active paths.
- Import/mount checks for potentially orphan pages.

**Deliverable**
- Frontend keep/freeze/retire plan.

---

## WS7 — Archive/Retire Pass
**Goal:** move low-risk artifacts to archive-first path; defer risky deletions.

**In-scope**
- Archive scopes (`archive/**`, `attached_assets/**`, `tmp/**`).
- Retire candidates that passed runtime/parity gates.

**Runtime gates required**
- None for archive-only moves.
- Full runtime gate evidence for retire/delete.

**Deliverable**
- Executed archive queue + approved retire queue.

---

## WS8 — Tests and Sign-off
**Goal:** enforce auditable release gates before cleanup/deletion and before Dashboard 5.

**In-scope**
- Consolidated verification suite.
- Sign-off packets (Codex + Replit + owner approvals).

**Runtime gates required**
- All critical gate checks must pass.

**Deliverable**
- Signed consolidation completion record.
