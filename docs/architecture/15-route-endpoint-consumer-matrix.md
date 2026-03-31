# 15) Route / Endpoint / Consumer Matrix

This matrix is evidence-based from:
- route declarations in `client/src/App.tsx`,
- provider root in `client/src/App.tsx`,
- frontend API usage inventory in `docs/architecture/architecture-machine-readable.json` (`frontend_api_calls`),
- backend mount files (`server/index.ts`, `server/routes.ts`, and route modules).

## Global providers (applies to all routes)
- `ErrorBoundary`
- `QueryClientProvider`
- `TooltipProvider`
- `BrowserRouter`
- `PageShell` wrapper for the dashboard/application route block

## Major route matrix

| Frontend route | Page file | Guard in App | API endpoints consumed (frontend evidence) | Backend serving files (mount/module evidence) | Source-of-truth system touched | Notes |
|---|---|---|---|---|---|---|
| `/login` | `client/src/pages/auth/Login.tsx` | No | `/api/auth/login` | `server/index.ts` mounts `/api/auth`; `server/routes/auth/authRoutes.ts` defines `/login` | Auth/users | Stores token/user in `localStorage`; no frontend guard consumes token for route gating. |
| `/dashboard` | `client/src/pages/Home.tsx` | Yes (`Guard`) | `/api/balance/forms`, `/api/balance/pos`, `/api/finance/summary/today`, `/api/metrics/prime-cost`, `/api/shift-report/latest` | `server/routes.ts` mounts `/api/balance`, `/api/shift-report`; `server/index.ts` mounts `/api/finance` | Daily sales + POS + finance rollups | Guard is allowlist-only (not auth). |
| `/operations/daily-sales-v2/library` | `client/src/pages/operations/daily-sales-v2/Library.tsx` | Yes | `/api/forms/daily-sales/v2`, `/api/ingredients` | `server/routes.ts` mounts `/api/forms`; `server/routes.ts` mounts `/api/ingredients` | Daily sales forms + ingredients | Architecture baseline marks many ops pages unguarded; runtime App wraps with Guard. |
| `/operations/shopping-list` | `client/src/pages/ShoppingList.tsx` | Yes | `/api/purchasing-list/latest`, `/api/purchasing-list/system-purchases`, `/api/purchasing-list/latest/csv` | `server/routes.ts` mounts `/api/purchasing-list` | Shopping list / purchasing items | Duplicate purchasing flows exist in legacy map (`shopping-list` and `purchasing-list`). |
| `/operations/purchasing-mapping` | `client/src/pages/operations/PurchasingFieldMapping.tsx` | Yes | `/api/purchasing-field-mapping/*` | `server/routes.ts` mounts `/api/purchasing-field-mapping` | Purchasing items canonical mapping | Explicit admin mapping path for canonical purchasing normalization. |
| `/operations/purchasing-shift-log` | `client/src/pages/operations/PurchasingShiftLog.tsx` | Yes | `/api/purchasing-shift-log` | `server/routes.ts` mounts `/api/purchasing-shift-log`; also `server/index.ts` mounts purchasing shift log router | Purchasing shift evidence | Duplicate mount surface exists (index + routes). |
| `/operations/purchasing-analytics` | `client/src/pages/operations/PurchasingAnalytics.tsx` | Yes | `/api/purchasing-analytics` | `server/routes.ts` mounts `/api/purchasing-analytics` | Purchasing analytics derived | Derived analytics layer; canonical upstream still purchasing items. |
| `/operations/ingredient-purchasing` | `client/src/pages/ops/IngredientPurchasingList.tsx` | Yes | `/api/ingredient-authority` | `server/index.ts` mounts `/api/ingredient-authority`; module `server/routes/ingredientAuthority.ts` | Ingredient authority | Explicit authority/canonical path present. |
| `/operations/daily-sales` | `client/src/pages/operations/daily-sales/Form.tsx` | **No** | `/api/daily-sales` family | Mixed mounts in `server/index.ts` and `server/routes.ts` | Daily sales source data | Unguarded operational form route inside `PageShell`. |
| `/operations/daily-stock` | `client/src/pages/operations/DailyStock.tsx` | Yes | `/api/daily-stock`, `/api/shopping-list` family | `server/index.ts` + `server/routes.ts` daily stock mounts | Daily stock + shopping list derivation | Daily stock is guarded by allowlist, not auth identity. |
| `/operations/system-health` | `client/src/pages/operations/system-health/index.tsx` | Yes | `/api/system-health` + Bob read checks | `server/index.ts` and `server/routes.ts` both mount system health router | System runtime state | Runtime probe showed `/api/system-health` can hang/fail without DB. |
| `/operations/ai-ops-control` | `client/src/pages/operations/AiOpsControl.tsx` | Yes | `/api/ai-ops/*`, `/api/bob/read/*` | `server/index.ts` mounts `/api/ops/ai`, `/api/ai-ops`, `/api/bob/read` | AI ops, issue register, readiness | Bob namespace read-only auth contract is explicit in router middleware. |
| `/analysis/stock-review` | `client/src/pages/analysis/StockReview.tsx` | Yes | `/api/analysis/stock-review/*`, receipts/usage endpoints | `server/routes.ts` analysis mounts (`/api/analysis`, stock review router) | Stock reconciliation and usage | Legacy alias redirects still present. |
| `/analysis/stock-reconciliation` | `client/src/pages/analysis/StockReconciliation.tsx` | Yes | stock/reconciliation APIs | `server/routes.ts` stock + variance mounts | Stock reconciliation | Sensitive operations still client-side reachable without auth token enforcement. |
| `/finance` | `client/src/pages/finance/FinancePage.tsx` | Yes | `/api/finance/*` | `server/index.ts` mounts finance router (`server/api/finance.ts`) | Finance summary + expenses | Some finance endpoints public by design (`summary/today`). |
| `/finance/profit-loss` | `client/src/pages/ProfitLoss.tsx` | Yes | P&L read endpoints | `server/routes.ts` mounts `/api/pnl`, `/api/pnl/snapshot` | P&L read models | Multiple P&L subsystems exist (legacy + v2). |
| `/menu/recipes` | `client/src/pages/menu/Recipes.tsx` | Yes | recipe/menu APIs | `server/routes.ts` mounts `/api/recipes`, `/api/menus`, `/api/menu-management`, `/api/menu-v3` | Recipes/menu truth | Multiple menu systems coexist (legacy + v3 + management layer). |
| `/products` | `client/src/pages/Products.tsx` | Yes | `/api/products` | `server/routes.ts` mounts `productsRouter` and `/api/products/*` modules | Product catalog | Product endpoints split across multiple routers. |
| `/marketing/online-ordering` | `client/src/pages/OnlineOrdering.tsx` | Yes | `/api/menu-ordering/full` | `server/routes.ts` mounts `/api/menu-ordering`, `/api/orders-v2` | Online ordering read/write model | Public ordering routes also exist outside guarded dashboard tree. |
| `/membership/dashboard` | `client/src/pages/membership/MemberDashboard.tsx` | Yes | `/api/membership/*` | `server/routes.ts` mounts `/api/membership` | Membership/accounts | Public `/membership` also exists and is unguarded marketing page. |

