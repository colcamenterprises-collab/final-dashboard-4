# Final Dashboard 5.1 — System Alignment Audit

Audit date: 2026-06-07  
Baseline inspected: `f0dbc18b9388019b347dc18cf5ffbc3b3266c47d` (`final-dashboard-5.0-stable` / `production-baseline-5.0` baseline requested)  
Scope: audit-only system map; no fixes, route changes, schema changes, or code edits.

## 1. Executive Summary

The current baseline contains multiple overlapping generations of the same business domains. The strongest alignment risk is not a missing page; it is that several modules read and calculate from different table families while using similar business names.

Primary findings:

1. **Loyverse is intended to be the POS source of truth, but it is not singularly represented in the app.** POS receipt data appears in `receipts`, `loyverse_receipts`, `lv_receipt` / `lv_line_item`, `pos_receipt`, Prisma `Receipt`, Prisma `PosReceipt`, and derived `receipt_truth_line` references in runtime SQL. The code also contains routes that fall back from Loyverse API to derived receipt tables.
2. **Shift reports have multiple authoritative candidates.** `daily_sales_v2` + `daily_stock_v2` are the staff form sources, `pos_shift_report` is the POS shift source, `shift_report_v2` is a derived report cache, and `shift_snapshots` / `ShiftSnapshot` also exist as a snapshot/report pathway.
3. **Daily Sales V2 partially aligns with POS by policy but not consistently by implementation.** The Daily Sales V2 backend states that sales figures were removed from required staff fields and should be sourced from POS, yet several endpoints still store/preserve `payload.totalSales`, compute total sales from staff-entered channels on create, and compare shift reports against `pos_shift_report`.
4. **Daily Stock V2 records staff stock and purchasing values, but POS item sales are not the direct canonical input in the form route.** Stock V2 persists `burgerBuns`, `meatWeightG`, `drinksJson`, and `purchasingJson`, and syncs purchasing shift items. Separate analytics modules derive item/modifier sales from POS receipts, but the Daily Stock form endpoint itself does not prove direct use of POS item sales for stock decrement.
5. **Purchasing and Shopping List are split.** Purchasing master data is `purchasing_items`; shift purchases are `purchasing_shift_items`. Shopping List has legacy `shopping_list`, newer `shopping_list_v2`, `shopping_purchase_v2`, `shopping_list_items` in Prisma, and inline shopping-list endpoints in `server/routes.ts`. The `shoppingListBuilder` service builds from Daily Stock V2 and requisition items into `shopping_list_v2`, while the visible Shopping List page queries `/api/shopping-list`.
6. **Ingredients and Recipes have conflicting authorities.** Legacy Drizzle `ingredients` / `recipes` / `recipe_ingredients` coexist with Prisma `IngredientV2` / `RecipeV2`, canonical `ingredient_authority`, and Foundation `recipe` / `recipe_ingredient` linked to `purchasing_items`. Current recipe routes use the legacy Drizzle `recipes` table. The newer authority model is present but not uniformly consumed.
7. **Menu / Online Ordering has at least four menu sources.** Customer ordering and catalog pages use `/api/menu-v3/items`, backed by the Menu V3 route family. The schema also contains `menu_items`, `online_catalog_items`, `menu_items_online`, and `product` / `product_menu`. Online Ordering is therefore not guaranteed to use the same source as Recipes or Menu Management.
8. **Finance uses multiple expense and sales sources.** Finance pages query `/api/reports/financial-overview`, `/api/profit-loss`, `/api/expensesV2`, and dynamic `/api/finance` routes. Expense tables include `expenses`, `expenses_v2`, `expenses_legacy`, `expense_entry`, `expense_import_*`, `imported_expenses`, `bank_txn`, `pnl_expense`, and shift-form embedded expenses. This creates a high risk of stale or partial finance totals.
9. **Reports use a mixture of Daily Sales V2, POS shift reports, shift report cache, analysis exports, and legacy daily sales summaries.** Reports are not proven to use the same source of truth as POS/Daily Sales V2 end-to-end.
10. **Staff Operations is comparatively isolated.** Staff Ops uses its own tables and endpoints and has lower cross-module source-of-truth risk, except where labor costs are also represented in Daily Sales V2 wage entries and Finance/expenses.

Bottom line: the system is stable but not aligned. Before new features, the platform needs a documented source-of-truth contract and read-only reconciliation endpoints that identify which records are authoritative for each shift, sale, stock movement, purchase, recipe, and finance total.

## 2. Module-by-Module Map

### 2.1 Loyverse POS Sync

| Audit item | Current state |
|---|---|
| Frontend routes | No active dedicated Loyverse page in `client/src/App.tsx`. Legacy routes exist in `RouteRegistry.ts` under `/operations/analysis`, receipts, and Loyverse mapping, but the active app route file does not mount a Loyverse report page. |
| Frontend files | Active visible consumers are indirect: Daily Sales form calls receipt count; reports/analysis pages call receipt/analysis endpoints. Legacy or backup references exist outside the active router. |
| Backend API endpoints | `/api/loyverse/shifts`, `/api/loyverse/receipts`, `/api/loyverse/*` mounted routes, `/api/pos/sync-status`, `/api/pos/sync`, `/api/pos-shift/:date`, `/api/receipts/recent`, `/api/receipts/*`, `/api/analytics/window`, `/api/analysis/shift/*`. |
| Backend route files | `server/routes.ts`, `server/routes/loyverseEnhanced.ts`, `server/routes/loyverseShiftReport.ts`, `server/routes/loyverseSync.ts`, `server/routes/receiptBatchRoutes.ts`, `server/routes/receiptsDebug.ts`, `server/routes/analytics.ts`, `server/routes/shiftApproval.ts`, `server/routes/shiftAnalysis.ts`. |
| Service files | `server/loyverseAPI.ts`, `server/services/loyverse.ts`, `server/services/enhancedLoyverseAPI.ts`, `server/services/loyverseReceipts.ts`, `server/services/loyverseDataOrchestrator.ts`, `server/services/liveReceiptService.ts`, `server/services/receiptSummary.ts`, `server/workers/postReceiptProcessor.ts`, `server/workers/postShiftProcessor.ts`. |
| Database tables | `receipts`, `loyverse_receipts`, `loyverse_shift_reports`, `loyverse_shifts`, `lv_receipt`, `lv_line_item`, `lv_modifier`, `pos_batch`, `pos_receipt`, `pos_shift_report`, `pos_sales_item`, `pos_sales_modifier`, `pos_payment_summary`, `dailyReceiptSummaries`, `receipt_truth_line` referenced in SQL, Prisma `Receipt`, `ReceiptItem`, `ReceiptPayment`, `PosReceipt`, `PosShiftReport`, `PosSalesItem`, `PosSalesModifier`, `PosPaymentSummary`. |
| Source of truth | Intended source: Loyverse API/POS. Stored authoritative candidate should be `pos_receipt` + `pos_sales_item` + `pos_payment_summary` or `lv_receipt` + `lv_line_item`, but the codebase has no single enforced canonical POS read model. |
| Data flow | Loyverse API / webhook / sync -> raw or normalized receipt tables -> item/modifier summaries -> shift reports / analysis / Daily Sales comparison / stock usage. |
| Calculations performed | Receipt totals, payment summaries, gross/net totals, item quantity aggregation, modifier aggregation, shift windows, fallback previous-day POS totals for low totals in shift approval. |
| Downstream consumers | Daily Sales V2 receipt count and POS comparison, Daily Stock/ingredient usage analytics, Reports, Finance sales totals, shift report builder, Jussi/analytics endpoints. |
| Duplicate logic | Multiple receipt imports and summary paths: `loyverse_receipts`, `receipts`, `lv_receipt`, `pos_receipt`, `receipt_truth_line`, analytics tables. |
| Conflicting logic | `/api/pos-shift/:date` can return snapshot, Loyverse API, `receipt_truth_line`, or `pos_shift_report` depending on availability. |
| Missing integrations | No single endpoint proves that all modules consume one canonical POS shift record. |
| Broken/suspicious endpoints | `/api/pos/sync` and `/api/loyverse/*` overlap; `receipt_truth_line` is referenced but not defined in `shared/schema.ts` or `schema.prisma`. |
| Data integrity risks | Duplicate receipts, inconsistent shift-date boundaries, stale fallback data, split item-sales calculations. |
| Fix before new features | Select one canonical POS receipt/read model; publish read-only shift POS contract; mark all other receipt tables as raw, legacy, or derived. |

