# Product Intent Specification — Shift Verification & Approval

Owner: Cameron
Scope: Operations only. This document defines how Daily Sales and Daily Stock submissions are verified before a shift can be approved. It does not change application code or schema.

## 1) POS Shift Report is the source of truth
The POS Shift Report is the authoritative record for shift-level sales truth.
All verification must compare staff submissions against POS data rather than replacing POS with manual declaration.

## 2) Daily Sales is staff declaration
Daily Sales is the staff-declared record of the shift.
It should capture what the team believes happened during service, including sales mix, cash handling, expenses, and banking intent.
It is not the truth source; it is the declaration to be checked.

## 3) Daily Stock is stock declaration
Daily Stock is the staff-declared record of stock movement and end-of-shift stock state.
It should describe operational stock usage, remaining stock, and items needed for replenishment.
It is also a declaration that must be checked against operational and POS evidence.

## 4) Receipt and payment verification
Verification must review the declared shift against receipts and payment mix evidence.
This includes checking:
- receipt counts
- cash sales
- QR sales
- Grab sales
- direct sales / manual sales where applicable

The intent is to confirm that declared sales are consistent with the POS Shift Report and recorded payments.

## 5) Cash register reconciliation
Cash register reconciliation must compare the declared cash position with the cash that should remain in the register after shift activity.
This includes reviewing opening cash, expected closing cash, and cash removed during the shift.
Any mismatch should be visible before approval.

## 6) Cash banked verification
Cash banked must be checked against the declared shift values and register reconciliation.
The approval process should confirm whether the amount banked matches the expected cash handoff from the shift.

## 7) QR banked verification
QR banked must be checked as part of the shift closeout.
The approval process should confirm whether the QR amount banked matches the declared and POS-supported QR totals.

## 8) Shift expense verification
Shift expenses must be reviewed before approval.
Verification should confirm that register-paid expenses, operational expenses, and related shift deductions are understood and recorded correctly.
Expenses are part of the approval review because they affect shift outcome and financial reporting.

## 9) Approval statuses
A shift may move through the following statuses:

- **Submitted** — staff has completed the Daily Sales / Daily Stock submission
- **Pending Review** — management is verifying POS, receipts, cash, QR, and expenses
- **Approved** — management accepts the shift as verified
- **Rejected** — submission contains unresolved mismatches or missing evidence

## 10) Rule for trusted reporting and P&L
Only **Approved** shifts may feed trusted reporting, operational summaries, and P&L calculations.

Submitted, Pending Review, and Rejected shifts may be visible for operational context, but they must not be treated as trusted financial truth.

## 11) Approval intent summary
Approval is the management checkpoint that confirms:
- POS Shift Report has been reviewed
- Daily Sales declaration has been verified
- Daily Stock declaration has been reviewed
- receipt and payment evidence is consistent
- cash register reconciliation is acceptable
- cash banked and QR banked are checked
- expenses are understood
- discrepancies, if any, are recorded for management review
- the shift is suitable for trusted reporting
