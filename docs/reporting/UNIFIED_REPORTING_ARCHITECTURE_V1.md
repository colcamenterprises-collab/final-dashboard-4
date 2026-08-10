# Unified Reporting Architecture V1

## Purpose

Create one reporting layer that can answer any reporting question for any exact local date/time range without exposing POS-system boundaries to the user.

The reporting UI must use a single universal filter:

- From date
- From time
- To date
- To time
- Venue timezone

No reporting calculation may depend on UI presets such as last shift, last 7 days, last 14 days or last 30 days. Presets may be added later only as optional shortcuts that populate the same exact date/time controls; they must never be a separate reporting mode.

## SBB cutover

Venue timezone: `Asia/Bangkok`

Canonical cutover instant: `2026-08-09T03:00:00+07:00`

Source ownership is half-open and non-overlapping:

- Loyverse historical source: transaction timestamp `< 2026-08-09T03:00:00+07:00`
- SBB POS live source: transaction timestamp `>= 2026-08-09T03:00:00+07:00`

This boundary means a report spanning the cutover can combine both sources without double-counting.

Example:

- Search from `2026-08-08 17:00` to `2026-08-09 03:00` -> historical Loyverse transactions only.
- Search from `2026-08-09 03:00` to `2026-08-10 03:00` -> SBB POS transactions only from the cutover forward.
- Search from `2026-08-01 00:00` to `2026-08-10 12:00` -> historical + live transactions in one result.

## Core principle

A sale exists once in the canonical reporting ledger.

Staff daily forms, bank statements, Grab statements and aggregate Loyverse reports are reconciliation evidence. They do not create additional sales revenue.

## Canonical reporting model

### 1. reporting_transactions

One row per sale / receipt.

Required fields:

- canonical_transaction_id
- venue_id
- source_system (`loyverse`, `sbb_pos`)
- source_transaction_id
- source_receipt_number
- occurred_at timestamptz
- business_timezone
- channel / order mode
- payment status
- subtotal
- discount_total
- refund_total
- tax_total
- net_sales
- gross_total / paid_total
- currency
- cashier / staff identifier where available
- source_import_batch_id for imported history
- created_at

Uniqueness must prevent the same source transaction being ingested twice.

### 2. reporting_transaction_items

One row per sold/refunded item line.

Required fields:

- canonical_line_id
- canonical_transaction_id
- source_line_id where supplied
- item / SKU / category
- quantity
- unit price
- gross line sales
- discounts
- refunds
- net line sales
- tax
- set-component flag
- source menu identifiers where supplied

### 3. reporting_transaction_modifiers

One row per modifier / option / upsell selection.

Required fields:

- canonical_modifier_id
- canonical_line_id
- modifier group
- modifier name
- quantity
- price delta
- revenue

### 4. reporting_payments

One row per payment allocation.

Required fields:

- canonical_payment_id
- canonical_transaction_id
- payment method
- amount
- paid_at
- source payment identifier where available

This allows split-tender restaurants in future without changing report architecture.

### 5. reporting_import_batches

Every historical file ingestion must have an immutable provenance record:

- source system
- source filename
- SHA-256
- import type
- stated period start / end
- row counts
- source totals
- imported totals
- validation status
- imported timestamp
- notes

The same SHA-256 must never be imported twice.

## Time rules

All canonical timestamps are stored as `TIMESTAMPTZ`.

The user selects local date + local time in the venue timezone. Backend converts that range to instants before querying.

Every range is half-open:

`occurred_at >= fromInstant AND occurred_at < toInstant`

This removes midnight/cross-date ambiguity and prevents the same transaction belonging to two adjacent report windows.

A shift is metadata, not a reporting boundary.

Restaurants may have:

- one overnight shift
- multiple shifts in one day
- shifts crossing midnight
- 24-hour operation

All are handled by timestamps. Shift IDs can be used as optional drill-down filters, never as the primary date model.

## Historical Loyverse ingestion

For arbitrary date/time reporting, aggregate Item Sales files are not sufficient because they have no transaction timestamps.

Preferred Loyverse evidence, in priority order:

1. Receipt / transaction export containing receipt timestamp, receipt ID and total.
2. Receipt item / sales-by-receipt detail containing item lines and receipt linkage.
3. Payment export containing receipt/payment linkage and payment method.
4. Shift export for reconciliation and shift metadata.
5. Item Sales aggregate report for reconciliation only.
6. Sales Summary / payment summary for reconciliation only.

If Loyverse cannot export full timestamped item history, the system must explicitly mark the historical granularity that is unavailable rather than manufacture it.

## Reconciliation rules

Before a historical batch is accepted:

- transaction count must reconcile where source provides it
- gross sales must reconcile
- discounts must reconcile
- refunds must reconcile
- net sales must reconcile
- payment totals must reconcile
- item quantities and item net sales must reconcile against Item Sales aggregate where available
- imported rows outside the historical source ownership window must be rejected
- duplicate source transaction IDs must be rejected or quarantined

No failed batch becomes visible in production reporting.

## Reporting API contract

All report endpoints should converge on the same range parameters:

- `fromDate=YYYY-MM-DD`
- `fromTime=HH:mm`
- `toDate=YYYY-MM-DD`
- `toTime=HH:mm`
- `timezone=Area/City`

Backend response should echo:

- requested local range
- resolved UTC instants
- timezone
- sources included
- source transaction counts
- reconciliation state

## Final visible Reporting menu

1. Overview
2. Sales by Item
3. Receipts
4. Shift Reconciliation

All four use the same universal date/time range component.

### Overview

- Net sales
- Orders / receipts
- Average order value
- discounts
- refunds
- Cash
- QR
- Grab / delivery partners
- gross profit and margin when costing coverage is sufficient
- sales trend
- channel mix
- category mix
- top products
- hourly sales

### Sales by Item

- Items
- Modifiers
- Upsells
- Set components
- Quantity
- Gross sales
- Discounts
- Refunds
- Net sales
- COGS
- Gross profit
- Margin

Cost configuration belongs under Menu / Recipes & Costing, not Reporting.

### Receipts

Permanent searchable transaction ledger with item/modifier drill-down.

### Shift Reconciliation

POS is the sales source of truth. Staff forms, cash banking, expenses, stock and imported bank/Grab statements reconcile against POS; they do not add sales.

## Migration from current implementation

Current `historical_item_sales` remains valid as a reconciliation archive but must not be the canonical historical transaction source.

The existing hard-coded historical SHA and historical date window in receipt analytics must be retired once timestamped historical ingestion is complete.

The current standalone Payment Types report should be merged into Overview.

Shift Summary and Shift Report should be merged into Shift Reconciliation.

## Acceptance tests

1. Cross-midnight search returns the correct transactions.
2. Two adjacent searches sharing a boundary contain no duplicate transaction.
3. Search spanning the 2026-08-09 03:00 cutover combines Loyverse and SBB POS exactly once.
4. Historical-only search never returns SBB POS data before the cutover.
5. Live-only search never returns Loyverse data at or after the cutover.
6. Report totals reconcile to canonical transaction rows.
7. Payment totals reconcile to transaction totals subject to documented payment timing rules.
8. Imported historical totals reconcile to supplied Loyverse control reports.
9. Staff form totals never increase canonical sales.
10. Range filtering behaves identically on Overview, Sales by Item, Receipts and Shift Reconciliation.
