# FINAL DB 5.0 — RESTORED BASELINE TRUTH AUDIT
**Date:** 29 May 2026  
**State:** Post DB 5.0 Pass 1 + Pass 2 cleanup. No further edits made for this audit.  
**Method:** Live server probes, file reads, route tracing. No synthetic data used.

---

## 1. FRONTEND NAVIGATION

### ModernSidebar (client/src/components/navigation/ModernSidebar.tsx)
All items render inside a single "Core" group. No other groups are active.

| Label | Route | Component File | Loads | Business Purpose | Classification |
|---|---|---|---|---|---|
| Home | `/dashboard` | `pages/Home.tsx` | YES | Launch pad — links to 4 core operations | KEEP |
| Daily Sales V2 | `/operations/daily-sales` | `pages/operations/daily-sales/Form.tsx` | YES | End-of-shift cash, expenses, sales data entry | KEEP |
| Daily Stock V2 | `/operations/daily-stock` | `pages/operations/DailyStock.tsx` | YES | End-of-shift ingredient stock count | KEEP |
| Form Library | `/operations/daily-sales-v2/library` | `pages/operations/daily-sales-v2/Library.tsx` | YES | Owner-only archive of submitted shift forms | KEEP |
| Purchasing | `/operations/purchasing` | `pages/operations/Purchasing.tsx` | YES | Purchasing items catalog management | KEEP |

### BottomNav (client/src/components/navigation/BottomNav.tsx)
Mobile bottom navigation bar. Five items, three working.

| Label | Route | Loads | Notes | Classification |
|---|---|---|---|---|
| Home | `/` | YES | Redirects to `/dashboard` | KEEP |
| Finance | `/finance` | NO | Route not registered in App.tsx — hits NotFound | DELETE (dead link) |
| Operations | `/operations/daily-sales` | YES | Opens Daily Sales V2 form | KEEP |
| Purchasing | `/operations/purchasing` | YES | Opens Purchasing page | KEEP |
| Menu | `/recipe-management` | NO | Route not registered in App.tsx — hits NotFound | DELETE (dead link) |

---

## 2. FRONTEND ROUTES

### Registered in App.tsx

| Route Path | Component | File Exists | Page Loads | API Calls | Classification |
|---|---|---|---|---|---|
| `/` | Navigate → `/dashboard` | — | YES | None | KEEP |
| `/login` | `Login` | YES | YES | `/api/ui-auth/check`, `/api/pin-auth/me` | KEEP |
| `/dashboard` | `Home` | YES | YES | None (pure nav grid) | KEEP |
| `/operations/daily-sales` | `DailySalesForm` | YES | YES | `/api/forms/daily-sales/v2`, `/api/receipts/count`, `/api/expense-suppliers`, `/api/ingredients`, `/api/refunds`, `/api/shift-report/latest` | KEEP |
| `/operations/daily-sales/edit/:id` | `DailySalesForm` | YES | YES | Same as above + form id lookup | KEEP |
| `/operations/daily-stock` | `DailyStock` | YES | YES | `/api/daily-stock`, `/api/ingredients`, `/api/purchasing-items` | KEEP |
| `/operations/daily-sales-v2/library` | `DailySalesV2Library` | YES | YES | `/api/library/daily-sales`, `/api/forms/library` | KEEP |
| `/operations/daily-sales-library` | Navigate → library | — | YES | None (redirect) | KEEP |
| `/operations/purchasing` | `PurchasingPage` | YES | YES | `/api/purchasing-items`, `/api/purchasing` | KEEP |
| `*` | `NotFound` | YES | YES | None | KEEP |

### Defined in RouteRegistry.ts — NOT wired in App.tsx
These paths exist as constants only. No component is assigned to them in the router.