### 2.2 Daily Sales V2

| Audit item | Current state |
|---|---|
| Frontend routes | `/operations/daily-sales`, `/operations/daily-sales/edit/:id`, `/operations/daily-sales-v2/library`, `/operations/daily-sales-library` redirect. |
| Frontend files | `client/src/pages/operations/daily-sales/Form.tsx`, `client/src/pages/operations/daily-sales-v2/Library.tsx`, `client/src/App.tsx`. |
| Backend API endpoints | `/api/forms/daily-sales/v3`, `/api/forms/daily-sales/v2`, `/api/forms/daily-sales/v2/:id`, `/api/forms/daily-sales/v2/:id/stock`, `/api/forms/daily-sales/v2/:id/roll-order`, `/api/forms/daily-sales/v2/:id/roll-order/send`, `/api/daily-sales-v2/latest-proof`, legacy blocked Daily Sales routes, `/api/daily-shift-forms`, `/api/daily-stock-sales`. |
| Backend route files | `server/forms/dailySalesV2.ts`, `server/routes.ts`, `server/api/daily-sales.legacy.ts`, `server/api/library/daily-sales.ts`. |
| Service files | `server/services/bankingAuto.js`, `server/services/stockRequired.js`, `server/services/rollOrderService`, `server/pdf/dailyReportV2.pdf.ts`, email services. |
| Database tables | `daily_sales_v2`, `shopping_purchase_v2`, `wage_entry_v2`, `other_expense_v2`, `daily_sales_stock_audit`, `roll_order`, legacy `daily_sales`, `daily_stock_sales`. |
| Source of truth | Staff-entered shift form for cash, expenses, wages, banking, and manager declarations. POS should be source for sales totals, but code still stores/preserves staff payload totals. |
| Data flow | Staff form -> `/api/forms/daily-sales/v3` create -> `daily_sales_v2` payload and child/derived rows -> library/report/stock form -> Daily Stock V2 and purchasing shift sync. |
| Calculations performed | `totalSales`, `totalExpenses`, expected cash, shopping total, wages total, receipt counts, library-row totals, banking proof fields, roll order recommendations. |
| Downstream consumers | Daily Stock V2, Shift Reports, Finance summary invalidation, shopping list builder, roll order, issue/refund logs, Reports exports. |
| Duplicate logic | Daily Sales legacy table/routes and Daily Sales V2 route coexist; total sales calculation exists in form backend and report comparison. |
| Conflicting logic | Comments say sales are POS-sourced, but create path still calculates `totalSales` from cash/QR/Grab/other input values; update path preserves existing `payload.totalSales`. |
| Missing integrations | No guaranteed join to canonical POS shift on creation; no blocker if POS source is unavailable. |
| Broken/suspicious endpoints | Legacy routes are blocked for write methods but still present; `/api/dev/daily-sales-v2/:id/repair-merge` is mounted in production route file. |
| Data integrity risks | Staff-entered sales can be mistaken for POS truth; edits can preserve stale total sales; soft-deleted records need consistent filtering. |
| Fix before new features | Make POS sales read-only canonical in Daily Sales V2 comparison; separate staff declarations from POS totals; expose blockers for missing POS shift. |

### 2.3 Daily Stock V2

| Audit item | Current state |
|---|---|
| Frontend routes | `/operations/daily-stock`. |
| Frontend files | `client/src/pages/operations/DailyStock.tsx`. |
| Backend API endpoints | `/api/forms/daily-sales/v2/:id/stock`, `/api/daily-stock`, `/api/purchasing-items/sync-to-daily-stock`, `/api/forms/daily-sales/v2/:id/roll-order`, `/api/forms/daily-sales/v2/:id/roll-order/send`, `/api/stock/*`, `/api/stock/variance/*`, `/api/stock/baseline`, `/api/stock/snapshot`, `/api/stock/variance/compute`. |
| Backend route files | `server/forms/dailySalesV2.ts`, `server/routes/dailyStock.ts`, `server/routes/stock/stockRoutes.ts`, `server/routes/stock/varianceRoutes.ts`, `server/routes/stockBaseline.ts`, inline routes in `server/routes.ts`. |
| Service files | `server/services/purchasingShiftSync.ts`, `server/services/shoppingListBuilder.ts`, `server/lib/purchasingPlanner.ts`, stock and variance services/routes. |
| Database tables | `daily_stock_v2`, `purchasing_shift_items`, `stock_items`, `stock_requests`, `stock_baseline`, `stock_snapshot`, `stock_variance`, legacy `daily_stock`, `daily_stock_sales`, `stock_entries`, `stock_ledger_day`, `stock_ledger_drinks`, `manual_stock_ledger`, `manual_drink_ledger`. |
| Source of truth | Staff-entered stock count is `daily_stock_v2`; item sales should come from POS item sales but are separate analytics paths. |
| Data flow | Daily Sales V2 id -> Daily Stock page -> save Form 2 stock -> `daily_stock_v2` -> `purchasing_shift_items` -> shopping-list builder / variance reports. POS item sales -> analytics tables separately. |
| Calculations performed | Total drink stock count, purchase quantities, mapped purchasing shift items, roll order recommended order, stock variance in stock modules. |
| Downstream consumers | Shopping List, Purchasing analytics, variance reports, shift reports, finance summary invalidation. |
| Duplicate logic | Stock is represented in `daily_stock_v2`, `daily_stock_sales`, stock ledgers, stock baseline/snapshot/variance, and manual ledgers. |
| Conflicting logic | Staff stock submission and POS-derived item usage are not enforced as one reconciliation chain. |
| Missing integrations | Direct consumption of canonical POS item sales in the Daily Stock V2 form path is not evident. |
| Broken/suspicious endpoints | Legacy `/api/daily-stock` appears both inline and as mounted router; legacy daily stock sales route still exists. |
| Data integrity risks | Stock variance can be calculated from disconnected stock and POS sale inputs; purchasing JSON can diverge from normalized `purchasing_shift_items`. |
| Fix before new features | Define exact Daily Stock V2 -> POS item sales -> ingredient/stock usage relationship; make `purchasing_shift_items` the normalized purchasing record and treat JSON as submission payload only. |

### 2.4 Form Library

