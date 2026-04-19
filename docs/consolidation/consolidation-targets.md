# Consolidation Targets (Planning Only)

## Scope
Planning artifact only. No merge/retire/archive action is executed in this PR.

## Will be merged later (post-validation phase)
| Target family | Planned canonical destination | Preconditions |
|---|---|---|
| Shopping list + purchasing list overlap | Single canonical purchasing-list service family | Runtime parity checks + endpoint consumer verification |
| Analysis overlap families | Single `/api/analysis/*` ownership model | Full mount-resolution validation + rebuild evidence checks |
| Product/menu/order multi-generation surfaces | Canonical menu/product/order module set | UI/API consumer mapping lock + migration playbook |
| Finance/expenses overlap (v1/v2/import) | Canonical finance + expenses-v2 read/write split | Import pipeline parity + historical report reconciliation |

## Will be retired later (post-cutover)
| Retirement candidates | Planned replacement owner | Preconditions |
|---|---|---|
| Legacy-named shopping-list aliases | purchasing-list canonical routes | 100% caller migration verified |
| Duplicate system-health mount overlap | single canonical mount path | runtime health checks + monitoring continuity |
| Parallel analysis aliases/redirect-era endpoints | canonical analysis surface | consumer migration + alerting confirmation |
| Legacy daily-sales route generation paths | forms/daily-sales canonical model | reconciliation proof across historical windows |

## Will be archived later (evidence + reference)
| Archive candidates | Archive reason |
|---|---|
| Legacy docs and conflict ledgers superseded by canonical ownership maps | Preserve decision history and audit trail |
| Legacy service modules after successful retirement | Retain rollback evidence and historical implementation context |
| Transitional scripts used only during consolidation cutover | Preserve deterministic rebuild and rollback procedures |

## Explicit non-action statement
This file defines future intent only:
- no merges performed,
- no retirements performed,
- no archives performed.