| Path Constant | Route Path | Component File Exists | Classification |
|---|---|---|---|
| `ANALYSIS` | `/operations/analysis` | NO | DELETE |
| `SHOPPING_LIST` | `/operations/shopping-list` | NO | UNSURE |
| `PURCHASING_MAPPING` | `/operations/purchasing-mapping` | NO | UNSURE |
| `PURCHASING_SHIFT_LOG` | `/operations/purchasing-shift-log` | NO | UNSURE |
| `PURCHASING_ANALYTICS` | `/operations/purchasing-analytics` | NO | UNSURE |
| `DAILY_SHIFT_ANALYSIS` | `/analysis/daily-review` | NO | DELETE |
| `STOCK_REVIEW` | `/analysis/stock-review` | NO | DELETE |
| `STOCK_RECONCILIATION` | `/analysis/stock-reconciliation` | NO | DELETE |
| `EXPENSES` | `/operations/expenses` | NO | UNSURE |
| `SHIFT_REPORTS` | `/operations/shift-reports` | NO | UNSURE |
| `SYSTEM_HEALTH` | `/operations/system-health` | NO | UNSURE |
| `AI_OPS_CONTROL` | `/operations/ai-ops-control` | NO | UNSURE |
| `HEALTH_SAFETY_AUDIT` | `/operations/health-safety-audit` | NO | UNSURE |
| `ISSUE_REGISTER` | `/operations/issue-register` | NO | UNSURE |
| `FINANCE` | `/finance` | NO | UNSURE |
| `PROFIT_LOSS` | `/finance/profit-loss` | NO | UNSURE |
| `EXPENSES_IMPORT` | `/finance/expenses-import` | NO | UNSURE |
| `RECIPE_MANAGEMENT` | `/recipe-management` | NO | UNSURE |
| `RECIPES` | `/menu/recipes` | NO | UNSURE |
| `COST_CALCULATOR` | `/menu/cost-calculator` | NO | UNSURE |
| `INGREDIENT_MANAGEMENT` | `/menu/ingredient-management` | NO | UNSURE |
| `NIGHTLY_CHECKLIST` | `/managers/nightly-checklist` | NO | UNSURE |
| `SHIFT_REPORT` | `/reports/shift-report` | NO | UNSURE |
| `ONLINE_ORDERING` | `/marketing/online-ordering` | NO | DELETE |
| `MEMBERSHIP` | `/membership` | NO | DELETE |
| `PARTNERS` | `/partners` | NO | DELETE |
| `DELIVERY_ADMIN` | `/delivery/admin` | NO | DELETE |
| `JUSSI_AI` | `/ai/jussi-ops` | NO | UNSURE |

---

## 3. BACKEND API ROUTES

### Lean Core — Verified Live (all return 200/401)

| Route Prefix | Source | Purpose | Frontend Consumer | Responding | Classification |
|---|---|---|---|---|---|
| `GET /api/pin-auth/me` | `server/routes/pinAuth.ts` (inline routes.ts) | PIN auth check | Login gate | 200 | KEEP |
| `GET /api/auth/session` | `server/routes/auth/authRoutes.ts` | Session validation | All protected routes | 401 | KEEP |
| `GET /api/ui-auth/check` | `server/routes/uiAuth.ts` | UI auth state | Login page | 200 | KEEP |
| `GET /api/system/pos-status` | `server/index.ts` (inline) | POS connection + last sync dates | Dashboard / Bob | 200 | KEEP |
| `GET /api/receipts/count` | `server/routes/receiptCount.ts` | Count POS receipts for a date | Daily Sales V2 form | 200 | KEEP |
| `GET /api/forms/daily-sales/v2` | `server/routes/forms/dailySalesV2.ts` | List submitted shift forms | Daily Sales V2 + Library | 200 | KEEP |
| `POST /api/forms/daily-sales/v3` | `server/routes.ts` (inline) | Submit new shift form | Daily Sales V2 form | 200 | KEEP |
| `GET /api/expense-suppliers` | `server/routes.ts` (inline) | Expense supplier list | Daily Sales V2 form | 200 | KEEP |
| `GET /api/purchasing-items` | `server/routes/purchasingItems.ts` | Purchasing catalog items | Purchasing + Daily Stock | 200 | KEEP |
| `GET /api/purchasing` | `server/routes/purchasing.ts` | Purchase records | Purchasing page | 200 | KEEP |
| `GET /api/ingredients` | `server/routes/ingredients.ts` | Ingredient list with costs | Daily Sales V2 + Daily Stock | 200 | KEEP |
| `GET /api/library/daily-sales` | `server/routes.ts` (inline) | Unified form library list | Form Library | 200 | KEEP |
| `GET /api/forms/library` | `server/routes/forms.ts` | V3 form library | Form Library | 200 | KEEP |
| `GET /api/refunds` | `server/routes/refunds.ts` | Refund log for shift | Daily Sales V2 form | 200 | KEEP |
| `GET /api/shift-report/latest` | `server/routes/shiftReportRoutes.ts` | Latest shift report header | Daily Sales V2 form | 200 | KEEP |
| `GET /api/daily-stock` | `server/api/daily-stock/index.ts` | Daily stock records | Daily Stock V2 form | 200 | KEEP |

### POS / Loyverse Sync — Live (no frontend page, backend pipeline only)

| Route Prefix | Source | Purpose | Responding | Classification |
|---|---|---|---|---|
| `/api/loyverse/sync` | `server/routes/loyverseSync.ts` | Manual POS receipt sync trigger | 200 | KEEP |
| `/api/loyverse/receipts` | `server/routes/loyverseShiftReportRouter.ts` | Loyverse receipt data | 200 | KEEP |
| `/api/pos/sync-status` | Inline `server/routes.ts` | POS sync state | 200 | KEEP |
| `/api/loyverse/sync-status` | — | Sync status alias | 404 — route does not exist | DELETE |

### Analysis Routes — Mounted, No Frontend

