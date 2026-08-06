# Fast bank expense review

## New operating rule

Bank-statement withdrawals no longer wait for manual approval before they enter business reporting.

1. Upload the bank statement.
2. Every imported withdrawal is immediately linked to a canonical `expenses` row.
3. The default expense category is `Review`.
4. `Review` is a valid business-expense category and is included in reporting immediately.
5. The owner reviews exceptions by scrolling the statement list.
6. Marking a transaction `Personal / Owner` removes its linked business-expense row while retaining the bank transaction for reconciliation/audit.
7. Changing a business category updates the linked expense directly; no separate approval step is required.
8. Statement deposits remain reconciliation-only and do not become revenue or expenses.

## Performance rule

Inline category, supplier, description, and personal/business changes use the lightweight `/api/finance/bank-imports/txns/:id` endpoint. The UI updates optimistically and does not lock the full transaction list while a row saves. Finance dashboard refreshes happen in the background.

## Data safety

- `bank_txn` remains the imported statement/audit record.
- `expenses` remains the business-expense ledger used by reporting.
- Bank-created expense IDs remain deterministic: `bank_txn:<bank_txn.id>`.
- Personal, deposit, transfer, ignored, or deleted rows are excluded from the business-expense ledger.
- No database migration is required.
