# Backend Endpoint Map

| Method | Path | Auth (explicit detection) | Source |
|---|---|---|---|
| POST | / | none-explicit | server/api/daily-sales.legacy.ts:9 |
| GET | / | none-explicit | server/api/db-health.ts:7 |
| POST | / | none-explicit | server/api/expenseImports.ts:20 |
| POST | /:batchId/parse | none-explicit | server/api/expenseImports.ts:51 |
| GET | /:batchId/lines | none-explicit | server/api/expenseImports.ts:199 |
| GET | /vendors | none-explicit | server/api/expenseImports.ts:243 |
| GET | /categories | none-explicit | server/api/expenseImports.ts:268 |
| PATCH | /:batchId/lines/:lineId | none-explicit | server/api/expenseImports.ts:283 |
| POST | /:batchId/commit | none-explicit | server/api/expenseImports.ts:312 |
| GET | / | none-explicit | server/api/expenseImports.ts:374 |
| GET | /summary/today | none-explicit | server/api/finance.ts:37 |
| GET | /pnl-expenses | none-explicit | server/api/finance.ts:181 |
| GET | /pnl-summary | none-explicit | server/api/finance.ts:233 |
| POST | /pl-entry | middleware-present | server/api/finance.ts:321 |
| GET | /pl | none-explicit | server/api/finance.ts:513 |
| GET | /pl/export | none-explicit | server/api/finance.ts:599 |
| GET | /summary | none-explicit | server/api/finance.ts:629 |
| POST | /import | none-explicit | server/api/ingredients-import.ts:27 |
| GET | /god-file | none-explicit | server/api/ingredients-import.ts:121 |
| POST | /sync-god | none-explicit | server/api/ingredients-import.ts:154 |
| POST | /sync-to-god | none-explicit | server/api/ingredients-import.ts:177 |
| POST | / | none-explicit | server/api/ingredients/upload.ts:23 |
| GET | / | none-explicit | server/api/library/daily-sales.ts:7 |
| GET | / | none-explicit | server/api/stock-catalog-new.ts:9 |
| GET | /rolls | none-explicit | server/api/stockReview.ts:18 |
| GET | /tablet-reload | none-explicit | server/index.ts:158 |
| GET | /tablet-nuclear | none-explicit | server/index.ts:162 |
| GET | /api/daily-stock/:salesFormId | none-explicit | server/index.ts:276 |
| POST | /api/daily-sales | none-explicit | server/index.ts:296 |
| GET | /api/daily-sales | none-explicit | server/index.ts:343 |
| GET | /api/ingredients | none-explicit | server/index.ts:360 |
| POST | /chat/:agent | none-explicit | server/index.ts:398 |
| GET | env | none-explicit | server/index.ts:538 |
| GET | /api/suppliers-json | none-explicit | server/routes.ts:326 |
| POST | /api/stock-catalog/import | none-explicit | server/routes.ts:354 |
| GET | /api/daily-stock | none-explicit | server/routes.ts:364 |
| POST | /api/daily-stock | none-explicit | server/routes.ts:369 |
| POST | /api/pos/upload | none-explicit | server/routes.ts:375 |
| POST | /api/pos/upload-bundle | none-explicit | server/routes.ts:386 |
| GET | /api/pos/batches | none-explicit | server/routes.ts:396 |
| GET | /api/pos/:batchId/analyze | none-explicit | server/routes.ts:414 |
| GET | /api/analysis/shift | none-explicit | server/routes.ts:425 |
| GET | /api/profit-loss | middleware-present | server/routes.ts:489 |
| GET | /api/loyverse/shifts | none-explicit | server/routes.ts:647 |
| GET | /api/loyverse/receipts | none-explicit | server/routes.ts:708 |
| GET | /api/dashboard/stock-discrepancies | none-explicit | server/routes.ts:766 |
| POST | /api/analysis/upload | none-explicit | server/routes.ts:829 |
| POST | /api/analysis/trigger | none-explicit | server/routes.ts:892 |
| POST | /api/analysis/generate | none-explicit | server/routes.ts:1016 |
| GET | /api/analysis | none-explicit | server/routes.ts:1027 |
| GET | /api/analysis/stock-reconciliation | none-explicit | server/routes.ts:1033 |
| GET | /api/analysis/usage-reconciliation | none-explicit | server/routes.ts:1046 |
| GET | /api/analysis/list | none-explicit | server/routes.ts:1061 |
| GET | /api/analysis/daily-sales | none-explicit | server/routes.ts:1092 |
| GET | /api/analysis/daily-sales/export.csv | none-explicit | server/routes.ts:1170 |
| GET | /online-ordering/* | none-explicit | server/routes.ts:1215 |
| GET | /api/analysis/receipts-summary | none-explicit | server/routes.ts:1246 |
| POST | /api/analysis/receipts-truth/rebuild | none-explicit | server/routes.ts:1263 |
| GET | /api/analysis/receipts-truth | none-explicit | server/routes.ts:1288 |
| GET | /api/analysis/receipts-truth/lines | none-explicit | server/routes.ts:1306 |
| GET | /api/analysis/receipts-truth/modifiers | none-explicit | server/routes.ts:1325 |
| POST | /api/analysis/receipts-truth/ingredients/rebuild | none-explicit | server/routes.ts:1371 |
| GET | /api/analysis/receipts-truth/ingredients | none-explicit | server/routes.ts:1385 |
| GET | /api/analysis/ingredients-truth | none-explicit | server/routes.ts:1406 |
| POST | /api/analysis/receipts-truth/aggregates/rebuild | none-explicit | server/routes.ts:1494 |
| GET | /api/analysis/receipts-truth/aggregates | none-explicit | server/routes.ts:1508 |
| GET | /api/analysis/receipts-truth/category-mappings | none-explicit | server/routes.ts:1528 |
| POST | /api/analysis/receipts-truth/category-mappings | none-explicit | server/routes.ts:1538 |
| POST | /api/analysis/receipts-truth/modifiers-effective/rebuild | none-explicit | server/routes.ts:1556 |
| GET | /api/analysis/receipts-truth/modifiers-effective | none-explicit | server/routes.ts:1571 |
| POST | /api/analysis/receipts-truth/daily-usage/rebuild | none-explicit | server/routes.ts:1586 |
| GET | /api/analysis/receipts-truth/daily-usage | none-explicit | server/routes.ts:1601 |
| GET | /api/analysis/build-status | none-explicit | server/routes.ts:1651 |
| POST | /api/analysis/ingredient-usage/rebuild | none-explicit | server/routes.ts:1667 |
| GET | /api/analysis/ingredient-usage | none-explicit | server/routes.ts:1681 |
| GET | /api/analysis/modifier-rules | none-explicit | server/routes.ts:1702 |
| POST | /api/analysis/modifier-rules | none-explicit | server/routes.ts:1717 |
| GET | /api/analysis/:date | none-explicit | server/routes.ts:1739 |
| GET | /api/analysis/snapshot/:id | none-explicit | server/routes.ts:1745 |
| GET | /api/analysis/search | none-explicit | server/routes.ts:1761 |
| GET | /api/analysis/latest | none-explicit | server/routes.ts:1795 |
| GET | /api/analysis/:id | none-explicit | server/routes.ts:1830 |
| POST | /api/expensesV2/legacy | none-explicit | server/routes.ts:1860 |
| GET | /api/expensesV2 | none-explicit | server/routes.ts:1925 |
| GET | /api/ingredients/search | none-explicit | server/routes.ts:1966 |
| GET | /api/reports/sales-summary | none-explicit | server/routes.ts:1999 |
| GET | /api/reports/financial-overview | none-explicit | server/routes.ts:2044 |
| GET | /api/reports/performance-metrics | none-explicit | server/routes.ts:2089 |
| POST | /api/sync-supplier-csv | none-explicit | server/routes.ts:2139 |
| GET | /api/ingredients/by-category | none-explicit | server/routes.ts:2173 |
| POST | /api/daily-shift-forms | none-explicit | server/routes.ts:2211 |
| POST | /api/daily-stock-sales/draft | none-explicit | server/routes.ts:2266 |
| POST | /api/daily-shift-forms | none-explicit | server/routes.ts:2294 |
| GET | /api/daily-stock-sales | none-explicit | server/routes.ts:2320 |
| DELETE | /api/daily-stock-sales/:id/soft | none-explicit | server/routes.ts:2332 |
| GET | /api/daily-stock-sales/archived | none-explicit | server/routes.ts:2356 |
| POST | /api/daily-stock-sales/:id/restore | none-explicit | server/routes.ts:2368 |
| POST | /api/daily-stock-sales | none-explicit | server/routes.ts:2385 |
| POST | /api/lodge-stock | none-explicit | server/routes.ts:2454 |
| GET | /api/daily-stock-sales/search | none-explicit | server/routes.ts:2474 |
| DELETE | /api/daily-stock-sales/:id/soft | none-explicit | server/routes.ts:2493 |
| GET | /api/shopping-lists | none-explicit | server/routes.ts:2509 |
| GET | /api/food-costings | none-explicit | server/routes.ts:2520 |
| POST | /submit-form | none-explicit | server/routes.ts:2532 |
| GET | /api/expensesV2 | none-explicit | server/routes.ts:2585 |
| GET | /api/system/status | none-explicit | server/routes.ts:2663 |
| POST | /api/expensesV2 | none-explicit | server/routes.ts:2698 |
| POST | /api/expensesV2/upload | none-explicit | server/routes.ts:2740 |
| POST | /api/expensesV2/approve | none-explicit | server/routes.ts:2806 |
| POST | /api/expensesV2/stock | none-explicit | server/routes.ts:2850 |
| GET | /api/analysis/stock-review/purchase-history | none-explicit | server/routes.ts:2980 |
| PUT | /api/expensesV2/stock/:id | none-explicit | server/routes.ts:3100 |
| PUT | /api/expensesV2/:id | none-explicit | server/routes.ts:3195 |
| DELETE | /api/expensesV2/:id | none-explicit | server/routes.ts:3224 |
| GET | /api/expensesV2/month-to-date | none-explicit | server/routes.ts:3240 |
| GET | /api/expensesV2/by-category | none-explicit | server/routes.ts:3251 |
| GET | /api/expensesV2/totals | none-explicit | server/routes.ts:3262 |
| GET | /api/expense-suppliers | none-explicit | server/routes.ts:3398 |
| POST | /api/expense-suppliers | none-explicit | server/routes.ts:3409 |
| GET | /api/expense-categories | none-explicit | server/routes.ts:3420 |
| POST | /api/expense-categories | none-explicit | server/routes.ts:3431 |
| GET | /api/bank-statements | none-explicit | server/routes.ts:3442 |
| POST | /api/bank-statements | none-explicit | server/routes.ts:3453 |
| GET | /api/ingredients/by-category | none-explicit | server/routes.ts:3466 |
| GET | /api/ingredients | none-explicit | server/routes.ts:3493 |
| GET | /api/ingredients/print | none-explicit | server/routes.ts:3527 |
| GET | /api/ingredients/print | none-explicit | server/routes.ts:3606 |
| PUT | /api/ingredients/:id | none-explicit | server/routes.ts:3685 |
| POST | /api/ingredients/sync-csv | none-explicit | server/routes.ts:3752 |
| POST | /api/daily-sales | none-explicit | server/routes.ts:3767 |
| POST | /api/daily-stock | none-explicit | server/routes.ts:3891 |
| GET | /api/daily-stock | none-explicit | server/routes.ts:3949 |
| GET | /api/forms | none-explicit | server/routes.ts:3969 |
| GET | /api/forms/:id | none-explicit | server/routes.ts:3970 |
| POST | /api/forms/:id/email | none-explicit | server/routes.ts:3971 |
| GET | /api/items | none-explicit | server/routes.ts:4035 |
| GET | /api/admin/menu-canonical/status | none-explicit | server/routes.ts:4051 |
| POST | /api/admin/menu-canonical/load | none-explicit | server/routes.ts:4061 |
| GET | /api/admin/menu-canonical/drift | none-explicit | server/routes.ts:4075 |
| GET | /api/pos/sync-status | none-explicit | server/routes.ts:4100 |
| POST | /api/pos/sync | none-explicit | server/routes.ts:4131 |
| GET | /api/analytics/latest | none-explicit | server/routes.ts:4165 |
| POST | /api/analytics/process | none-explicit | server/routes.ts:4193 |
| GET | /api/jussi/status | none-explicit | server/routes.ts:4222 |
| POST | /api/jussi/generate | none-explicit | server/routes.ts:4257 |
| GET | /api/jussi/latest | none-explicit | server/routes.ts:4268 |
| GET | /api/receipts/recent | none-explicit | server/routes.ts:4282 |
| POST | /api/recipes | none-explicit | server/routes.ts:4320 |
| POST | /api/recipes/save-with-photo | none-explicit | server/routes.ts:4325 |
| GET | /api/recipes/:id | none-explicit | server/routes.ts:4347 |
| PUT | /api/recipes/:id | none-explicit | server/routes.ts:4364 |
| GET | /api/ingredients | none-explicit | server/routes.ts:4384 |
| POST | /api/ingredients | none-explicit | server/routes.ts:4393 |
| GET | /api/items/:id/waste-history | none-explicit | server/routes.ts:4402 |
| GET | /api/suppliers/makro/prices | none-explicit | server/routes.ts:4452 |
| GET | /api/library/daily-sales | none-explicit | server/routes.ts:4478 |
| POST | /api/ingredients/upload | none-explicit | server/routes.ts:4484 |
| POST | /api/shopping-list/regenerate | none-explicit | server/routes.ts:4493 |
| GET | /api/shopping-list/:date? | none-explicit | server/routes.ts:4594 |
| GET | /api/shopping-list/:id/estimate | none-explicit | server/routes.ts:4726 |
| GET | /api/shopping-list/:id | none-explicit | server/routes.ts:4739 |
| POST | /api/ops/jussi/compare-shift | none-explicit | server/routes.ts:4750 |
| POST | /api/acc/jane/reconcile-day | none-explicit | server/routes.ts:4754 |
| GET | /api/operations/variance | none-explicit | server/routes.ts:4762 |
| POST | /api/ai/recipe-description | none-explicit | server/routes.ts:4814 |
| POST | /api/menu/publish | none-explicit | server/routes.ts:4863 |
| GET | /api/forms/library | none-explicit | server/routes.ts:4909 |
| POST | /api/forms/daily-sales/v3 | none-explicit | server/routes.ts:4949 |
| POST | /api/dev/daily-sales-v2/:id/repair-merge | none-explicit | server/routes.ts:4983 |
| GET | /api/daily-sales-v2/latest-proof | none-explicit | server/routes.ts:5030 |
| POST | /api/ingredients/upload-csv | none-explicit | server/routes.ts:5037 |
| GET | /api/ingredients/shopping-list/:date | none-explicit | server/routes.ts:5038 |
| GET | /api/manager-checklist/questions | none-explicit | server/routes.ts:5044 |
| POST | /api/manager-checklist/questions | none-explicit | server/routes.ts:5049 |
| DELETE | /api/manager-checklist/questions/:id | none-explicit | server/routes.ts:5054 |
| GET | /api/manager-checklist/nightly | none-explicit | server/routes.ts:5060 |
| GET | /api/manager-checklist/status | none-explicit | server/routes.ts:5068 |
| POST | /api/manager-checklist/submit | none-explicit | server/routes.ts:5080 |
| POST | /api/manager-checklist/seed | none-explicit | server/routes.ts:5108 |
| POST | /api/upload/image | none-explicit | server/routes.ts:5138 |
| GET | /api/snapshots | none-explicit | server/routes.ts:5151 |
| GET | /api/snapshots/:id | none-explicit | server/routes.ts:5192 |
| GET | /api/jussi/latest-comparison | none-explicit | server/routes.ts:5221 |
| GET | /api/snapshots/:id/items | none-explicit | server/routes.ts:5260 |
| GET | /api/dashboard/latest | none-explicit | server/routes.ts:5295 |
| POST | /api/snapshots/create | none-explicit | server/routes.ts:5317 |
| GET | /api/snapshots/:id/comparison | none-explicit | server/routes.ts:5366 |
| POST | /api/snapshots/:id/recompute | none-explicit | server/routes.ts:5444 |
| POST | /api/shift-sales | none-explicit | server/routes.ts:5504 |
| GET | /api/shift-sales/:id | none-explicit | server/routes.ts:5514 |
| GET | /api/shift-sales/date/:date | none-explicit | server/routes.ts:5528 |
| PATCH | /api/shift-sales/:id/status | none-explicit | server/routes.ts:5539 |
| GET | /api/operations/stats | none-explicit | server/routes.ts:5557 |
| GET | /api/download/architecture-report | none-explicit | server/routes.ts:5650 |
| GET | /api/download/ground-zero-schema | none-explicit | server/routes.ts:5661 |
| GET | /api/shift-reports/balance-review | none-explicit | server/routes.ts:5681 |
| GET | / | none-explicit | server/routes/admin/ingredientAuthority.ts:14 |
| GET | /review-queue | none-explicit | server/routes/admin/ingredientAuthority.ts:31 |
| POST | / | none-explicit | server/routes/admin/ingredientAuthority.ts:64 |
| PUT | /:id | none-explicit | server/routes/admin/ingredientAuthority.ts:156 |
| GET | /:id/versions | none-explicit | server/routes/admin/ingredientAuthority.ts:244 |
| GET | /:id | none-explicit | server/routes/admin/ingredientAuthority.ts:266 |
| PATCH | /:id/deactivate | none-explicit | server/routes/admin/ingredientAuthority.ts:295 |
| POST | /run | none-explicit | server/routes/adminBackup.ts:10 |
| GET | /status | none-explicit | server/routes/adminBackup.ts:44 |
| POST | /import | none-explicit | server/routes/adminHistoricalImport.ts:10 |
| GET | /status | none-explicit | server/routes/adminHistoricalImport.ts:44 |
| GET | /api/admin/menu | none-explicit | server/routes/adminMenu.ts:12 |
| POST | /api/admin/menu/category | none-explicit | server/routes/adminMenu.ts:41 |
| PUT | /api/admin/menu/category/:id | none-explicit | server/routes/adminMenu.ts:62 |
| DELETE | /api/admin/menu/category/:id | none-explicit | server/routes/adminMenu.ts:79 |
| POST | /api/admin/menu/item | none-explicit | server/routes/adminMenu.ts:93 |
| PUT | /api/admin/menu/item/:id | none-explicit | server/routes/adminMenu.ts:144 |
| DELETE | /api/admin/menu/item/:id | none-explicit | server/routes/adminMenu.ts:201 |
| GET | /admin/sync-loyverse | none-explicit | server/routes/adminSync.ts:8 |
| GET | /bob/health | none-explicit | server/routes/aiOpsControl.ts:1376 |
| GET | /bob/manifest | none-explicit | server/routes/aiOpsControl.ts:1383 |
| GET | /bob/proxy-read | none-explicit | server/routes/aiOpsControl.ts:2434 |
| GET | /bob/file-read | none-explicit | server/routes/aiOpsControl.ts:2564 |
| GET | /bob/file-list | none-explicit | server/routes/aiOpsControl.ts:2610 |
| POST | /bob/analysis | middleware-present | server/routes/aiOpsControl.ts:2713 |
| POST | /bob/adjustments | none-explicit | server/routes/aiOpsControl.ts:2739 |
| GET | /bob/adjustments/:date | none-explicit | server/routes/aiOpsControl.ts:2761 |
| PATCH | /bob/adjustments/:id/review | middleware-present | server/routes/aiOpsControl.ts:2785 |
| POST | /bob/email/trigger | none-explicit | server/routes/aiOpsControl.ts:2811 |
| GET | /bob/analysis-csv/:date | none-explicit | server/routes/aiOpsControl.ts:2919 |
| POST | /bob/run-analysis | none-explicit | server/routes/aiOpsControl.ts:2986 |
| GET | /bob/analysis/:date | none-explicit | server/routes/aiOpsControl.ts:3130 |
| GET | /bob/charter | none-explicit | server/routes/aiOpsControl.ts:3150 |
| GET | /process-registry | none-explicit | server/routes/aiOpsControl.ts:3174 |
| GET | /process-registry/:key | none-explicit | server/routes/aiOpsControl.ts:3188 |
| POST | /process-registry/:key | none-explicit | server/routes/aiOpsControl.ts:3204 |
| GET | /bob/onboarding-context | none-explicit | server/routes/aiOpsControl.ts:3241 |
| GET | /agents | none-explicit | server/routes/aiOpsControl.ts:3343 |
| PUT | /agents/:agent/state | none-explicit | server/routes/aiOpsControl.ts:3384 |
| GET | /chat/threads | none-explicit | server/routes/aiOpsControl.ts:3409 |
| POST | /chat/threads | none-explicit | server/routes/aiOpsControl.ts:3420 |
| GET | /chat/threads/:id/messages | none-explicit | server/routes/aiOpsControl.ts:3435 |
| DELETE | /chat/threads/:id | none-explicit | server/routes/aiOpsControl.ts:3453 |
| POST | /chat/threads/:id/messages | none-explicit | server/routes/aiOpsControl.ts:3467 |
| GET | /tasks | none-explicit | server/routes/aiOpsControl.ts:3542 |
| POST | /tasks | none-explicit | server/routes/aiOpsControl.ts:3645 |
| PUT | /tasks/:id | none-explicit | server/routes/aiOpsControl.ts:3696 |
| PUT | /tasks/:id/status | none-explicit | server/routes/aiOpsControl.ts:3779 |
| GET | /tasks/:id | none-explicit | server/routes/aiOpsControl.ts:3819 |
| POST | /tasks/:id/messages | none-explicit | server/routes/aiOpsControl.ts:3850 |
| POST | /tasks/:id/review-request | none-explicit | server/routes/aiOpsControl.ts:3886 |
| POST | /tasks/:id/review-decision | none-explicit | server/routes/aiOpsControl.ts:3932 |
| POST | /tasks/:id/archive | none-explicit | server/routes/aiOpsControl.ts:4003 |
| POST | /tasks/:id/restore | none-explicit | server/routes/aiOpsControl.ts:4032 |
| POST | /tasks/:id/submit | none-explicit | server/routes/aiOpsControl.ts:4063 |
| GET | /tasks/:id/activity | none-explicit | server/routes/aiOpsControl.ts:4101 |
| GET | /monitors | none-explicit | server/routes/aiOpsControl.ts:4113 |
| POST | /monitors/run | none-explicit | server/routes/aiOpsControl.ts:4130 |
| GET | /shift-rebuild-log | none-explicit | server/routes/aiOpsControl.ts:4147 |
| POST | /shift-rebuild-log/trigger | none-explicit | server/routes/aiOpsControl.ts:4166 |
| GET | /issues | none-explicit | server/routes/aiOpsControl.ts:4179 |
| POST | /issues | none-explicit | server/routes/aiOpsControl.ts:4222 |
| GET | /issues/:id | none-explicit | server/routes/aiOpsControl.ts:4252 |
| PUT | /issues/:id | none-explicit | server/routes/aiOpsControl.ts:4287 |
| PUT | /issues/:id/status | none-explicit | server/routes/aiOpsControl.ts:4336 |
| POST | /issues/:id/plan | none-explicit | server/routes/aiOpsControl.ts:4395 |
| POST | /issues/:id/approve | none-explicit | server/routes/aiOpsControl.ts:4450 |
| POST | /issues/:id/reject | none-explicit | server/routes/aiOpsControl.ts:4500 |
| POST | /issues/:id/assign | none-explicit | server/routes/aiOpsControl.ts:4548 |
| POST | /issues/:id/complete | none-explicit | server/routes/aiOpsControl.ts:4597 |
| POST | /issues/:id/close | none-explicit | server/routes/aiOpsControl.ts:4647 |
| POST | /issues/:id/comments | none-explicit | server/routes/aiOpsControl.ts:4697 |
| GET | /ideas | none-explicit | server/routes/aiOpsControl.ts:4733 |
| POST | /ideas | none-explicit | server/routes/aiOpsControl.ts:4768 |
| GET | /ideas/:id | none-explicit | server/routes/aiOpsControl.ts:4798 |
| PUT | /ideas/:id/status | none-explicit | server/routes/aiOpsControl.ts:4823 |
| POST | /ideas/:id/convert-to-issue | none-explicit | server/routes/aiOpsControl.ts:4861 |
| POST | /ideas/:id/convert-to-task | none-explicit | server/routes/aiOpsControl.ts:4911 |
| GET | / | none-explicit | server/routes/analysisDailySales.ts:27 |
| GET | /export.csv | none-explicit | server/routes/analysisDailySales.ts:102 |
| POST | /upload | none-explicit | server/routes/analysisShift.ts:16 |
| GET | /latest | none-explicit | server/routes/analytics.ts:9 |
| GET | /window | none-explicit | server/routes/analytics.ts:52 |
| GET | /daily | none-explicit | server/routes/analytics/ingredientUsageRoutes.ts:6 |
| GET | /top | none-explicit | server/routes/analytics/ingredientUsageRoutes.ts:14 |
| POST | /register | none-explicit | server/routes/auth/authRoutes.ts:6 |
| POST | /login | none-explicit | server/routes/auth/authRoutes.ts:24 |
| GET | /pos | none-explicit | server/routes/balance.ts:7 |
| GET | /forms | none-explicit | server/routes/balance.ts:17 |
| GET | /combined | none-explicit | server/routes/balance.ts:27 |
| POST | / | none-explicit | server/routes/bankImport.ts:169 |
| GET | /:batchId/txns | none-explicit | server/routes/bankImport.ts:266 |
| POST | /:batchId/approve | none-explicit | server/routes/bankImport.ts:354 |
| PATCH | /txns/:id | none-explicit | server/routes/bankImport.ts:410 |
| DELETE | /txns/:id | none-explicit | server/routes/bankImport.ts:436 |
| POST | /rules | none-explicit | server/routes/bankImport.ts:467 |
| GET | /rules | none-explicit | server/routes/bankImport.ts:487 |
| GET | /health | none-explicit | server/routes/bobRead.ts:164 |
| GET | /system-health | none-explicit | server/routes/bobRead.ts:179 |
| GET | /system-map | none-explicit | server/routes/bobRead.ts:210 |
| GET | /build-status | none-explicit | server/routes/bobRead.ts:235 |
| GET | /forms/daily-sales | none-explicit | server/routes/bobRead.ts:286 |
| GET | /forms/daily-stock | none-explicit | server/routes/bobRead.ts:304 |
| GET | /receipts/truth | none-explicit | server/routes/bobRead.ts:328 |
| GET | /usage/truth | none-explicit | server/routes/bobRead.ts:377 |
| GET | /issues | none-explicit | server/routes/bobRead.ts:434 |
| GET | /catalog | none-explicit | server/routes/bobRead.ts:474 |
| GET | /orders | none-explicit | server/routes/bobRead.ts:507 |
| GET | /roll-order | none-explicit | server/routes/bobRead.ts:554 |
| GET | /module-status | none-explicit | server/routes/bobRead.ts:573 |
| GET | /shift-snapshot | none-explicit | server/routes/bobRead.ts:625 |
| GET | /reports/item-sales | none-explicit | server/routes/bobRead.ts:681 |
| GET | /reports/modifier-sales | none-explicit | server/routes/bobRead.ts:703 |
| GET | /reports/category-totals | none-explicit | server/routes/bobRead.ts:725 |
| GET | /analysis/stock-usage | none-explicit | server/routes/bobRead.ts:744 |
| GET | /random | none-explicit | server/routes/checklists.ts:10 |
| POST | /complete | none-explicit | server/routes/checklists.ts:46 |
| GET | /history | none-explicit | server/routes/checklists.ts:112 |
| POST | /chat | none-explicit | server/routes/chef.ts:15 |
| POST | /describe | none-explicit | server/routes/chef.ts:31 |
| GET | /api/ingredients/master | none-explicit | server/routes/dashboard4Routes.ts:15 |
| POST | /api/ingredients/:id/toggle-verified | none-explicit | server/routes/dashboard4Routes.ts:46 |
| POST | /api/ingredients/:id/toggle-locked | none-explicit | server/routes/dashboard4Routes.ts:56 |
| GET | /api/purchases/summary | none-explicit | server/routes/dashboard4Routes.ts:66 |
| GET | /api/data-confidence | none-explicit | server/routes/dashboard4Routes.ts:127 |
| POST | /api/power-tools/backup | none-explicit | server/routes/dashboard4Routes.ts:149 |
| GET | /api/power-tools/backup/status | none-explicit | server/routes/dashboard4Routes.ts:169 |
| POST | /api/power-tools/historical-import | none-explicit | server/routes/dashboard4Routes.ts:179 |
| GET | /api/power-tools/historical-import/stats | none-explicit | server/routes/dashboard4Routes.ts:199 |
| GET | /purchasing-parity | middleware-present | server/routes/debugPurchasing.ts:12 |
| GET | /ingredient-parity | middleware-present | server/routes/debugPurchasing.ts:57 |
| GET | /ingredient-usage-summary | none-explicit | server/routes/debugPurchasing.ts:84 |
| POST | /derive-ingredient-usage | none-explicit | server/routes/debugPurchasing.ts:107 |
| POST | /create | none-explicit | server/routes/delivery/deliveryRoutes.ts:9 |
| POST | /assign | none-explicit | server/routes/delivery/deliveryRoutes.ts:21 |
| POST | /update-status | none-explicit | server/routes/delivery/deliveryRoutes.ts:33 |
| GET | /active | none-explicit | server/routes/delivery/deliveryRoutes.ts:45 |
| GET | /history | none-explicit | server/routes/delivery/deliveryRoutes.ts:55 |
| POST | /drivers/add | none-explicit | server/routes/delivery/deliveryRoutes.ts:65 |
| POST | /drivers/status | none-explicit | server/routes/delivery/deliveryRoutes.ts:75 |
| GET | /drivers | none-explicit | server/routes/delivery/deliveryRoutes.ts:85 |
| GET | / | none-explicit | server/routes/executiveMetrics.ts:26 |
| GET | /purchasing-demand | none-explicit | server/routes/executiveMetrics.ts:107 |
| POST | /upload-bank | none-explicit | server/routes/expenses-import.ts:294 |
| POST | /upload-partner | none-explicit | server/routes/expenses-import.ts:375 |
| GET | /pending | none-explicit | server/routes/expenses-import.ts:452 |
| PATCH | /:id/approve | none-explicit | server/routes/expenses-import.ts:484 |
| PATCH | /:id/reject | none-explicit | server/routes/expenses-import.ts:616 |
| PATCH | /batch-approve | none-explicit | server/routes/expenses-import.ts:654 |
| PATCH | /batch-reject | none-explicit | server/routes/expenses-import.ts:803 |
| GET | /defaults | none-explicit | server/routes/expenses-import.ts:843 |
| GET | /defaults/:supplier | none-explicit | server/routes/expenses-import.ts:862 |
| POST | /defaults | none-explicit | server/routes/expenses-import.ts:888 |
| POST | /create | none-explicit | server/routes/expensesV2Routes.ts:10 |
| GET | /all | none-explicit | server/routes/expensesV2Routes.ts:82 |
| GET | /summary | none-explicit | server/routes/expensesV2Routes.ts:100 |
| GET | /daily-sales-v2 | none-explicit | server/routes/exportRoutes.ts:20 |
| GET | /daily-stock-v2 | none-explicit | server/routes/exportRoutes.ts:31 |
| GET | /pos/shift-reports | none-explicit | server/routes/exportRoutes.ts:43 |
| GET | /pos/receipts | none-explicit | server/routes/exportRoutes.ts:54 |
| GET | /expenses | none-explicit | server/routes/exportRoutes.ts:69 |
| GET | /summary | none-explicit | server/routes/finance.ts:9 |
| GET | /summary/today | none-explicit | server/routes/finance.ts:30 |
| GET | / | none-explicit | server/routes/forms.ts:14 |
| GET | /library | none-explicit | server/routes/forms.ts:37 |
| GET | /:id | none-explicit | server/routes/forms.ts:88 |
| POST | /daily-sales | none-explicit | server/routes/forms.ts:113 |
| POST | /daily-stock | none-explicit | server/routes/forms.ts:118 |
| POST | /daily-sales-v2 | none-explicit | server/routes/forms.ts:320 |
| PUT | /:id | none-explicit | server/routes/forms.ts:423 |
| POST | /:id/stock | none-explicit | server/routes/forms.ts:521 |
| POST | /:id/complete | none-explicit | server/routes/forms.ts:567 |
| POST | /backup | none-explicit | server/routes/github.ts:6 |
| GET | /health | none-explicit | server/routes/health.ts:6 |
| POST | / | none-explicit | server/routes/healthSafety/audits.ts:6 |
| GET | / | none-explicit | server/routes/healthSafety/audits.ts:42 |
| GET | /:id | none-explicit | server/routes/healthSafety/pdf.ts:6 |
| GET | / | none-explicit | server/routes/healthSafety/questions.ts:14 |
| GET | /all | none-explicit | server/routes/healthSafety/questions.ts:22 |
| POST | / | none-explicit | server/routes/healthSafety/questions.ts:29 |
| PUT | /:id | none-explicit | server/routes/healthSafety/questions.ts:44 |
| DELETE | /:id | none-explicit | server/routes/healthSafety/questions.ts:56 |
| POST | /upload/menu-item-image | none-explicit | server/routes/imageUpload.ts:59 |
| DELETE | /upload/menu-item-image | none-explicit | server/routes/imageUpload.ts:85 |
| GET | / | none-explicit | server/routes/ingredientAuthority.ts:72 |
| GET | /:id | none-explicit | server/routes/ingredientAuthority.ts:92 |
| POST | / | none-explicit | server/routes/ingredientAuthority.ts:118 |
| PUT | /:id | none-explicit | server/routes/ingredientAuthority.ts:163 |
| GET | / | none-explicit | server/routes/ingredientMaster.ts:27 |
| PUT | /:id | none-explicit | server/routes/ingredientMaster.ts:77 |
| GET | / | none-explicit | server/routes/ingredientReconciliation.ts:15 |
| POST | /rebuild | none-explicit | server/routes/ingredientReconciliation.ts:33 |
| GET | /export.csv | none-explicit | server/routes/ingredientReconciliation.ts:53 |
| GET | /ingredients | none-explicit | server/routes/ingredientReconciliation.ts:86 |
| GET | / | none-explicit | server/routes/ingredients-legacy.ts:7 |
| GET | / | none-explicit | server/routes/ingredients.ts:109 |
| POST | /suggest | none-explicit | server/routes/ingredients.ts:185 |
| GET | /canonical | none-explicit | server/routes/ingredients.ts:236 |
| POST | /sync/:purchasingItemId | none-explicit | server/routes/ingredients.ts:269 |
| POST | /sync-all | none-explicit | server/routes/ingredients.ts:293 |
| GET | /management | none-explicit | server/routes/ingredients.ts:313 |
| PUT | /:id | none-explicit | server/routes/ingredients.ts:452 |
| GET | /:reportId/live | none-explicit | server/routes/insightsV2.ts:18 |
| GET | /item-sales | none-explicit | server/routes/internalReports.ts:42 |
| GET | /modifier-sales | none-explicit | server/routes/internalReports.ts:96 |
| GET | /category-totals | none-explicit | server/routes/internalReports.ts:139 |
| GET | / | none-explicit | server/routes/issueRegister.ts:108 |
| GET | /by-shift/:date | none-explicit | server/routes/issueRegister.ts:182 |
| GET | /:id | none-explicit | server/routes/issueRegister.ts:212 |
| POST | / | none-explicit | server/routes/issueRegister.ts:234 |
| PATCH | /:id | none-explicit | server/routes/issueRegister.ts:277 |
| POST | /auto-create | none-explicit | server/routes/issueRegister.ts:343 |
| GET | /active | none-explicit | server/routes/kds/kdsRoutes.ts:9 |
| POST | /update-status | none-explicit | server/routes/kds/kdsRoutes.ts:20 |
| GET | /history | none-explicit | server/routes/kds/kdsRoutes.ts:32 |
| GET | /expenses | none-explicit | server/routes/legacyBridge.ts:15 |
| GET | /daily-sales | none-explicit | server/routes/legacyBridge.ts:51 |
| GET | /shopping-list | none-explicit | server/routes/legacyBridge.ts:98 |
| GET | /ingredients | none-explicit | server/routes/legacyBridge.ts:144 |
| GET | /recipes | none-explicit | server/routes/legacyBridge.ts:168 |
| GET | /suppliers | none-explicit | server/routes/legacyBridge.ts:191 |
| GET | /menu-items | none-explicit | server/routes/legacyBridge.ts:214 |
| GET | /partners | none-explicit | server/routes/legacyBridge.ts:258 |
| GET | /status | none-explicit | server/routes/legacyBridge.ts:291 |
| POST | /send | none-explicit | server/routes/lineNotify.ts:8 |
| GET | /enhanced/test-connection | none-explicit | server/routes/loyverseEnhanced.ts:12 |
| POST | /enhanced/manual-sync | none-explicit | server/routes/loyverseEnhanced.ts:26 |
| POST | /enhanced/process-shift | none-explicit | server/routes/loyverseEnhanced.ts:40 |
| GET | /enhanced/status | none-explicit | server/routes/loyverseEnhanced.ts:71 |
| GET | /enhanced/history | none-explicit | server/routes/loyverseEnhanced.ts:83 |
| POST | /enhanced/schedule/start | none-explicit | server/routes/loyverseEnhanced.ts:96 |
| POST | /enhanced/schedule/stop | none-explicit | server/routes/loyverseEnhanced.ts:113 |
| GET | /enhanced/validation-stats | none-explicit | server/routes/loyverseEnhanced.ts:129 |
| POST | /enhanced/validation-stats/reset | none-explicit | server/routes/loyverseEnhanced.ts:141 |
| GET | /enhanced/analysis/:shiftDate | none-explicit | server/routes/loyverseEnhanced.ts:157 |
| GET | /enhanced/ingredient-usage/:shiftDate | none-explicit | server/routes/loyverseEnhanced.ts:203 |
| GET | /enhanced/anomalies/:shiftDate | none-explicit | server/routes/loyverseEnhanced.ts:262 |
| GET | /enhanced/staff-comparison/:shiftDate | none-explicit | server/routes/loyverseEnhanced.ts:311 |
| GET | /enhanced/health | none-explicit | server/routes/loyverseEnhanced.ts:360 |
| GET | /all | none-explicit | server/routes/loyverseMapRoutes.ts:8 |
| POST | /save | none-explicit | server/routes/loyverseMapRoutes.ts:15 |
| POST | /loyverse/menu | none-explicit | server/routes/loyverseMenuImport.ts:401 |
| GET | /loyverse/menu/status | none-explicit | server/routes/loyverseMenuImport.ts:445 |
| GET | /shift-report | none-explicit | server/routes/loyverseShiftReport.ts:14 |
| POST | /sync | none-explicit | server/routes/loyverseSync.ts:8 |
| POST | /loyverse/sync | none-explicit | server/routes/loyverseV2.ts:7 |
| GET | /questions | none-explicit | server/routes/managerChecks.ts:26 |
| POST | /submit | none-explicit | server/routes/managerChecks.ts:62 |
| GET | /admin/questions | none-explicit | server/routes/managerChecks.ts:89 |
| POST | /register | none-explicit | server/routes/membership.ts:15 |
| POST | /:id/spend | none-explicit | server/routes/membership.ts:54 |
| GET | / | none-explicit | server/routes/membership.ts:72 |
| GET | /categories | none-explicit | server/routes/menu/menuV3Routes.ts:18 |
| POST | /categories/create | none-explicit | server/routes/menu/menuV3Routes.ts:22 |
| POST | /categories/update | none-explicit | server/routes/menu/menuV3Routes.ts:26 |
| POST | /categories/reorder | none-explicit | server/routes/menu/menuV3Routes.ts:30 |
| GET | /items | none-explicit | server/routes/menu/menuV3Routes.ts:36 |
| POST | /items/create | none-explicit | server/routes/menu/menuV3Routes.ts:40 |
| POST | /items/update | none-explicit | server/routes/menu/menuV3Routes.ts:44 |
| POST | /items/toggle | none-explicit | server/routes/menu/menuV3Routes.ts:48 |
| GET | /modifiers/groups | none-explicit | server/routes/menu/menuV3Routes.ts:53 |
| POST | /modifiers/groups/create | none-explicit | server/routes/menu/menuV3Routes.ts:57 |
| POST | /modifiers/create | none-explicit | server/routes/menu/menuV3Routes.ts:61 |
| POST | /modifiers/apply | none-explicit | server/routes/menu/menuV3Routes.ts:65 |
| GET | /recipes/:itemId | none-explicit | server/routes/menu/menuV3Routes.ts:70 |
| POST | /recipes/set | none-explicit | server/routes/menu/menuV3Routes.ts:74 |
| GET | /menu | none-explicit | server/routes/menuOnline.ts:10 |
| GET | /menu-online | none-explicit | server/routes/menuOnline.ts:24 |
| PATCH | /menu-online/item/:id | none-explicit | server/routes/menuOnline.ts:44 |
| GET | /categories | none-explicit | server/routes/menuOrderingRoutes.ts:6 |
| GET | /items/:categoryId | none-explicit | server/routes/menuOrderingRoutes.ts:19 |
| GET | /full | none-explicit | server/routes/menuOrderingRoutes.ts:43 |
| GET | /menu-item/:menuItemId | none-explicit | server/routes/modifiers.ts:9 |
| POST | /groups | none-explicit | server/routes/modifiers.ts:46 |
| PATCH | /groups/:id | none-explicit | server/routes/modifiers.ts:69 |
| DELETE | /groups/:id | none-explicit | server/routes/modifiers.ts:93 |
| POST | /modifiers | none-explicit | server/routes/modifiers.ts:104 |
| PATCH | /modifiers/:id | none-explicit | server/routes/modifiers.ts:125 |
| DELETE | /modifiers/:id | none-explicit | server/routes/modifiers.ts:147 |
| POST | /ingredients | none-explicit | server/routes/modifiers.ts:158 |
| DELETE | /ingredients/:id | none-explicit | server/routes/modifiers.ts:192 |
| GET | /online/catalog | none-explicit | server/routes/onlineCatalog.ts:6 |
| GET | /online/catalog/:id/options | none-explicit | server/routes/onlineCatalog.ts:43 |
| GET | /api/menu | none-explicit | server/routes/onlineMenu.ts:6 |
| POST | /online/products/upsert-from-recipe | none-explicit | server/routes/onlineOrderingV2.ts:65 |
| POST | /online/products/unpublish-from-recipe | none-explicit | server/routes/onlineOrderingV2.ts:148 |
| GET | /online/products | none-explicit | server/routes/onlineOrderingV2.ts:205 |
| GET | /online/products/catalog | none-explicit | server/routes/onlineOrderingV2.ts:247 |
| PATCH | /online/products/:id | none-explicit | server/routes/onlineOrderingV2.ts:274 |
| POST | /online/orders | none-explicit | server/routes/onlineOrderingV2.ts:357 |
| GET | /online/orders | none-explicit | server/routes/onlineOrderingV2.ts:526 |
| PATCH | /online/orders/:id/status | none-explicit | server/routes/onlineOrderingV2.ts:565 |
| GET | /ordering/menu | none-explicit | server/routes/onlineOrderingV2.ts:587 |
| POST | /ordering/orders | none-explicit | server/routes/onlineOrderingV2.ts:619 |
| GET | /ordering/orders | none-explicit | server/routes/onlineOrderingV2.ts:624 |
| GET | /api/orders/today | none-explicit | server/routes/onlineOrders.ts:18 |
| POST | /api/order | none-explicit | server/routes/onlineOrders.ts:39 |
| GET | /api/orders | none-explicit | server/routes/onlineOrders.ts:84 |
| GET | /api/order/:ref | none-explicit | server/routes/onlineOrders.ts:101 |
| PUT | /api/order/:id/status | none-explicit | server/routes/onlineOrders.ts:122 |
| GET | /ops/mtd | none-explicit | server/routes/ops_mtd.ts:8 |
| POST | /create | none-explicit | server/routes/ordersV2Routes.ts:24 |
| GET | /all | none-explicit | server/routes/ordersV2Routes.ts:140 |
| GET | /status | none-explicit | server/routes/ordersV2Routes.ts:159 |
| POST | /manual-partner | none-explicit | server/routes/ordersV2Routes.ts:172 |
| GET | /summary | middleware-present | server/routes/partners.ts:30 |
| GET | /analytics | none-explicit | server/routes/partners/partnerAnalyticsRoutes.ts:7 |
| POST | /create | none-explicit | server/routes/partners/partnerRoutes.ts:8 |
| GET | /all | none-explicit | server/routes/partners/partnerRoutes.ts:28 |
| GET | /:partnerId | none-explicit | server/routes/partners/partnerRoutes.ts:42 |
| POST | /process | none-explicit | server/routes/payments/processRoutes.ts:12 |
| GET | /list | middleware-present | server/routes/payments/providerRoutes.ts:11 |
| POST | /save | middleware-present | server/routes/payments/providerRoutes.ts:23 |
| GET | /dynamic | none-explicit | server/routes/payments/qrRoutes.ts:8 |
| POST | /webhook | middleware-present | server/routes/payments/scbRoutes.ts:11 |
| GET | /years | none-explicit | server/routes/pnlReadModel.ts:16 |
| GET | / | none-explicit | server/routes/pnlReadModel.ts:31 |
| GET | /year | none-explicit | server/routes/pnlReadModel.ts:87 |
| POST | /rebuild | none-explicit | server/routes/pnlReadModel.ts:237 |
| POST | /rebuild-range | none-explicit | server/routes/pnlReadModel.ts:274 |
| POST | /rebuild | none-explicit | server/routes/pnlSnapshot.route.ts:6 |
| GET | / | none-explicit | server/routes/pnlSnapshot.route.ts:23 |
| GET | /receipts-summary | none-explicit | server/routes/posAnalysis.ts:8 |
| GET | /analysis/shift | none-explicit | server/routes/posAnalysis.ts:24 |
| GET | /live-items | middleware-present | server/routes/posItems.ts:38 |
| GET | /live-shift | middleware-present | server/routes/posLive.ts:97 |
| GET | /receipts | none-explicit | server/routes/posReceipts.ts:9 |
| POST | /upload | none-explicit | server/routes/posUpload.ts:8 |
| GET | /summary/:date | none-explicit | server/routes/posUpload.ts:25 |
| GET | /shifts | none-explicit | server/routes/posUpload.ts:34 |
| POST | /sync-daily | none-explicit | server/routes/posUpload.ts:47 |
| GET | /ingredient-usage | none-explicit | server/routes/posUsage.ts:8 |
| GET | /api/metrics/prime-cost | none-explicit | server/routes/primeCost.ts:11 |
| POST | /:productId/activate | none-explicit | server/routes/productActivation.ts:6 |
| POST | /:productId/ingredients | none-explicit | server/routes/productIngredients.ts:11 |
| GET | /api/product-menu | none-explicit | server/routes/productMenu.ts:18 |
| PATCH | /api/product-menu/:productId | none-explicit | server/routes/productMenu.ts:60 |
| GET | /api/products | none-explicit | server/routes/products.ts:14 |
| GET | /api/products/:id | none-explicit | server/routes/products.ts:33 |
| POST | /api/products | none-explicit | server/routes/products.ts:79 |
| PUT | /api/products/:id | none-explicit | server/routes/products.ts:125 |
| DELETE | /api/products/:id | none-explicit | server/routes/products.ts:165 |
| POST | /import-purchases | none-explicit | server/routes/purchases.ts:31 |
| GET | / | none-explicit | server/routes/purchasing.ts:26 |
| POST | /plan | none-explicit | server/routes/purchasing.ts:57 |
| GET | / | none-explicit | server/routes/purchasingAnalytics.ts:13 |
| GET | /drinks | none-explicit | server/routes/purchasingDrinks.ts:16 |
| GET | /field-keys | none-explicit | server/routes/purchasingFieldMapping.ts:13 |
| GET | /items | none-explicit | server/routes/purchasingFieldMapping.ts:86 |
| POST | /map | none-explicit | server/routes/purchasingFieldMapping.ts:128 |
| DELETE | /map/:fieldKey | none-explicit | server/routes/purchasingFieldMapping.ts:155 |
| GET | /export/csv | none-explicit | server/routes/purchasingFieldMapping.ts:175 |
| POST | /import/csv | none-explicit | server/routes/purchasingFieldMapping.ts:228 |
| POST | /items | none-explicit | server/routes/purchasingFieldMapping.ts:294 |
| GET | / | none-explicit | server/routes/purchasingItems.ts:79 |
| POST | / | none-explicit | server/routes/purchasingItems.ts:99 |
| PUT | /:id | none-explicit | server/routes/purchasingItems.ts:126 |
| DELETE | /:id | none-explicit | server/routes/purchasingItems.ts:180 |
| GET | /export/csv | none-explicit | server/routes/purchasingItems.ts:230 |
| POST | /import/csv | none-explicit | server/routes/purchasingItems.ts:272 |
| POST | /sync-to-daily-stock | none-explicit | server/routes/purchasingItems.ts:346 |
| POST | /populate-catalog | none-explicit | server/routes/purchasingItems.ts:496 |
| GET | /purchasing-shift-matrix | none-explicit | server/routes/purchasingShiftLog.ts:14 |
| POST | /purchasing-shift-sync/:stockId | none-explicit | server/routes/purchasingShiftLog.ts:28 |
| POST | /purchasing-shift-backfill | none-explicit | server/routes/purchasingShiftLog.ts:45 |
| GET | / | none-explicit | server/routes/purchasingShiftLog.ts:61 |
| GET | /generate | none-explicit | server/routes/qrRoutes.ts:9 |
| POST | /receipts/rebuild | none-explicit | server/routes/receiptBatchRoutes.ts:6 |
| GET | /receipts/summary | none-explicit | server/routes/receiptBatchRoutes.ts:34 |
| GET | /count | none-explicit | server/routes/receiptCount.ts:10 |
| GET | /shift/burgers/ping | none-explicit | server/routes/receiptsBurgers.ts:40 |
| GET | /shift/burgers | none-explicit | server/routes/receiptsBurgers.ts:50 |
| POST | /shift/burgers/rebuild | none-explicit | server/routes/receiptsBurgers.ts:76 |
| GET | /debug/items | none-explicit | server/routes/receiptsDebug.ts:18 |
| GET | /export/csv | none-explicit | server/routes/recipes.ts:204 |
| GET | /cards | none-explicit | server/routes/recipes.ts:254 |
| GET | /card-generate/:id | none-explicit | server/routes/recipes.ts:330 |
| POST | /init-templates | none-explicit | server/routes/recipes.ts:365 |
| POST | /templates/ensure | none-explicit | server/routes/recipes.ts:375 |
| GET | /v2 | none-explicit | server/routes/recipes.ts:385 |
| GET | /v2/:id | none-explicit | server/routes/recipes.ts:429 |
| PUT | /v2/:id | none-explicit | server/routes/recipes.ts:474 |
| GET | / | none-explicit | server/routes/recipes.ts:533 |
| GET | /:id/cost-validation | none-explicit | server/routes/recipes.ts:571 |
| GET | /:id/ingredients | none-explicit | server/routes/recipes.ts:600 |
| PATCH | /:id/ingredient/:rowId | none-explicit | server/routes/recipes.ts:652 |
| GET | /:id | none-explicit | server/routes/recipes.ts:712 |
| POST | / | none-explicit | server/routes/recipes.ts:736 |
| POST | /:id/ingredients | none-explicit | server/routes/recipes.ts:819 |
| PUT | /:id | none-explicit | server/routes/recipes.ts:870 |
| POST | /:id/approve | none-explicit | server/routes/recipes.ts:899 |
| DELETE | /:id | none-explicit | server/routes/recipes.ts:924 |
| POST | /import | none-explicit | server/routes/recipes.ts:943 |
| POST | /upload-image | none-explicit | server/routes/recipes.ts:1005 |
| POST | /ramsay | none-explicit | server/routes/recipes.ts:1051 |
| POST | /:id/optimize | none-explicit | server/routes/recipes.ts:1090 |
| GET | /:id/forecast | none-explicit | server/routes/recipes.ts:1152 |
| GET | /cross-ref-shift | none-explicit | server/routes/recipes.ts:1246 |
| POST | /save | none-explicit | server/routes/recipes.ts:1281 |
| POST | /save-with-photo | none-explicit | server/routes/recipes.ts:1387 |
| POST | /log | none-explicit | server/routes/refunds.ts:8 |
| GET | / | none-explicit | server/routes/refunds.ts:37 |
| GET | /list | none-explicit | server/routes/reportsListV2.ts:23 |
| GET | /:id/json | none-explicit | server/routes/reportsListV2.ts:50 |
| GET | /:id/pdf | none-explicit | server/routes/reportsListV2.ts:75 |
| GET | /search | none-explicit | server/routes/reportsListV2.ts:108 |
| GET | /export-range | none-explicit | server/routes/reportsListV2.ts:134 |
| POST | /daily/generate | none-explicit | server/routes/reportsV2.ts:18 |
| GET | /daily/:date/pdf | none-explicit | server/routes/reportsV2.ts:60 |
| GET | /:reportId/live | none-explicit | server/routes/securityV2.ts:18 |
| GET | /analysis/shift/items | none-explicit | server/routes/shiftAnalysis.ts:12 |
| POST | /analysis/shift/rebuild | none-explicit | server/routes/shiftAnalysis.ts:129 |
| GET | /analysis/shift/raw | none-explicit | server/routes/shiftAnalysis.ts:141 |
| POST | /analysis/shift/backfill | none-explicit | server/routes/shiftAnalysis.ts:161 |
| GET | /pos-shift/:date | none-explicit | server/routes/shiftApproval.ts:32 |
| POST | /pos-shift/:date/sync | none-explicit | server/routes/shiftApproval.ts:118 |
| GET | /daily-sales-v2/:date | none-explicit | server/routes/shiftApproval.ts:129 |
| POST | /approve-shift | none-explicit | server/routes/shiftApproval.ts:140 |
| GET | /shift-snapshots | none-explicit | server/routes/shiftApproval.ts:162 |
| GET | /latest-valid-shift | none-explicit | server/routes/shiftApproval.ts:173 |
| GET | /pnl/:period | none-explicit | server/routes/shiftApproval.ts:234 |
| GET | / | none-explicit | server/routes/shiftExpenses.ts:17 |
| POST | /generate | none-explicit | server/routes/shiftReportRoutes.ts:12 |
| GET | /latest | none-explicit | server/routes/shiftReportRoutes.ts:31 |
| GET | /history | none-explicit | server/routes/shiftReportRoutes.ts:46 |
| GET | /view/:id | none-explicit | server/routes/shiftReportRoutes.ts:61 |
| GET | /pdf/:id | none-explicit | server/routes/shiftReportRoutes.ts:76 |
| POST | / | none-explicit | server/routes/shiftReview.ts:8 |
| GET | / | none-explicit | server/routes/shiftReview.ts:31 |
| GET | /:id/estimate | none-explicit | server/routes/shoppingList.ts:10 |
| GET | /latest | none-explicit | server/routes/shoppingList.ts:22 |
| GET | /by-date | none-explicit | server/routes/shoppingList.ts:56 |
| GET | /latest | none-explicit | server/routes/shoppingListNew.ts:206 |
| GET | /system-purchases | none-explicit | server/routes/shoppingListNew.ts:280 |
| GET | /:salesId | none-explicit | server/routes/shoppingListNew.ts:299 |
| GET | /:salesId/csv | none-explicit | server/routes/shoppingListNew.ts:314 |
| GET | /latest/csv | none-explicit | server/routes/shoppingListNew.ts:374 |
| GET | /latest | none-explicit | server/routes/shoppingListRoutes.ts:36 |
| GET | /pdf/latest | none-explicit | server/routes/shoppingListRoutes.ts:71 |
| GET | /pdf/range | none-explicit | server/routes/shoppingListRoutes.ts:92 |
| GET | /history | none-explicit | server/routes/shoppingListRoutes.ts:117 |
| GET | /live | none-explicit | server/routes/stock/stockRoutes.ts:9 |
| POST | /manual-purchase | none-explicit | server/routes/stock/stockRoutes.ts:22 |
| POST | /rolls | none-explicit | server/routes/stock/stockRoutes.ts:178 |
| POST | /meat | none-explicit | server/routes/stock/stockRoutes.ts:230 |
| POST | /drinks | none-explicit | server/routes/stock/stockRoutes.ts:260 |
| POST | /lodge/rolls | none-explicit | server/routes/stock/stockRoutes.ts:295 |
| POST | /lodge/meat | none-explicit | server/routes/stock/stockRoutes.ts:318 |
| POST | /lodge/drinks | none-explicit | server/routes/stock/stockRoutes.ts:342 |
| GET | /shift | none-explicit | server/routes/stock/varianceRoutes.ts:6 |
| POST | /baseline | none-explicit | server/routes/stockBaseline.ts:13 |
| GET | /baseline | none-explicit | server/routes/stockBaseline.ts:48 |
| POST | /snapshot | none-explicit | server/routes/stockBaseline.ts:57 |
| POST | /variance/compute | none-explicit | server/routes/stockBaseline.ts:82 |
| GET | /variance | none-explicit | server/routes/stockBaseline.ts:138 |
| GET | / | none-explicit | server/routes/stockReviewManual.ts:82 |
| POST | / | none-explicit | server/routes/stockReviewManual.ts:126 |
| GET | /export.csv | none-explicit | server/routes/stockReviewManual.ts:205 |
| GET | /health | none-explicit | server/routes/stockReviewManual.ts:266 |
| POST | /refresh-meat | none-explicit | server/routes/stockReviewManual.ts:395 |
| POST | /refresh-rolls | none-explicit | server/routes/stockReviewManual.ts:477 |
| POST | /save | none-explicit | server/routes/stockReviewManual.ts:507 |
| POST | /refresh-meat | none-explicit | server/routes/stockReviewManual_autopatch.mjs:128 |
| GET | /manual-ledger/health | none-explicit | server/routes/stockReviewManual_harden.mjs:13 |
| POST | /refresh-rolls | none-explicit | server/routes/stockReviewManual_rolls_autopatch.mjs:60 |
| POST | /save | none-explicit | server/routes/stockReviewManual_rolls_autopatch.mjs:90 |
| GET | / | none-explicit | server/routes/systemHealth.ts:9 |
| GET | /run | none-explicit | server/routes/systemHealth.ts:52 |
| GET | /:id/variance-history | none-explicit | server/routes/varianceHistory.ts:7 |

## Mounted router expressions

- `reqId)` (server/index.ts:64)
- `timing)` (server/index.ts:65)
- `express.json({ limit: '100mb' }))` (server/index.ts:66)
- `express.urlencoded({ extended: false, limit: '100mb' }))` (server/index.ts:67)
- `tenantResolver)` (server/index.ts:69)
- `readonlyGuard)` (server/index.ts:71)
- `(req, res, next) => {` (server/index.ts:74)
- `(req, res, next) => {` (server/index.ts:108)
- `'/attached_assets', express.static(path.resolve(process.cwd(), 'attached_assets')))` (server/index.ts:116)
- `'/uploads', express.static(path.resolve(process.cwd(), 'uploads')))` (server/index.ts:119)
- `'/public', express.static(path.resolve(process.cwd(), 'public')))` (server/index.ts:122)
- `tenantContext)` (server/index.ts:125)
- `(req: Request, res: Response, next: NextFunction) => {` (server/index.ts:135)
- `(req, res, next) => {` (server/index.ts:166)
- `"/api/pos", posUploadRouter)` (server/index.ts:237)
- `'/api/daily-stock', dailyStockRouter)` (server/index.ts:248)
- `'/api/shift-expenses', shiftExpensesRouter)` (server/index.ts:252)
- `'/api', loyverseV2Router)` (server/index.ts:257)
- `'/api', shiftAnalysisRouter)` (server/index.ts:258)
- `'/api/analysis/shift', analysisCsv)` (server/index.ts:259)
- `ensureShiftRouter)` (server/index.ts:260)
- `'/api', healthRouter)` (server/index.ts:261)
- `'/api', opsMtdRouter)` (server/index.ts:262)
- `'/api/purchasing', purchasingRouter)` (server/index.ts:263)
- `'/api/purchasing', purchasingDrinksRouter)` (server/index.ts:264)
- `'/api/purchasing-items', purchasingItemsRouter)` (server/index.ts:265)
- `'/api', purchasingShiftLogRouter)` (server/index.ts:269)
- `'/api', menuOnlineRouter)` (server/index.ts:271)
- `'/api', imageUploadRouter)` (server/index.ts:272)
- `'/api/export', exportRoutes)` (server/index.ts:273)
- `primeCostRouter)` (server/index.ts:274)
- `'/api/stock-catalog', stockCatalogRouter)` (server/index.ts:456)
- `'/api/ingredients', ingredientsRouter)` (server/index.ts:461)
- `'/api/finance', financeRouter)` (server/index.ts:465)
- `'/api/checklists', checklistRouter)` (server/index.ts:469)
- `'/api', skuMapRouter)` (server/index.ts:473)
- `adminTestEmailRouter)` (server/index.ts:477)
- `'/api', adminSyncRouter)` (server/index.ts:481)
- `"/api/reports", reportsV2Router)` (server/index.ts:482)
- `"/api/reports", reportsListV2Router)` (server/index.ts:483)
- `"/api/insights", insightsV2Router)` (server/index.ts:484)
- `"/api/security", securityV2Router)` (server/index.ts:485)
- `"/api/auth", authRoutes)` (server/index.ts:488)
- `"/api/payment-providers", providerRoutes)` (server/index.ts:491)
- `"/api/payments", paymentProcessRoutes)` (server/index.ts:492)
- `"/api/legacy-bridge", legacyBridgeRoutes)` (server/index.ts:495)
- `'/api/system-health', systemHealthRouter)` (server/index.ts:499)
- `'/api/ops/ai', aiOpsControlRouter)` (server/index.ts:505)
- `'/api/ai-ops', aiOpsControlRouter)` (server/index.ts:506)
- `'/api/bob', bobAliasRouter)` (server/index.ts:508)
- `'/api/bob/read', bobReadRouter)` (server/index.ts:512)
- `'/api/ai/chat', chatAliasRouter)` (server/index.ts:519)
- `'/api/ingredient-master', ingredientMasterRouter)` (server/index.ts:523)
- `'/api/ingredient-authority', ingredientAuthorityRouter)` (server/index.ts:529)
- `'/', ingredientSearchRouter)` (server/index.ts:530)
- `errorGuard)` (server/index.ts:533)
- `"/api/stock-review/manual-ledger", stockReviewManual)` (server/routes.ts:1177)
- `"/api/stock-review", stockReviewRouter)` (server/routes.ts:1178)
- `"/api/receipts", receiptsBurgers)` (server/routes.ts:1181)
- `"/api/receipts", receiptsDebug)` (server/routes.ts:1182)
- `"/api/receipts", receiptCount)` (server/routes.ts:1183)
- `"/internal/api/reports", internalReports)` (server/routes.ts:1184)
- `"/api/loyverse", loyverseSync)` (server/routes.ts:1187)
- `"/api/loyverse", loyverseShiftReportRouter)` (server/routes.ts:1188)
- `"/api/shift-report", shiftReportRoutes)` (server/routes.ts:1191)
- `"/api/purchases", purchasesRouter)` (server/routes.ts:1194)
- `"/api", onlineOrderingV2Router)` (server/routes.ts:1197)
- `"/api", onlineCatalogRouter)` (server/routes.ts:1198)
- `"/uploads", express.static(uploadsDir))` (server/routes.ts:1203)
- `"/online-ordering", (req, res, next) => {` (server/routes.ts:1209)
- `'/api/analysis', analysisDailyReviewRouter)` (server/routes.ts:1224)
- `'/api/daily-review-comments', dailyReviewCommentsRouter)` (server/routes.ts:1225)
- `'/api/analysis/rolls-ledger', rollsLedgerRouter)` (server/routes.ts:1229)
- `'/api/analysis/meat-ledger', meatLedgerRouter)` (server/routes.ts:1233)
- `'/api/analysis/drinks-ledger', drinksLedgerRouter)` (server/routes.ts:1237)
- `'/api/analysis', receiptBatchRoutes)` (server/routes.ts:1242)
- `freshnessRouter)` (server/routes.ts:1736)
- `blockLegacyIngredients)` (server/routes.ts:3975)
- `'/api/expenses', expensesImportRouter)` (server/routes.ts:3978)
- `'/api/balance', balanceRoutes)` (server/routes.ts:3984)
- `'/api/ingredients/legacy', legacyIngredientsRouter)` (server/routes.ts:3987)
- `'/api/ingredients', ingredientsRoutes)` (server/routes.ts:3988)
- `'/api/manager-check', managerCheckRouter)` (server/routes.ts:3989)
- `'/api/shopping-list', shoppingListRoutes)` (server/routes.ts:3990)
- `'/api/purchasing-list', shoppingListNewRouter)` (server/routes.ts:3991)
- `'/api/purchasing-field-mapping', purchasingFieldMappingRouter)` (server/routes.ts:3992)
- `'/api/purchasing-shift-log', purchasingShiftLogRouter)` (server/routes.ts:3993)
- `'/api/purchasing-analytics', purchasingAnalyticsRouter)` (server/routes.ts:3994)
- `'/api/debug', debugPurchasingRouter)` (server/routes.ts:3995)
- `'/api/pnl', pnlReadModelRoutes)` (server/routes.ts:3996)
- `'/api', shiftApprovalRoutes)` (server/routes.ts:3997)
- `'/api/issue-register', issueRegisterRoutes)` (server/routes.ts:3998)
- `'/api/pnl/snapshot', pnlSnapshotRoutes)` (server/routes.ts:3999)
- `'/api/menu-management', menuManagementRouter)` (server/routes.ts:4000)
- `'/api/modifiers', modifiersRouter)` (server/routes.ts:4001)
- `productsRouter)` (server/routes.ts:4002)
- `'/api/products', productIngredientsRouter)` (server/routes.ts:4003)
- `'/api/products', productActivationRouter)` (server/routes.ts:4004)
- `productMenuRouter)` (server/routes.ts:4005)
- `'/api/membership', membershipRouter)` (server/routes.ts:4006)
- `'/api/github', githubRouter)` (server/routes.ts:4007)
- `'/api/expenses-v2', expensesV2Routes)` (server/routes.ts:4008)
- `'/api/menu-ordering', menuOrderingRoutes)` (server/routes.ts:4009)
- `'/api/orders-v2', ordersV2Routes)` (server/routes.ts:4010)
- `'/api/loyverse-map', loyverseMapRoutes)` (server/routes.ts:4011)
- `'/api/payments-qr', qrRoutes)` (server/routes.ts:4012)
- `'/api/payments/scb', scbRoutes)` (server/routes.ts:4013)
- `'/api/payments/qr', qrDynamicRoutes)` (server/routes.ts:4014)
- `'/api/partners', partnerBarRoutes)` (server/routes.ts:4015)
- `'/api/partners', partnerAnalyticsRoutes)` (server/routes.ts:4016)
- `'/api/partners', partnersRouter)` (server/routes.ts:4017)
- `'/api/delivery', deliveryRoutes)` (server/routes.ts:4018)
- `'/api/kds', kdsRoutes)` (server/routes.ts:4019)
- `'/api/menu-v3', menuV3Routes)` (server/routes.ts:4020)
- `'/api/stock', stockRoutes)` (server/routes.ts:4021)
- `'/api/stock/variance', varianceRoutes)` (server/routes.ts:4022)
- `'/api/stock', stockBaselineRouter)` (server/routes.ts:4023)
- `'/api/refunds', refundsRouter)` (server/routes.ts:4024)
- `'/api/shift-review', shiftReviewRouter)` (server/routes.ts:4025)
- `'/api/analytics/ingredients', ingredientUsageRoutes)` (server/routes.ts:4026)
- `'/api/admin/import', loyverseMenuImportRouter)` (server/routes.ts:4027)
- `'/api/admin/backup', adminBackupRouter)` (server/routes.ts:4028)
- `'/api/admin/historical', adminHistoricalImportRouter)` (server/routes.ts:4029)
- `'/api/admin/ingredient-authority', ingredientAuthorityAdminRoutes)` (server/routes.ts:4032)
- `'/api/system-health', systemHealthRouter)` (server/routes.ts:4033)
- `'/api/line', lineNotifyRouter)` (server/routes.ts:4034)
- `'/api/items', varianceHistoryRouter)` (server/routes.ts:4046)
- `'/api/executive-metrics', executiveMetricsRouter)` (server/routes.ts:4047)
- `dashboard4Routes)` (server/routes.ts:4048)
- `'/api/expensesV2/imports', expenseModule.default)` (server/routes.ts:4087)
- `"/api/bank-imports", bankUploadRouter)` (server/routes.ts:4090)
- `'/api/finance', financeModule.financeRouter)` (server/routes.ts:4094)
- `'/api/loyverse', loyverseEnhancedRoutes)` (server/routes.ts:4462)
- `'/api/analytics', analyticsRoutes)` (server/routes.ts:4465)
- `'/api/receipts', analyticsRoutes)` (server/routes.ts:4466)
- `'/api/analysis/shift-summary', analysisShift)` (server/routes.ts:4469)
- `'/api', shiftAnalysis)` (server/routes.ts:4472)
- `'/api/daily-sales', dailySalesLibrary)` (server/routes.ts:4475)
- `'/api/daily-stock', dailyStock)` (server/routes.ts:4759)
- `'/api/chef', chef)` (server/routes.ts:4861)
- `'/api/recipes', recipes)` (server/routes.ts:4862)
- `'/api/upload', uploadsRouter)` (server/routes.ts:4882)
- `'/api/import', importRouter)` (server/routes.ts:4883)
- `'/api/costing', costingRouter)` (server/routes.ts:4884)
- `"/api/bank-imports", bankImportRouter)` (server/routes.ts:4888)
- `"/api/bank-imports", bankUploadRouter)` (server/routes.ts:4889)
- `'/api/purchase-tally', purchaseTallyRouter)` (server/routes.ts:4892)
- `'/api/bank-imports', bankImportRouter)` (server/routes.ts:4895)
- `'/api/menus', menuRouter)` (server/routes.ts:4898)
- `'/api', imageUploadRouter)` (server/routes.ts:4906)
- `"/api/forms", dailySalesV2Router)` (server/routes.ts:5029)
- `'/api/forms', formsRouter)` (server/routes.ts:5034)
- `'/api/pos', posLive)` (server/routes.ts:5144)
- `'/api/pos', posItems)` (server/routes.ts:5145)
- `'/api/pos', posUsage)` (server/routes.ts:5146)
- `'/api/pos', async (req, res, next) => {` (server/routes.ts:5622)
- `'/api/pos', async (req, res, next) => {` (server/routes.ts:5631)
- `'/api/pos', async (req, res, next) => {` (server/routes.ts:5640)
- `"/api/health-safety/questions", healthSafetyQuestions)` (server/routes.ts:5672)
- `"/api/health-safety/audits", healthSafetyAudits)` (server/routes.ts:5673)
- `"/api/health-safety/pdf", healthSafetyPdf)` (server/routes.ts:5674)
- `recipeMappingRouter)` (server/routes.ts:5678)