| Route Prefix | Source File | Purpose | Responding | Classification |
|---|---|---|---|---|
| `/api/analysis` (drinksVariance) | `server/routes/drinksVariance.ts` | Drinks vs POS comparison | Mounted, sub-path varies | UNSURE |
| `/api/analysis` (drinksAdjustments) | `server/routes/drinksAdjustments.ts` | Drinks adjustment entries | Mounted | UNSURE |
| `/api/analysis` (burgersVariance) | `server/routes/burgersVariance.ts` | Burger set metrics | Mounted | UNSURE |
| `/api/analysis` (bunsReconciliation) | `server/routes/bunsReconciliation.ts` | Buns stock vs POS | Mounted | UNSURE |
| `/api/analysis` (meatReconciliation) | `server/routes/meatReconciliation.ts` | Meat stock vs POS | Mounted | UNSURE |
| `/api/analysis` (sideOrdersVariance) | `server/routes/sideOrdersVariance.ts` | Side orders metrics | Mounted | UNSURE |
| `/api/analysis` (friesReconciliation) | `server/routes/friesReconciliation.ts` | Fries stock vs POS | Mounted | UNSURE |
| `/api/analysis` (sweetPotatoReconciliation) | `server/routes/sweetPotatoReconciliation.ts` | Sweet potato stock vs POS | Mounted | UNSURE |
| `/api/analysis` (modifierPipeline) | `server/routes/modifierPipeline.ts` | POS modifier data pipeline | Mounted | UNSURE |
| `/api/analysis` (promoMixMatch) | `server/routes/promoMixMatch.ts` | Promo mix analysis | Mounted | UNSURE |
| `/api/analysis` (analysisV2) | `server/routes/analysisV2.ts` | Analysis V2 pages data | Mounted | DELETE |
| `/api/analysis/v3/*` | `server/routes/analysisV3.ts` | POS truth layer read surface | 400 (requires auth params) | UNSURE |
| `/api/analysis/stock-reconciliation` | `server/routes.ts` (inline) | Stock vs POS comparison | 200 | UNSURE |
| `/api/analysis/:date` (catch-all) | `server/routes.ts` (inline) | Generic analysis row lookup | 200 | UNSURE |
| `/api/analysis/rolls-ledger` | `server/routes/rollsLedger.ts` | Buns/rolls inventory ledger | Mounted | UNSURE |
| `/api/analysis/meat-ledger` | `server/routes/meatLedger.ts` | Meat inventory ledger | Mounted | UNSURE |
| `/api/analysis/drinks-ledger` | `server/routes/drinksLedger.ts` | Drinks inventory ledger | Mounted | UNSURE |
| `/api/analysis` (receiptBatch) | `server/routes/receiptBatchRoutes.ts` | Batch receipt processing | Mounted | UNSURE |
| `/api/analysis/shift` (CSV) | `server/routes/analysisCsv.ts` | CSV shift analysis export | Mounted | UNSURE |
| `/api/daily-review-comments` | `server/routes/dailyReviewComments.ts` | Comments on daily reviews | Mounted | UNSURE |
| `/api/analysis` (dailyReview) | `server/routes/analysisDailyReviewRouter.ts` | Daily review data | Mounted | UNSURE |
| `/api/analysis/manual-ledger` | `server/routes/analysisManualLedger.ts` | Manual ledger entries | Mounted | UNSURE |
| `/api/receipts` (burgers) | `server/routes/receiptsBurgers.ts` | Burger-specific receipt metrics | Mounted | UNSURE |
| `/api/receipts` (debug) | `server/routes/receiptsDebug.ts` | Receipt debugging tools | Mounted | UNSURE |

### Finance — Live, No Frontend

| Route Prefix | Source | Purpose | Responding | Classification |
|---|---|---|---|---|
| `/api/finance/profit-loss` | `server/routes/finance.ts` | P&L data aggregation | 401 (auth required) | UNSURE |
| `/api/finance/*` | `server/routes/finance.ts` | Finance module | Mounted | UNSURE |
| `/api/expenses` | `server/routes/expenses.ts` | Expense records | Mounted | UNSURE |
| `/api/expenses` (import) | `server/routes/expenses-import.ts` | Expense import pipeline | Mounted | UNSURE |
| `/api/balance` | `server/routes/balance.ts` | Balance/banking reconciliation | Mounted | UNSURE |
| `/api/bank-imports` | `server/routes/bankImport.ts` | Bank statement imports | Mounted | UNSURE |
| `/api/bank-imports` | `server/routes/bankImport.ts` + duplicate | **DUPLICATE** — mounted twice in index.ts | Mounted | DELETE (one copy) |

### Health & Safety — Live, No Frontend

| Route Prefix | Source | Responding | Classification |
|---|---|---|---|
| `/api/health-safety/questions` | `server/routes/healthSafety/questions.ts` | 200 | UNSURE |
| `/api/health-safety/audits` | `server/routes/healthSafety/audits.ts` | 200 | UNSURE |
| `/api/health-safety/pdf` | `server/routes/healthSafety/pdf.ts` | Mounted | UNSURE |

### Manager Checklist

