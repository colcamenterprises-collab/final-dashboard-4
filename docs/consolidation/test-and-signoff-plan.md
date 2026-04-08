# Test and Sign-off Plan

## Objective
Define mandatory verification and approval gates for safe consolidation execution.

## Verification Tracks

### 1) Codex Implementation Verification Gate
Required before merging any consolidation implementation PR:
- Scope matches approved workstream.
- No protected flow behavior regressions.
- Runtime validation gate evidence attached.
- Deletion safety matrix classification respected.

### 2) Replit Runtime Verification Gate
Required before retire/delete actions:
- App boot + route probing in runtime environment.
- Bob daily check endpoint verification with token/auth behavior.
- Scheduler/background job registration verification.
- Frontend route/deep-link verification against RouteRegistry/App truth.

### 3) Final Approval Gate Before Deletions
Required before any delete operation:
- Candidate marked delete-eligible in safety matrix.
- Runtime and parity proofs complete.
- Rollback and recovery note prepared.
- Owner approval explicitly recorded.

### 4) Final Approval Gate Before Dashboard 5 Begins
Required before Dashboard 5 or platform migration planning starts:
- Consolidation execution complete for approved scope.
- Open risks documented with owners and due dates.
- Protected systems stability confirmed.
- Final sign-off packet approved.

## Minimum Test Coverage for Protected Systems
- Daily sales and daily stock ingestion smoke tests.
- Purchasing flow and ingredient purchasing tests.
- Ingredient authority and recipe/product integration tests.
- Receipts and shift report generation tests.
- Bob/AI-Ops route and guard behavior tests.
- Email/PDF generation path validation.
- Scheduler startup/registration validation.

## Sign-off Packet Contents
- Workstream summary
- Files/surfaces touched
- Runtime validation evidence links
- Parity test results
- Risk and rollback notes
- Approval checklist (Codex, Replit, Owner)

## Exit Criteria
Consolidation phase is complete only when:
1. Required workstreams are completed or explicitly deferred with owner approval.
2. No unresolved high-risk items in Freeze without owner acknowledgement.
3. Deletions (if any) were gated and approved.
4. Dashboard 5 precondition gate is signed.
