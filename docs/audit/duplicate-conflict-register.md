# Duplicate / Conflict Register (Final Structural Classification)

## Scope
Non-destructive classification for cleanup sequencing.
No merge/deletion/refactor action is taken in this register update.

## Classification matrix
| Conflict family | Canonical system | Secondary system(s) | Legacy system(s) | Merge now? |
|---|---|---|---|---|
| Shopping list vs purchasing list | `/api/purchasing-list*` family in `server/routes.ts` | `/api/shopping-list*` family (`server/routes/shoppingListRoutes.ts` + inline handlers), `server/services/shoppingList.ts` | historical shopping list naming and route variants | **No** (classification only) |
| Analysis route overlap | `/api/analysis*` core in `server/routes.ts` | mounted analysis modules in `server/index.ts`; receipts analytics overlap surfaces | legacy aliases and transitional analysis paths | **No** (classification only) |
| Product/menu/order multi-generation | canonical `products + menu-management + orders-v2` ownership set (planned) | `menu-v3`, `menu-ordering`, `productMenu`, split product subrouters | older menu/order family modules and aliases | **No** (classification only) |
| Finance/expenses/import overlap | `/api/finance` (index-mounted) + canonical expenses-v2 trajectory | `server/routes/finance.ts`, `server/routes/expenses-import.ts`, inline expenses handlers | older expenses/import route patterns | **No** (classification only) |
| Daily stock overlap | `/api/daily-stock` index-mounted router family | inline `/api/daily-stock*` handlers in `server/routes.ts` | older stock helper endpoints | **No** (classification only) |
| System-health dual mount | `/api/system-health` canonical health family | duplicate mount points in both `server/index.ts` and `server/routes.ts` | n/a | **No** (classification only) |

## Legacy-presence watch list
- `server/api/daily-sales.legacy.ts`
- `server/routes/ingredients-legacy.ts` (active)
- `server/loyverseAPI_old.ts`

## Disposition
- Canonical/secondary/legacy ownership is now explicit.
- Do not merge yet.
- Do not retire yet.
- Keep runtime unchanged until later runtime-validated consolidation PRs.