| Route Prefix | Source | Responding | Classification |
|---|---|---|---|
| `/api/checklists` | Deleted route file | 404 | DELETE |
| `/api/manager-checklist/*` | Inline `server/routes.ts` | Mounted | UNSURE |
| `/api/manager-checklist/questions` | Inline | 200 | UNSURE |

### Recipes / Menu / Ingredients

| Route Prefix | Source | Responding | Classification |
|---|---|---|---|
| `/api/ingredients` (master) | `server/routes/ingredients.ts` | 200 | KEEP |
| `/api/ingredient-master` | `server/routes/ingredientMasterRouter` (index.ts) | Mounted | UNSURE |
| `/api/ingredient-authority` | `server/routes/ingredientAuthorityAdminRoutes` | Mounted | UNSURE |
| `/api/ingredients/legacy` | `server/routes/ingredients-legacy.ts` | Mounted | UNSURE |
| `/api/menu-v3` | `server/routes/menu/menuV3Routes.ts` | Mounted | UNSURE |
| `/api/menus` | `server/routes/menu.ts` | Mounted | UNSURE |
| `/api/products` | `server/routes/products.ts` + activation + menu | Mounted | UNSURE |
| `/api/admin/menu-canonical/*` | Inline `server/routes.ts` | Mounted | UNSURE |

### Stock / Inventory

| Route Prefix | Source | Responding | Classification |
|---|---|---|---|
| `/api/stock-catalog` | `server/api/stock-catalog-new.ts` | Mounted | UNSURE |
| `/api/stock` | `server/routes/stock/stockRoutes.ts` | Mounted | UNSURE |
| `/api/stock/variance` | `server/routes/stock/varianceRoutes.ts` | Mounted | UNSURE |
| `/api/stock` (baseline) | `server/routes/stockBaseline.ts` | Mounted | UNSURE |
| `/api/stock-review/manual-ledger` | `server/routes/stockReviewManual.ts` | Mounted | UNSURE |
| `/api/snapshots` | Inline `server/routes.ts` | 200 | UNSURE |

### Bob / Agent Surface

| Route Prefix | Source | Responding | Notes | Classification |
|---|---|---|---|---|
| `/api/gateway/*` | `server/routes/agentGateway.ts` | 401 | Agent tool gateway — external Bob calls | UNSURE |
| `/api/bob/read/*` | `server/routes/bobRead.ts` | Auth-gated | Bob read layer | UNSURE |
| `/api/ai-ops/bob/*` | `server/routes/bobCanonicalRead.ts` | Auth-gated | Bob canonical read | UNSURE |
| `/api/ops/ai/*` + `/api/ai-ops/*` | `server/routes/aiOpsControl.ts` | Mounted | AI Ops control + monitor engine | UNSURE |
| `/api/bob/*` | `server/routes/bobAlias.ts` | Mounted | Bob alias router | UNSURE |
| `/api/agent/read/*` | `server/routes/agentRead.ts` | 401 | Agent canonical read | UNSURE |
| `/api/ai/chat` | `server/routes/chatAlias.ts` | Mounted | AI chat alias | UNSURE |

### Miscellaneous — Live, No Frontend Page

| Route Prefix | Source | Responding | Classification |
|---|---|---|---|
| `/api/dashboard/latest` | Inline `server/routes.ts` | 200 | UNSURE |
| `/api/shift-review` | `server/routes/shiftReview.ts` | Mounted | UNSURE |
| `/api/shift-report/*` | `server/routes/shiftReportRoutes.ts` | 200 | UNSURE |
| `/api/internal/reports` | `server/routes/internalReports.ts` | Mounted | UNSURE |
| `/api/export` | `server/routes/exportRoutes.ts` | Mounted | UNSURE |
| `/api/system-health` | `server/routes/systemHealth.ts` | Mounted | UNSURE |
| `/api/auth` (SaaS) | `server/routes/auth/authRoutes.ts` | Mounted | SaaS tenant auth, separate from pin auth | UNSURE |
| `/api/payment-providers`, `/api/payments` | Payment route files | Mounted | UNSURE |
| `/api/legacy-bridge` | `server/routes/legacyBridge.ts` | Mounted | UNSURE |
| `/api/shopping-list` | `server/routes/shoppingListRoutes.ts` + others | Mounted | UNSURE |
| `/api/pos` (upload) | `server/routes/posUpload.ts` (includes posBlaze) | Mounted | UNSURE |
| `/api/pos` (items/usage/live) | `server/routes/posItems.ts`, `posUsage.ts`, `posLive.ts` | Mounted | UNSURE |
| `/api/shift-expenses` | `server/routes/shiftExpenses.ts` | Mounted | UNSURE |
| `/api/purchasing/drinks` | `server/routes/purchasingDrinks.ts` | Mounted | UNSURE |
| `/api/analytics/ingredients` | `server/routes/analytics/ingredientUsageRoutes.ts` | Mounted | UNSURE |
| `/api/health-safety/*` | Health safety routes | 200 | UNSURE |
| `/api/issue-register` | `server/routes/issueRegister.ts` | Mounted | UNSURE |
| `/api/shift-approval` | `server/routes/shiftApproval.ts` | Mounted | UNSURE |
| `/api/purchases` | `server/routes/purchases.ts` | Mounted | UNSURE |
| `/api/purchase-tally` | `server/routes/purchaseTally.ts` | Mounted | UNSURE |
| `/api/purchasing/analytics` | `server/routes/purchasingAnalytics.ts` | Mounted | UNSURE |
| `/api/admin/ingredient-authority` | `server/routes/admin/ingredientAuthority.ts` | Mounted | UNSURE |

