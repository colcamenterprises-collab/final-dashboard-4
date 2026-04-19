# Duplicate / Conflict Register (Final Sweep)

## Scope
Refreshed for current repository state with focus on active runtime conflict families.

## A. Shopping list families (active overlap risk)
- `server/routes/shoppingList.ts`
- `server/routes/shoppingListNew.ts`
- `server/routes/shoppingListRoutes.ts`
- Inline shopping-list handlers in `server/routes.ts`
- `server/services/shoppingList.ts`

Risk:
- Multiple route families and service entry points can drift in behavior or ownership.

## B. Analysis route families (active overlap risk)
- Inline `/api/analysis/*` handlers in `server/routes.ts`
- `server/routes/analysis*` modules
- Receipt truth and usage endpoints served across multiple mounts

Risk:
- Competing ownership and duplicated endpoint surfaces for similar analysis domains.

## C. Product/menu/order surfaces (active overlap risk)
- `server/routes/menu.ts`
- `server/routes/menuManagement.ts`
- `server/routes/menu/menuV3Routes.ts`
- `server/routes/onlineMenu.ts`
- `server/routes/onlineOrders.ts`
- `server/routes/menuOrderingRoutes.ts`
- `server/routes/ordersV2Routes.ts`
- `server/routes/products.ts`, `productMenu.ts`, `productIngredients.ts`, `productActivation.ts`

Risk:
- Parallel generations (legacy + v2/v3) increase ownership ambiguity for cleanup.

## D. Finance/expenses import overlap
- `server/routes/expenses.ts`
- `server/routes/expenses-import.ts`
- `server/routes/expensesV2Routes.ts`
- `server/api/finance.ts`
- `server/routes/finance.ts`

Risk:
- Multiple expense and finance surfaces can create mixed canonical read/write assumptions.

## E. Legacy-named service/file presence to track
- `server/loyverseAPI_old.ts`
- `server/api/daily-sales.legacy.ts`
- `server/routes/ingredients-legacy.ts`

Risk:
- Legacy naming may imply inactive code but can still be mounted/used.

## Disposition for cleanup readiness
- No merges/deletions executed in this sweep.
- These conflict families are retained for runtime-validated consolidation phases only.