| Audit item | Current state |
|---|---|
| Frontend routes | `/operations/daily-sales-v2/library`, `/operations/daily-sales-library` redirect. |
| Frontend files | `client/src/pages/operations/daily-sales-v2/Library.tsx`. |
| Backend API endpoints | `/api/forms/daily-sales/v2`, `/api/forms/daily-sales/v2/:id`, `/api/forms/daily-sales/v2/:id/restore`, `/api/forms/daily-sales/v2/:id/print-full`, `/api/forms/library`, `/api/forms`, `/api/forms/:id`. |
| Backend route files | `server/forms/dailySalesV2.ts`, `server/api/forms.ts`, inline `server/routes.ts`. |
| Service files | PDF/email services; Daily Sales V2 mapper. |
| Database tables | `daily_sales_v2`, `daily_stock_v2`, `daily_sales_stock_audit`, `uploaded_reports`/form library tables if used by generic forms routes. |
| Source of truth | Daily Sales V2 rows and their stock link. |
| Data flow | Library query -> map `daily_sales_v2` rows -> display totals/stock status -> fetch detail/audit. |
| Calculations performed | Total receipt count from payload receipt-count fields; drinks normalized from payload; stock-present flag via `daily_stock_v2`. |
| Downstream consumers | Owners/managers, export/print, report generation. |
| Duplicate logic | Generic forms library coexists with Daily Sales V2 library. |
| Conflicting logic | Library fallback can return rows if normal date-window query returns empty; this protects visibility but can mask date-filter mismatch. |
| Missing integrations | No POS canonical status beside form rows. |
| Broken/suspicious endpoints | `/api/forms/daily-sales/v2/:id/print-full` depends on mounted router behavior; generic `/api/forms` dynamic import may not share the same form source. |
| Data integrity risks | Owners may read form totals as sales truth when POS comparison is absent. |
| Fix before new features | Display/report source metadata: staff form, POS status, stock status, audit status. |

### 2.5 Purchasing

| Audit item | Current state |
|---|---|
| Frontend routes | `/operations/purchasing`. Legacy registry also lists purchasing mapping, shift log, analytics, list detail, ingredient purchasing. |
| Frontend files | `client/src/pages/operations/Purchasing.tsx`. |
| Backend API endpoints | `/api/purchasing-items`, `/api/purchasing-items/:id`, `/api/purchasing-items/export/csv`, `/api/purchasing-items/import/csv`, `/api/purchasing-items/sync-to-daily-stock`, `/api/purchasing-list/*`, `/api/purchasing-field-mapping/*`, `/api/purchasing-shift-log/*`, `/api/purchasing-analytics/*`, `/api/debug/*`, `/api/purchases/import-purchases`, `/api/purchase-tally/*`. |
| Backend route files | `server/routes/purchasingItems.ts`, `server/routes/purchasing.ts`, `server/routes/purchases.ts`, `server/routes/purchaseTally.ts`, `server/routes/purchasingFieldMapping.ts`, `server/routes/purchasingShiftLog.ts`, `server/routes/purchasingAnalytics.ts`, `server/routes/shoppingListNew.ts`. |
| Service files | `server/services/purchasingItemsSchemaGuard.ts`, `server/services/purchasingShiftSync.ts`, `server/lib/purchasingPlanner.ts`, `server/scripts/seedPurchasingList.ts`. |
| Database tables | `purchasing_items`, `purchasing_shift_items`, `purchasing_field_map`, `purchase_tally`, `purchase_tally_drink`, `stock_purchase_rolls`, `stock_purchase_drinks`, `stock_purchase_meat`, shift-form embedded shopping/purchasing JSON. |
| Source of truth | Master item list: `purchasing_items`. Actual shift purchases: `purchasing_shift_items` and/or `purchase_tally` depending path. |
| Data flow | Purchasing master -> Daily Stock item inputs -> `daily_stock_v2.purchasingJson` -> normalized `purchasing_shift_items` -> shopping list / analytics / stock variance. |
| Calculations performed | Category normalization, CSV import/export, sync-to-daily-stock mapping, quantity aggregation, purchase tally totals. |
| Downstream consumers | Daily Stock V2, Shopping List, Ingredients/recipes authority, finance expenses if integrated, analytics. |
| Duplicate logic | `purchase_tally` and `purchasing_shift_items` both represent purchases; JSON payload and normalized table both carry quantities. |
| Conflicting logic | `purchasing_items` is used as recipe ingredient authority in Foundation models, while legacy ingredients table remains active. |
| Missing integrations | Purchasing does not obviously post approved purchases into the canonical finance expense ledger. |
| Broken/suspicious endpoints | Delete is available but guarded by production lock and historical refs; duplicate purchasing routers exist. |
| Data integrity risks | Item renames/category changes can break mappings; purchasing JSON can diverge from normalized shift items; finance may miss cash purchases. |
| Fix before new features | Make `purchasing_items` the explicit procurement master; choose one actual-purchase table; document whether `purchase_tally` is legacy or authoritative. |

### 2.6 Shopping List

| Audit item | Current state |
|---|---|
| Frontend routes | `/operations/shopping-list`; legacy registry also includes `/operations/purchasing-list/:id`. |
| Frontend files | `client/src/pages/operations/ShoppingList.tsx`. |
| Backend API endpoints | `/api/shopping-list`, `/api/shopping-list/:date?`, `/api/shopping-list/:id`, `/api/shopping-list/:id/estimate`, `/api/shopping-list/regenerate`, `/api/shopping-list/latest`, `/api/shopping-list/by-date`, `/api/purchasing-list/*`, `/api/ingredients/shopping-list/:date`. |
| Backend route files | `server/routes.ts`, `server/routes/shoppingList.ts`, `server/routes/shoppingListRoutes.ts`, `server/routes/shoppingListNew.ts`, `server/forms/ingredients.ts`. |
| Service files | `server/services/shoppingList.ts`, `server/services/shoppingListBuilder.ts`, `server/services/shoppingListPDF.ts`, `server/services/shoppingListZip.ts`. |
| Database tables | `shopping_list`, `shopping_list_v2`, `shopping_purchase_v2`, `shopping_purchase`, `shopping_list_items`, `shopping_master`, `purchase_analytics_v2`. |
| Source of truth | Not singular. Visible page queries `/api/shopping-list`; builder writes `shopping_list_v2`; some routes read `shopping_list` + `shopping_list_items`. |
| Data flow | Daily Stock V2 / requisitions / purchasing items -> builder or regenerate route -> shopping list table(s) -> page/PDF/export. |
| Calculations performed | Estimate total cost, total item counts, requested quantities, category/supplier grouping. |
| Downstream consumers | Purchasing, managers, finance if purchases are completed/approved. |
| Duplicate logic | Legacy and V2 shopping list tables and multiple route implementations. |
| Conflicting logic | `/api/shopping-list/:date?` can conflict with `/api/shopping-list/:id` and mounted routers depending order; visible page query does not prove it uses V2 builder output. |
| Missing integrations | Purchasing-to-shopping-list and shopping-list-to-finance flow is not authoritative. |
| Broken/suspicious endpoints | Optional `/:date?` plus `/:id/estimate` and `/:id` route patterns create route-order sensitivity. |
| Data integrity risks | Pages can display stale/disconnected list data if builder writes a different table than page reads. |
| Fix before new features | Pick canonical shopping list table and route; mark all other routes/tables as legacy or derived. |

### 2.7 Menu Items