---

## 4. DATABASE TABLE USAGE

### Daily Sales V2
| Table | Type | Purpose |
|---|---|---|
| `daily_sales_v2` | Prisma (raw SQL) | Primary store for submitted shift forms |
| `expense_suppliers` | Drizzle | Supplier dropdown in form |
| `expense_entry` | Drizzle | Expense line items within a form |
| `daily_sales_stock_audit` | Prisma | Audit log of form submissions |
| `receipts` | Prisma | POS receipt count lookup for date |
| `loyverse_shifts` | Prisma | Latest shift date context |

### Daily Stock V2
| Table | Type | Purpose |
|---|---|---|
| `daily_sales_v2` | Prisma | Stock form payload stored alongside sales |
| `ingredient_v2` | Prisma | Ingredient master list with costs |
| `purchasing_items` | Prisma | Purchasing catalog for stock form |

### Form Library
| Table | Type | Purpose |
|---|---|---|
| `daily_sales_v2` | Prisma | Source of all forms in library |
| `shift_reports` | Drizzle | Linked shift report per form |

### Purchasing
| Table | Type | Purpose |
|---|---|---|
| `purchasing_items` | Prisma | Item catalog (name, category, unit, cost) |
| `purchasing_items_log` | Prisma | Change log |

### POS / Loyverse (truth layer — hard-locked)
| Table | Type | Purpose |
|---|---|---|
| `receipts` | Prisma | Loyverse receipt headers |
| `loyverse_receipts` | Drizzle | Drizzle schema mirror of receipts |
| `loyverse_shifts` | Prisma | Loyverse shift report summaries |
| `lv_receipt` | Prisma | POS truth layer — immutable receipt rows |
| `lv_line_item` | Prisma | POS truth layer — immutable line items |
| `lv_modifier` | Prisma | POS truth layer — immutable modifier rows (qty always 1) |

### Ingredients / Recipes
| Table | Type | Purpose |
|---|---|---|
| `ingredients` | Drizzle | Ingredient list with cost, unit, category |
| `ingredient_v2` | Prisma | Canonical ingredient authority |
| `ingredient_authority` | Drizzle | Decoupled ingredient master |
| `recipes` | Drizzle | Recipe definitions |
| `recipe_ingredients` | Drizzle | Ingredient-to-recipe mapping |

### Finance / Expenses
| Table | Type | Purpose |
|---|---|---|
| `expense_import_batch` | Drizzle | Imported expense batches |
| `expense_import_line` | Drizzle | Individual expense lines from import |
| `expense_entry` | Drizzle | Manual expense entries |
| `expense_suppliers`, `expense_categories`, `expense_type_lkp` | Drizzle | Expense lookup tables |
| `bank_statements`, `transactions` | Drizzle | Banking reconciliation |
| `pl_row`, `pl_category_map`, `pl_month_cache` | Drizzle | P&L read model |

### Analysis (no active frontend)
| Table | Type | Purpose |
|---|---|---|
| `daily_shift_receipt_summary` | Drizzle | Receipt truth daily summaries |
| `daily_shift_summary` | Drizzle | Consolidated shift summaries |
| `daily_receipt_summaries` | Drizzle | Receipt summaries for analysis |
| `receipt_truth_daily_usage` | Prisma | Ingredient usage derived from POS (analysis engine) |
| `receipt_truth_usage_rule` | Prisma | Rules for usage calculation |
| `analysis_build_status` | Prisma | Build lifecycle tracking |
| `shift_rebuild_log` | Prisma | Nightly rebuild audit log |

### Shift Reports
| Table | Type | Purpose |
|---|---|---|
| `shift_reports` | Drizzle | Auto-generated nightly shift report |
| `shift_sales` | Drizzle | Per-shift sales summary |
| `shift_purchases` | Drizzle | Per-shift purchase summary |
| `shift_item_sales`, `shift_modifier_sales` | Drizzle | POS item-level data per shift |
| `shift_summary` | Drizzle | Aggregated shift totals |

### Online Ordering / KDS / Delivery
| Table | Type | Purpose |
|---|---|---|
| `online_catalog_items` | Drizzle | Online order menu items |
| `menu_items` | Drizzle | Internal menu items |
| `pos_batch`, `pos_receipt`, `pos_sales_item`, etc. | Drizzle | POS terminal data (not Loyverse) |

