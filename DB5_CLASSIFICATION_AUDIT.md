# DB 5.0 — PHASE 1 CLASSIFICATION AUDIT
**Date:** 29 May 2026  
**Status:** AUDIT ONLY — no code changes, no route changes, no database changes  
**Method:** Live file reads, grep traces, import maps. All data from actual files.

---

## CLASSIFICATION KEY

| Label | Meaning |
|---|---|
| **KEEP** | Live, needed, do not touch |
| **REPAIR** | Backend exists and healthy, frontend route missing — build the page |
| **REMOVE** | Explicit user rule or zero business value — scheduled for deletion |

---

## 1. FILE INVENTORY

### 1A — Frontend Files

| File | Feature | Classification |
|---|---|---|
| `client/src/pages/auth/Login.tsx` | Auth | KEEP |
| `client/src/pages/Home.tsx` | Dashboard | KEEP |
| `client/src/pages/NotFound.tsx` | 404 | KEEP |
| `client/src/pages/operations/daily-sales/Form.tsx` | Daily Sales V2 | KEEP |
| `client/src/pages/operations/daily-sales-v2/Library.tsx` | Form Library | KEEP |
| `client/src/pages/operations/DailyStock.tsx` | Daily Stock V2 | KEEP |
| `client/src/pages/operations/Purchasing.tsx` | Purchasing | KEEP |
| `client/src/components/KDS.tsx` | KDS | **REMOVE** |
| `client/src/components/JussiChatBubble.tsx` | Jussi | **REMOVE** |
| `client/src/router/RouteRegistry.ts` | All routes | KEEP — prune dead constants |

### 1B — Backend Route Files (`server/routes/`)

| File | Feature | Classification | Notes |
|---|---|---|---|
| `agentGateway.ts` | Agent Gateway | **REMOVE** | Entire file |
| `agentRead.ts` | Agent Read | **REMOVE** | Entire file |
| `aiOpsControl.ts` | AI Ops / Bob | **REMOVE** | 4915 lines — also exports `bobAliasRouter`, `chatAliasRouter` |
| `bobCanonicalRead.ts` | Bob | **REMOVE** | Entire file |
| `bobRead.ts` | Bob | **REMOVE** | Entire file |
| `adminSync.ts` | AI Ops (analysis build) | **REMOVE** | Calls `analysisBuildOrchestrator.ensureAnalysisForDate` |
| `adminTestEmail.ts` | AI Ops test email | REPAIR | Standalone test email tool — review before removing |
| `internalReports.ts` | Bob read surface | **REMOVE** | Grep confirmed bob reference; mounted at `/internal/api/reports` |
| `posBlaze.ts` | POS Terminal | **REMOVE** | Imported only by `posUpload.ts` |
| `posLive.ts` | POS Terminal | **REMOVE** | Mounted at `/api/pos` in routes.ts |
| `posItems.ts` | POS Terminal | **REMOVE** | Mounted at `/api/pos` in routes.ts |
| `posUsage.ts` | POS Terminal | **REMOVE** | Mounted at `/api/pos` in routes.ts |
| `posAnalysis.ts` | POS Terminal | **REMOVE** | Commented-out mount in routes.ts — still exists |
| `posReceipts.ts` | POS Terminal | **REMOVE** | Commented-out mount in routes.ts — still exists |
| `posUpload.ts` | POS Terminal | **REMOVE** | Imports posBlaze; handles `/api/pos/upload-bundle`, `/api/pos/batches`, `/api/pos/:batchId/analyze` |
| `checklists.ts` | Manager Checklist | REPAIR | File exists but returns 404 (mount deleted in Pass 1); reinstate |
| `analysisV2.ts` | Analysis V2 | **REMOVE** | Analysis V2 frontend deleted; router still mounted |
| `analysisDailySales.ts` | Analysis | REPAIR | Daily sales analysis data — backend valid |
| `analysisDailyReview.ts` | Analysis / Reports | REPAIR | Daily review data — feeds Reports feature |
| `analysisManualLedger.ts` | Analysis | REPAIR | Manual ledger entries |
| `analysisCsv.ts` | Analysis / Reports | REPAIR | CSV export of shift analysis |
| `analysisShift.ts` | Analysis | REPAIR | Shift-level analysis data |
| `analysisV3.ts` | POS Truth Layer | KEEP | SELECT-only POS truth surface — protected |
| `analysis/hybridStockControl.ts` | Analysis | REPAIR | Stock control data |
| `analysis/stockReconciliation.ts` | Analysis | REPAIR | Stock vs POS reconciliation |
| `analysis/usageReconciliation.ts` | Analysis | REPAIR | Usage reconciliation |
| `analytics.ts` | Analytics | REPAIR | Ingredient analytics |
| `analytics/ingredientUsageRoutes.ts` | Ingredients | KEEP | Ingredient usage data |
| `balance.ts` | Finance | KEEP | Banking reconciliation |
| `bankImport.ts` | Finance | KEEP | Bank statement import |
| `bunsReconciliation.ts` | Analysis / Reports | REPAIR | Buns stock vs POS |
| `burgersVariance.ts` | Analysis / Reports | REPAIR | Burger set metrics |
| `costing.ts` | Cost Calculator | KEEP | Cost calculator API |
| `dailyReviewComments.ts` | Reports | REPAIR | Comments on daily reviews |
| `dailySalesLibrary.ts` | Form Library | KEEP | Already active |
| `dailyStock.ts` | Daily Stock V2 | KEEP | Already active |
| `debugPurchasing.ts` | Purchasing | REPAIR | Debug tool — internal only |
| `drinksAdjustments.ts` | Analysis / Reports | REPAIR | Drinks adjustment entries |
| `drinksLedger.ts` | Analysis / Reports | REPAIR | Drinks inventory ledger |
| `drinksVariance.ts` | Analysis / Reports | REPAIR | Drinks vs POS comparison |
| `ensureShift.ts` | Core POS | KEEP | Ensures shift record exists |
| `expenses-import.ts` | Finance | KEEP | Expense import pipeline |
| `expenses.ts` | Finance | KEEP | Expense management |
| `exportRoutes.ts` | Reports | REPAIR | Data export endpoints |
| `finance.ts` | Finance | KEEP | P&L and finance data |
| `forms.ts` | Daily Sales V2 | KEEP | Form CRUD |
| `freshness.ts` | System | REPAIR | Data freshness checks |
| `friesReconciliation.ts` | Analysis / Reports | REPAIR | Fries stock vs POS |
| `health.ts` | System Health | REPAIR | Health check endpoints |
| `healthSafety/audits.ts` | Health & Safety | REPAIR | Audit records |
| `healthSafety/pdf.ts` | Health & Safety | REPAIR | H&S PDF generation |
| `healthSafety/questions.ts` | Health & Safety | REPAIR | H&S question set |
| `imageUpload.ts` | Menu Management | KEEP | Image upload for menu items |
| `imports.ts` | Admin | REPAIR | Data import utilities |
| `ingredientAuthority.ts` | Ingredients | KEEP | Ingredient authority admin |
| `ingredientMaster.ts` | Ingredients | KEEP | Ingredient master CRUD |
| `ingredients-legacy.ts` | Ingredients | KEEP | Legacy ingredient bridge |
| `ingredients.ts` | Ingredients | KEEP | Primary ingredient API |
| `admin/ingredientAuthority.ts` | Ingredients | KEEP | Admin ingredient authority routes |
| `issueRegister.ts` | Issue Register | REPAIR | Theft-control issue log |
| `legacyBridge.ts` | Legacy | REPAIR | Legacy data bridge — review |
| `loyverseEnhanced.ts` | POS Sync | KEEP | Enhanced Loyverse API |
| `loyverseShiftReport.ts` | POS Sync | KEEP | Loyverse shift report |
| `loyverseSync.ts` | POS Sync | KEEP | Active Loyverse sync trigger |
| `loyverseV2.ts` | POS Sync | KEEP | Loyverse V2 endpoints |
| `managerChecks.ts` | Manager Checklist | REPAIR | Manager checklist inline routes |
| `meatLedger.ts` | Analysis / Reports | REPAIR | Meat inventory ledger |
| `meatReconciliation.ts` | Analysis / Reports | REPAIR | Meat stock vs POS |
| `menu.ts` | Menu Management | KEEP | Menu CRUD |
| `menuManagement.ts` | Menu Management | KEEP | Menu management routes |
| `menu/menuV3Routes.ts` | Menu Management | KEEP | V3 menu routes |
| `menuOnline.ts` | Online Ordering | KEEP | Online menu routes |
| `modifiers.ts` | Menu Management | KEEP | POS modifier management |
| `modifierPipeline.ts` | Analysis | REPAIR | Modifier data pipeline |
| `onlineMenu.ts` | Online Ordering | KEEP | Online menu endpoints |
| `onlineOrders.ts` | Online Ordering | KEEP | Online order management |
| `ops_mtd.ts` | Reports | REPAIR | Month-to-date ops summary |
| `payments/providerRoutes.ts` | Online Ordering (payment) | REPAIR | Payment provider mgmt |
| `payments/processRoutes.ts` | Online Ordering (payment) | REPAIR | Payment processing (SCB/Stripe) |
| `pinAuth.ts` | Auth | KEEP | PIN login |
| `posReceipts.ts` | POS Terminal | **REMOVE** | See above |
| `posAnalysis.ts` | POS Terminal | **REMOVE** | See above |
| `primeCost.ts` | Finance | KEEP | Prime cost calculations |
| `productActivation.ts` | Menu Management | KEEP | Product activation |
| `productIngredients.ts` | Menu Management / Recipes | KEEP | Product-ingredient mapping |
| `productMenu.ts` | Menu Management | KEEP | Product menu view |
| `products.ts` | Menu Management | KEEP | Product CRUD |
| `promoMixMatch.ts` | Analysis / Reports | REPAIR | Promo mix analysis |
| `purchases.ts` | Purchasing | KEEP | Purchase records |
| `purchaseTally.ts` | Purchasing | KEEP | Purchase tally aggregates |
| `purchasingAnalytics.ts` | Purchasing | KEEP | Purchasing analytics |
| `purchasingDrinks.ts` | Purchasing | KEEP | Drinks purchasing |
| `purchasingFieldMapping.ts` | Purchasing | KEEP | Field mapping admin |
| `purchasingItems.ts` | Purchasing | KEEP | Purchasing catalog |
| `purchasingShiftLog.ts` | Purchasing | KEEP | Shift purchase log |
| `purchasing.ts` | Purchasing | KEEP | Purchasing routes |
| `receiptBatchRoutes.ts` | Analysis | REPAIR | Batch receipt processing |
| `receiptCount.ts` | Daily Sales V2 | KEEP | Receipt count for date |
| `receiptsBurgers.ts` | Analysis | REPAIR | Burger receipt metrics |
| `receiptsDebug.ts` | Debug | REPAIR | Receipt debugging |
| `recipeMapping.ts` | Recipes | KEEP | Recipe-POS mapping |
| `refunds.ts` | Daily Sales V2 | KEEP | Refund log |
| `rollsLedger.ts` | Analysis / Reports | REPAIR | Buns/rolls ledger |
| `shiftAnalysis.ts` | Analysis / Reports | REPAIR | Shift-level analysis |
| `shiftApproval.ts` | Operations | REPAIR | Shift sign-off approval |
| `shiftExpenses.ts` | Daily Sales V2 | KEEP | Shift expense records |
| `shiftReportRoutes.ts` | Reports | KEEP | Shift report CRUD + email |
| `shiftReview.ts` | Reports | REPAIR | Shift review data |
| `shoppingListNew.ts` | Shopping List | REPAIR | New purchasing list |
| `shoppingListRoutes.ts` | Shopping List | REPAIR | Shopping list CRUD |
| `shoppingList.ts` | Shopping List | REPAIR | Shopping list (legacy) |
| `sideOrdersVariance.ts` | Analysis / Reports | REPAIR | Side orders metrics |
| `skuMap.ts` | Menu / POS | REPAIR | SKU mapping |
| `stockBaseline.ts` | Stock | REPAIR | Stock baseline seeding |
| `stock/stockRoutes.ts` | Stock | REPAIR | Stock management |
| `stock/varianceRoutes.ts` | Stock | REPAIR | Stock variance engine |
| `stockReviewManual.ts` | Stock | REPAIR | Manual stock review ledger |
| `sweetPotatoReconciliation.ts` | Analysis / Reports | REPAIR | Sweet potato stock vs POS |
| `systemHealth.ts` | System | REPAIR | System health dashboard |
| `uiAuth.ts` | Auth | KEEP | UI auth state check |
| `uploads.ts` | Admin | REPAIR | File upload utilities |
| `auth/authRoutes.ts` | Auth | KEEP | Session auth routes |
| `migrations/20260413_agent_read_foundation.sql` | Agent Read | **REMOVE** | Migration for removed feature |