| Audit item | Current state |
|---|---|
| Frontend routes | `/menu/items`; admin ordering catalog also `/ordering/catalog`. |
| Frontend files | `client/src/pages/menu/MenuItems.tsx`, `client/src/pages/ordering/Catalog.tsx`. |
| Backend API endpoints | `/api/menu-v3/items`, `/api/menu-v3/categories`, `/api/items`, `/api/menus/*`, `/api/menu-management/*`, `/api/menu/publish`, `/api/product-menu`, `/api/products/*`. |
| Backend route files | `server/routes/menu/menuV3Routes.ts`, `server/routes/menu.ts`, `server/routes/menuManagement.ts`, `server/routes/productMenu.ts`, `server/routes/products.ts`, `server/routes/productIngredients.ts`, `server/routes/productActivation.ts`, inline `server/routes.ts`. |
| Service files | `server/services/menuCanonicalService.ts`, `server/services/menuService.ts`. |
| Database tables | `menu_items`, `menu_v2`, `menu_item_v2`, `menu_modifier_v2`, `menu_categories_v3`, `menu_items_v3`, `menu_modifiers_group_v3`, `menu_modifiers_v3`, `menu_item_recipes_v3`, `product`, `product_menu`, `product_recipe`, `product_price`, `online_catalog_items`. |
| Source of truth | Active page source appears to be Menu V3 (`/api/menu-v3/items`). Other menu sources remain active or present. |
| Data flow | Menu V3 categories/items/modifiers -> menu pages and Online Ordering pages; product/menu-management path separately manages products/canonical menu. |
| Calculations performed | Item display price, active/visible flags, sort order, channel flags. |
| Downstream consumers | Online Ordering, Recipes mapping/costing if linked, POS/External SKU mapping, Reports item attribution. |
| Duplicate logic | Menu V2, Menu V3, legacy menu items, online catalog, product menu. |
| Conflicting logic | Menu V3 item recipes link to ingredient quantity directly, while Foundation recipe authority maps products/menu items to recipes. |
| Missing integrations | No single menu item id shared across POS, recipes, online ordering, and reports. |
| Broken/suspicious endpoints | `/api/items` inline endpoint may not match `/api/menu-v3/items`. |
| Data integrity risks | Item shown online may not have recipe cost or POS mapping; recipe cost may not match sold item. |
| Fix before new features | Establish one menu item identity and mapping layer across Menu V3, POS, recipes, and online ordering. |

### 2.8 Recipes

| Audit item | Current state |
|---|---|
| Frontend routes | `/menu/recipes`. |
| Frontend files | `client/src/pages/menu/Recipes.tsx`. |
| Backend API endpoints | `/api/recipes`, `/api/recipes/:id`, recipe mapping router mounted without visible prefix, `/api/ai/recipe-description`. |
| Backend route files | `server/routes/recipes.ts`, recipe mapping router imported in `server/routes.ts`, `server/routes/menuManagement.ts`. |
| Service files | `server/services/recipes/bom.ts`; recipe/mapping helpers. |
| Database tables | Legacy `recipes`, `recipe_ingredients`, `ingredients`; Prisma `RecipeV2`, `RecipeItemV2`, Foundation `recipe`, `recipe_ingredient`, `recipe_sku_map`, `recipe_authority`-style models, `pos_item_recipe_map`, `product_recipe`, `menu_item_recipe`. |
| Source of truth | Active `/api/recipes` route uses legacy Drizzle `recipes` table, not Foundation `recipe` linked to `purchasing_items`. |
| Data flow | Recipe page -> `/api/recipes` -> legacy recipes table. Separate Foundation/recipe authority path exists for POS/menu mapping. |
| Calculations performed | Create/delete recipe; total cost fields stored in table; costs may be precomputed/stored rather than rebuilt from canonical ingredient costs. |
| Downstream consumers | Cost Calculator, Menu Management/Product recipes, POS item recipe map, ingredient usage. |
| Duplicate logic | `recipes` vs `recipe_v2` vs `recipe` Foundation; `recipe_ingredients` vs `recipe_item_v2` vs `recipe_ingredient`. |
| Conflicting logic | Legacy `recipe_ingredients` references legacy `ingredients`, while Foundation recipe ingredients reference `purchasing_items`. |
| Missing integrations | Active Recipes page is not proven to use canonical `purchasing_items` ingredient cost source. |
| Broken/suspicious endpoints | Recipe mapping router mount is not obvious from route name; active recipe route is basic and may omit ingredient joins. |
| Data integrity risks | Recipe costs can become stale if ingredient/purchasing cost changes in a different table. |
| Fix before new features | Decide if Foundation `recipe` + `recipe_ingredient` is canonical; migrate pages/read endpoints to read from it only after a separate repair plan. |

### 2.9 Ingredients

| Audit item | Current state |
|---|---|
| Frontend routes | `/menu/ingredients`; legacy registry also includes ingredient management/master routes. |
| Frontend files | `client/src/pages/menu/Ingredients.tsx`, `client/src/constants/ingredientCategories.ts`. |
| Backend API endpoints | `/api/ingredients`, `/api/ingredients/canonical`, `/api/ingredients/management`, `/api/ingredients/suggest`, `/api/ingredients/sync/:purchasingItemId`, `/api/ingredients/sync-all`, `/api/ingredients/upload`, `/api/ingredients/upload-csv`, `/api/ingredients/search`, `/api/ingredients/by-category`, `/api/admin/ingredient-authority/*`. |
| Backend route files | `server/routes/ingredients.ts`, `server/routes/ingredientAuthority.ts`, `server/api/ingredients/upload.ts`, `server/api/ingredients-import.ts`, `server/forms/ingredients.ts`, inline `server/routes.ts`. |
| Service files | `server/lib/ingredientAuthority.ts`, `server/importIngredientCosts.ts`, `server/lib/seedIngredients.ts`, `server/scripts/sync-ingredients.ts`. |
| Database tables | `ingredients`, `ingredient_authority`, `ingredient_authority_versions`, Prisma `IngredientV2`, `IngredientPriceV2`, `purchasing_items`, `supplier_defaults`, `stock_items`. |
| Source of truth | Documentation and schema suggest ingredient authority should be canonical, but active Ingredients page queries `/api/ingredients`, and recipes route references `ingredients`. |
| Data flow | Purchasing item / CSV / manual ingredient API -> ingredient tables -> recipes/costing/menu/product ingredient links. |
| Calculations performed | Cost-per-item, unit price, yield, conversion, category filtering, sync/suggest mappings. |
| Downstream consumers | Recipes, Cost Calculator, Stock usage, Menu item recipes, Shopping List, Purchasing. |
| Duplicate logic | `ingredients`, `ingredient_authority`, `ingredient_v2`, `purchasing_items` all carry ingredient-like data. |
| Conflicting logic | Recipes use `ingredients`; Foundation recipe authority uses `purchasing_items`; admin authority route uses `ingredient_authority`. |
| Missing integrations | Active ingredient table is not proven to be the same table used by recipe authority and purchasing. |
| Broken/suspicious endpoints | Legacy ingredients router is mounted under `/api/ingredients/legacy`; inline `/api/ingredients` POST exists while GET is commented in one place and mounted elsewhere. |
| Data integrity risks | Cost changes in purchasing may not update recipe cost; ingredient duplicates may split recipe usage. |
| Fix before new features | Declare exact canonical ingredient master and build read-only duplicate detection across `ingredients`, `ingredient_authority`, and `purchasing_items`. |

### 2.10 Cost Calculator