### Miscellaneous
| Table | Type | Purpose |
|---|---|---|
| `users` | Drizzle | Legacy user table |
| `shopping_list`, `shopping_master` | Drizzle | Shopping list |
| `marketing_calendar` | Drizzle | Marketing calendar entries |
| `stock_purchase_rolls`, `stock_purchase_drinks`, `stock_purchase_meat` | Drizzle | Purchasing tally by category |
| `purchase_tally`, `purchase_tally_drink` | Drizzle | Purchasing tally aggregates |
| `monitor_events` | Prisma | Monitor engine event log |
| `app_kv` | Prisma | Key-value store (secrets/config) |
| `ai_tasks` | Prisma | Work register (Bob task tracking) |
| `chat_logs` | Drizzle | AI chat history |

---

## 5. LIVE FEATURE MAP

### KEEP
Features that are live, tested, and actively needed.

| Feature | Status | Notes |
|---|---|---|
| **Daily Sales V2** | Live and used | Core shift form — sales, cash, expenses, POS sync |
| **Daily Stock V2** | Live and used | Core stock count form per shift |
| **Form Library** | Live and used | Owner archive of all submitted shift forms |
| **Purchasing** | Live and used | Purchasing item catalog |
| **Authentication (PIN + session)** | Live and used | PIN login gate + session auth |
| **Active Loyverse POS Sync** | Live and used | Receipt ingest — 15-min incremental + daily at 3AM |
| **Ingredients (read surface)** | Live and used | Powers stock form and sales form |

### REBUILD
Features with real business value but no working frontend page. Backend is healthy. Frontend was removed in DB 5.0 cleanup.

| Feature | Backend State | Notes |
|---|---|---|
| **Finance / P&L** | Live (401-gated) | P&L, expense import, banking reconciliation — all backend healthy |
| **Shift Report** | Live (200) | Auto-generated nightly, emailed, stored — no viewer page |
| **Recipes** | Backend mounted | Recipe and ingredient management — no frontend route |
| **Ingredients Management** | Backend mounted | Full CRUD exists; only read surface active in frontend |
| **Shopping List** | Backend mounted | Shopping list builder and PDF exist |
| **Health & Safety** | Live (200) | Questions, audits, PDF — backend complete, no frontend page |
| **Manager Checklist** | Partial (inline routes.ts) | Locked schema, inline endpoints — no frontend page |
| **Analysis Variance Modules** | Mounted | Drinks, burgers, buns, fries, meat, side orders — backend data present |
| **Issue Register** | Mounted | Theft-control register — backend exists, no frontend |

### DELETE
No business value, no active use, experimental, or fully replaced.

| Feature | Notes |
|---|---|
| **Online Ordering frontend** | No frontend page, complex, external dependency |
| **Membership** | No frontend, no business need currently active |
| **Marketing calendar / content generation** | No frontend, no consumer |
| **Partner tracking** | No frontend, no consumer |
| **Delivery module** | No frontend, no consumer |
| **KDS (Kitchen Display System)** | No frontend; KDS auto-complete cron still runs every 2 min — no screens to display |
| **POS Terminal routes** (pos_batch, posBlaze, etc.) | Separate from Loyverse truth layer; no active terminal use |
| **Jussi AI / Jane Accounts / Ramsay** | No frontend page; Jussi cron runs at 3AM to no consumer |
| **analysisV2 frontend data** | Analysis V2 frontend deleted; route file still mounted |
| **BottomNav Finance link** | Dead link — no route |
| **BottomNav Menu link** | Dead link — no route |
| **Legacy daily_sales table** | Superseded by daily_sales_v2 |
| **`/api/loyverse/sync-status`** | Route does not exist (404) |
| **`/api/bank-imports` duplicate mount** | Same router mounted twice in index.ts |

### UNSURE
Requires Cameron decision before any action.

| Feature | Reason |
|---|---|
| **Cost Calculator** | No frontend page or route — unclear if still needed |
| **AI Ops Control / Bob** | External agent surface — Cameron decides if Bob is still active |
| **Agent Gateway** | External agent tool gateway — no frontend, depends on Bob decision |
| **Staff Operations** | 16-table schema, 50+ endpoints — no frontend route registered |
| **Weekly Roster Planner** | Cron registered, no frontend |
| **Shift Approval** | Route mounted, no frontend |
| **Reports page (shift report history)** | Route in registry, backend alive — rebuild or delete? |
| **Settings / Admin page** | Not in registry; admin functions exist inline in routes.ts |
| **Analysis V3 (POS truth read)** | Clean POS data API — needed for any future analysis rebuild? |
| **SKU Map** | Mounted, no visible frontend consumer |
| **Purchase Tally / Purchasing Analytics** | Mounted, purpose unclear for current app state |

---

## 6. BACKGROUND JOBS / CRONS