### 1C — Backend Service Files (`server/services/`)

| File | Feature | Classification |
|---|---|---|
| `aiAnalysisService.ts` | AI Ops / Bob | **REMOVE** |
| `analysisBuildOrchestrator.ts` | AI Ops / Bob | **REMOVE** — called by adminSync + scheduler |
| `bobCanonicalReadService.ts` | Bob | **REMOVE** |
| `bobInterpretationService.ts` | Bob | **REMOVE** |
| `bobWorkspace.ts` | Bob | **REMOVE** |
| `dailyBobAnalystAiOpsLoop.ts` | Bob / AI Ops | **REMOVE** |
| `deliveryService.ts` | Delivery | REPAIR — no active frontend or routes |
| `deliveryTime.ts` | Delivery | REPAIR — no active frontend or routes |
| `driverService.ts` | Delivery | REPAIR — no active frontend or routes |
| `jussiDailySummaryService.ts` | Jussi | **REMOVE** |
| `jussiLatestShiftService.ts` | Jussi | **REMOVE** |
| `jussiShiftSummarizer.ts` | Jussi | **REMOVE** |
| `jussi/runJussiDaily.js` | Jussi | **REMOVE** |
| `jussi/runJussi.js` | Jussi | **REMOVE** |
| `kdsService.ts` | KDS | **REMOVE** |
| `partnerTracker.ts` | Partner Systems | **REMOVE** |
| `scheduledAnalysisBuild.ts` | AI Ops (cron) | **REMOVE** — feeds deleted analysis pages |
| `shiftRebuildScheduler.ts` | AI Ops | **REMOVE** — disabled in Pass 2; only consumer was aiOpsControl |
| `monitorEngine.ts` | AI Ops | **REMOVE** — only imported by aiOpsControl |
| `scbClient.ts` | SCB Payment | REPAIR — linked to online ordering |
| `scbDynamicQR.ts` | SCB Payment | REPAIR — linked to online ordering |
| `scbPaymentMatcher.ts` | SCB Payment | REPAIR — linked to online ordering |
| `scbSignature.ts` | SCB Payment | REPAIR — linked to online ordering |
| `onlineCatalogService.ts` | Online Ordering | KEEP |
| `onlineCatalogOptionsService.ts` | Online Ordering | KEEP |
| `onlineProductFeed.ts` | Online Ordering | KEEP |
| `recipeService.ts` | Recipes | KEEP |
| `menu/recipeService.ts` | Recipes | KEEP |
| `recipeCost.service.ts` | Cost Calculator / Recipes | KEEP |
| `recipeCoverageDeriver.ts` | Recipes | KEEP |
| `recipeResolver.ts` | Recipes | KEEP |
| `recipes/` (directory) | Recipes | KEEP |
| `staffOpsService.ts` | Staff Operations | KEEP |
| `rosterExportService.ts` | Staff Operations | KEEP |
| `cronEmailService.ts` | Reports / Finance | KEEP — sends Daily Review email |
| `dailyReportV2.ts` | Reports | KEEP |
| `shiftReportBuilder.ts` | Reports | KEEP |
| `shiftReportEmail.ts` | Reports | KEEP |
| `shiftReportInsights.ts` | Reports | KEEP |
| `shiftReportPDF.ts` | Reports | KEEP |
| `ingredientService.ts` | Ingredients | KEEP |
| `ingredientSync.service.ts` | Ingredients | KEEP |
| `ingredientCascade.ts` | Ingredients | KEEP |
| `ingredientResolution.service.ts` | Ingredients | KEEP |
| `ingredientUsageDeriver.ts` | Ingredients / Analysis | REPAIR |
| `ingredientVarianceEngine.ts` | Ingredients / Analysis | REPAIR |
| `menuService.ts` | Menu Management | KEEP |
| `menuCanonicalService.ts` | Menu Management | KEEP |
| `loyverseImportV2.ts` | POS Sync (truth layer) | KEEP — hard-locked |
| `loyverseService.ts` | POS Sync | KEEP |
| `loyverseDataOrchestrator.ts` | POS Sync | KEEP |
| `loyverseIngest.ts` | POS Sync | KEEP |
| `loyverseQueue.ts` | POS Sync / Online Ordering | KEEP |
| `scheduler.ts` | POS Sync / Crons | KEEP |
| `email.ts` | Email | KEEP |
| `emailService.ts` | Email | KEEP |
| `gmailService.ts` | Email | KEEP |
| `googleOAuthEmailService.ts` | Email | KEEP |
| `pdf.ts` | PDF | KEEP |
| `shoppingList.ts` | Shopping List | REPAIR |
| `shoppingListBuilder.ts` | Shopping List | REPAIR |
| `shoppingListPDF.ts` | Shopping List | REPAIR |
| `rollsLedger.ts` | Analysis / Reports | REPAIR |
| `meatLedger.ts` | Analysis / Reports | REPAIR |
| `drinksLedger.ts` | Analysis / Reports | REPAIR |
| `shiftAnalysisService.ts` | Analysis | REPAIR |
| `stockAnalysis.ts` | Analysis | REPAIR |
| `stockEngine.ts` | Stock | REPAIR |
| `stockVarianceService.ts` | Stock | REPAIR |
| `securityEngineV2.ts` | Security / Issue Register | REPAIR |
| `issueRegister.ts` (if exists) | Issue Register | REPAIR |
| `insightsEngineV2.ts` | Analysis | REPAIR |
| `dataAnalystService.ts` | Analysis | REPAIR |
| `dataConfidenceService.ts` | Analysis | REPAIR |
| `receiptTruthSummary.ts` | Analysis | REPAIR |
| `receiptTruthDailyUsageService.ts` | Analysis | REPAIR — review callers |
| `receiptTruthIngredientService.ts` | Analysis | REPAIR |
| `receiptTruthModifierEffective.ts` | Analysis | REPAIR |
| `receiptTruthAggregateService.ts` | Analysis | REPAIR |
| `receiptIngredientTruthEngine.ts` | Analysis | REPAIR |
| `receiptBatchSummary.ts` | Analysis | REPAIR |
| `summaryExtract.ts` | Analysis | REPAIR |
| `backfillShiftAnalytics.ts` | Analysis | REPAIR |
| `burgerMetrics.ts` | Analysis / Reports | REPAIR |
| `burgerVarianceService.ts` | Analysis / Reports | REPAIR |
| `shiftItems.ts` | Analysis | REPAIR |
| `shiftApprovalService.ts` | Operations | REPAIR |
| `pnlReadModelService.ts` | Finance | KEEP |
| `pnlExpenseDeriver.ts` | Finance | KEEP |
| `pnlSnapshot.service.ts` | Finance | KEEP |
| `labourAnalysis.ts` | Finance | KEEP |
| `primeCost.ts` | Finance | KEEP |
| `balanceService.ts` | Finance | KEEP |
| `bankingAuto.ts` | Finance | KEEP |
| `productCost.service.ts` | Cost Calculator | KEEP |
| `productActivation.service.ts` | Menu Management | KEEP |
| `productMenuView.ts` | Menu Management | KEEP |

