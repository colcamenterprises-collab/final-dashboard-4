# System Decision Register

## Purpose
This register captures consolidation decisions, decision status, evidence requirements, and sign-off ownership.

## Decision Status Legend
- Proposed
- Approved
- Deferred
- Blocked
- Completed

## Decisions

| ID | Decision | Status | Required Evidence | Owner Gate |
|---|---|---|---|---|
| SDR-001 | `RouteRegistry.ts` + `App.tsx` are frontend route truth. `page-inventory.csv` is non-authoritative for URL decisions. | Approved | Route probe + import/mount evidence | Codex + Replit |
| SDR-002 | Bob read namespace remains GET-only and token-protected; no cleanup action may weaken this contract. | Approved | Bob route verification + auth tests | Replit + Owner |
| SDR-003 | Background job inventory is advisory only; deletion/retire requires runtime scheduler proof. | Approved | Job startup + execution evidence | Replit |
| SDR-004 | Shopping list overlap is treated as high-risk and must pass triple-router runtime parity before consolidation. | Approved | Mount/import/response parity | Codex + Replit |
| SDR-005 | Protected core flows are excluded from deletion/refactor during consolidation cycle. | Approved | N/A (policy gate) | Owner |
| SDR-006 | Duplicate route/service modules are merge candidates, not delete candidates, until canonical ownership is runtime-proven. | Approved | Parity + runtime hit-path proof | Codex |
| SDR-007 | Unmounted and `_old` files are not safe-delete by static scan alone. | Approved | Dynamic import + runtime zero-use proof | Codex + Replit |
| SDR-008 | Archive-first strategy applies to `archive/**`, `attached_assets/**`, `tmp/**`. | Approved | Non-runtime confirmation | Codex |
| SDR-009 | No deletion without pre-deletion approval gate packet. | Approved | Gate checklist complete | Owner |
| SDR-010 | Dashboard 5 planning/execution blocked until consolidation completion sign-off is recorded. | Approved | Final sign-off packet | Owner |

## Evidence Packet Requirements Per Decision
- Decision ID
- Candidate scope/files
- Runtime proof references
- Parity test references
- Risk rating
- Rollback note
- Gate approvals (Codex, Replit, Owner)

## Change Control
Any decision status change from Approved to Deferred/Blocked requires explicit note with:
- reason,
- impacted workstreams,
- revised sequence,
- revised risk rating.
