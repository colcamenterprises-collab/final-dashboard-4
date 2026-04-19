# Route Ownership — Final Structural Truth (Cleanup PR #2)

## Scope and constraints
This document is non-destructive and ownership-only. It does not change runtime, auth, mounts, handlers, or behavior.

Authoritative route truth was resolved from:
- Backend mount + route declarations: `server/index.ts`, `server/routes.ts`.
- Backend governed read routers: `server/routes/bobRead.ts`, `server/routes/agentRead.ts`, `server/routes/aiOpsControl.ts`.
- Frontend route wiring: `client/src/App.tsx` and `client/src/router/RouteRegistry.ts`.
- Existing full inventory baseline: `docs/audit/route-inventory.csv` and `docs/architecture/architecture-machine-readable.json`.

## Final frontend route ownership
Frontend route ownership is canonical at:
1. `client/src/App.tsx` (actual React Router wiring / redirects / guards)
2. `client/src/router/RouteRegistry.ts` (route constants)

The frontend full route list is already enumerated in `docs/architecture/01-frontend-route-map.md` and remains the canonical full listing for cleanup sequencing.

## Final backend route ownership (resolved)
Backend ownership is split by mount tier:
1. `server/index.ts` = primary bootstrap + protected read/control mounts.
2. `server/routes.ts` = large consolidated API surface + many legacy/parallel families.

### Protected ownership zones (canonical)
| Surface | Canonical runtime path | Canonical owner | Notes |
|---|---|---|---|
| Bob governed read plane | `/api/bob/read/*` | `server/routes/bobRead.ts` via `server/index.ts` mount | Protected; GET-only + token-protected namespace. |
| Agent governed read plane | `/api/agent/read/*` | `server/routes/agentRead.ts` (+ `server/middleware/agentAuth.ts`) via `server/index.ts` mount | Protected read namespace; excluded from consolidation changes. |
| AI Ops control plane | `/api/ai-ops/*` and `/api/ops/ai/*` | `server/routes/aiOpsControl.ts` via `server/index.ts` dual mount | Dual-prefix family retained until later consolidation phase. |

### Duplicate route families (classified, non-merge)
| Family | Canonical owner | Secondary/duplicate owners | Legacy owners | Current action |
|---|---|---|---|---|
| Analysis | `server/routes.ts` `/api/analysis/*` core + mounted analysis modules | `server/index.ts` mounts additional analysis routers (`/api/analysis`, `/api/analysis/shift`) | historical aliases in `server/routes.ts` | Keep all; classify only. |
| Purchasing / shopping list | `server/routes.ts` `/api/purchasing-list*` family | `server/routes/shoppingListRoutes.ts`, inline `/api/shopping-list*` in `server/routes.ts`, `server/index.ts` purchasing mounts | older shopping-list naming | Keep all; no merge. |
| Daily stock | `server/index.ts` mount + `server/routes.ts` inline `/api/daily-stock*` | `server/api/daily-stock.ts` and inline handlers coexist | n/a | Keep all; ownership fixed for later sequencing. |
| System health | `/api/system-health` mounted in both `server/index.ts` and `server/routes.ts` | both files mount same family | n/a | Keep dual mount for now. |
| Finance/expenses | `server/index.ts` `/api/finance` + `server/api/finance.ts` | `server/routes/finance.ts`, `server/routes/expenses*.ts`, `server/routes.ts` inline `expensesV2` paths | legacy expense import patterns | Keep all; no behavior change. |
| Menu/products/orders | `server/routes.ts` mounted menu/product/order modules | multiple module generations (`menu`, `menu-management`, `menu-v3`, products split routers, `orders-v2`) | older menu/order family aliases | Keep all; no merge. |

### Legacy route families (tracked, not retired in this PR)
- `server/api/daily-sales.legacy.ts`
- `server/routes/ingredients-legacy.ts` (active mount)
- Legacy-named/parallel families in shopping list, expenses, menu/order surfaces remain active and are not removed here.

## Full resolved routes statement
For cleanup sequencing, the **full resolved route corpus** is:
- Frontend full map: `docs/architecture/01-frontend-route-map.md`
- Backend full endpoint corpus: `docs/architecture/02-backend-endpoint-map.md`
- Machine-readable baseline (665 backend endpoint declarations + route metadata): `docs/architecture/architecture-machine-readable.json`
- Audit inventory CSV: `docs/audit/route-inventory.csv`

This file establishes **ownership truth and family classification** over that full corpus; it does not alter any runtime surface.