### 1D — Middleware Files

| File | Feature | Classification |
|---|---|---|
| `server/middleware/bobAuth.ts` | Bob | **REMOVE** |
| `server/middleware/agentAuth.ts` | Agent Gateway / Agent Read | **REMOVE** |
| `server/middleware/blockLegacyIngredients.ts` | Ingredients | KEEP |
| `server/middleware/legacyProxies.ts` | Legacy | KEEP |
| `server/middleware/validateDailySalesForm.ts` | Daily Sales V2 | KEEP |
| `server/middleware/authGuard.ts` | Auth | KEEP |
| `server/middleware/roleGuard.ts` | Auth | KEEP |

### 1E — Config Files

| File | Feature | Classification |
|---|---|---|
| `server/config/toolRegistry.ts` | Agent Gateway / Bob | **REMOVE** |
| `server/config/scbConfig.ts` | SCB Payment | REPAIR |

### 1F — Agent Files (`server/agents/`)

| File | Feature | Classification |
|---|---|---|
| `server/agents/jussi.ts` | Jussi | **REMOVE** |
| `server/agents/jane.ts` | Jussi / AI Agents | **REMOVE** |
| `server/agents/ramsay.ts` | Jussi / AI Agents | **REMOVE** |
| `server/agents/marlo.ts` | AI Agents | **REMOVE** |
| `server/agents/ollie.ts` | AI Agents | **REMOVE** |
| `server/agents/sally.ts` | AI Agents | **REMOVE** |
| `server/agents/bigboss.ts` | AI Agents | **REMOVE** |

### 1G — Jobs Files (`server/jobs/`)

| File | Feature | Classification |
|---|---|---|
| `server/jobs/cron.ts` | Analysis / Reports / POS | REPAIR — runs ledger rebuilds + analytics cache |
| `server/jobs/cronEnsureShift.ts` | POS Sync | KEEP |

### 1H — Cron Files (`server/cron/`)

| File | Feature | Classification |
|---|---|---|
| `server/cron/dailyReportCron.ts` | Reports | KEEP |
| `server/cron/weeklyRosterDistributionCron.ts` | Staff Operations | KEEP |

### 1I — Scripts (`server/scripts/`)

| File | Feature | Classification |
|---|---|---|
| `run_daily_bob_analyst_ai_ops_loop.ts` | Bob | **REMOVE** |
| `seed_ai_ops_agents.ts` | AI Ops | **REMOVE** |
| `bootstrap_menu_online.sql` | Online Ordering | KEEP |
| `bootstrap_menu_online.ts` | Online Ordering | KEEP |
| `catalog_import_from_file.ts` | Online Ordering | KEEP |
| `import_menu_online_from_csv.ts` | Online Ordering | KEEP |
| `seed_burger_catalog.ts` | Online Ordering | KEEP |
| `seed_online_catalog_option_example.ts` | Online Ordering | KEEP |
| `importLoyverseRecipes.ts` | Recipes | KEEP |
| `importRecipeMappings.ts` | Recipes | KEEP |
| `migrateLegacyRecipeIngredients.ts` | Recipes | KEEP |
| `rebuildRecipeCoverage.ts` | Recipes | KEEP |
| `seedRecipesFromPOS.ts` | Recipes | KEEP |
| `rebuildIngredientUsage.ts` | Ingredients | KEEP |
| `seedIngredients.ts` | Ingredients | KEEP |
| `seed-ingredients.ts` | Ingredients | KEEP |
| `rebuildPnlExpenses.ts` | Finance | KEEP |
| `rebuildPnlReadModel.ts` | Finance | KEEP |
| `rebuildAlerts.ts` | Analysis | REPAIR |
| `rebuildReconciliation.ts` | Analysis | REPAIR |
| `rebuildSoldItems.ts` | Analysis | REPAIR |
| `all others (golden_*, validate_*, ingest*, patch*)` | Analysis / Debug | REPAIR |

### 1J — Migration Files

| File | Feature | Classification |
|---|---|---|
| `server/migrations/20260413_agent_read_foundation.sql` | Agent Read | **REMOVE** — adds tables for removed feature |
| All other migration files | Various | KEEP — schema history must not be deleted |

---

## 2. ROUTE INVENTORY

### Frontend Routes (App.tsx)

| Route | Component | Classification |
|---|---|---|
| `/` | → `/dashboard` | KEEP |
| `/login` | Login | KEEP |
| `/dashboard` | Home | KEEP |
| `/operations/daily-sales` | DailySalesForm | KEEP |
| `/operations/daily-sales/edit/:id` | DailySalesForm | KEEP |
| `/operations/daily-stock` | DailyStock | KEEP |
| `/operations/daily-sales-v2/library` | DailySalesV2Library | KEEP |
| `/operations/daily-sales-library` | → library | KEEP |
| `/operations/purchasing` | PurchasingPage | KEEP |
| `*` | NotFound | KEEP |

### RouteRegistry Constants — Classification

