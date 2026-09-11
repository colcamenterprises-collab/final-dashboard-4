# Productisation Program — Tracks A, B and C

**Start:** 2026-09-05

## Track A — Commercial onboarding and productisation

Goal: a new business can configure and operate Customli without developer intervention.

### A1. Business onboarding
- business profile
- location/store setup
- currency/timezone
- tax/receipt basics
- operating hours
- guided setup progress

### A2. Device onboarding
- Back Office Devices page
- create device
- select POS Register / Kitchen Display / Customer Display
- download universal Android app
- enter six-digit one-time pairing code
- verify connected state
- show app version / OS / last seen / role / location
- revoke and re-pair
- add native QR/app-link pairing after code path is production-proven

### A3. Employee access
- employee account/PIN
- allowed locations
- allowed systems/roles
- owner/manager/staff permissions
- device identity separated from employee identity

### A4. Hardware onboarding
- printer discovery/connect/test
- receipt print test
- kitchen ticket routing
- cash drawer test
- guided acceptance result

### A5. First transaction wizard
- open shift
- create test sale
- route to KDS
- display customer state
- print receipt
- verify reporting entry
- close/void test transaction safely where appropriate

### A6. Distribution and updates
- Back Office download surface
- current app version
- device version compliance
- update required / supported state
- Google Play distribution later
- iOS only after a real iOS build, device support and printer/drawer compatibility are certified

## Track B — Reporting, stock control and accounting completion

Goal: SBB/Customli operational and financial reporting is complete enough for business decision-making and reconciliation without double-counting.

### B1. Reporting foundation — COMPLETE/LIVE
- Gross Sales
- Discounts / Refunds
- Net Sales
- COGS
- Gross Profit
- Food Cost %
- uncosted sales exception
- category profitability
- compact labour reporting
- sale-time cost snapshots for new POS-era profitability

### B2. Ingredient security — PARTIAL
- theoretical usage: live
- rolls/meat/drinks physical truth: available
- fries closing-unit model: unresolved
- nuggets physical closing count: unresolved
- drink mapping / legacy meat constants: consolidate
- universal variance only after compatible physical quantities exist

### B3. Revenue-source reconciliation — IN PROGRESS
- generic revenue sources
- evidence sources
- immutable import batches
- normalized financial transactions
- provider evidence separated from POS facts
- Grab provider model

### B4. Settlement and banking — TO COMPLETE
- Grab settlement import/reconciliation
- bank statement import
- settlement-to-bank matching
- QR/cash reconciliation where evidence exists
- ensure bank deposits do not create duplicate revenue

### B5. Month close / P&L — TO COMPLETE
- close period controls
- unresolved exception register
- reconciled revenue
- expenses
- COGS
- labour
- gross/net profit
- audit trail and reopening policy

## Track C — SBB App documentation and gradual cleanup

Goal: reduce the existing monolithic repository safely after the new device applications have moved to `customli-pos`.

### C0. Historical cleanup baseline
Preserve and review `V3_1_TIDY_PATCH_REPORT.md`. It documents prior route canonicalisation, legacy 410 guards, manager-check cleanup and decimal migration work.

### C1. Inventory — CURRENT
Create a full inventory of:
- frontend pages/routes
- Express mounts and route families
- services
- forms
- migrations
- cron/background jobs
- integrations
- scripts/one-off patchers
- deployment files
- archived/debug/attached assets
- POS-related code remaining in SBB repo

### C2. Classification
Every candidate is tagged:
- ACTIVE — production dependency
- COMPATIBILITY — still required while migration is incomplete
- HISTORICAL — documentation/archive only
- DEAD — proven unused and removable
- UNKNOWN — requires investigation

### C3. Low-risk cleanup
First removal candidates should be non-runtime clutter proven unused, such as superseded patch installers, obsolete generated/debug assets and old deployment triggers. Do not delete solely because a filename looks old.

### C4. POS extraction cleanup
After universal Customli device acceptance:
- identify duplicate POS client/native build code in `final-dashboard-4`
- preserve backend APIs and reporting ownership
- remove obsolete in-repo device application build paths only after `customli-pos` is confirmed authoritative
- simplify legacy POS router composition gradually

### C5. Backend modularisation
After dead-code removal:
- split oversized route registration where safe
- consolidate duplicated services/helpers
- standardise auth middleware
- centralise migration policy
- reduce startup-time table creation and permission warnings

### C6. Dependency/build cleanup
- dependency audit without blind `npm audit fix --force`
- remove packages only when import/reference checks prove unused
- reduce frontend bundle/chunks where worthwhile
- update browserslist/tooling separately from functional changes

## Definition of done

The program is not complete until:

1. a new business can onboard without terminal access
2. Android devices can be registered, controlled and updated from Back Office
3. SBB physical device acceptance passes POS/KDS/CDS/printer/drawer/reporting
4. finance/reconciliation/month-close is complete enough to avoid duplicate or unexplained revenue
5. current system architecture and operating runbooks exist in-repo
6. SBB repository cleanup has removed proven dead code without losing live business functionality
7. remaining compatibility code is explicitly documented with a removal condition