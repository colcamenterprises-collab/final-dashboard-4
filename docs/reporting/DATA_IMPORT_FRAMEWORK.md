# Data Import Framework

## Purpose

The reporting system must support restaurants migrating from different POS and accounting systems without changing the canonical reporting model.

The product must never be designed around a single retired POS vendor such as Loyverse.

## User-facing concept

Use **Data Import** rather than vendor-specific navigation.

Recommended flow:

1. Upload one or more source files.
2. System detects the likely source format where possible.
3. User selects/accepts the source system.
4. Adapter validates required columns and timestamps.
5. Preview shows transaction count, date/time range and control totals.
6. Import is staged and reconciled.
7. Only a validated batch becomes reportable.
8. Original files and SHA-256 provenance remain attached to the batch record.

## Adapter model

Each source adapter converts vendor-specific data into the same canonical structures:

- Transactions
- Line items
- Modifiers/options
- Payments
- Refunds/discounts
- Cost/COGS when genuinely supplied
- Staff/cashier identifiers
- Source metadata

Optional supporting datasets may include:

- Shifts
- Pay-ins/payouts
- Aggregate sales summaries
- Discount summaries
- Modifier summaries

Supporting datasets are reconciliation evidence unless they represent unique canonical events. They must never be added to sales totals simply because they were uploaded.

## Initial adapters

### Loyverse

First implemented adapter because SBB supplies a verified migration dataset.

Canonical transaction inputs:

- Receipts
- Receipts by Item

Supporting reconciliation inputs:

- Sales Summary
- Payment Type Sales
- Modifier Sales
- Shifts
- Pay-ins/Payouts
- Discounts

### Generic CSV

A configurable mapping adapter should support third-party systems for which no native parser exists.

Minimum required transaction fields:

- transaction/receipt identifier
- transaction timestamp
- transaction total or net sales

Recommended fields:

- payment method
- item identifier/name
- SKU
- category
- quantity
- gross sales
- discounts
- refunds
- taxes
- COGS
- cashier/staff

The mapping screen should allow users to match uploaded columns to canonical fields and save the mapping as a reusable template for that venue or source.

### Future native adapters

Adapters can be added independently for systems such as Square, Toast, Lightspeed, Clover, Shopify POS or other restaurant systems. A new adapter must not require reporting UI changes.

## Canonical reporting rule

All reporting pages consume canonical transactions, never vendor-specific tables directly.

`source vendor -> adapter -> validated import batch -> canonical historical ledger -> unified reporting query`

Live SBB POS transactions join the same reporting layer after the venue-specific cutover boundary.

## Venue-specific cutovers

Cutover is configuration, not application code.

Each venue may define one or more source ownership periods. Example for SBB Rawai:

- Loyverse owns transactions before `2026-08-09T03:00:00+07:00`
- SBB POS owns transactions at or after `2026-08-09T03:00:00+07:00`

A third-party restaurant may have a completely different timezone, cutover time, source system or multiple migration periods.

## Universal date/time reporting

No adapter controls reporting periods.

Every report accepts:

- From date
- From time
- To date
- To time
- Venue timezone

Queries operate on actual transaction timestamps. Shift membership is optional metadata/filtering only.

This allows overnight trading, multiple shifts per day, 24-hour venues and arbitrary time-window analysis.

## Safety rules

- Duplicate source file hashes are rejected.
- Duplicate source transaction IDs within a venue/source are rejected or quarantined.
- Files crossing a configured ownership boundary must be clipped/rejected according to explicit source ownership rules.
- Reconciliation failures prevent a batch becoming reportable.
- Original source values remain retained for audit.
- Vendor-specific aggregate reports do not create additional revenue.
- Missing cost data remains missing; it must never be silently treated as zero.
