# Source of Truth Map

## Explicitly verified
- Auth users: `saas_tenant_users` via Prisma auth service.
- Bob read APIs: `/api/bob/read/*` router in `server/routes/bobRead.ts` mounted by `server/index.ts`.
- Route authority: `client/src/App.tsx` + `RouteRegistry.ts` for frontend; `server/index.ts` + `server/routes.ts` for backend registration.

## Conflicts/overlaps flagged
- Products/menu authority spans `products`, `productMenu`, `menuManagement`, `menu-v3`, `menuOnline`, `menuOrderingRoutes`.
- Expenses authority spans legacy `/api/expensesV2*`, `/api/expenses-v2`, and additional finance imports.
- Analysis authority spans multiple routers under `/api/analysis*` plus direct handlers in `routes.ts`.