| Audit item | Current state |
|---|---|
| Frontend routes | `/menu/cost-calculator`. |
| Frontend files | `client/src/pages/menu/CostCalculator.tsx`. |
| Backend API endpoints | `/api/food-costings`, `/api/costing/*`. |
| Backend route files | inline `server/routes.ts`, `server/routes/costing.ts`. |
| Service files | `server/data/foodCostings.ts`, `server/services/recipes/bom.ts`. |
| Database tables | `recipes`, `recipe_ingredients`, `ingredients`, Foundation `recipe`, `recipe_ingredient`, `purchasing_items`, `product`, `product_recipe`, `product_ingredient`, possibly static food cost data. |
| Source of truth | Not clear. Visible page queries `/api/food-costings`, which may return static/server-side food costings rather than canonical recipe/ingredient authority. |
| Data flow | Cost Calculator page -> food costings endpoint -> static or calculated cost data. Separate `/api/costing` route may calculate from recipe BOM. |
| Calculations performed | Ingredient cost sums, cost per serving/unit, margin/COGS percentage, suggested price. |
| Downstream consumers | Menu pricing, recipes, finance margin reports. |
| Duplicate logic | Recipe table stores `totalCost`, `costPerServing`, `cogsPercent`, `suggestedPrice`; product table stores `baseCost`; static foodCostings can duplicate both. |
| Conflicting logic | Calculator may not use same ingredient table as active recipe authority. |
| Missing integrations | No proven deterministic rebuild from purchasing cost source -> recipe cost -> menu/product price. |
| Broken/suspicious endpoints | `/api/food-costings` is separate from `/api/costing`, increasing risk of stale display. |
| Data integrity risks | Displayed food cost may be stale or disconnected from actual purchasing cost. |
| Fix before new features | Make cost calculator read from canonical recipes + canonical ingredient/purchasing costs only, with stale-cost blockers. |

### 2.11 Online Ordering

| Audit item | Current state |
|---|---|
| Frontend routes | `/online-ordering`, `/online-ordering/checkout`, `/online-ordering/confirmation`, `/ordering/orders`, `/ordering/catalog`. |
| Frontend files | `client/src/pages/ordering/OnlineOrdering.tsx`, `Checkout.tsx`, `Confirmation.tsx`, `Orders.tsx`, `Catalog.tsx`. |
| Backend API endpoints | `/api/menu-v3/items`, `/api/menu-v3/categories`, `/api/orders`, `/api/menu`, online order routes registered by `registerOnlineOrderRoutes`, admin/menu routes, payment routes. |
| Backend route files | `server/routes/onlineOrders.ts`, `server/routes/onlineMenu.ts`, `server/routes/menu/menuV3Routes.ts`, payment routes, `server/routes/adminMenu.ts`. |
| Service files | Ordering services if present, menu canonical service, product/menu service. |
| Database tables | `orders_v2`, `order_items_v2`, `order_modifiers_v2`, `KDSQueue`, `order_counters`, `menu_categories_v3`, `menu_items_v3`, `menu_modifiers_group_v3`, `menu_modifiers_v3`, legacy `orders_online`, `order_lines_online`, `menu_items_online`, `online_catalog_items`, `loyverse_map_v2`, payment/provider tables. |
| Source of truth | Active ordering pages appear to read Menu V3. Orders are stored in `orders_v2`. |
| Data flow | Menu V3 items -> customer ordering UI -> cart/checkout -> online orders -> KDS/admin orders -> payment/SCB/partner/delivery extensions. |
| Calculations performed | Subtotal/total, modifiers, delivery/partner fields, KDS state. |
| Downstream consumers | KDS/admin orders, Finance if integrated, POS sync if Loyverse order creation exists, delivery. |
| Duplicate logic | Online catalog, Menu V3, menu_items_online, product menu. Order tables V2 and Online variants both exist. |
| Conflicting logic | Ordering uses Menu V3, while Recipes page uses legacy recipes and Menu Management may use product/menu-management routes. |
| Missing integrations | No proof that online orders feed POS/Loyverse sales or finance sales totals as canonical paid sales. |
| Broken/suspicious endpoints | `/api/menu` and `/api/menu-v3/items` both expose menus; active customer page uses one source but registered online menu route exposes another. |
| Data integrity risks | Online item can be sold without matching recipe or POS mapping; finance may exclude unpaid/unverified online orders. |
| Fix before new features | Align Menu V3 item ids to recipe ids and POS item ids; define whether online order sales become POS receipts or separate sales channel records. |

### 2.12 Finance

| Audit item | Current state |
|---|---|
| Frontend routes | `/finance`, `/finance/profit-loss`, `/finance/expenses`, `/finance/expenses-import`. |
| Frontend files | `client/src/pages/finance/FinanceHub.tsx`, `ProfitLoss.tsx`, `Expenses.tsx`, `ExpensesImport.tsx`. |
| Backend API endpoints | `/api/reports/financial-overview`, `/api/profit-loss`, `/api/expensesV2`, `/api/expensesV2/*`, `/api/finance/*`, `/api/bank-imports/*`, `/api/expense-suppliers`, `/api/expense-categories`, `/api/bank-statements`, `/api/expenses`, `/api/expensesV2/imports/*`. |
| Backend route files | `server/routes.ts`, `server/api/finance.ts`, `server/routes/finance.ts`, `server/routes/expenses-import.ts`, `server/api/expenseImports.ts`, `server/routes/bankImport.ts`, `server/routes/expenses.ts`. |
| Service files | `server/utils/financeCalculations.ts`, `server/lib/expenseTotals.ts`, expense import services, email/report data services. |
| Database tables | `expenses`, `expenses_v2`, `expenses_legacy`, `expense_entry`, `expense_import_batch`, `expense_import_line`, `imported_expenses`, `bank_import_batch`, `bank_txn`, `vendor_rule`, `bank_statements`, `transactions`, `pnl_expense`, `pl_row`, `pl_category_map`, `pl_month_cache`, `partner_statements`, shift form expenses/wages. |
| Source of truth | Not singular. Bank imports and approved expenses appear most finance-grade; shift cash expenses are embedded in Daily Sales V2; `pnl_expense` exists for unified derivation but may not be active everywhere. |
| Data flow | Bank/partner/manual import -> staging -> approval -> expense tables -> finance summary/P&L. Separately Daily Sales V2 expenses/wages -> reports/finance summaries. |
| Calculations performed | Today summary, P&L expenses, P&L summary, profit/loss, month-to-date/by-category totals, financial overview. |
| Downstream consumers | Finance pages, reports, email summaries, shift P&L. |
| Duplicate logic | Multiple expense tables and multiple P&L endpoints; `/api/profit-loss` separate from `/api/finance/pl` and reports financial overview. |
| Conflicting logic | Finance may combine daily_sales, expenses_v2, imported expenses, and shift forms inconsistently depending endpoint. |
| Missing integrations | Purchasing cash purchases and online orders may not flow into one approved finance ledger. |
| Broken/suspicious endpoints | `/api/expensesV2` is defined in multiple inline sections and dynamic import mounts; high route shadowing risk. |
| Data integrity risks | Double-counting or missing expenses; stale P&L cache; shift wages not reconciled with staff operations. |
| Fix before new features | Define canonical finance ledger and explicit derived P&L rebuild; ensure shift expenses and bank-approved expenses do not double-count. |

### 2.13 Reports

