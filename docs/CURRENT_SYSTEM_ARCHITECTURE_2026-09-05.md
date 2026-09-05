# SBB / Customli Current System Architecture

**Baseline date:** 2026-09-05  
**Repository:** `colcamenterprises-collab/final-dashboard-4`  
**Production baseline:** `5bf39ac84e28b25b8f515f0cad814684fc610078`

## Purpose

This document is the source-of-truth map to use before cleanup. No legacy-looking route, migration, script or table should be removed until its current production dependency is verified against this map.

## System boundary

### SBB App / Back Office
The existing SBB repository remains the system of record for business data and Back Office operations. It owns:

- sales and receipt history
- reporting and profitability
- finance and reconciliation
- recipes, ingredient catalogue and costing
- stock and purchasing
- daily sales / daily stock workflows
- labour and staff reporting
- online ordering backend and administration
- device registry and provisioning
- owner/manager operational controls

### Customli Android application
The dedicated `customli-pos` repository owns the device application. From v1.1 the customer-facing Android product is one universal app. Back Office assigns the runtime role after provisioning:

- POS Register
- Kitchen Display
- Customer Display

The Android app is not the business system of record. It consumes and writes through SBB/Customli backend APIs.

## Device provisioning

Back Office owns device identity. New installations do not require SSH, terminal access or exposure of `POS_DEVICE_TOKEN`.

Flow:

1. Owner creates device in Back Office.
2. Owner assigns name, location and role.
3. Back Office creates a six-digit single-use pairing code valid for 10 minutes.
4. Universal Customli Android app claims the code.
5. Backend issues a unique random device credential.
6. Credential is stored hashed server-side and can be revoked.
7. Device role is returned by the backend and controls whether the app launches Register, Kitchen Display or Customer Display.

Current release uses the six-digit pairing code. Native QR/app-link provisioning is a planned productisation step, not yet a production dependency.

## Sales and order architecture

### Direct POS / Grab
Operational POS endpoints remain under `/api/pos/*`. A transitional compatibility layer remains in the SBB repository while device code is separated into `customli-pos`.

Grab orders are handled by the Grab-specific POS contract before the legacy POS router. Grab promotions are stored as discounts and do not rewrite item prices.

### Online ordering
Online ordering uses `/api/ordering/*`. Orders are prepared/routed into the POS-era operational model so they can flow through kitchen, customer display, receipt and reporting lifecycle.

## Reporting architecture

Current Reporting Overview accounting hierarchy:

`Gross Sales → Discounts / Refunds → Net Sales → COGS → Gross Profit`

Rules:

- missing item cost must never silently become zero
- uncosted sales are surfaced as an exception
- post-cutover COGS uses immutable sale-time cost snapshots
- category profitability and costing coverage are reported
- labour appears lower in the overview as compact KPIs/hourly utilisation

## Ingredient control

Theoretical ingredient usage is derived from completed receipt lines through menu item / modifier recipe mappings. Sale-time snapshots are preferred; older POS-era rows may explicitly fall back to current recipes where required.

Physical variance is only valid where compatible physical closing-stock quantities exist. Current verified physical truth covers rolls/meat/drinks. Fries and nuggets remain incomplete for universal physical variance until closing quantities and canonical units are aligned.

## Finance and reconciliation

Core principle: external evidence and settlement records reconcile existing revenue; they do not create duplicate revenue.

Target chain:

`POS / Online Ordering → Sales Ledger → Shift Reconciliation → Provider Evidence → Settlement / Bank Evidence → Month Close → P&L`

Generic finance work includes configurable revenue/evidence sources, immutable imports, normalized financial transactions and reconciliation. Month-close and complete bank/provider reconciliation are not yet finished.

## Daily operations

Daily Sales / Stock remains part of Back Office and must be treated as live until a replacement is proven. Historical cleanup work canonicalized Daily Sales to `/api/forms/daily-sales/v3` and deliberately returned `410 Gone` for several older endpoints. See `V3_1_TIDY_PATCH_REPORT.md` before altering this route family.

## Authentication and authorization

Back Office uses owner/session/PIN paths. Staff-facing POS shift responses intentionally exclude expected cash and reconciliation variance. Device authentication now supports unique per-device credentials while retaining a server-side compatibility bridge for proven POS routes during migration.

## Cleanup rule

For each cleanup PR:

1. identify candidate file/route/table/script
2. prove whether it is imported, mounted, invoked, referenced by deployment or used by production data
3. classify: ACTIVE / COMPATIBILITY / HISTORICAL / DEAD / UNKNOWN
4. remove only DEAD items
5. migrate COMPATIBILITY items before deletion
6. run production build and applicable regression checks
7. document what was removed and rollback path

This architecture document must be updated as Track A, Track B and cleanup work changes system ownership.