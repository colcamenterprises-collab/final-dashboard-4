# Acceptance checklist

- Upload an SCB/KBank statement.
- Confirm withdrawals are immediately present in Business Expenses with category `Review`.
- Confirm deposits remain in Bank Deposits / Credits and are not added to profit or expenses.
- Open Expense Review and change a `Review` row to a normal business category; the row should change immediately and remain included in reporting.
- Mark a withdrawal `Personal`; it should disappear from the Review view and be removed from business expense reporting while remaining in the personal/audit view.
- Change that Personal row back to `Review`; its deterministic `bank_txn:<id>` expense should be restored.
- Edit statement description and supplier/purpose and confirm the linked expense updates.
- Delete an imported row and confirm the linked business expense is removed while the bank row is retained as deleted.
- Confirm no approval button or per-row approval wait remains.
- Confirm the UI remains usable while individual rows save.
