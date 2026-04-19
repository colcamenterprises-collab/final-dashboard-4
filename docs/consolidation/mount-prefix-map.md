# Mount Prefix Resolution Map (Final Structural Truth)

## Purpose
Resolve router-local paths into final runtime endpoint paths and remove prefix ambiguity (example: `/bob/health` local route vs mounted `/api/ai-ops/bob/health`).

## Canonical resolution rule
`full_runtime_path = mount_prefix + router_local_path`

Where dual mounts exist, one router-local path resolves to multiple full runtime paths.

## Index-level protected/control mounts
| Router/module | Mount prefix | Router-local example | Resolved full endpoint |
|---|---|---|---|
| `aiOpsControlRouter` | `/api/ai-ops` | `/bob/health` | `/api/ai-ops/bob/health` |
| `aiOpsControlRouter` | `/api/ops/ai` | `/bob/health` | `/api/ops/ai/bob/health` |
| `bobAliasRouter` | `/api/bob` | alias routes | `/api/bob/*` |
| `bobReadRouter` | `/api/bob/read` | `/system-health` | `/api/bob/read/system-health` |
| `bobReadRouter` | `/api/bob/read` | `/system-map` | `/api/bob/read/system-map` |
| `bobReadRouter` | `/api/bob/read` | `/module-status` | `/api/bob/read/module-status` |
| `bobReadRouter` | `/api/bob/read` | `/build-status` | `/api/bob/read/build-status` |
| `bobReadRouter` | `/api/bob/read` | `/shift-snapshot` | `/api/bob/read/shift-snapshot` |
| `agentReadRouter` | `/api/agent/read` | router read endpoints | `/api/agent/read/*` |
| `systemHealthRouter` | `/api/system-health` | router paths | `/api/system-health/*` |

## Index-level domain mounts
| Router/module | Mount prefix | Router-local path shape | Resolved endpoint family |
|---|---|---|---|
| `dailyStockRouter` | `/api/daily-stock` | `/...` | `/api/daily-stock/*` |
| `financeRouter` | `/api/finance` | `/summary/today`, `/pnl-*` | `/api/finance/*` |
| `purchasingRouter` | `/api/purchasing` | `/...` | `/api/purchasing/*` |
| `purchasingDrinksRouter` | `/api/purchasing` | `/...` | `/api/purchasing/*` |
| `purchasingItemsRouter` | `/api/purchasing-items` | `/...` | `/api/purchasing-items/*` |
| `authRoutes` | `/api/auth` | `/login`, etc. | `/api/auth/*` |
| `providerRoutes` | `/api/payment-providers` | `/...` | `/api/payment-providers/*` |
| `paymentProcessRoutes` | `/api/payments` | `/...` | `/api/payments/*` |
| `ingredientMasterRouter` | `/api/ingredient-master` | `/...` | `/api/ingredient-master/*` |
| `ingredientAuthorityRouter` | `/api/ingredient-authority` | `/...` | `/api/ingredient-authority/*` |

## `server/routes.ts` high-impact mounts (ownership-ambiguous families)
| Router/module | Mount prefix | Router-local path shape | Resolved endpoint family |
|---|---|---|---|
| `shoppingListRoutes` | `/api/shopping-list` | `/...` | `/api/shopping-list/*` |
| `shoppingListNewRouter` | `/api/purchasing-list` | `/...` | `/api/purchasing-list/*` |
| `purchasingFieldMappingRouter` | `/api/purchasing-field-mapping` | `/...` | `/api/purchasing-field-mapping/*` |
| `purchasingShiftLogRouter` | `/api/purchasing-shift-log` | `/...` | `/api/purchasing-shift-log/*` |
| `purchasingAnalyticsRouter` | `/api/purchasing-analytics` | `/...` | `/api/purchasing-analytics/*` |
| `menuManagementRouter` | `/api/menu-management` | `/...` | `/api/menu-management/*` |
| `menuV3Routes` | `/api/menu-v3` | `/...` | `/api/menu-v3/*` |
| `productsRouter` (direct mount) | router-defined | mixed local explicit prefixes | mixed `/api/products*` paths |
| `productIngredientsRouter` | `/api/products` | `/...` | `/api/products/*` |
| `productActivationRouter` | `/api/products` | `/...` | `/api/products/*` |
| `ordersV2Routes` | `/api/orders-v2` | `/...` | `/api/orders-v2/*` |
| `menuOrderingRoutes` | `/api/menu-ordering` | `/...` | `/api/menu-ordering/*` |
| `expensesV2Routes` | `/api/expenses-v2` | `/...` | `/api/expenses-v2/*` |
| `systemHealthRouter` | `/api/system-health` | `/...` | `/api/system-health/*` |

## Prefix ambiguity eliminations (explicit)
| Ambiguous-local expression | Correct resolved runtime path |
|---|---|
| `/bob/health` in `aiOpsControlRouter` | `/api/ai-ops/bob/health` and `/api/ops/ai/bob/health` |
| `/system-health` in Bob read router | `/api/bob/read/system-health` |
| `/build-status` in Bob read router | `/api/bob/read/build-status` |
| `/shift-snapshot` in Bob read router | `/api/bob/read/shift-snapshot` |
| `/...` local in agent read router | `/api/agent/read/...` |

## Notes
- This map is structural truth for cleanup planning only.
- No mounts were changed.
- No routes were rewritten.