| Audit item | Current state |
|---|---|
| Frontend routes | `/reports/shift-reports`, `/reports/shift-history`, `/reports/export`. Legacy registry also lists `/reports/shift-report`, `/reports/shift-report/history`, `/reports/shift-report/view/:id`, and operations report routes. |
| Frontend files | `client/src/pages/reports/ShiftReports.tsx`, `ShiftHistory.tsx`, `Export.tsx`. |
| Backend API endpoints | `/api/shift-report/history`, `/api/shift-report/generate`, `/api/shift-reports/balance-review`, `/api/analysis/daily-sales/export.csv`, `/api/reports/sales-summary`, `/api/reports/financial-overview`, `/api/reports/performance-metrics`, `/api/analysis/daily-sales`, `/api/snapshots/*`, `/api/dashboard/latest`. |
| Backend route files | `server/routes/shiftReportRoutes.ts`, `server/services/shiftReportBuilder.ts`, `server/routes.ts`, analysis routes. |
| Service files | `server/services/shiftReportBuilder.ts`, `server/services/shiftReportsService.ts`, `server/services/shiftReportPDF.ts`, `server/services/shiftReportEmail.ts`, `server/services/shiftReportInsights.ts`. |
| Database tables | `shift_report_v2`, `shift_reports`, `daily_sales_v2`, `daily_stock_v2`, `pos_shift_report`, `daily_shift_summary`, `daily_shift_receipt_summary`, `analysis_reports`, `analysis_adjustments`, `ShiftSnapshot` and snapshot child tables. |
| Source of truth | Reports should be derived from canonical POS + Daily Sales V2 + Daily Stock V2, but current routes also read cached shift report and legacy analysis summaries. |
| Data flow | Daily Sales/Stock/POS -> shift report builder -> `shift_report_v2` -> report history/detail/export; analysis routes export legacy daily sales. |
| Calculations performed | POS vs form variance, cash/QR/Grab variances, warnings, refunds/discounts, financial overview metrics. |
| Downstream consumers | Owners/managers, exports, emails, finance decisions. |
| Duplicate logic | `shift_report_v2`, `shift_reports`, daily shift summaries, snapshots, analysis exports. |
| Conflicting logic | Report exports may use `/api/analysis/daily-sales/export.csv`, not shift report builder; financial overview may use separate finance/report queries. |
| Missing integrations | One report endpoint should expose source provenance for POS, form, stock, finance. |
| Broken/suspicious endpoints | CSV export comments mention disabled daily shift summary in imports, but an inline export route remains. |
| Data integrity risks | Reports may disagree with Daily Sales/POS or Finance page totals. |
| Fix before new features | Make shift report builder the sole derived report path, with source table/version metadata and blocker statuses. |

### 2.14 Staff Operations

| Audit item | Current state |
|---|---|
| Frontend routes | `/staff/dashboard`, `/staff/members`, `/staff/roster`, `/staff/cleaning`, `/staff/attendance`, `/staff/settings`. |
| Frontend files | `client/src/pages/staff/Dashboard.tsx`, `Members.tsx`, `Roster.tsx`, `Cleaning.tsx`, `Attendance.tsx`, `Settings.tsx`. |
| Backend API endpoints | `/api/staff/dashboard`, `/api/staff/members`, `/api/staff/members/:id`, `/api/staff/work-areas`, `/api/staff/templates`, `/api/staff/rosters`, `/api/staff/rosters/:id/assignments`, `/api/staff/cleaning/templates`, `/api/staff/attendance`, `/api/staff/unavailability`. |
| Backend route files | `server/routes/staffOps.ts`. |
| Service files | `server/services/staffOpsService.ts`. |
| Database tables | `operations_settings`, `operating_hours`, `work_areas`, `shift_templates`, `shift_template_station_requirements`, `staff_members`, `staff_availability`, `staff_unavailability`, `shift_rosters`, `shift_staff_assignments`, `shift_breaks`, `cleaning_task_templates`, `shift_cleaning_tasks`, `deep_cleaning_tasks`, `shift_attendance_logs`, `shift_change_log`, legacy `staff_shifts`, `cleaning_tasks`, `checklist_assignments`. |
| Source of truth | Staff Ops tables from `staffOps_phase1.sql` / Prisma models. |
| Data flow | Staff pages -> staff ops API -> staff/roster/attendance/cleaning tables. |
| Calculations performed | Dashboard counts, roster date ranges, attendance filtering, active member/template lists. |
| Downstream consumers | Operations management; potential labor cost/finance future integration. |
| Duplicate logic | Legacy `staff_shifts` and `cleaning_tasks` coexist with newer staff ops tables. |
| Conflicting logic | Daily Sales V2 wage entries are not tied to Staff Ops members/attendance. |
| Missing integrations | No authoritative labor-cost handoff from Staff Ops attendance/rosters to Finance/Daily Sales wages. |
| Broken/suspicious endpoints | Most Staff Ops endpoints are straightforward; write endpoints exist for members/settings. |
| Data integrity risks | Wage costs may be manually entered in Daily Sales and not reconciled to Staff Ops attendance. |
| Fix before new features | Add read-only reconciliation between Daily Sales wage entries and staff attendance before automating labor cost. |

## 3. Source-of-Truth Map

| Domain | Current authoritative candidate | Competing/duplicate sources | Alignment verdict |
|---|---|---|---|
| POS receipts | Loyverse API -> normalized POS table should be canonical (`pos_receipt` family or `lv_receipt` family) | `receipts`, `loyverse_receipts`, `lv_receipt`, `pos_receipt`, `receipt_truth_line`, Prisma `Receipt` | Not aligned. Select one canonical persisted read model. |
| POS shift totals | `pos_shift_report` candidate | `loyverse_shift_reports`, snapshot POS data, receipt_truth_line aggregation, live Loyverse API fallback | Not aligned. |
| Staff daily sales | `daily_sales_v2` | `daily_sales`, `daily_stock_sales`, shift snapshots | Mostly aligned for staff form; sales totals need POS separation. |
| Staff daily stock | `daily_stock_v2` | `daily_stock`, `daily_stock_sales`, stock ledgers, manual ledgers | Partially aligned. |
| Shift reports | Derived `shift_report_v2` candidate | `shift_reports`, snapshots, daily shift summaries, analysis reports | Not aligned. |
| Purchasing master | `purchasing_items` | `ingredients`, `ingredient_authority`, `shopping_master` | Partially aligned. |
| Actual purchases | `purchasing_shift_items` candidate | `purchase_tally`, `shopping_purchase_v2`, shift payload JSON, finance expenses | Not aligned. |
| Shopping list | `shopping_list_v2` candidate | `shopping_list`, `shopping_list_items`, `shopping_master`, inline route output | Not aligned. |
| Ingredients | `ingredient_authority` or `purchasing_items` candidate | `ingredients`, `ingredient_v2`, product ingredients | Not aligned. |
| Recipes | Foundation `recipe` + `recipe_ingredient` candidate | legacy `recipes`, `recipe_v2`, product/menu recipe links | Not aligned. |
| Menu items | Menu V3 candidate | `menu_items`, `menu_v2`, `online_catalog_items`, `product_menu`, online menu tables | Not aligned. |
| Online orders | `orders_v2` candidate | legacy `orders_online`, POS receipts if synced | Partially aligned inside ordering only. |
| Expenses | Approved finance ledger should be canonical (`expenses` or `pnl_expense`) | `expenses_v2`, `expenses_legacy`, `expense_entry`, imports, shift embedded expenses | Not aligned. |
| Staff ops | Staff Ops phase-1 tables | `staff_shifts`, Daily Sales wage entries | Mostly isolated; labor finance not aligned. |

## 4. Data-Flow Diagrams (Text Form)

### 4.1 POS / Shift Sales

```text
Loyverse POS
  -> Loyverse sync/API/webhook routes
  -> raw/normalized receipt candidates:
     receipts | loyverse_receipts | lv_receipt/lv_line_item | pos_receipt/pos_sales_item
  -> POS shift total candidates:
     pos_shift_report | loyverse_shift_reports | receipt_truth_line aggregation | snapshot.pos_data
  -> consumers:
     Daily Sales V2 comparison
     Reports / shift_report_v2
     Finance sales totals
     Stock/ingredient usage analytics
```

