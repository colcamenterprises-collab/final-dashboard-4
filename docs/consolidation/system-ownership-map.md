# System Ownership Map (Final Structural Truth)

## Ownership model
- **Canonical owner** = target source for future consolidation.
- **Secondary/duplicate systems** = active parallel implementations retained during cleanup phases.
- **Legacy systems** = older generations still present and/or mounted.

No merges, deletions, or rewiring are executed in this PR.

## Domain ownership table
| Domain | Canonical owner | Secondary / duplicate systems | Legacy systems |
|---|---|---|---|
| Daily sales | `server/routes.ts` `/api/daily-sales*` + forms surfaces under `/api/forms` | `server/index.ts` daily-sales handlers and mounted form routers | `server/api/daily-sales.legacy.ts` |
| Daily stock | `server/index.ts` + `server/api/daily-stock.ts` mounted at `/api/daily-stock` | Inline `/api/daily-stock*` paths in `server/routes.ts` | historical stock helper paths retained in `server/routes.ts` |
| Purchasing | `server/routes.ts` `/api/purchasing-list*`, mapping, shift-log, analytics modules | `server/index.ts` `/api/purchasing*` and `/api/purchasing-items*` mounts | older `/api/shopping-list*` naming retained |
| Ingredient authority | `/api/ingredient-authority` via `server/routes/ingredientAuthority.ts` and admin authority routes | ingredient master and ingredient search surfaces (`/api/ingredient-master`, `/api/ingredients*`) | `/api/ingredients/legacy` family |
| Recipes | `/api/recipes` modules in `server/routes.ts` | product-menu linkage and menu management routes | legacy mixed recipe/menu aliases |
| Products | `productsRouter` + `/api/products` family | product ingredient + activation split routers | older menu/product overlap families |
| Analysis | `/api/analysis*` core in `server/routes.ts` | additional mounted analysis modules in `server/index.ts`; receipts analytics overlap | legacy analysis aliases and transitional paths |
| AI Ops (Bob control plane) | `server/routes/aiOpsControl.ts` mounted at `/api/ai-ops` and `/api/ops/ai` | `/api/bob` alias surface | legacy AI alias paths retained |
| Agent read surface | `server/routes/agentRead.ts` mounted at `/api/agent/read` with `agentAuth` middleware | none (protected single read plane) | none |

## Protected systems alignment check
Protected systems remain mapped and excluded from consolidation actions in this PR:
- Bob governed read (`/api/bob/read/*`)
- Agent governed read (`/api/agent/read/*`)
- AI ops control router and monitoring/orchestrator stack
- Daily sales / daily stock / purchasing / ingredient authority protected ownership families in keep-register governance

Alignment references:
- `docs/audit/business-critical-keep-register.md`
- `docs/consolidation/cleanup-hard-stop-rules.md`
- `docs/consolidation/protection-rules-refresh.md`

Status: **Aligned** (documentation-only verification).
