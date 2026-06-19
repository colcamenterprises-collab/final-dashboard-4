# Product Intent Specification — Daily Sales & Daily Stock

Owner: Cameron
Scope: Operations only. This document defines the intended product behavior for Daily Sales and Daily Stock. It does not change application code or schema.

## 1) Daily Sales is staff shift declaration
Daily Sales is the staff-facing declaration of what happened during a shift.
It records the shift outcome from the team’s point of view and is used to close the loop between operations, cash handling, and POS truth.

## 2) POS Shift Report is the source of truth
The POS Shift Report is the authoritative source of truth for shift-level sales.
Daily Sales must be checked against POS Shift Report values rather than treated as a replacement for POS.
When Daily Sales and POS disagree, the discrepancy must be visible and reviewable.

## 3) Receipt, cash, QR, Grab, and direct sales verification
Daily Sales must support verification across the full sales mix:
- receipt count reconciliation
- cash sales reconciliation
- QR payment reconciliation
- Grab reconciliation
- direct sales / manual sales reconciliation

The intent is to compare staff-reported values against the POS truth layer and surface mismatches clearly.

## 4) Shift expenses paid from the register
Shift-level expenses paid from the register are part of the Daily Sales closeout.
The system should capture these expenses as part of the shift declaration so management can review register outflows alongside sales and tender breakdowns.

## 5) Cash and QR banking verification
Daily Sales must support banking verification for cash and QR.
The aim is to compare what the shift reported with what was actually banked, so finance and operations can reconcile shortfalls, timing differences, or missing deposits.

## 6) Daily Stock is stock control and purchasing planning
Daily Stock is the operational stock-control layer.
Its purpose is to:
- record stock movement during the shift
- support purchasing planning
- help managers understand what must be reordered
- connect operational consumption to upcoming procurement decisions

## 7) Theft, wastage, and over-ordering detection
Daily Stock should help identify operational waste patterns, including:
- theft
- wastage
- over-ordering
- unexplained stock movement

The goal is not only recording stock, but also highlighting anomalies that need manager review.

## 8) Shopping list generation
Daily Stock should generate shopping list recommendations from stock state and operational demand.
The shopping list is a planning tool for purchasing, not a replacement for manager judgment.

## 9) Management email output
Daily Sales / Daily Stock closeout should produce management-facing email output.
The email should summarize key shift outcomes, discrepancies, and actions requiring attention.

## 10) Shift approval logic
Shift approval should act as the management checkpoint.
Approval should only happen after:
- the shift declaration is complete
- POS reconciliation is reviewed
- cash / QR banking verification is checked
- expenses and stock changes are understood

Approval indicates that the shift is accepted for management review and downstream operational reporting.

## Product intent summary
- Daily Sales = staff declaration of the shift
- POS Shift Report = truth source
- Daily Stock = inventory and purchasing control
- Shopping list = procurement planning output
- Management email = review summary
- Approval = managerial checkpoint after verification