| Constant | Path | Classification |
|---|---|---|
| `PUBLIC_HOME` | `/` | KEEP |
| `HOME` / `DASHBOARD` | `/dashboard` | KEEP |
| `DAILY_STOCK` | `/operations/daily-stock` | KEEP |
| `DAILY_SALES_LIBRARY` | `/operations/daily-sales-v2/library` | KEEP |
| `PURCHASING` | `/operations/purchasing` | KEEP |
| `PURCHASING_MAPPING` | `/operations/purchasing-mapping` | REPAIR |
| `PURCHASING_SHIFT_LOG` | `/operations/purchasing-shift-log` | REPAIR |
| `PURCHASING_ANALYTICS` | `/operations/purchasing-analytics` | REPAIR |
| `PURCHASING_LIST` | `/operations/purchasing-list/:id` | REPAIR |
| `INGREDIENT_PURCHASING` | `/operations/ingredient-purchasing` | REPAIR |
| `ANALYSIS` | `/operations/analysis` | REPAIR |
| `DAILY_SHIFT_ANALYSIS` | `/analysis/daily-review` | REPAIR |
| `STOCK_REVIEW` | `/analysis/stock-review` | REPAIR |
| `STOCK_RECONCILIATION` | `/analysis/stock-reconciliation` | REPAIR |
| `EXPENSES` | `/operations/expenses` | REPAIR |
| `SHIFT_REPORTS` | `/operations/shift-reports` | REPAIR |
| `SYSTEM_HEALTH` | `/operations/system-health` | REPAIR |
| `AI_OPS_CONTROL` | `/operations/ai-ops-control` | **REMOVE** |
| `HEALTH_SAFETY_AUDIT` | `/operations/health-safety-audit` | REPAIR |
| `ISSUE_REGISTER` | `/operations/issue-register` | REPAIR |
| `FINANCE` | `/finance` | REPAIR |
| `PROFIT_LOSS` | `/finance/profit-loss` | REPAIR |
| `EXPENSES_IMPORT` | `/finance/expenses-import` | REPAIR |
| `EXPENSES_V2` | `/finance/expenses-v2` | REPAIR |
| `RECIPE_MANAGEMENT` | `/recipe-management` | REPAIR |
| `RECIPES` | `/menu/recipes` | REPAIR |
| `COST_CALCULATOR` | `/menu/cost-calculator` | REPAIR |
| `INGREDIENT_MANAGEMENT` | `/menu/ingredient-management` | REPAIR |
| `INGREDIENTS` | `/menu/ingredients` | REPAIR |
| `MENU_MGR` | `/menu/manager` | REPAIR |
| `MENU_MANAGEMENT` | `/menu-management` | REPAIR |
| `NIGHTLY_CHECKLIST` | `/managers/nightly-checklist` | REPAIR |
| `SHIFT_REPORT` | `/reports/shift-report` | REPAIR |
| `SHIFT_REPORT_HISTORY` | `/reports/shift-report/history` | REPAIR |
| `SHIFT_REPORT_VIEW` | `/reports/shift-report/view/:id` | REPAIR |
| `ONLINE_ORDERING` | `/marketing/online-ordering` | REPAIR |
| `ONLINE_ORDERING_CATALOG` | `/online-ordering/catalog` | REPAIR |
| `ORDER` | `/order` | REPAIR |
| `ORDER_CHECKOUT` | `/online-ordering/checkout` | REPAIR |
| `ORDER_CONFIRMATION` | `/online-ordering/confirmation` | REPAIR |
| `ADMIN_ORDERS` | `/admin/orders` | REPAIR |
| `JUSSI_AI` | `/ai/jussi-ops` | **REMOVE** |
| `JANE_ACCOUNTS` | `/ai/jane-accounts` | **REMOVE** |
| `MEMBERSHIP` | `/membership` | **REMOVE** |
| `MEMBERSHIP_DASHBOARD` | `/membership/dashboard` | **REMOVE** |
| `MEMBERSHIP_REGISTER` | `/membership/register` | **REMOVE** |
| `PARTNERS` | `/partners` | **REMOVE** |
| `PARTNERS_ANALYTICS` | `/partners/analytics` | **REMOVE** |
| `DELIVERY_ADMIN` | `/delivery/admin` | REPAIR |
| `DELIVERY_DRIVERS` | `/delivery/drivers` | REPAIR |
| `DELIVERY_HISTORY` | `/delivery/history` | REPAIR |
| `PUBLIC_MEMBERSHIP` | `/membership` | **REMOVE** |
| `PUBLIC_ONLINE_ORDERING` | `/online-ordering` | REPAIR |
| `MENU_DESC_TOOL` | `/menu/description-tool` | **REMOVE** — marketing machine |
| `MENU_ADMIN` | `/marketing/menu-admin` | REPAIR |

### Navigation Items

| Location | Label | Classification |
|---|---|---|
| Sidebar | Home | KEEP |
| Sidebar | Daily Sales V2 | KEEP |
| Sidebar | Daily Stock V2 | KEEP |
| Sidebar | Form Library | KEEP |
| Sidebar | Purchasing | KEEP |
| BottomNav | Home | KEEP |
| BottomNav | Finance | **REMOVE** dead link (route not registered) |
| BottomNav | Operations | KEEP |
| BottomNav | Purchasing | KEEP |
| BottomNav | Menu | **REMOVE** dead link (route not registered) |

---

## 3. API INVENTORY

### Auth

| Endpoint | Classification |
|---|---|
| `GET /api/ui-auth/check` | KEEP |
| `GET /api/pin-auth/me` | KEEP |
| `POST /api/pin-auth/login` | KEEP |
| `GET /api/auth/session` | KEEP |
| `POST /api/auth/*` (SaaS tenant) | REPAIR — SaaS tenant layer |

### Daily Sales V2 / Form Library

| Endpoint | Classification |
|---|---|
| `GET /api/forms/daily-sales/v2` | KEEP |
| `POST /api/forms/daily-sales/v3` | KEEP |
| `GET /api/library/daily-sales` | KEEP |
| `GET /api/forms/library` | KEEP |
| `GET /api/forms/:id` | KEEP |
| `POST /api/forms/:id/email` | KEEP |
| `GET /api/shift-report/latest` | KEEP |
| `GET /api/receipts/count` | KEEP |
| `GET /api/refunds` | KEEP |
| `GET /api/expense-suppliers` | KEEP |
| `GET /api/shift-expenses` | KEEP |

### Daily Stock V2

| Endpoint | Classification |
|---|---|
| `GET /api/daily-stock` (index.ts) | KEEP |
| `POST /api/daily-stock` (index.ts) | KEEP |
| `GET /api/daily-stock/:salesFormId` (index.ts) | KEEP |

### Purchasing

| Endpoint | Classification |
|---|---|
| `GET /api/purchasing-items` | KEEP |
| `POST/PUT/DELETE /api/purchasing-items` | KEEP |
| `GET /api/purchasing` | KEEP |
| `GET/POST /api/purchasing/drinks` | KEEP |
| `GET /api/purchasing-shift-log` | KEEP |
| `GET /api/purchasing-analytics` | KEEP |
| `GET /api/purchasing-list/:id` | KEEP |
| `GET /api/purchases` | KEEP |
| `GET/POST /api/purchase-tally` | KEEP |
| `GET /api/debug/purchasing` | REPAIR |

### POS Sync (Loyverse — lean core)

| Endpoint | Classification |
|---|---|
| `POST /api/loyverse/sync` | KEEP |
| `GET /api/loyverse/receipts` | KEEP |
| `GET /api/loyverse/shifts` | KEEP |
| `GET /api/system/pos-status` | KEEP |
| `POST /api/loyverse/ensure-shift` | KEEP |

### Ingredients

| Endpoint | Classification |
|---|---|
| `GET /api/ingredients` | KEEP |
| `GET /api/ingredients/search` | KEEP |
| `GET /api/ingredients/by-category` | KEEP |
| `GET/POST/PUT/DELETE /api/ingredient-master` | KEEP |
| `GET/POST /api/ingredient-authority` | KEEP |
| `GET/POST /api/admin/ingredient-authority` | KEEP |
| `GET /api/ingredients/legacy` | KEEP |
| `GET /api/analytics/ingredients` | KEEP |

### Recipes / Cost Calculator