### 4.2 Daily Sales + Daily Stock

```text
Staff Daily Sales Form
  -> /api/forms/daily-sales/v3 or /api/forms/daily-sales/v2/:id
  -> daily_sales_v2.payload + child expense/wage/purchase rows
  -> Daily Sales Library / Reports / Finance summary
  -> Daily Stock Form for same salesId
     -> daily_stock_v2
     -> purchasing_shift_items sync
     -> shopping-list builder / stock variance / reports
```

### 4.3 Purchasing -> Shopping List

```text
Purchasing master
  -> purchasing_items
  -> Daily Stock V2 purchasing fields
  -> daily_stock_v2.purchasingJson
  -> purchasing_shift_items (normalized actual shift quantities)
  -> shoppingListBuilder
  -> shopping_list_v2 candidate

Legacy/parallel path:
  shopping_list + shopping_list_items + /api/shopping-list routes
  purchase_tally / purchase_tally_drink
```

### 4.4 Ingredients -> Recipes -> Menu -> Online Ordering

```text
Purchasing/ingredient master candidates
  -> purchasing_items / ingredient_authority / ingredients / ingredient_v2
  -> recipe candidates:
     legacy recipes + recipe_ingredients
     Foundation recipe + recipe_ingredient
     RecipeV2 + RecipeItemV2
  -> menu candidates:
     Menu V3 tables
     product/product_menu tables
     online_catalog_items / menu_items_online
  -> Online Ordering:
     /api/menu-v3/items -> customer catalog -> orders_v2/order_items_v2
```

### 4.5 Finance / Reports

```text
Sales candidates:
  POS shift totals + Daily Sales V2 + Online orders

Expense candidates:
  bank imports -> imported/approved expenses
  shift form expenses/wages
  purchase tally / purchasing shift items
  expenses_v2 / expenses / pnl_expense

Derived outputs:
  /api/profit-loss
  /api/finance/*
  /api/reports/financial-overview
  shift_report_v2
  CSV exports
```

## 5. Duplicate Logic List

1. **POS receipts:** `receipts`, `loyverse_receipts`, `lv_receipt`, `pos_receipt`, `receipt_truth_line`, Prisma `Receipt`.
2. **POS item sales:** `pos_sales_item`, `analytics_shift_item`, `analytics_shift_burger_item`, `shift_item_sales`, `SoldItem`.
3. **Shift reports:** `shift_report_v2`, `shift_reports`, `ShiftSnapshot`, `daily_shift_summary`, `daily_shift_receipt_summary`, `analysis_reports`.
4. **Daily sales:** legacy `daily_sales`, legacy `daily_stock_sales`, `daily_sales_v2`.
5. **Stock:** `daily_stock_v2`, `stock_entries`, stock ledgers, manual stock ledgers, stock baseline/snapshot/variance tables.
6. **Purchases:** `purchasing_shift_items`, `purchase_tally`, `shopping_purchase_v2`, shift payload JSON.
7. **Shopping list:** `shopping_list`, `shopping_list_v2`, `shopping_list_items`, `shopping_master`.
8. **Ingredients:** `ingredients`, `ingredient_authority`, `ingredient_v2`, `purchasing_items` with ingredient fields.
9. **Recipes:** `recipes`, `recipe_v2`, Foundation `recipe`, `recipe_ingredient`, product/menu recipe links.
10. **Menus:** `menu_items`, `menu_v2`, Menu V3, `online_catalog_items`, `menu_items_online`, `product_menu`.
11. **Orders:** `orders_v2` and `orders_online` families.
12. **Expenses/P&L:** `expenses`, `expenses_v2`, `expenses_legacy`, `expense_entry`, `imported_expenses`, `pnl_expense`, `pl_*` cache tables.
13. **Finance totals:** `/api/profit-loss`, `/api/finance/pl`, `/api/reports/financial-overview`, shift P&L route.
14. **Staff/labor:** Daily Sales wage entries and Staff Ops attendance/roster tables.

## 6. Conflicting Data Source List

| Conflict | Risk |
|---|---|
| Daily Sales V2 comments say POS-sourced sales, but create path still computes/stores `totalSales` from form channels. | Staff-entered sales can be treated as POS truth. |
| Shift approval can source POS data from snapshot, Loyverse API, receipt truth aggregation, or POS shift report. | Same date can show different POS totals. |
| Shopping List page reads `/api/shopping-list` while builder writes `shopping_list_v2`. | Page may show stale or legacy list. |
| Recipes route reads legacy `recipes`, but Foundation recipe authority uses `recipe` linked to `purchasing_items`. | Recipe costs/ingredient usage can disagree. |
| Ingredients page reads `/api/ingredients`, while authority route uses `ingredient_authority` and purchasing uses `purchasing_items`. | Duplicate ingredient names/costs can exist. |
| Online Ordering reads Menu V3, while Recipes and Product/Menu Management use other tables. | Online menu items can lack recipe cost or POS mapping. |
| Finance pages use `/api/profit-loss`, `/api/reports/financial-overview`, `/api/expensesV2`, and `/api/finance/*`. | P&L numbers can disagree across pages. |
| Reports export daily sales analysis separately from shift report builder. | Export totals may disagree with shift report history. |
| Staff Ops attendance is separate from Daily Sales wage entries. | Labor cost can be manually entered and unreconciled. |

## 7. Broken or Suspicious Endpoint List

1. **`/api/expensesV2` multiple definitions/mounts** — inline GET/POST/upload/approve/stock/delete/totals and dynamic imports raise route-shadowing risk.
2. **`/api/shopping-list/:date?` with `/api/shopping-list/:id` and `/:id/estimate`** — optional route parameters create order-sensitive behavior.
3. **`/api/dev/daily-sales-v2/:id/repair-merge`** — development repair route is mounted in main route file.
4. **Legacy Daily Sales write routes** — explicitly blocked, but their presence indicates old clients may still call them.
5. **`receipt_truth_line` references** — runtime SQL references a table not found in the main Drizzle or Prisma schema files inspected.
6. **`/api/menu` vs `/api/menu-v3/items`** — two menu read APIs can disagree.
7. **`/api/items` vs Menu V3 item APIs** — generic item endpoint can diverge from menu item source.
8. **`/api/food-costings` vs `/api/costing/*`** — cost calculator may use static/legacy data instead of recipe BOM source.
9. **`/api/daily-stock` inline plus mounted route** — duplicate daily-stock endpoint ownership.
10. **Shift report exports using `/api/analysis/daily-sales/export.csv`** — reports export path may bypass canonical shift report builder.

## 8. High-Risk Issues

1. **No single canonical POS receipt table.** This affects sales, stock usage, reports, finance, and reconciliation.
2. **Shift report authority is ambiguous.** `pos_shift_report`, snapshots, `shift_report_v2`, and analysis summaries can all present shift truth.
3. **Daily Sales V2 POS alignment is incomplete.** Staff totals and POS totals are not strictly separated as declaration vs truth.
4. **Finance ledger is fragmented.** Multiple expense tables/endpoints create double-counting and omission risk.
5. **Recipes/ingredients/purchasing are not aligned.** Cost and usage calculations can be wrong if recipes read one ingredient table and purchasing updates another.
6. **Online Ordering menu may be disconnected from recipe/POS mapping.** Sold online items may not map to cost, stock, or POS items.
7. **Shopping List may read a different table than the builder writes.** Managers can act on stale/disconnected purchasing recommendations.
8. **POS item sales are not proven to drive Daily Stock V2 usage.** Stock variance can be disconnected from actual item sales.