| Job | File | Purpose | Runs When | Still Needed | Classification |
|---|---|---|---|---|---|
| Incremental Loyverse POS sync | `server/services/scheduler.ts` | Pulls new receipts from Loyverse API | Every 15 minutes | YES | KEEP |
| Daily Loyverse sync (full) | `server/services/scheduler.ts` | Full receipt sync + shift data | 3:00 AM Bangkok | YES | KEEP |
| Email daily sales summary | `server/services/scheduler.ts` | Emails sales summary | 9:00 AM Bangkok | UNSURE | UNSURE |
| Burger metrics cache rebuild | `server/services/scheduler.ts` | Rebuilds burger set cache | 3:10 AM Bangkok | UNSURE | UNSURE |
| Daily Review POS ingestion | `server/services/scheduler.ts` | Ingests POS data for daily review | 3:15 AM Bangkok | UNSURE | UNSURE |
| Shift Analytics MM cache | `server/services/scheduler.ts` | Rebuilds shift analytics cache | 3:20 AM Bangkok | UNSURE | UNSURE |
| Scheduled analysis build (04:30 BKK) | `server/services/scheduledAnalysisBuild.ts` | Builds receipt_truth_daily_usage for previous date | 4:30 AM Bangkok | NO — feeds deleted analysis pages | DELETE |
| Daily Report V2 PDF + email | `server/cron/dailyReportCron.ts` | Compiles daily report, generates PDF, emails management | 3:00 AM Bangkok | YES | KEEP |
| Weekly Roster Distribution | `server/cron/weeklyRosterDistributionCron.ts` | Prepares roster export | Sunday 3:30 AM Bangkok | UNSURE — no active roster frontend | UNSURE |
| Shift Report V2 auto-gen + email | `server/index.ts` inline | Builds shift report, emails it | 3:10 AM Bangkok | YES — shift report email is active | KEEP |
| Shift snapshot POS ingestion | `server/index.ts` inline | Stores shift_snapshot_v2 for yesterday | 8:00 AM Bangkok | UNSURE | UNSURE |
| Daily shift anomaly audit | `server/index.ts` inline | Emails anomaly audit | 8:00 AM Bangkok | UNSURE | UNSURE |
| Daily Review email (cronEmailService) | `server/services/cronEmailService.ts` | Sends Daily Review email (deprecated flag inside) | 9:00 AM Bangkok | UNSURE — marked deprecated internally | UNSURE |
| Bob auto-daily analysis | `server/index.ts` inline | POSTs to /api/ai-ops/bob/run-analysis | 9:00 AM Bangkok | UNSURE — depends on Bob status | UNSURE |
| Jussi Daily Cron | `server/index.ts` inline via setInterval | Generates Jussi report | 3:00 AM Bangkok (polling) | NO — no frontend page, no consumer | DELETE |
| Rolls ledger + analytics crons | `server/jobs/cron.js` | Rolls ledger rebuilds, ingestion audit, analytics rebuilds | Various (3AM range) | UNSURE | UNSURE |
| Loyverse order queue processor | `server/services/loyverseQueue.ts` | Processes queued Loyverse orders | Every 30 seconds | UNSURE — linked to online ordering | UNSURE |
| KDS auto-complete | `server/services/kdsService.ts` | Auto-completes old KDS orders | Every 2 minutes | NO — no KDS frontend | DELETE |
| Monitor engine scheduler | `server/services/monitorEngine.ts` (via aiOpsControl) | Runs daily checks, logs to monitor_events | Daily | UNSURE | UNSURE |
| cronEnsureShift | `server/jobs/cronEnsureShift.ts` | Ensures shift record exists | Startup + scheduled | UNSURE | UNSURE |
| ~~analysisBuildOrchestrator startup~~ | `server/index.ts` | Startup catch-up + 4AM build | Startup / 4AM | **DISABLED in Pass 2** | REMOVED |
| ~~startShiftRebuildScheduler~~ | `server/routes/aiOpsControl.ts` | Nightly shift rebuild at 03:05 BKK | 3:05 AM Bangkok | **DISABLED in Pass 2** | REMOVED |

---

## 7. SAFE DELETE CANDIDATES

Items listed here satisfy all criteria: not visible in frontend, not routed, not imported by any active consumer, no API consumer, no staff or owner use, no rebuild value.

| Item | Type | Reason |
|---|---|---|
| `server/routes/bobVerify.ts` | Route file | 0 imports anywhere — already deleted in Pass 2 |
| `server/routes/ingredientReconciliation.ts` | Route file | 0 imports anywhere — already deleted in Pass 2 |
| `scheduled analysis build job (04:30 BKK)` | Cron/service | `scheduledAnalysisBuild.ts` — feeds only deleted analysis pages; `startScheduledAnalysisBuildJob()` still called at startup |
| KDS auto-complete cron | Cron | Fires every 2 min with no display terminal, no frontend, no business use |
| Jussi Daily Cron (setInterval in index.ts) | Cron | Polls every minute for 3AM, generates report to no consumer |
| `BottomNav Finance link` | Navigation | Dead link — hits NotFound page |
| `BottomNav Menu link` | Navigation | Dead link — hits NotFound page |
| `marketing_calendar` table | DB table | No frontend, no route, no consumer |
| `quick_notes` table | DB table | No frontend, no route, no consumer |
| `/api/loyverse/sync-status` route constant | RouteRegistry | Listed as LOYVERSE_REPORTS but route returns 404 |
| Duplicate `/api/bank-imports` mount | index.ts | Same router mounted at lines ~4911 and ~4918 — one is redundant |
| Legacy `daily_sales` table (Drizzle) | DB table | Superseded by `daily_sales_v2`; verify no writes before removing |