| Endpoint | Classification |
|---|---|
| `GET/POST/PUT/DELETE /api/recipes` | KEEP |
| `GET/POST /api/recipe-mapping` | KEEP |
| `GET /api/costing` | KEEP |
| `GET /api/food-costings` | KEEP |

### Menu Management

| Endpoint | Classification |
|---|---|
| `GET/POST /api/menus` | KEEP |
| `GET/POST /api/menu-v3` | KEEP |
| `GET/POST /api/products` | KEEP |
| `GET/POST /api/products/ingredients` | KEEP |
| `POST /api/products/activate` | KEEP |
| `GET /api/admin/menu-canonical` | KEEP |
| `GET/POST /api/modifiers` | KEEP |
| `GET /api/skumap` | REPAIR |

### Online Ordering

| Endpoint | Classification |
|---|---|
| `GET /api/online-menu` | KEEP |
| `GET/POST /api/online-orders` | KEEP |
| `GET /api/stock-catalog` | KEEP |
| `POST /api/stock-catalog/import` | KEEP |

### Finance

| Endpoint | Classification |
|---|---|
| `GET /api/finance/profit-loss` | KEEP |
| `GET/POST /api/finance/*` | KEEP |
| `GET/POST /api/expenses` | KEEP |
| `GET/POST /api/expenses-import` | KEEP |
| `GET /api/balance` | KEEP |
| `GET/POST /api/bank-imports` | KEEP — **note: mounted TWICE at lines 4513 + 4514 in routes.ts** |
| `GET /api/expensesV2` | KEEP |
| `GET /api/profit-loss` | KEEP |
| `GET /api/prime-cost` | KEEP |

### Reports

| Endpoint | Classification |
|---|---|
| `GET /api/shift-report/*` | KEEP |
| `GET/POST /api/shift-reports` | KEEP |
| `GET /api/reports/sales-summary` | KEEP |
| `GET /api/reports/financial-overview` | KEEP |
| `GET /api/reports/performance-metrics` | KEEP |
| `GET /api/daily-review-comments` | REPAIR |
| `GET /api/analysis/daily-review` | REPAIR |
| `GET /internal/api/reports` | **REMOVE** — `internalReports.ts` is a Bob read surface |

### Analysis (no frontend page — backend healthy)

| Endpoint | Classification |
|---|---|
| `GET /api/analysis/v3/*` | KEEP — POS truth layer |
| `GET /api/analysis/drinks` | REPAIR |
| `GET /api/analysis/burgers` | REPAIR |
| `GET /api/analysis/buns` | REPAIR |
| `GET /api/analysis/meat` | REPAIR |
| `GET /api/analysis/fries` | REPAIR |
| `GET /api/analysis/sweet-potato` | REPAIR |
| `GET /api/analysis/side-orders` | REPAIR |
| `GET /api/analysis/rolls-ledger` | REPAIR |
| `GET /api/analysis/meat-ledger` | REPAIR |
| `GET /api/analysis/drinks-ledger` | REPAIR |
| `GET /api/analysis/stock-reconciliation` | REPAIR |
| `GET /api/analysis/ingredient-usage` | REPAIR |
| `GET /api/analysis/modifier-rules` | REPAIR |
| `GET /api/analysis/receipts-summary` | REPAIR |
| `GET /api/analysis/latest` | REPAIR |
| `GET /api/analysis/:id` | REPAIR |
| `GET /api/analysis/list` | REPAIR |
| `GET /api/analysis/search` | REPAIR |
| `POST /api/analysis/upload` | REPAIR |
| `POST /api/analysis/trigger` | REPAIR |
| `POST /api/analysis/ingredient-usage/rebuild` | REPAIR |
| `GET /api/analysis/snapshot/:id` | REPAIR |
| `GET /api/analysis/shift` | REPAIR |
| `GET /api/analysis/manual-ledger` | REPAIR |
| `GET /api/analysis/receipts/burgers` | REPAIR |
| `GET /api/pos/batches` | **REMOVE** — POS Terminal |
| `POST /api/pos/upload-bundle` | **REMOVE** — POS Terminal |
| `GET /api/pos/:batchId/analyze` | **REMOVE** — POS Terminal |
| `GET /api/pos/live/*` | **REMOVE** — POS Terminal |
| `GET /api/pos/items/*` | **REMOVE** — POS Terminal |
| `GET /api/pos/usage/*` | **REMOVE** — POS Terminal |

### Health & Safety

| Endpoint | Classification |
|---|---|
| `GET/POST /api/health-safety/questions` | REPAIR |
| `GET/POST /api/health-safety/audits` | REPAIR |
| `GET /api/health-safety/pdf` | REPAIR |

### Staff Operations

| Endpoint | Classification |
|---|---|
| `GET/POST /api/operations/staff/*` | KEEP — no frontend route yet (REPAIR for frontend) |
| `GET/POST /api/staff/*` | KEEP |

### Manager Checklist

| Endpoint | Classification |
|---|---|
| `GET /api/manager-checklist/questions` | REPAIR |
| `GET /api/manager-checklist/nightly` | REPAIR |
| `GET /api/manager-checklist/status` | REPAIR |
| `GET/POST /api/manager-check` | REPAIR |

### Shopping List

| Endpoint | Classification |
|---|---|
| `GET /api/shopping-list` | REPAIR |
| `GET /api/shopping-lists` | REPAIR |
| `GET /api/purchasing-list` | REPAIR |

### Issue Register / Security

| Endpoint | Classification |
|---|---|
| `GET/POST /api/issue-register` | REPAIR |
| `GET/POST /api/shift-approval` | REPAIR |

### System

| Endpoint | Classification |
|---|---|
| `GET /api/system-health` | REPAIR |
| `GET /api/system/pos-status` | KEEP |

### Bob / AI Ops / Agents — ALL REMOVE

| Endpoint | Classification |
|---|---|
| `GET/POST /api/gateway/*` | **REMOVE** |
| `GET/POST /api/bob/read/*` | **REMOVE** |
| `GET/POST /api/ops/ai/*` | **REMOVE** |
| `GET/POST /api/ai-ops/*` (all sub-paths) | **REMOVE** |
| `GET/POST /api/bob/*` | **REMOVE** |
| `GET/POST /api/agent/read/*` | **REMOVE** |
| `GET/POST /api/ai-ops/bob/*` | **REMOVE** |
| `GET/POST /api/ai/chat` | **REMOVE** |
| `POST /chat/jussi` | **REMOVE** |
| `POST /chat/jane` | **REMOVE** |
| `POST /chat/ramsay` | **REMOVE** |
| `POST /chat/:agent` | **REMOVE** |
| `GET /internal/api/reports` | **REMOVE** |
| `POST /api/analysis/trigger` (Bob rebuild trigger) | **REMOVE** |

### Payment (SCB / Stripe — linked to Online Ordering)

| Endpoint | Classification |
|---|---|
| `GET /api/payment-providers/list` | REPAIR |
| `POST /api/payments/process` | REPAIR |

---

## 4. CRON INVENTORY

