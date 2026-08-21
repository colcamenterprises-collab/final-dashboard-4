# Generic Financial Source & Reconciliation Architecture

Status: Approved architecture foundation
Date: 2026-08-21

## Objective

Build Finance as a restaurant-agnostic financial source and reconciliation engine. Provider names such as Grab, Uber Eats, Stripe, LINE MAN, card terminals, banks, POS products, and ordering platforms are configuration/integration data, not core accounting concepts.

The engine must answer four independent questions:

1. What revenue did the restaurant earn?
2. What evidence independently supports that revenue?
3. What deductions, refunds, fees, promotions, or adjustments occurred?
4. Did the expected settlement actually reach cash/bank?

A bank deposit is settlement evidence and must not create revenue a second time.

## Finance navigation target

- Overview
- Revenue Sources
- Transactions
- Reconciliation
- Expenses
- Banking
- P&L
- Month End

## 1. Revenue Sources

Each business configures its own revenue sources. No restaurant-specific channel list is hard-coded.

Example configuration only:

| Revenue source | Channel type | Operational evidence | External evidence | Settlement evidence |
| --- | --- | --- | --- | --- |
| Delivery marketplace | Marketplace | POS | Marketplace transaction report | Bank |
| Cash sales | Cash | POS | Register count | Cash deposit / bank |
| QR sales | Bank transfer / QR | POS | Payment/bank transaction | Bank |
| Online direct | Online ordering | Ordering/POS | Payment processor | Bank |
| Third-party introduced | Third party | POS | Provider statement | Bank |

Suggested channel types are configurable classifications, not providers: cash, card, bank transfer, QR, delivery marketplace, online direct, invoice/accounts receivable, third party, other.

## 2. Evidence Sources

Income/revenue source and evidence source are different entities.

Evidence types:

- POS Reporting
- Delivery / Marketplace Statement
- Payment Processor
- Bank Statement
- Cash / Register Count
- Online Ordering System
- Invoice / Accounts Receivable
- Imported CSV / Spreadsheet
- API Integration
- Manual Declaration
- Other

A revenue source may have multiple evidence sources and each relationship has a purpose/authority, for example operational, external, settlement, verification.

## 3. Source of truth by financial fact

There is no single global source of truth. Authority is assigned by fact.

Examples:

- item identity / quantity / modifier: POS or ordering source
- restaurant sale price: POS or ordering source
- marketplace-funded or merchant-funded promotion: marketplace statement where authoritative
- marketplace commission and platform fee: marketplace statement
- actual bank receipt: bank statement
- cash physically present: register count
- COGS: immutable sale-time recipe/direct-cost snapshot

The reconciliation engine compares facts; it does not overwrite one source merely because another differs.

## 4. Core data model

### financial_revenue_sources

- id
- business_id
- name
- channel_type
- currency
- active
- settlement_method
- destination_account_id nullable
- created_at / updated_at

### financial_evidence_sources

- id
- business_id
- name
- evidence_type
- provider_key nullable
- integration_type (manual_import, api, internal, bank, register)
- active
- configuration_json
- created_at / updated_at

### financial_source_evidence_links

- revenue_source_id
- evidence_source_id
- authority_role (operational, external, settlement, verification)
- priority
- required_for_close
- matching_rules_json

### financial_import_templates

Reusable provider-agnostic mappings.

- id
- business_id nullable for system templates
- evidence_source_id
- name
- version
- delimiter / date / decimal settings
- column_mapping_json
- validation_rules_json
- active

### financial_import_batches

- id
- business_id
- evidence_source_id
- template_id
- original_filename
- source_sha256
- period_start / period_end
- imported_at
- imported_by
- row_count
- accepted_count
- rejected_count
- duplicate_count
- status
- validation_summary_json

Import batches are immutable audit records.

### financial_transactions

Normalized financial event while preserving provider data.

- id
- business_id
- revenue_source_id nullable until classified
- evidence_source_id
- import_batch_id nullable
- external_transaction_id
- external_order_id nullable
- external_receipt_id nullable
- linked_external_transaction_id nullable
- transaction_type (sale, refund, adjustment, fee, settlement, cancellation, other)
- transaction_at
- settlement_at nullable
- currency
- gross_sales nullable
- merchant_funded_discount nullable
- provider_funded_discount nullable
- refund_amount nullable
- net_sales nullable
- commission nullable
- platform_fee nullable
- payment_fee nullable
- tax nullable
- tips nullable
- other_deduction nullable
- adjustment_amount nullable
- expected_settlement nullable
- actual_settlement nullable
- cogs_snapshot nullable
- original_record_json
- source_record_hash
- created_at

Missing values remain NULL. Missing cost is never zero.

### financial_reconciliation_groups

Represents the money journey for an order, shift, settlement, or period.