---

## 8. PROTECTED LIST

These files, routes, and tables must not be modified or deleted in any future cleanup pass.

### Files — Do Not Touch
| File | Reason |
|---|---|
| `server/index.ts` (pos-status inline route) | Lean core — POS connection status |
| `server/routes/purchasingItems.ts` | Lean core — Purchasing page |
| `server/routes/receiptCount.ts` | Lean core — Daily Sales V2 receipt count |
| `server/routes/refunds.ts` | Lean core — Daily Sales V2 refund log |
| `server/routes/shiftReportRoutes.ts` | Lean core — shift report header for form |
| `server/routes/forms/dailySalesV2.ts` | Lean core — form list and submission |
| `server/api/daily-stock/index.ts` | Lean core — Daily Stock V2 |
| `server/services/loyverseImportV2.ts` | POS truth layer — immutable after first insert |
| `server/routes/loyverseSync.ts` | Active POS ingestion — do not break |
| `server/routes/auth/authRoutes.ts` | Auth foundation |
| `server/routes/pinAuth.ts` | Auth foundation |
| `client/src/pages/operations/daily-sales/Form.tsx` | Lean core frontend |
| `client/src/pages/operations/DailyStock.tsx` | Lean core frontend |
| `client/src/pages/operations/Purchasing.tsx` | Lean core frontend |
| `client/src/pages/operations/daily-sales-v2/Library.tsx` | Lean core frontend |
| `client/src/pages/Home.tsx` | Dashboard |
| `client/src/pages/auth/Login.tsx` | Auth |

### DB Tables — Do Not Drop
| Table | Reason |
|---|---|
| `daily_sales_v2` | All submitted shift forms |
| `lv_receipt` | POS truth layer — hard-locked, immutable |
| `lv_line_item` | POS truth layer — hard-locked, immutable |
| `lv_modifier` | POS truth layer — hard-locked, immutable |
| `receipts` | Active POS receipt store |
| `loyverse_shifts` | Shift date context |
| `purchasing_items` | Purchasing catalog |
| `ingredient_v2` | Canonical ingredient master |
| `ingredients` | Ingredient list with costs |
| `expense_suppliers` | Expense supplier dropdown |
| `expense_entry` | Expense line items in shift form |
| `shift_reports` | Nightly auto-generated report |
| `recipes`, `recipe_ingredients` | Recipe definitions |

### Schema Constraints — Do Not Remove
| Constraint | Table | Reason |
|---|---|---|
| `qty_must_be_one` CHECK | `lv_modifier` | POS truth layer integrity — rejects qty ≠ 1 |
| `no_update_lv_line_item` trigger | `lv_line_item` | POS truth layer — prevents any UPDATE |
| `no_update_lv_modifier` trigger | `lv_modifier` | POS truth layer — prevents any UPDATE |

---

## 9. FINAL RECOMMENDED APP STRUCTURE

This is the proposed clean navigation structure only. Not built. No action taken.

```
SBB Dashboard
│
├── Home  (/dashboard)
│   └── Launch grid — links to core operations
│
├── OPERATIONS
│   ├── Daily Sales  (/operations/daily-sales)
│   ├── Daily Stock  (/operations/daily-stock)
│   └── Form Library  (/operations/daily-sales-v2/library)  [Owner only]
│
├── PURCHASING
│   └── Purchasing  (/operations/purchasing)
│
├── MENU
│   ├── Recipes  (/menu/recipes)
│   ├── Ingredients  (/menu/ingredients)
│   └── Cost Calculator  (/menu/cost-calculator)
│
├── FINANCE
│   ├── Profit & Loss  (/finance/profit-loss)
│   ├── Expenses Import  (/finance/expenses-import)
│   └── Banking  (/finance/banking)
│
├── REPORTS
│   ├── Shift Report  (/reports/shift-report)
│   └── Shift History  (/reports/shift-report/history)
│
├── OPERATIONS TOOLS
│   ├── Shopping List  (/operations/shopping-list)
│   ├── Health & Safety  (/operations/health-safety-audit)
│   ├── Manager Checklist  (/managers/nightly-checklist)
│   └── Issue Register  (/operations/issue-register)
│
└── SETTINGS  [Owner/Admin only]
    ├── Staff Directory
    └── System Health
```

**Excluded from proposed structure** (no recommendation to restore without Cameron approval):
- AI Ops / Bob / Agent Gateway
- Staff Operations / Roster
- Analysis variance pages (drinks, burgers, buns, fries)
- KDS / POS Terminal
- Membership
- Marketing
- Online Ordering / Delivery
- Partner tracking