| Cron Job | Source | Schedule | Classification | Notes |
|---|---|---|---|---|
| Incremental Loyverse POS sync | `server/services/scheduler.ts` | Every 15 minutes | **KEEP** | Core POS receipt ingest |
| Daily Loyverse full sync | `server/services/scheduler.ts` | 3:00 AM Bangkok | **KEEP** | Full receipt + shift sync |
| Email daily sales summary | `server/services/scheduler.ts` | 9:00 AM Bangkok | **KEEP** | Management email |
| Burger metrics cache rebuild | `server/services/scheduler.ts` | 3:10 AM Bangkok | REPAIR | Feeds analysis pages |
| Daily Review POS ingestion | `server/services/scheduler.ts` | 3:15 AM Bangkok | REPAIR | Feeds daily review |
| Shift Analytics MM cache | `server/services/scheduler.ts` | 3:20 AM Bangkok | REPAIR | Feeds shift analytics |
| Scheduled analysis build | `server/services/scheduledAnalysisBuild.ts` | 4:30 AM Bangkok | **REMOVE** | Feeds deleted analysis V2 pages |
| Daily Report V2 PDF + email | `server/cron/dailyReportCron.ts` | 3:00 AM Bangkok | **KEEP** | Compiles and emails daily report PDF |
| Weekly Roster Distribution | `server/cron/weeklyRosterDistributionCron.ts` | Sunday 3:30 AM Bangkok | **KEEP** | Staff Operations — roster export |
| Shift Report V2 auto-gen + email | `server/index.ts` inline | 3:10 AM Bangkok | **KEEP** | Builds and emails nightly shift report |
| Shift snapshot POS ingestion | `server/index.ts` inline | 8:00 AM Bangkok | **KEEP** | Stores shift_snapshot_v2 |
| Daily shift anomaly audit email | `server/index.ts` inline | 8:00 AM Bangkok | **KEEP** | Anomaly detection email |
| Daily Review email (cronEmailService) | `server/services/cronEmailService.ts` | 9:00 AM Bangkok | **KEEP** | Daily Review email to management |
| Bob auto-daily analysis | `server/index.ts` inline | 9:00 AM Bangkok | **REMOVE** | Calls /api/ai-ops/bob/run-analysis |
| Jussi Daily Cron (setInterval) | `server/index.ts` inline | 3:00 AM Bangkok (polling) | **REMOVE** | Generates Jussi report to no consumer |
| KDS auto-complete | `server/index.ts` inline | Every 2 minutes | **REMOVE** | KDS — no terminal in use |
| Ensure shift (02:55 BKK) | `server/jobs/cron.ts` | 2:55 AM Bangkok | **KEEP** | POS data readiness check |
| Analytics cache rebuild (03:05 BKK) | `server/jobs/cron.ts` | 3:05 AM Bangkok | REPAIR | Shift analytics; depends on analysis pages |
| Ledger parity rebuild (03:15 BKK) | `server/jobs/cron.ts` | 3:15 AM Bangkok | REPAIR | Rolls/meat/drinks ledger |
| Hourly safety re-run | `server/jobs/cron.ts` | Hourly | REPAIR | In-progress shift re-run |
| Monitor engine scheduler | `server/routes/aiOpsControl.ts` | Daily | **REMOVE** | Only caller is aiOpsControl |

**Disabled crons (already removed in Pass 2, verify they are gone):**
- `analysisBuildOrchestrator` startup catch-up — DISABLED
- `startShiftRebuildScheduler` (03:05 BKK) — DISABLED

---

## 5. DATABASE TABLE INVENTORY

### Lean Core — KEEP (Protected)

| Table | Type | Feature | Classification |
|---|---|---|---|
| `daily_sales_v2` | Prisma (raw SQL) | Daily Sales V2 | **KEEP** |
| `receipts` | Prisma | POS receipts | **KEEP** |
| `loyverse_shifts` | Prisma | Loyverse shift context | **KEEP** |
| `lv_receipt` | Prisma | POS truth layer | **KEEP** — hard-locked |
| `lv_line_item` | Prisma | POS truth layer | **KEEP** — hard-locked |
| `lv_modifier` | Prisma | POS truth layer | **KEEP** — hard-locked |
| `purchasing_items` | Prisma | Purchasing catalog | **KEEP** |
| `users` | Drizzle | Auth | **KEEP** |

### Ingredients — KEEP

| Table | Type | Classification |
|---|---|---|
| `ingredients` | Drizzle | **KEEP** |
| `ingredient_v2` | Prisma | **KEEP** |
| `ingredient_authority` | Drizzle | **KEEP** |

### Recipes — KEEP

| Table | Type | Classification |
|---|---|---|
| `recipes` | Drizzle | **KEEP** |
| `recipe_ingredients` | Drizzle | **KEEP** |

### Menu Management — KEEP

| Table | Type | Classification |
|---|---|---|
| `menu_items` | Drizzle | **KEEP** |
| `online_catalog_items` | Drizzle | **KEEP** |

### Finance — KEEP

| Table | Type | Classification |
|---|---|---|
| `expense_entry` | Drizzle | **KEEP** |
| `expense_suppliers` | Drizzle | **KEEP** |
| `expense_categories` | Drizzle | **KEEP** |
| `expense_type_lkp` | Drizzle | **KEEP** |
| `supplier_lkp` | Drizzle | **KEEP** |
| `expense_import_batch` | Drizzle | **KEEP** |
| `expense_import_line` | Drizzle | **KEEP** |
| `bank_statements` | Drizzle | **KEEP** |
| `transactions` | Drizzle | **KEEP** |
| `pl_row` | Drizzle | **KEEP** |
| `pl_category_map` | Drizzle | **KEEP** |
| `pl_month_cache` | Drizzle | **KEEP** |
| `vendors` | Drizzle | **KEEP** |
| `vendor_aliases` | Drizzle | **KEEP** |
| `categories` | Drizzle | **KEEP** |
| `suppliers` | Drizzle | **KEEP** |

### Reports — KEEP

| Table | Type | Classification |
|---|---|---|
| `shift_reports` | Drizzle | **KEEP** |
| `shift_sales` | Drizzle | **KEEP** |
| `shift_purchases` | Drizzle | **KEEP** |
| `shift_item_sales` | Drizzle | **KEEP** |
| `shift_modifier_sales` | Drizzle | **KEEP** |
| `shift_summary` | Drizzle | **KEEP** |
| `daily_shift_receipt_summary` | Drizzle | **KEEP** |
| `daily_shift_summary` | Drizzle | **KEEP** |
| `daily_receipt_summaries` | Drizzle | **KEEP** |

### Staff Operations — KEEP (16 tables)

| Table | Type | Classification |
|---|---|---|
| `work_areas` | Drizzle | **KEEP** |
| `shift_templates` | Drizzle | **KEEP** |
| `shift_template_station_requirements` | Drizzle | **KEEP** |
| `staff_members` | Drizzle | **KEEP** |
| `staff_availability` | Drizzle | **KEEP** |
| `staff_unavailability` | Drizzle | **KEEP** |
| `shift_rosters` | Drizzle | **KEEP** |
| `shift_staff_assignments` | Drizzle | **KEEP** |
| `shift_breaks` | Drizzle | **KEEP** |
| `cleaning_tasks` | Drizzle | **KEEP** |
| `cleaning_task_templates` | Drizzle | **KEEP** |
| `shift_cleaning_tasks` | Drizzle | **KEEP** |
| `deep_cleaning_tasks` | Drizzle | **KEEP** |
| `staff_shifts` | Drizzle | **KEEP** |

### Analysis / Stock — REPAIR (keep table, build frontend)

| Table | Type | Classification |
|---|---|---|
| `receipt_truth_daily_usage` | Prisma | REPAIR |
| `receipt_truth_usage_rule` | Prisma | REPAIR |
| `analysis_build_status` | Prisma | REPAIR |
| `stock_purchase_rolls` | Drizzle | REPAIR |
| `stock_purchase_drinks` | Drizzle | REPAIR |
| `stock_purchase_meat` | Drizzle | REPAIR |
| `purchase_tally` | Drizzle | REPAIR |
| `purchase_tally_drink` | Drizzle | REPAIR |
| `uploaded_reports` | Drizzle | REPAIR |
| `daily_stock_sales` | Drizzle | REPAIR |
| `stock_entries` | Drizzle | REPAIR |
| `inventory` | Drizzle | REPAIR |

### Shopping List — REPAIR

| Table | Type | Classification |
|---|---|---|
| `shopping_list` | Drizzle | REPAIR |
| `shopping_master` | Drizzle | REPAIR |

### Loyverse POS Sync — KEEP

| Table | Type | Classification |
|---|---|---|
| `loyverse_receipts` | Drizzle | **KEEP** |
| `loyverse_shift_reports` | Drizzle | **KEEP** |

### REMOVE — POS Terminal

| Table | Type | Classification | Notes |
|---|---|---|---|
| `pos_batch` | Drizzle | **REMOVE** | POS Terminal — not Loyverse |
| `pos_receipt` | Drizzle | **REMOVE** | POS Terminal |
| `pos_shift_report` | Drizzle | **REMOVE** | POS Terminal |
| `pos_sales_item` | Drizzle | **REMOVE** | POS Terminal |
| `pos_sales_modifier` | Drizzle | **REMOVE** | POS Terminal |
| `pos_payment_summary` | Drizzle | **REMOVE** | POS Terminal |

### REMOVE — Partner Systems

| Table | Type | Classification |
|---|---|---|
| `partner_statements` | Drizzle | **REMOVE** |

### REMOVE — Marketing Machine

| Table | Type | Classification |
|---|---|---|
| `marketing_calendar` | Drizzle | **REMOVE** |

### REMOVE — Misc (Bob / Jussi)