- id
- business_id
- revenue_source_id
- reconciliation_type
- period_start / period_end
- status (unreconciled, partial, reconciled, exception, closed)
- expected_amount
- actual_amount
- variance
- closed_at nullable
- closed_by nullable

### financial_reconciliation_matches

- reconciliation_group_id
- transaction_id
- match_role (operational, external, settlement, bank, register)
- match_method (exact_id, reference, amount_date, manual)
- confidence
- variance
- notes

### financial_reconciliation_exceptions

- reconciliation_group_id
- exception_type
- severity
- expected_value nullable
- actual_value nullable
- difference nullable
- status
- resolution_notes
- resolved_by / resolved_at

Initial exception vocabulary:

- missing_operational_record
- missing_external_record
- gross_mismatch
- discount_mismatch
- refund_or_adjustment
- fee_mismatch
- expected_settlement_mismatch
- bank_unmatched
- duplicate_source_transaction
- unknown_revenue_source

## 5. Generic import mapper

First import workflow:

1. Upload file.
2. Detect headers and sample values.
3. Select/create Evidence Source.
4. Map provider columns to normalized financial fields.
5. Configure identifiers, dates, signs and currency.
6. Validate totals and duplicate identifiers.
7. Preview accepted/rejected rows and totals.
8. Save mapping as an Import Template.
9. Commit immutable Import Batch.
10. Run reconciliation.

Subsequent imports use the saved template, but must still validate before commit.

No import may silently convert missing financial values to zero.

## 6. Reconciliation pathways

The engine uses configuration rather than provider-specific logic.

Cash example:

POS expected cash -> register count -> cash banked -> bank

Marketplace example:

POS/order -> marketplace transaction -> marketplace settlement -> bank

QR/card example:

POS -> payment transaction -> processor/bank settlement -> bank

Invoice example:

Invoice -> payment -> bank

## 7. Accounting treatment

Revenue and settlement must be separate.

Restaurant net sales are derived from authoritative sales facts and valid discounts/refunds. Provider settlement is not revenue.

Provider commissions, platform fees, payment fees and similar deductions are classified expenses/contra amounts according to accounting configuration; they must remain separately reportable rather than being hidden by reporting only settlement cash.

COGS comes only from restaurant costing evidence, preferably immutable sale-time snapshots. Marketplace transaction files must never invent COGS or gross profit.

## 8. Close control

Suggested progression:

Operational evidence reconciled -> External evidence reconciled -> Settlement reconciled -> Bank reconciled -> CLOSED

The required stages depend on the configured revenue source.

Closed periods/groups must not silently mutate. Corrections after close require an explicit adjustment/reopen workflow with audit history.

## 9. Provider implementation rule

Provider adapters/templates may understand provider terminology, but normalized finance tables and UI must not contain business-specific assumptions.

The existing Grab transaction dataset from 2026-07-01 through 2026-08-21 is the first production validation dataset. It should be implemented as a provider template/evidence source on top of this generic architecture, not as a Grab-only ledger.

The original provider row and transaction identifiers must be retained for audit and reprocessing.

## 10. Migration from existing reporting

Existing POS and restaurant reporting should be connected to the engine as evidence sources rather than duplicated.

Existing staff-entered channel totals remain operational declarations/control evidence. They do not supersede transaction-level POS, provider, processor, or bank evidence where those authoritative sources exist.

Historical records without trustworthy COGS remain NULL for COGS/gross profit/margin.

## 11. Implementation stages

### Stage A — Foundation

- additive database migration for generic finance tables
- Revenue Sources + Evidence Sources configuration API
- owner/finance permissions
- Revenue Sources setup UI
- generic transaction/import types

### Stage B — Import engine

- CSV upload/preview
- generic field mapper
- validation and duplicate protection
- immutable batches
- saved templates
- original-record preservation

### Stage C — Reconciliation engine

- matching rules
- reconciliation groups
- exception queue
- settlement and bank matching
- close controls

### Stage D — First provider migration

- configure Grab as an Evidence Source/template
- import and reconcile the supplied 2026-07-01 to 2026-08-21 transaction report
- match provider order references against POS where available
- preserve unmatched records as exceptions

### Stage E — Finance reporting

- revenue by configured source
- gross/net sales
- promotions/discounts/refunds
- provider/payment fees
- settlement receivable vs cash received
- COGS/gross profit only where cost evidence exists
- reconciliation health
- P&L and month-end close

## Non-negotiable controls

1. No hard-coded SBB/Grab accounting architecture.
2. No bank settlement recorded as duplicate revenue.
3. No missing cost represented as zero.
4. No destructive overwrite of source evidence.
5. No silent duplicate transaction import.
6. No silent import while required mapping/validation is unresolved.
7. Every normalized value remains traceable to source record + import batch.
8. Refunds/adjustments can link back to original transactions.
9. Financial authority is configured by fact/evidence role.
10. Closed reconciliation periods cannot silently change.
