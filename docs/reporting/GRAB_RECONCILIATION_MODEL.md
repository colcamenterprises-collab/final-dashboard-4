# Grab reconciliation model

## Purpose

Explain differences between SBB POS values and official Grab transaction gross before treating them as operational errors.

## Value sequence

1. POS/menu gross value
2. Less any internal POS discount already recorded on the receipt
3. Apply channel-specific modifier price differences through the live modifier catalogue
4. Less date-bound Grab marketing campaign adjustments configured in Reporting
5. Result = expected Grab gross
6. Compare expected Grab gross with official Grab gross when official transaction data is available

## Status intent

- MATCHED — expected and official Grab gross agree within tolerance.
- MATCHED AFTER CAMPAIGN — difference is fully explained by an active Grab campaign.
- CHANNEL PRICE EXPLAINED — difference is explained by Direct vs Grab modifier pricing.
- MISSING POS RECEIPT — official Grab order has no POS receipt.
- MISSING GRAB TRANSACTION — POS Grab receipt has no official Grab transaction.
- UNEXPLAINED VARIANCE — remaining difference requires review.

## Data ownership

- POS/menu and modifier prices are operational catalogue data.
- Grab marketing adjustments are temporary reporting/reconciliation rules only and must not overwrite POS/menu price history.
- Official Grab transaction gross remains the source of truth for Grab financial reconciliation once imported/available.
- `isSetProduct` identifies a sold set or upgraded parent product; `isSetComponent` identifies child components such as included fries/drink and is not a synonym for “set”.

## Exports

Receipts provides two exports:

- Receipt Summary CSV — one row per receipt for normal reconciliation.
- Line Items CSV — item-level forensic export for investigating mismatches.