| Table | Type | Classification | Notes |
|---|---|---|---|
| `chat_logs` | Drizzle | **REMOVE** | AI chat history for Jussi/agents |
| `ai_insights` | Drizzle | **REMOVE** | AI-generated insights (Bob/analysis) |
| `ai_tasks` | Prisma | **REMOVE** | Bob work register |
| `agent_tokens` | Prisma (if exists) | **REMOVE** | Agent auth tokens |
| `shift_rebuild_log` | Prisma | **REMOVE** | Nightly shift rebuild log (aiOpsControl) |
| `quick_notes` | Drizzle | **REMOVE** | No route, no frontend, no consumer |

---

## 6. DEPENDENCY MAP

### Bob — What Imports / References It

```
server/index.ts
  └── imports agentGateway → server/routes/agentGateway.ts
  └── imports bobRead → server/routes/bobRead.ts
  └── imports aiOpsControl → server/routes/aiOpsControl.ts
       ├── exports bobAliasRouter (mounted at /api/bob)
       └── exports chatAliasRouter (mounted at /api/ai/chat)
  └── imports bobCanonicalRead → server/routes/bobCanonicalRead.ts
  └── imports agentRead → server/routes/agentRead.ts
  └── inline cron: Bob auto-daily analysis at 9AM → calls /api/ai-ops/bob/run-analysis

server/routes/aiOpsControl.ts (4915 lines)
  └── imports bobCanonicalReadService.ts
  └── imports bobInterpretationService.ts
  └── imports bobWorkspace.ts
  └── imports monitorEngine.ts → startMonitorScheduler() called at module load
  └── imports analysisBuildOrchestrator.ts (via adminSync)

server/routes/adminSync.ts
  └── imports analysisBuildOrchestrator.ts
  └── mounted at /api in index.ts

server/services/scheduler.ts
  └── imports analysisBuildOrchestrator.ts (line 309)

server/middleware/bobAuth.ts
  └── referenced by bobRead.ts, bobCanonicalRead.ts, agentRead.ts

server/middleware/agentAuth.ts
  └── referenced by agentGateway.ts, agentRead.ts

server/config/toolRegistry.ts
  └── imported by agentGateway.ts

server/scripts/run_daily_bob_analyst_ai_ops_loop.ts
  └── imports dailyBobAnalystAiOpsLoop.ts
  └── standalone script — not imported elsewhere

server/scripts/seed_ai_ops_agents.ts
  └── standalone script — not imported elsewhere
```

### Jussi — What Imports / References It

```
server/index.ts
  └── inline /chat/:agent route: imports from server/agents/jussi.ts, jane.ts, ramsay.ts
  └── inline Jussi Daily Cron (setInterval): imports summaryGenerator.js for generateJussiReport
  └── inline /chat/jussi, /chat/jane, /chat/ramsay route handlers

server/routes.ts
  └── line 73: import { analyzeShift } from "../src/server/jussi/analysis"
       └── This is a dead import — analyzeShift is not used in any active route after PHASE M deletion

server/agents/jussi.ts — standalone, only imported by index.ts /chat/ handler
server/agents/jane.ts — standalone
server/agents/ramsay.ts — standalone
server/agents/marlo.ts — standalone (not referenced in index.ts /chat/ handler — orphan)
server/agents/ollie.ts — standalone orphan
server/agents/sally.ts — standalone orphan
server/agents/bigboss.ts — standalone orphan

server/services/jussiDailySummaryService.ts
  └── imported by agents/jussi.ts
server/services/jussiLatestShiftService.ts
  └── imported by agents/jussi.ts
server/services/jussiShiftSummarizer.ts
  └── imported by jussiDailySummaryService.ts
server/services/jussi/runJussiDaily.js
  └── standalone script — not imported
server/services/jussi/runJussi.js
  └── standalone script — not imported

client/src/components/JussiChatBubble.tsx
  └── check App.tsx and page files — likely orphaned (no route)
```

### KDS — What Imports / References It

```
server/index.ts
  └── inline cron every 2 min: imports kdsService.autoCompleteOldOrders

client/src/components/KDS.tsx
  └── check imports in pages — likely orphaned (no route)
```

### POS Terminal — What Imports / References It

```
server/routes.ts
  └── import posLive from "./routes/posLive"
  └── import posItems from "./routes/posItems"
  └── import posUsage from "./routes/posUsage"
  └── app.use('/api/pos', posLive)   (line 4785)
  └── app.use('/api/pos', posItems)  (line 4786)
  └── app.use('/api/pos', posUsage)  (line 4787)
  └── commented out: posReceipts, posAnalysis

server/routes.ts inline routes (lines 368–407)
  └── POST /api/pos/upload-bundle → importPosBundle
  └── GET  /api/pos/batches
  └── GET  /api/pos/:batchId/analyze

server/routes/posUpload.ts
  └── imports posBlaze.ts (line 4 of posUpload.ts)

server/index.ts
  └── app.use('/api/pos', posUploadRouter) (line 335) — imports posUpload.ts
```

### Partner Systems — What Imports / References It

```
server/services/partnerTracker.ts
  └── No imports found in route files — standalone service, orphaned
  └── partner_statements table in shared/schema.ts

shared/schema.ts
  └── partnerStatements table definition (line 1443)
```

### Marketing Machine — What Imports / References It

```
shared/schema.ts
  └── marketingCalendar table definition (line 771)
  └── No route file imports this table directly

RouteRegistry.ts
  └── MENU_DESC_TOOL: "/menu/description-tool" — marketing content generation tool
```

### Membership — What Imports / References It

```
RouteRegistry.ts
  └── PUBLIC_MEMBERSHIP, MEMBERSHIP, MEMBERSHIP_DASHBOARD, MEMBERSHIP_REGISTER paths
  └── No backend route files found for membership
  └── No database tables found for membership
  └── Conclusion: constants only — safe to remove from RouteRegistry
```

### analysisBuildOrchestrator — Caller Chain

```
server/services/analysisBuildOrchestrator.ts
  ← imported by server/services/scheduler.ts (line 309) — inside schedulerService.start()
  ← imported by server/routes/adminSync.ts (line 49) — POST /api/admin/sync-analysis
  ← startup call already DISABLED in Pass 2

If adminSync.ts is REMOVE:
  → server/index.ts no longer needs: const adminSyncRouter = (await import('./routes/adminSync.js'))
  → scheduler.ts call to analysisBuildOrchestrator should also be removed
```

---

## 7. DELETION PLAN — REMOVE ITEMS ONLY

> **This is a plan only. No action has been taken.**  
> Execute in order: imports first, then route mounts, then files, then tables last.

---

### PHASE A — Remove Bob

#### A1. Remove route mounts from `server/index.ts`

| Line (approx) | Mount to remove |
|---|---|
| 629 | `const agentGatewayRouter = ...` |
| 630 | `app.use('/api/gateway', agentGatewayRouter)` |
| 634 | `const bobReadRouter = ...` |
| 635 | `app.use('/api/bob/read', bobReadRouter)` |
| 638–642 | `const aiOpsModule = ...` + `app.use('/api/ops/ai', ...)` + `app.use('/api/ai-ops', ...)` |
| 645 | `app.use('/api/bob', bobAliasRouter)` |
| 656–657 | `const agentReadRouter = ...` + `app.use('/api/agent/read', agentReadRouter)` |
| 661–662 | `const bobCanonicalReadRouter = ...` + `app.use('/api/ai-ops/bob', bobCanonicalReadRouter)` |
| 674 | `app.use('/api/ai/chat', chatAliasRouter)` |
| 824–839 | Bob auto-daily analysis cron block (9AM Bangkok) |
| 608–609 | `const adminSyncRouter = ...` + `app.use('/api', adminSyncRouter)` |

#### A2. Remove route files (DELETE)

- `server/routes/agentGateway.ts`
- `server/routes/agentRead.ts`
- `server/routes/aiOpsControl.ts`
- `server/routes/bobCanonicalRead.ts`
- `server/routes/bobRead.ts`
- `server/routes/adminSync.ts`
- `server/routes/internalReports.ts`

#### A3. Remove import from `server/routes.ts`

- Line 1225: Remove `app.use("/internal/api/reports", internalReports)` and its import

#### A4. Remove service files (DELETE)