## 9. Medium-Risk Issues

1. Duplicate report/export endpoints may produce inconsistent owner-facing numbers.
2. Purchasing item renames/category changes may break recipe and stock mappings if not guarded everywhere.
3. Soft-deleted Daily Sales V2 records require consistent filtering in all reports.
4. Staff Ops labor data does not reconcile to Daily Sales wages.
5. Product/Menu Management and Menu V3 overlap.
6. Legacy route constants list pages not mounted in active `App.tsx`, creating documentation/runtime drift.
7. Static food costing data can become stale relative to ingredient purchasing cost.
8. Multiple stock ledgers can disagree with Daily Stock V2.

## 10. Low-Risk Cleanup Items

1. Document active vs legacy frontend routes.
2. Label legacy tables in schema comments and architecture docs.
3. Add endpoint owner comments for modules with multiple routers.
4. Inventory unused backup routes/pages separately.
5. Normalize naming: `shift-report` vs `shift-reports`, `daily-stock-sales` vs `daily_stock_v2`.
6. Create read-only source-provenance headers/fields in report endpoints.
7. Remove or hide development route references in production only after explicit repair PR approval.

## 11. Recommended Repair Order

No fixes should happen in this audit PR. Future repair order should be:

1. **POS canonical contract PR** — choose canonical persisted POS receipt and POS shift tables; mark other receipt tables raw/legacy/derived.
2. **Daily Sales V2 reconciliation PR** — separate staff declarations from POS totals; add blockers when POS shift is missing.
3. **Shift Report source-contract PR** — make one derived shift report path from POS + Daily Sales V2 + Daily Stock V2 with provenance.
4. **Daily Stock V2 POS usage PR** — define POS item sales -> recipe/ingredient usage -> stock variance flow.
5. **Purchasing/Shopping List alignment PR** — choose canonical shopping list table and actual-purchase table.
6. **Ingredient authority PR** — choose canonical ingredient master and duplicate-detection report.
7. **Recipe authority PR** — align recipe route/page to canonical ingredients/purchasing costs.
8. **Menu identity PR** — map Menu V3/product/menu items to recipes and POS ids.
9. **Online Ordering sales integration PR** — define whether online orders become POS receipts or separate channel sales.
10. **Finance ledger PR** — choose canonical expense ledger and deterministic P&L rebuild path.
11. **Reports/export consolidation PR** — route exports through canonical report/read models.
12. **Staff labor reconciliation PR** — read-only compare Staff Ops attendance/rosters with Daily Sales wage entries.

## 12. Patch Plan for Future Repair PRs

### PR 1 — POS Source-of-Truth Read Contract

- Add a read-only audit endpoint/report listing all POS receipt tables by date and counts.
- Do not migrate or delete data.
- Output blockers for dates where canonical POS shift is missing.
- Document raw vs derived vs canonical POS tables.

### PR 2 — Daily Sales V2 POS Separation

- Keep staff form behavior unchanged initially.
- Add read-only comparison fields: `staff_declared_sales`, `pos_sales`, `variance`, `pos_source`, `blockers`.
- Stop displaying staff-entered totals as POS truth in reports without provenance.

### PR 3 — Shift Report Rebuild Contract

- Define `shift_report_v2` as derived-only if selected.
- Rebuild from canonical POS + `daily_sales_v2` + `daily_stock_v2`.
- Store source ids and timestamps in report payload.

### PR 4 — Daily Stock / POS Item Usage Bridge

- Build deterministic read model from canonical POS line items to expected stock/ingredient usage.
- Do not mutate Daily Stock forms.
- Surface unmapped POS items as blockers, not guessed categories.

### PR 5 — Purchasing and Shopping List Unification

- Select canonical actual purchase record.
- Make shopping list builder and page read the same table.
- Add route-level source metadata.

### PR 6 — Ingredient and Recipe Authority

- Produce duplicate ingredient/recipe map first.
- Align cost calculator to canonical recipe + canonical ingredient cost read model.
- Preserve old tables as legacy until validated.

### PR 7 — Menu / Online Ordering Identity

- Add mapping visibility: menu item -> recipe -> POS item -> online item.
- Block costing/stock deductions for unmapped items instead of guessing.

### PR 8 — Finance Ledger Consolidation

- Define approved expense ledger and derived P&L cache.
- Reconcile shift expenses, bank imports, purchasing, online orders, and POS sales.
- Add double-count detection.

### PR 9 — Reports Consolidation

- Move exports to canonical read models.
- Add source provenance and blocker sections to all owner-facing reports.

### PR 10 — Staff Labor Reconciliation

- Add read-only comparison between Staff Ops attendance/rosters and Daily Sales wage entries.
- Do not auto-create wage entries until owner explicitly approves.

## Specific Focus Answers

### Is Loyverse really the POS source of truth?

Business intent appears to be yes, but implementation does not enforce one canonical Loyverse/POS read model. The code has multiple persisted POS/receipt tables and fallback sources.

### Which tables contain POS receipts?

Known receipt/POS candidates include: `receipts`, `loyverse_receipts`, `lv_receipt`, `lv_line_item`, `lv_modifier`, `pos_receipt`, `pos_sales_item`, `pos_sales_modifier`, `pos_payment_summary`, Prisma `Receipt`, `ReceiptItem`, `ReceiptPayment`, and referenced `receipt_truth_line`.

### Which table is authoritative for shift reports?

No single table is authoritative today. `shift_report_v2` is the strongest derived-report candidate, while `pos_shift_report` is the strongest POS-shift candidate, and `daily_sales_v2` + `daily_stock_v2` are staff-form sources.

### Does Daily Sales V2 compare against Loyverse correctly?

Partially. There are POS comparison paths, but Daily Sales V2 still computes/stores/preserves sales values in its payload. Correctness depends on the endpoint/path used and source availability.

### Does Daily Stock V2 use POS item sales correctly?

Not conclusively. POS item sales analytics exist separately, but the Daily Stock V2 save path is primarily staff stock/purchasing data and does not prove direct use of canonical POS item sales.

### Does Purchasing feed Shopping List correctly?

Partially but not conclusively. `purchasing_items` and `purchasing_shift_items` feed builder logic, but visible shopping list routes and tables are split between legacy and V2 implementations.

### Do Recipes use the correct ingredient table?

Not consistently. Active recipes route uses legacy `recipes` and legacy `ingredients` relationship, while newer authority models link recipes to `purchasing_items`.

### Does Cost Calculator use recipe and ingredient costs correctly?

Not proven. The visible page queries `/api/food-costings`, separate from recipe authority and BOM service paths.

### Does Online Ordering use the same menu source as Recipes/Menu Management?

No clear singular source. Active Online Ordering uses Menu V3 endpoints; Recipes use legacy recipe routes; Menu Management/Product routes use additional tables.

### Does Finance use real expenses and sales data?

Finance uses real tables/routes, but the real data is fragmented. It is not yet guaranteed that all real expenses and sales are included exactly once.

### Do Reports use the same source of truth as Daily Sales/POS?

Not consistently. Report pages use shift report history plus analysis exports and financial overview endpoints that may not share one source contract.

### Are there duplicate tables or duplicate calculations?

Yes. Duplicate receipt, shift report, shopping list, ingredient, recipe, menu, stock, expense, and finance/P&L calculations exist.

### Are any pages displaying stale or disconnected data?

Likely candidates are Shopping List, Cost Calculator, Reports export, Finance overview/P&L, and Online Ordering menu/cost linkage because their active endpoints can read sources different from the modules they conceptually represent.