- `server/services/aiAnalysisService.ts`
- `server/services/analysisBuildOrchestrator.ts`
- `server/services/bobCanonicalReadService.ts`
- `server/services/bobInterpretationService.ts`
- `server/services/bobWorkspace.ts`
- `server/services/dailyBobAnalystAiOpsLoop.ts`
- `server/services/scheduledAnalysisBuild.ts`
- `server/services/shiftRebuildScheduler.ts`
- `server/services/monitorEngine.ts`

#### A5. Remove middleware (DELETE)

- `server/middleware/bobAuth.ts`
- `server/middleware/agentAuth.ts`

#### A6. Remove config (DELETE)

- `server/config/toolRegistry.ts`

#### A7. Remove scripts (DELETE)

- `server/scripts/run_daily_bob_analyst_ai_ops_loop.ts`
- `server/scripts/seed_ai_ops_agents.ts`

#### A8. Fix import in `server/services/scheduler.ts`

- Line 309: Remove the dynamic import of `analysisBuildOrchestrator.ensureAnalysisForDate`

#### A9. Remove migration (DELETE)

- `server/migrations/20260413_agent_read_foundation.sql`

---

### PHASE B — Remove Jussi and All AI Agents

#### B1. Remove route handlers from `server/index.ts`

| Block | What to remove |
|---|---|
| Lines 541–555 | `/chat/:agent` route handler (imports jussiHandler, janeHandler, ramsayHandler) |
| Lines 753–767 | Jussi Daily Cron setInterval block |

#### B2. Remove agent files (DELETE)

- `server/agents/jussi.ts`
- `server/agents/jane.ts`
- `server/agents/ramsay.ts`
- `server/agents/marlo.ts`
- `server/agents/ollie.ts`
- `server/agents/sally.ts`
- `server/agents/bigboss.ts`

#### B3. Remove service files (DELETE)

- `server/services/jussiDailySummaryService.ts`
- `server/services/jussiLatestShiftService.ts`
- `server/services/jussiShiftSummarizer.ts`
- `server/services/jussi/runJussiDaily.js`
- `server/services/jussi/runJussi.js`
- `server/services/jussi/` (directory)

#### B4. Remove frontend component (DELETE)

- `client/src/components/JussiChatBubble.tsx`

#### B5. Remove dead import from `server/routes.ts`

- Line 73: `import { analyzeShift } from "../src/server/jussi/analysis"` — dead import, remove

#### B6. Remove RouteRegistry constants

From `client/src/router/RouteRegistry.ts`, delete:
- `JUSSI_AI`
- `JANE_ACCOUNTS`

---

### PHASE C — Remove KDS

#### C1. Remove cron from `server/index.ts`

- Lines 849–854: KDS auto-complete cron block (`*/2 * * * *`)

#### C2. Remove service file (DELETE)

- `server/services/kdsService.ts`

#### C3. Remove frontend component (DELETE)

- `client/src/components/KDS.tsx`

---

### PHASE D — Remove POS Terminal

#### D1. Remove route mounts from `server/routes.ts`

- Line 4785: `app.use('/api/pos', posLive)`
- Line 4786: `app.use('/api/pos', posItems)`
- Line 4787: `app.use('/api/pos', posUsage)`
- Lines 368–407: inline blocks for `/api/pos/upload-bundle`, `/api/pos/batches`, `/api/pos/:batchId/analyze`

#### D2. Remove imports from `server/routes.ts`

- `import posLive from "./routes/posLive"` (line 18)
- `import posItems from "./routes/posItems"` (line 19)
- `import posUsage from "./routes/posUsage"` (line 20)

#### D3. Remove route mount from `server/index.ts`

- Line 335: `app.use('/api/pos', posUploadRouter)` and its import

#### D4. Remove route files (DELETE)

- `server/routes/posBlaze.ts`
- `server/routes/posLive.ts`
- `server/routes/posItems.ts`
- `server/routes/posUsage.ts`
- `server/routes/posAnalysis.ts`
- `server/routes/posReceipts.ts`
- `server/routes/posUpload.ts`

#### D5. Remove RouteRegistry constants (no frontend pages, but clean the constants)

No RouteRegistry constants exist for POS Terminal — no action needed.

---

### PHASE E — Remove Partner Systems

#### E1. Remove service file (DELETE)

- `server/services/partnerTracker.ts`

#### E2. Remove RouteRegistry constants

From `client/src/router/RouteRegistry.ts`, delete:
- `PARTNERS`
- `PARTNERS_ANALYTICS`

#### E3. Database table (DROP — deferred, plan only)

```sql
-- Run only after confirming no foreign key dependencies
DROP TABLE IF EXISTS partner_statements;
```

#### E4. Remove from `shared/schema.ts`

- Remove `partnerStatements` table definition (line 1443)

---

### PHASE F — Remove Marketing Machine

#### F1. Remove RouteRegistry constants

From `client/src/router/RouteRegistry.ts`, delete:
- `MENU_DESC_TOOL`

#### F2. Database table (DROP — deferred, plan only)

```sql
DROP TABLE IF EXISTS marketing_calendar;
```

#### F3. Remove from `shared/schema.ts`

- Remove `marketingCalendar` table definition (line 771)

---

### PHASE G — Remove Membership

#### G1. Remove RouteRegistry constants

From `client/src/router/RouteRegistry.ts`, delete:
- `PUBLIC_MEMBERSHIP`
- `MEMBERSHIP`
- `MEMBERSHIP_DASHBOARD`
- `MEMBERSHIP_REGISTER`

No backend files found. No database tables found. RouteRegistry cleanup only.

---

### PHASE H — Remove POS Terminal Database Tables

#### H1. Remove from `shared/schema.ts` (DELETE Drizzle definitions)

- `posBatch` (line 1117)
- `posReceipt` (line 1126)
- `posShiftReport` (line 1138)
- `posSalesItem` (line 1153)
- `posSalesModifier` (line 1163)
- `posPaymentSummary` (line 1173)

#### H2. Database DROP (deferred, plan only)

```sql
-- Run only after all route files and services are removed
DROP TABLE IF EXISTS pos_payment_summary;
DROP TABLE IF EXISTS pos_sales_modifier;
DROP TABLE IF EXISTS pos_sales_item;
DROP TABLE IF EXISTS pos_shift_report;
DROP TABLE IF EXISTS pos_receipt;
DROP TABLE IF EXISTS pos_batch;
```

---

### PHASE I — Remove Bob/Jussi Misc Tables

#### I1. Remove from `shared/schema.ts`

- `chatLogs` / `chat_logs` — Jussi AI chat history
- `aiInsights` / `ai_insights` — Bob AI insights
- `quickNotes` / `quick_notes` — orphaned, no consumer

#### I2. Database DROP (deferred, plan only)

```sql
DROP TABLE IF EXISTS chat_logs;
DROP TABLE IF EXISTS ai_insights;
DROP TABLE IF EXISTS quick_notes;
-- Prisma tables (via Prisma migration):
-- ai_tasks, shift_rebuild_log
```

---

### PHASE J — Clean BottomNav Dead Links

From `client/src/components/navigation/BottomNav.tsx`:
- Remove Finance link (`/finance`) — dead link, no route registered
- Remove Menu link (`/recipe-management`) — dead link, no route registered

---

### PHASE K — Verify Disabled Crons Are Fully Removed

Verify these blocks were fully removed in Pass 2 (confirm no remaining calls):
- `analysisBuildOrchestrator.runStartupCatchup()` — should be gone from `server/index.ts`
- `startShiftRebuildScheduler()` — should be gone from `server/routes/aiOpsControl.ts` (but since the whole file is REMOVE, moot)

---

## EXECUTION ORDER SUMMARY

| Phase | Target | Pre-condition |
|---|---|---|
| A | Bob (routes, services, middleware, config, scripts) | None — do first |
| B | Jussi + All AI Agents | Phase A complete |
| C | KDS | Phase A complete |
| D | POS Terminal | Phase A complete |
| E | Partner Systems | None |
| F | Marketing Machine | None |
| G | Membership (RouteRegistry only) | None |
| H | POS Terminal DB tables | Phase D complete + verify no FK deps |
| I | Chat/AI/Notes DB tables | Phase A+B complete + verify no FK deps |
| J | BottomNav dead links | None |
| K | Verify disabled crons are clean | Phase A complete |

**Do not drop any database table until all route files and service files referencing it have been removed and the server is confirmed running without errors.**
