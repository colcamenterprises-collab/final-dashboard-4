# Ground-Zero Schema Summary

**Generated:** 2025-10-08 08:14:09 UTC

This document reflects the **current** Postgres schema as the single source of truth.

> Scope: tables, columns, primary/foreign keys, indexes, enums/domains, views/materialized views, approximate row counts, and integrity sanity checks.

---
## Database Identity
| neondb | public | PostgreSQL 16.9 (165f042) on aarch64-unknown-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit |

## Schemas Present
| information_schema |
|---|pg_catalog
pg_toast
public

## Enums
| public | ExpenseType | GENERAL |
|---|public | ExpenseType | PURCHASE
public | ExpenseType | WAGE
public | JobStatus | QUEUED
public | JobStatus | RUNNING
public | JobStatus | SUCCESS
public | JobStatus | FAILED
public | JobStatus | DEAD_LETTER
public | JobType | POS_BACKFILL
public | JobType | POS_INCREMENTAL_SYNC
public | JobType | ANALYTICS_DAILY
public | JobType | EMAIL_SUMMARY
public | MenuSource | house
public | MenuSource | pos
public | MenuSource | grab
public | MenuSource | foodpanda
public | MenuSource | other
public | POSProvider | LOYVERSE
public | POSProvider | TOAST
public | POSProvider | SQUARE
public | POSProvider | LIGHTSPEED
public | POSProvider | OTHER
public | PaymentChannel | CASH
public | PaymentChannel | QR
public | PaymentChannel | CARD
public | PaymentChannel | GRAB
public | PaymentChannel | OTHER
public | PaymentMethod | CASH
public | PaymentMethod | CARD
public | PaymentMethod | QR
public | PaymentMethod | WALLET
public | PaymentMethod | DELIVERY_PARTNER
public | PaymentMethod | OTHER
public | Provider | LOYVERSE
public | ReconcileState | OK
public | ReconcileState | MISMATCH
public | ReconcileState | MISSING_DATA
public | SalesChannel | IN_STORE
public | SalesChannel | GRAB
public | SalesChannel | FOODPANDA
public | SalesChannel | LINE_MAN
public | SalesChannel | ONLINE
public | SalesChannel | OTHER
public | imported_expense_status | PENDING
public | imported_expense_status | APPROVED
public | imported_expense_status | REJECTED

## Domains
| information_schema | cardinal_number | integer |
|---|information_schema | character_data | character varying
information_schema | sql_identifier | name
information_schema | time_stamp | timestamp with time zone
information_schema | yes_or_no | character varying

## Tables (Approx Row Counts)
| public | receipts | 1736704 | 744 |
|---|public | receipt_items | 655360 | 1490
public | imported_expenses | 565248 | 464
public | pos_sync_logs | 516096 | 1669
public | loyverse_receipts | 262144 | 2
public | daily_sales_v2 | 253952 | 92
public | receipt_payments | 229376 | 744
public | ingredients | 155648 | 73
public | expenses | 114688 | 146
public | pos_connections | 98304 | 1
public | loyverse_shifts | 98304 | 2
public | ingredient_v2 | 81920 | 66
public | dailyShiftAnalysis | 49152 | 4
public | dailyReceiptSummaries | 49152 | 1
public | shopping_list | 49152 | 1
public | restaurants | 49152 | 1
public | suppliers | 49152 | 7
public | shopping_list_items | 49152 | 0
public | daily_stock_v2 | 49152 | 0
public | menu_items | 32768 | 0
public | analytics_daily | 32768 | 0
public | jobs | 32768 | 0
public | recipe_lines | 32768 | 10
public | manager_checklists | 32768 | 6
public | PaymentBreakdown | 32768 | 0
public | purchase_tally_drink | 32768 | 0
public | _prisma_migrations | 32768 | 1
public | recipes | 32768 | 5
public | JussiComparison | 32768 | 0
public | purchase_tally | 32768 | 31
public | PosBatch | 32768 | 9
public | DailySales | 32768 | 3
public | ManagerCheckQuestion | 32768 | 6
public | menu_item_v2 | 32768 | 0
public | cleaning_tasks | 32768 | 10
public | checklist_assignments | 32768 | 0
public | ExpenseLine | 24576 | 0
public | DailyStock | 24576 | 0
public | PaymentMethodMap | 24576 | 0
public | ingestion_errors | 24576 | 0
public | ShiftSnapshot | 24576 | 0
public | SnapshotItem | 24576 | 0
public | SnapshotModifier | 24576 | 0
public | RecipeItem | 24576 | 0
public | RecipeComponent | 24576 | 0
public | recipe_v2 | 24576 | 0
public | recipe_item_v2 | 24576 | 0
public | menu_v2 | 24576 | 0
public | menu_modifier_v2 | 24576 | 0
public | stock_requests | 24576 | 0
public | PosShiftReport | 24576 | 0
public | BankTxn | 24576 | 0
public | PosReceipt | 16384 | 0
public | supplier_defaults | 16384 | 0
public | PosSalesItem | 16384 | 0
public | PosSalesModifier | 16384 | 0
public | PosPaymentSummary | 16384 | 0
public | BankImportBatch | 16384 | 0
public | VendorRule | 16384 | 0
public | wage_entry_v2 | 16384 | 0
public | shopping_purchase_v2 | 16384 | 0
public | partner_statements | 16384 | 0
public | other_expenses | 16384 | 0
public | daily_stock_sales | 16384 | 0
public | wage_entries | 16384 | 0
public | stock_items | 16384 | 0
public | shopping_purchases | 16384 | 0
public | other_expense_v2 | 16384 | 0

## Columns
| public | BankImportBatch | id | 1 | text | NO |  |
|---|public | BankImportBatch | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | BankImportBatch | source | 3 | text | NO | 
public | BankImportBatch | filename | 4 | text | NO | 
public | BankImportBatch | status | 5 | text | NO | 'pending'::text
public | BankTxn | id | 1 | text | NO | 
public | BankTxn | batchId | 2 | text | NO | 
public | BankTxn | postedAt | 3 | timestamp without time zone | NO | 
public | BankTxn | description | 4 | text | NO | 
public | BankTxn | amountTHB | 5 | numeric | NO | 
public | BankTxn | ref | 6 | text | YES | 
public | BankTxn | raw | 7 | jsonb | NO | 
public | BankTxn | status | 8 | text | NO | 'pending'::text
public | BankTxn | category | 9 | text | YES | 
public | BankTxn | supplier | 10 | text | YES | 
public | BankTxn | notes | 11 | text | YES | 
public | BankTxn | expenseId | 12 | text | YES | 
public | BankTxn | dedupeKey | 13 | text | NO | 
public | DailySales | id | 1 | text | NO | 
public | DailySales | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | DailySales | updatedAt | 3 | timestamp without time zone | NO | 
public | DailySales | status | 4 | text | NO | 'draft'::text
public | DailySales | shiftDate | 5 | text | NO | 
public | DailySales | submittedAtISO | 6 | timestamp without time zone | YES | 
public | DailySales | completedBy | 7 | text | NO | 
public | DailySales | startingCash | 8 | integer | NO | 0
public | DailySales | endingCash | 9 | integer | NO | 0
public | DailySales | cashBanked | 10 | integer | NO | 0
public | DailySales | cashSales | 11 | integer | NO | 0
public | DailySales | qrSales | 12 | integer | NO | 0
public | DailySales | grabSales | 13 | integer | NO | 0
public | DailySales | aroiSales | 14 | integer | NO | 0
public | DailySales | totalSales | 15 | integer | NO | 0
public | DailySales | shoppingTotal | 16 | integer | NO | 0
public | DailySales | wagesTotal | 17 | integer | NO | 0
public | DailySales | othersTotal | 18 | integer | NO | 0
public | DailySales | totalExpenses | 19 | integer | NO | 0
public | DailySales | closingCash | 20 | integer | NO | 0
public | DailySales | qrTransfer | 21 | integer | NO | 0
public | DailySales | notes | 22 | text | YES | 
public | DailySales | deletedAt | 23 | timestamp without time zone | YES | 
public | DailyStock | id | 1 | text | NO | 
public | DailyStock | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | DailyStock | updatedAt | 3 | timestamp without time zone | NO | 
public | DailyStock | salesId | 4 | text | NO | 
public | DailyStock | burgerBuns | 5 | integer | NO | 0
public | DailyStock | meatWeightG | 6 | integer | NO | 0
public | DailyStock | drinksJson | 7 | jsonb | YES | 
public | DailyStock | notes | 8 | text | YES | 
public | DailyStock | purchasingJson | 9 | jsonb | YES | 
public | DailyStock | status | 10 | text | NO | 'submitted'::text
public | DailyStock | deletedAt | 11 | timestamp without time zone | YES | 
public | DailyStock | bunsCount | 12 | integer | NO | 0
public | DailyStock | meatGrams | 13 | integer | NO | 0
public | ExpenseLine | id | 1 | text | NO | 
public | ExpenseLine | expenseId | 2 | text | NO | 
public | ExpenseLine | ingredientId | 3 | text | YES | 
public | ExpenseLine | name | 4 | text | NO | 
public | ExpenseLine | qty | 5 | double precision | YES | 
public | ExpenseLine | uom | 6 | text | YES | 
public | ExpenseLine | unitPriceTHB | 7 | numeric | YES | 
public | ExpenseLine | lineTotalTHB | 8 | numeric | YES | 
public | ExpenseLine | type | 9 | USER-DEFINED | NO | 'GENERAL'::"ExpenseType"
public | ExpenseLine | createdAt | 10 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | JussiComparison | id | 1 | text | NO | 
public | JussiComparison | snapshotId | 2 | text | NO | 
public | JussiComparison | salesFormId | 3 | text | YES | 
public | JussiComparison | createdAt | 4 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | JussiComparison | openingBuns | 5 | integer | YES | 
public | JussiComparison | openingMeatGram | 6 | integer | YES | 
public | JussiComparison | openingDrinks | 7 | integer | YES | 
public | JussiComparison | purchasedBuns | 8 | integer | YES | 
public | JussiComparison | purchasedMeatGram | 9 | integer | YES | 
public | JussiComparison | purchasedDrinks | 10 | integer | YES | 
public | JussiComparison | expectedBuns | 11 | integer | YES | 
public | JussiComparison | expectedMeatGram | 12 | integer | YES | 
public | JussiComparison | expectedDrinks | 13 | integer | YES | 
public | JussiComparison | expectedCloseBuns | 14 | integer | YES | 
public | JussiComparison | expectedCloseMeatGram | 15 | integer | YES | 
public | JussiComparison | expectedCloseDrinks | 16 | integer | YES | 
public | JussiComparison | staffBuns | 17 | integer | YES | 
public | JussiComparison | staffMeatGram | 18 | integer | YES | 
public | JussiComparison | staffDrinks | 19 | integer | YES | 
public | JussiComparison | varBuns | 20 | integer | YES | 
public | JussiComparison | varMeatGram | 21 | integer | YES | 
public | JussiComparison | varDrinks | 22 | integer | YES | 
public | JussiComparison | state | 23 | USER-DEFINED | NO | 'MISSING_DATA'::"ReconcileState"
public | JussiComparison | notes | 24 | text | YES | 
public | ManagerCheckQuestion | id | 1 | integer | NO | nextval('"ManagerCheckQuestion_id_seq"'::regclass)
public | ManagerCheckQuestion | text | 2 | text | NO | 
public | ManagerCheckQuestion | text_en | 3 | text | YES | 
public | ManagerCheckQuestion | text_th | 4 | text | YES | 
public | ManagerCheckQuestion | category | 5 | text | YES | 
public | ManagerCheckQuestion | enabled | 6 | boolean | YES | true
public | ManagerCheckQuestion | weight | 7 | integer | YES | 1
public | ManagerCheckQuestion | created_at | 8 | timestamp without time zone | YES | now()
public | ManagerCheckQuestion | updated_at | 9 | timestamp without time zone | YES | now()
public | PaymentBreakdown | id | 1 | text | NO | 
public | PaymentBreakdown | snapshotId | 2 | text | NO | 
public | PaymentBreakdown | channel | 3 | USER-DEFINED | NO | 
public | PaymentBreakdown | count | 4 | integer | NO | 0
public | PaymentBreakdown | totalSatang | 5 | bigint | NO | 0
public | PaymentMethodMap | id | 1 | text | NO | 
public | PaymentMethodMap | provider | 2 | USER-DEFINED | NO | 'LOYVERSE'::"Provider"
public | PaymentMethodMap | sourceName | 3 | text | NO | 
public | PaymentMethodMap | channel | 4 | USER-DEFINED | NO | 'OTHER'::"PaymentChannel"
public | PaymentMethodMap | createdAt | 5 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | PosBatch | id | 1 | text | NO | 
public | PosBatch | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | PosBatch | title | 3 | text | YES | 
public | PosBatch | shiftStart | 4 | timestamp without time zone | YES | 
public | PosBatch | shiftEnd | 5 | timestamp without time zone | YES | 
public | PosPaymentSummary | id | 1 | text | NO | 
public | PosPaymentSummary | batchId | 2 | text | NO | 
public | PosPaymentSummary | method | 3 | text | NO | 
public | PosPaymentSummary | amount | 4 | numeric | NO | 
public | PosReceipt | id | 1 | text | NO | 
public | PosReceipt | batchId | 2 | text | NO | 
public | PosReceipt | receiptId | 3 | text | NO | 
public | PosReceipt | datetime | 4 | timestamp without time zone | NO | 
public | PosReceipt | total | 5 | numeric | NO | 
public | PosReceipt | itemsJson | 6 | jsonb | NO | 
public | PosReceipt | payment | 7 | text | YES | 
public | PosSalesItem | id | 1 | text | NO | 
public | PosSalesItem | batchId | 2 | text | NO | 
public | PosSalesItem | name | 3 | text | NO | 
public | PosSalesItem | qty | 4 | integer | NO | 
public | PosSalesItem | net | 5 | numeric | NO | 
public | PosSalesModifier | id | 1 | text | NO | 
public | PosSalesModifier | batchId | 2 | text | NO | 
public | PosSalesModifier | name | 3 | text | NO | 
public | PosSalesModifier | qty | 4 | integer | NO | 
public | PosSalesModifier | net | 5 | numeric | NO | 
public | PosShiftReport | id | 1 | text | NO | 
public | PosShiftReport | batchId | 2 | text | NO | 
public | PosShiftReport | grossSales | 3 | numeric | NO | 
public | PosShiftReport | discounts | 4 | numeric | NO | 
public | PosShiftReport | netSales | 5 | numeric | NO | 
public | PosShiftReport | cashInDrawer | 6 | numeric | NO | 
public | PosShiftReport | cashSales | 7 | numeric | NO | 
public | PosShiftReport | qrSales | 8 | numeric | NO | 
public | PosShiftReport | otherSales | 9 | numeric | NO | 
public | PosShiftReport | receiptCount | 10 | integer | NO | 
public | RecipeComponent | id | 1 | text | NO | 
public | RecipeComponent | recipeItemId | 2 | text | NO | 
public | RecipeComponent | ingredientId | 3 | text | NO | 
public | RecipeComponent | baseQty | 4 | double precision | NO | 
public | RecipeComponent | uom | 5 | text | NO | 
public | RecipeItem | id | 1 | text | NO | 
public | RecipeItem | sku | 2 | text | YES | 
public | RecipeItem | name | 3 | text | NO | 
public | RecipeItem | category | 4 | text | YES | 
public | RecipeItem | isMealDeal | 5 | boolean | NO | false
public | RecipeItem | createdAt | 6 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | ShiftSnapshot | id | 1 | text | NO | 
public | ShiftSnapshot | provider | 2 | USER-DEFINED | NO | 'LOYVERSE'::"Provider"
public | ShiftSnapshot | windowStartUTC | 3 | timestamp without time zone | NO | 
public | ShiftSnapshot | windowEndUTC | 4 | timestamp without time zone | NO | 
public | ShiftSnapshot | loyverseShiftNumber | 5 | integer | YES | 
public | ShiftSnapshot | salesFormId | 6 | text | YES | 
public | ShiftSnapshot | createdAt | 7 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | ShiftSnapshot | totalReceipts | 8 | integer | NO | 0
public | ShiftSnapshot | totalSalesSatang | 9 | bigint | NO | 0
public | ShiftSnapshot | reconcileState | 10 | USER-DEFINED | NO | 'MISSING_DATA'::"ReconcileState"
public | ShiftSnapshot | reconcileNotes | 11 | text | YES | 
public | SnapshotItem | id | 1 | text | NO | 
public | SnapshotItem | snapshotId | 2 | text | NO | 
public | SnapshotItem | itemName | 3 | text | NO | 
public | SnapshotItem | sku | 4 | text | YES | 
public | SnapshotItem | category | 5 | text | YES | 
public | SnapshotItem | qty | 6 | integer | NO | 0
public | SnapshotItem | revenueSatang | 7 | bigint | NO | 0
public | SnapshotModifier | id | 1 | text | NO | 
public | SnapshotModifier | snapshotId | 2 | text | NO | 
public | SnapshotModifier | modifierName | 3 | text | NO | 
public | SnapshotModifier | lines | 4 | integer | NO | 0
public | SnapshotModifier | revenueSatang | 5 | bigint | NO | 0
public | VendorRule | id | 1 | text | NO | 
public | VendorRule | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | VendorRule | matchText | 3 | text | NO | 
public | VendorRule | category | 4 | text | NO | 
public | VendorRule | supplier | 5 | text | NO | 
public | _prisma_migrations | id | 1 | character varying | NO | 
public | _prisma_migrations | checksum | 2 | character varying | NO | 
public | _prisma_migrations | finished_at | 3 | timestamp with time zone | YES | 
public | _prisma_migrations | migration_name | 4 | character varying | NO | 
public | _prisma_migrations | logs | 5 | text | YES | 
public | _prisma_migrations | rolled_back_at | 6 | timestamp with time zone | YES | 
public | _prisma_migrations | started_at | 7 | timestamp with time zone | NO | now()
public | _prisma_migrations | applied_steps_count | 8 | integer | NO | 0
public | analytics_daily | id | 1 | text | NO | 
public | analytics_daily | restaurantId | 2 | text | NO | 
public | analytics_daily | shiftDate | 3 | timestamp without time zone | NO | 
public | analytics_daily | top5ByQty | 4 | jsonb | YES | 
public | analytics_daily | top5ByRevenue | 5 | jsonb | YES | 
public | analytics_daily | expectedBunsUsed | 6 | integer | YES | 
public | analytics_daily | expectedMeatGrams | 7 | integer | YES | 
public | analytics_daily | expectedDrinksUsed | 8 | integer | YES | 
public | analytics_daily | variance | 9 | jsonb | YES | 
public | analytics_daily | shoppingList | 10 | jsonb | YES | 
public | analytics_daily | flags | 11 | jsonb | YES | 
public | analytics_daily | createdAt | 12 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | checklist_assignments | id | 1 | text | NO | gen_random_uuid()
public | checklist_assignments | shift_id | 2 | text | NO | 
public | checklist_assignments | manager_name | 3 | text | NO | 
public | checklist_assignments | assigned_task_ids | 4 | jsonb | NO | 
public | checklist_assignments | created_at | 5 | timestamp without time zone | YES | now()
public | checklist_assignments | expires_at | 6 | timestamp without time zone | NO | 
public | cleaning_tasks | id | 1 | integer | NO | nextval('cleaning_tasks_id_seq'::regclass)
public | cleaning_tasks | taskName | 2 | text | NO | 
public | cleaning_tasks | taskDetail | 3 | text | YES | 
public | cleaning_tasks | zone | 4 | text | NO | 
public | cleaning_tasks | shiftPhase | 5 | text | NO | 
public | cleaning_tasks | active | 6 | boolean | YES | true
public | cleaning_tasks | createdAt | 7 | timestamp without time zone | YES | now()
public | dailyReceiptSummaries | id | 1 | integer | NO | nextval('"dailyReceiptSummaries_id_seq"'::regclass)
public | dailyReceiptSummaries | shift_date | 2 | date | NO | 
public | dailyReceiptSummaries | data | 3 | jsonb | NO | 
public | dailyReceiptSummaries | created_at | 4 | timestamp without time zone | YES | now()
public | dailyShiftAnalysis | id | 1 | integer | NO | nextval('"dailyShiftAnalysis_id_seq"'::regclass)
public | dailyShiftAnalysis | shift_date | 2 | date | NO | 
public | dailyShiftAnalysis | analysis | 3 | jsonb | NO | 
public | dailyShiftAnalysis | created_at | 4 | timestamp without time zone | YES | now()
public | daily_sales_v2 | id | 1 | text | NO | 
public | daily_sales_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | daily_sales_v2 | shiftDate | 3 | text | NO | 
public | daily_sales_v2 | submittedAtISO | 4 | timestamp without time zone | NO | 
public | daily_sales_v2 | completedBy | 5 | text | NO | 
public | daily_sales_v2 | startingCash | 6 | integer | NO | 0
public | daily_sales_v2 | endingCash | 7 | integer | NO | 0
public | daily_sales_v2 | cashBanked | 8 | integer | NO | 0
public | daily_sales_v2 | cashSales | 9 | integer | NO | 0
public | daily_sales_v2 | qrSales | 10 | integer | NO | 0
public | daily_sales_v2 | grabSales | 11 | integer | NO | 0
public | daily_sales_v2 | aroiSales | 12 | integer | NO | 0
public | daily_sales_v2 | totalSales | 13 | integer | NO | 0
public | daily_sales_v2 | shoppingTotal | 14 | integer | NO | 0
public | daily_sales_v2 | wagesTotal | 15 | integer | NO | 0
public | daily_sales_v2 | othersTotal | 16 | integer | NO | 0
public | daily_sales_v2 | totalExpenses | 17 | integer | NO | 0
public | daily_sales_v2 | qrTransfer | 18 | integer | NO | 0
public | daily_sales_v2 | deletedAt | 19 | timestamp without time zone | YES | 
public | daily_sales_v2 | staff | 20 | text | YES | 
public | daily_sales_v2 | shift_date | 21 | date | YES | 
public | daily_sales_v2 | payload | 22 | jsonb | YES | 
public | daily_stock_sales | id | 1 | integer | NO | nextval('daily_stock_sales_id_seq'::regclass)
public | daily_stock_sales | completed_by | 2 | text | NO | 
public | daily_stock_sales | shift_type | 3 | text | NO | 
public | daily_stock_sales | shift_date | 4 | timestamp without time zone | NO | 
public | daily_stock_sales | starting_cash | 5 | numeric | YES | 
public | daily_stock_sales | ending_cash | 6 | numeric | YES | 
public | daily_stock_sales | grab_sales | 7 | numeric | YES | 
public | daily_stock_sales | food_panda_sales | 8 | numeric | YES | 
public | daily_stock_sales | aroi_dee_sales | 9 | numeric | YES | 
public | daily_stock_sales | qr_scan_sales | 10 | numeric | YES | 
public | daily_stock_sales | cash_sales | 11 | numeric | YES | 
public | daily_stock_sales | total_sales | 12 | numeric | YES | 
public | daily_stock_sales | salary_wages | 13 | numeric | YES | 
public | daily_stock_sales | gas_expense | 14 | numeric | YES | 
public | daily_stock_sales | total_expenses | 15 | numeric | YES | 
public | daily_stock_sales | expense_description | 16 | text | YES | 
public | daily_stock_sales | burger_buns_stock | 17 | integer | YES | 
public | daily_stock_sales | rolls_ordered_count | 18 | integer | YES | 
public | daily_stock_sales | meat_weight | 19 | numeric | YES | 
public | daily_stock_sales | drink_stock_count | 20 | integer | YES | 
public | daily_stock_sales | food_items | 21 | jsonb | YES | 
public | daily_stock_sales | drink_stock | 22 | jsonb | YES | 
public | daily_stock_sales | kitchen_items | 23 | jsonb | YES | 
public | daily_stock_sales | packaging_items | 24 | jsonb | YES | 
public | daily_stock_sales | fresh_food | 25 | jsonb | YES | 
public | daily_stock_sales | frozen_food | 26 | jsonb | YES | 
public | daily_stock_sales | shelf_items | 27 | jsonb | YES | 
public | daily_stock_sales | wage_entries | 28 | jsonb | YES | 
public | daily_stock_sales | shopping_entries | 29 | jsonb | YES | 
public | daily_stock_sales | rolls_ordered_confirmed | 30 | boolean | YES | 
public | daily_stock_sales | wages | 31 | jsonb | YES | 
public | daily_stock_sales | banked_amount | 32 | numeric | YES | 
public | daily_stock_sales | purchased_amounts | 33 | jsonb | YES | 
public | daily_stock_sales | number_needed | 34 | jsonb | YES | 
public | daily_stock_sales | shopping | 35 | jsonb | YES | 
public | daily_stock_sales | pdf_path | 36 | text | YES | 
public | daily_stock_sales | is_draft | 37 | boolean | YES | false
public | daily_stock_sales | deleted_at | 38 | timestamp without time zone | YES | 
public | daily_stock_sales | created_at | 39 | timestamp without time zone | YES | now()
public | daily_stock_sales | updated_at | 40 | timestamp without time zone | YES | now()
public | daily_stock_sales | status | 41 | text | YES | 
public | daily_stock_sales | notes | 42 | text | YES | 
public | daily_stock_sales | discrepancy_notes | 43 | text | YES | 
public | daily_stock_v2 | id | 1 | text | NO | 
public | daily_stock_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | daily_stock_v2 | salesId | 3 | text | NO | 
public | daily_stock_v2 | burgerBuns | 4 | integer | NO | 0
public | daily_stock_v2 | meatWeightG | 5 | integer | NO | 0
public | daily_stock_v2 | drinksJson | 6 | jsonb | YES | 
public | daily_stock_v2 | purchasingJson | 7 | jsonb | YES | 
public | daily_stock_v2 | notes | 8 | text | YES | 
public | daily_stock_v2 | deletedAt | 9 | timestamp without time zone | YES | 
public | expenses | id | 1 | text | NO | 
public | expenses | restaurantId | 2 | text | NO | 
public | expenses | shiftDate | 3 | timestamp without time zone | NO | 
public | expenses | item | 4 | text | NO | 
public | expenses | costCents | 5 | integer | NO | 
public | expenses | supplier | 6 | text | YES | 
public | expenses | expenseType | 7 | text | YES | 
public | expenses | meta | 8 | jsonb | YES | 
public | expenses | createdAt | 9 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | expenses | source | 10 | text | YES | 
public | expenses | wages | 11 | numeric | YES | 0
public | imported_expenses | id | 1 | text | NO | gen_random_uuid()
public | imported_expenses | restaurant_id | 2 | text | NO | 
public | imported_expenses | import_batch_id | 3 | text | NO | 
public | imported_expenses | date | 4 | date | YES | 
public | imported_expenses | description | 5 | text | YES | 
public | imported_expenses | amount_cents | 6 | integer | YES | 
public | imported_expenses | raw_data | 7 | jsonb | YES | 
public | imported_expenses | status | 8 | USER-DEFINED | NO | 'PENDING'::imported_expense_status
public | imported_expenses | approved_by | 9 | text | YES | 
public | imported_expenses | approved_at | 10 | timestamp without time zone | YES | 
public | imported_expenses | created_at | 11 | timestamp without time zone | YES | now()
public | imported_expenses | supplier | 12 | text | YES | 
public | imported_expenses | category | 13 | text | YES | 
public | imported_expenses | source | 14 | text | YES | 'MANUAL_ENTRY'::text
public | ingestion_errors | id | 1 | text | NO | 
public | ingestion_errors | restaurantId | 2 | text | YES | 
public | ingestion_errors | provider | 3 | USER-DEFINED | YES | 
public | ingestion_errors | externalId | 4 | text | YES | 
public | ingestion_errors | context | 5 | text | YES | 
public | ingestion_errors | errorMessage | 6 | text | NO | 
public | ingestion_errors | rawPayload | 7 | jsonb | YES | 
public | ingestion_errors | createdAt | 8 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | ingredient_v2 | id | 1 | text | NO | 
public | ingredient_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | ingredient_v2 | name | 3 | text | NO | 
public | ingredient_v2 | unit | 4 | text | NO | 
public | ingredient_v2 | unitCost | 5 | numeric | NO | 0
public | ingredient_v2 | supplier | 6 | text | YES | 
public | ingredient_v2 | notes | 7 | text | YES | 
public | ingredient_v2 | category | 8 | text | YES | 
public | ingredient_v2 | brand | 9 | text | YES | 
public | ingredient_v2 | packagesize | 10 | text | YES | 
public | ingredient_v2 | portionsize | 11 | text | YES | 
public | ingredient_v2 | lastreview | 12 | text | YES | 
public | ingredients | id | 1 | integer | NO | nextval('ingredients_id_seq'::regclass)
public | ingredients | name | 2 | text | NO | 
public | ingredients | category | 3 | text | NO | 
public | ingredients | supplier | 4 | text | NO | 
public | ingredients | unit_price | 5 | numeric | NO | 
public | ingredients | price | 6 | numeric | YES | 
public | ingredients | package_size | 7 | numeric | YES | 
public | ingredients | portion_size | 8 | numeric | YES | 
public | ingredients | cost_per_portion | 9 | numeric | YES | 
public | ingredients | unit | 10 | text | NO | 
public | ingredients | notes | 11 | text | YES | 
public | ingredients | brand | 12 | text | YES | 
public | ingredients | packaging_qty | 13 | text | YES | 
public | ingredients | last_review_date | 14 | text | YES | 
public | ingredients | source | 15 | text | YES | 'manual'::text
public | ingredients | last_updated | 16 | timestamp without time zone | YES | now()
public | ingredients | updated_at | 17 | timestamp without time zone | YES | now()
public | ingredients | created_at | 18 | timestamp without time zone | YES | now()
public | ingredients | supplier_id | 19 | integer | YES | 
public | ingredients | package_qty | 20 | numeric | YES | 
public | ingredients | package_unit | 21 | character varying | YES | 
public | ingredients | package_cost | 22 | numeric | YES | 
public | ingredients | portion_qty | 23 | numeric | YES | 
public | ingredients | portion_unit | 24 | character varying | YES | 
public | jobs | id | 1 | text | NO | 
public | jobs | restaurantId | 2 | text | YES | 
public | jobs | type | 3 | USER-DEFINED | NO | 
public | jobs | payload | 4 | jsonb | YES | 
public | jobs | status | 5 | USER-DEFINED | NO | 'QUEUED'::"JobStatus"
public | jobs | runAt | 6 | timestamp without time zone | YES | 
public | jobs | attempts | 7 | integer | NO | 0
public | jobs | lastError | 8 | text | YES | 
public | jobs | createdAt | 9 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | jobs | updatedAt | 10 | timestamp without time zone | NO | 
public | loyverse_receipts | shift_date | 1 | date | NO | 
public | loyverse_receipts | data | 2 | jsonb | YES | 
public | loyverse_shifts | shift_date | 1 | date | NO | 
public | loyverse_shifts | data | 2 | jsonb | YES | 
public | manager_checklists | id | 1 | integer | NO | nextval('manager_checklists_id_seq'::regclass)
public | manager_checklists | shiftId | 2 | text | NO | 
public | manager_checklists | managerName | 3 | text | NO | 
public | manager_checklists | tasksAssigned | 4 | jsonb | NO | 
public | manager_checklists | tasksCompleted | 5 | jsonb | NO | 
public | manager_checklists | createdAt | 6 | timestamp without time zone | YES | now()
public | manager_checklists | signedAt | 7 | timestamp without time zone | YES | now()
public | menu_item_v2 | id | 1 | text | NO | 
public | menu_item_v2 | menuId | 2 | text | NO | 
public | menu_item_v2 | externalId | 3 | text | YES | 
public | menu_item_v2 | name | 4 | text | NO | 
public | menu_item_v2 | category | 5 | text | YES | 
public | menu_item_v2 | basePrice | 6 | numeric | NO | 0
public | menu_item_v2 | description | 7 | text | YES | 
public | menu_item_v2 | active | 8 | boolean | NO | true
public | menu_items | id | 1 | text | NO | 
public | menu_items | restaurantId | 2 | text | NO | 
public | menu_items | sku | 3 | text | NO | 
public | menu_items | name | 4 | text | NO | 
public | menu_items | category | 5 | text | NO | 
public | menu_items | portionGrams | 6 | integer | YES | 
public | menu_items | isDrink | 7 | boolean | NO | false
public | menu_items | isBurger | 8 | boolean | NO | false
public | menu_items | active | 9 | boolean | NO | true
public | menu_items | meta | 10 | jsonb | YES | 
public | menu_items | createdAt | 11 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | menu_items | updatedAt | 12 | timestamp without time zone | NO | 
public | menu_modifier_v2 | id | 1 | text | NO | 
public | menu_modifier_v2 | itemId | 2 | text | NO | 
public | menu_modifier_v2 | groupName | 3 | text | YES | 
public | menu_modifier_v2 | name | 4 | text | NO | 
public | menu_modifier_v2 | price | 5 | numeric | NO | 0
public | menu_v2 | id | 1 | text | NO | 
public | menu_v2 | name | 2 | text | NO | 
public | menu_v2 | source | 3 | USER-DEFINED | NO | 
public | menu_v2 | fileType | 4 | text | NO | 
public | menu_v2 | version | 5 | text | YES | 
public | menu_v2 | importedAt | 6 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | menu_v2 | notes | 7 | text | YES | 
public | other_expense_v2 | id | 1 | text | NO | 
public | other_expense_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | other_expense_v2 | label | 3 | text | NO | 
public | other_expense_v2 | amount | 4 | integer | NO | 0
public | other_expense_v2 | salesId | 5 | text | NO | 
public | other_expenses | id | 1 | text | NO | 
public | other_expenses | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | other_expenses | label | 3 | text | NO | 
public | other_expenses | amount | 4 | integer | NO | 0
public | other_expenses | salesId | 5 | text | NO | 
public | partner_statements | id | 1 | text | NO | gen_random_uuid()
public | partner_statements | restaurant_id | 2 | text | NO | 
public | partner_statements | partner | 3 | text | YES | 
public | partner_statements | import_batch_id | 4 | text | NO | 
public | partner_statements | statement_date | 5 | date | YES | 
public | partner_statements | gross_sales_cents | 6 | integer | YES | 
public | partner_statements | commission_cents | 7 | integer | YES | 
public | partner_statements | net_payout_cents | 8 | integer | YES | 
public | partner_statements | raw_data | 9 | jsonb | YES | 
public | partner_statements | status | 10 | USER-DEFINED | NO | 'PENDING'::imported_expense_status
public | partner_statements | created_at | 11 | timestamp without time zone | YES | now()
public | partner_statements | approved_by | 12 | text | YES | 
public | partner_statements | approved_at | 13 | timestamp without time zone | YES | 
public | pos_connections | id | 1 | text | NO | 
public | pos_connections | restaurantId | 2 | text | NO | 
public | pos_connections | provider | 3 | USER-DEFINED | NO | 
public | pos_connections | apiKey | 4 | text | YES | 
public | pos_connections | refreshToken | 5 | text | YES | 
public | pos_connections | meta | 6 | jsonb | YES | 
public | pos_connections | isActive | 7 | boolean | NO | true
public | pos_connections | lastSyncAt | 8 | timestamp without time zone | YES | 
public | pos_connections | createdAt | 9 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | pos_connections | updatedAt | 10 | timestamp without time zone | NO | 
public | pos_sync_logs | id | 1 | text | NO | 
public | pos_sync_logs | restaurantId | 2 | text | NO | 
public | pos_sync_logs | provider | 3 | USER-DEFINED | NO | 
public | pos_sync_logs | startedAt | 4 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | pos_sync_logs | finishedAt | 5 | timestamp without time zone | YES | 
public | pos_sync_logs | mode | 6 | text | NO | 
public | pos_sync_logs | receiptsFetched | 7 | integer | NO | 0
public | pos_sync_logs | itemsUpserted | 8 | integer | NO | 0
public | pos_sync_logs | paymentsUpserted | 9 | integer | NO | 0
public | pos_sync_logs | status | 10 | text | NO | 'SUCCESS'::text
public | pos_sync_logs | message | 11 | text | YES | 
public | pos_sync_logs | createdAt | 12 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | purchase_tally | id | 1 | character varying | NO | gen_random_uuid()
public | purchase_tally | created_at | 2 | timestamp without time zone | NO | now()
public | purchase_tally | date | 3 | date | NO | 
public | purchase_tally | staff | 4 | text | YES | 
public | purchase_tally | supplier | 5 | text | YES | 
public | purchase_tally | amount_thb | 6 | numeric | YES | 
public | purchase_tally | notes | 7 | text | YES | 
public | purchase_tally | rolls_pcs | 8 | integer | YES | 
public | purchase_tally | meat_grams | 9 | integer | YES | 
public | purchase_tally_drink | id | 1 | character varying | NO | gen_random_uuid()
public | purchase_tally_drink | tally_id | 2 | character varying | NO | 
public | purchase_tally_drink | item_name | 3 | text | NO | 
public | purchase_tally_drink | qty | 4 | integer | NO | 
public | purchase_tally_drink | unit | 5 | text | NO | 'pcs'::text
public | receipt_items | id | 1 | text | NO | 
public | receipt_items | receiptId | 2 | text | NO | 
public | receipt_items | providerItemId | 3 | text | YES | 
public | receipt_items | sku | 4 | text | YES | 
public | receipt_items | name | 5 | text | NO | 
public | receipt_items | category | 6 | text | YES | 
public | receipt_items | qty | 7 | integer | NO | 
public | receipt_items | unitPrice | 8 | integer | NO | 
public | receipt_items | total | 9 | integer | NO | 
public | receipt_items | modifiers | 10 | jsonb | YES | 
public | receipt_payments | id | 1 | text | NO | 
public | receipt_payments | receiptId | 2 | text | NO | 
public | receipt_payments | method | 3 | USER-DEFINED | NO | 'OTHER'::"PaymentMethod"
public | receipt_payments | amount | 4 | integer | NO | 
public | receipt_payments | meta | 5 | jsonb | YES | 
public | receipts | id | 1 | text | NO | 
public | receipts | restaurantId | 2 | text | NO | 
public | receipts | provider | 3 | USER-DEFINED | NO | 
public | receipts | externalId | 4 | text | NO | 
public | receipts | receiptNumber | 5 | text | YES | 
public | receipts | channel | 6 | USER-DEFINED | NO | 'OTHER'::"SalesChannel"
public | receipts | createdAtUTC | 7 | timestamp without time zone | NO | 
public | receipts | closedAtUTC | 8 | timestamp without time zone | YES | 
public | receipts | subtotal | 9 | integer | NO | 
public | receipts | tax | 10 | integer | NO | 
public | receipts | discount | 11 | integer | NO | 
public | receipts | total | 12 | integer | NO | 
public | receipts | notes | 13 | text | YES | 
public | receipts | rawPayload | 14 | jsonb | YES | 
public | receipts | createdAt | 15 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | recipe_item_v2 | id | 1 | text | NO | 
public | recipe_item_v2 | recipeId | 2 | text | NO | 
public | recipe_item_v2 | ingredientId | 3 | text | NO | 
public | recipe_item_v2 | qty | 4 | numeric | NO | 0
public | recipe_lines | id | 1 | bigint | NO | nextval('recipe_lines_id_seq'::regclass)
public | recipe_lines | recipe_id | 2 | bigint | YES | 
public | recipe_lines | ingredient_id | 3 | text | YES | 
public | recipe_lines | ingredient_name | 4 | text | NO | 
public | recipe_lines | qty | 5 | numeric | NO | 0
public | recipe_lines | unit | 6 | text | NO | 
public | recipe_lines | unit_cost_thb | 7 | numeric | NO | 0
public | recipe_lines | cost_thb | 8 | numeric | NO | 0
public | recipe_lines | supplier | 9 | text | YES | 
public | recipe_v2 | id | 1 | text | NO | 
public | recipe_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | recipe_v2 | name | 3 | text | NO | 
public | recipe_v2 | yield | 4 | numeric | NO | 1
public | recipe_v2 | targetMargin | 5 | numeric | NO | 0
public | recipes | id | 1 | bigint | NO | nextval('recipes_id_seq'::regclass)
public | recipes | name | 2 | text | NO | 
public | recipes | note | 3 | text | YES | 
public | recipes | waste_pct | 4 | numeric | YES | 0
public | recipes | portions | 5 | integer | YES | 1
public | recipes | menu_price_thb | 6 | numeric | YES | 0
public | recipes | totals_json | 7 | jsonb | YES | 
public | recipes | description | 8 | text | YES | 
public | recipes | created_at | 9 | timestamp with time zone | YES | now()
public | recipes | category | 10 | text | YES | 'Burgers'::text
public | recipes | yield_quantity | 11 | numeric | YES | 1
public | recipes | yield_unit | 12 | text | YES | 'servings'::text
public | recipes | ingredients | 13 | jsonb | YES | '[]'::jsonb
public | recipes | total_cost | 14 | numeric | YES | 0
public | recipes | cost_per_serving | 15 | numeric | YES | 0
public | recipes | cogs_percent | 16 | numeric | YES | 0
public | recipes | suggested_price | 17 | numeric | YES | 0
public | recipes | waste_factor | 18 | numeric | YES | 0.05
public | recipes | yield_efficiency | 19 | numeric | YES | 0.90
public | recipes | image_url | 20 | text | YES | 
public | recipes | instructions | 21 | text | YES | 
public | recipes | notes | 22 | text | YES | 
public | recipes | is_active | 23 | boolean | YES | true
public | recipes | updated_at | 24 | timestamp with time zone | YES | CURRENT_TIMESTAMP
public | recipes | version | 25 | integer | YES | 1
public | recipes | parent_id | 26 | integer | YES | 
public | restaurants | id | 1 | text | NO | 
public | restaurants | name | 2 | text | NO | 
public | restaurants | slug | 3 | text | NO | 
public | restaurants | email | 4 | text | YES | 
public | restaurants | timezone | 5 | text | NO | 'Asia/Bangkok'::text
public | restaurants | locale | 6 | text | NO | 'en-TH'::text
public | restaurants | logoUrl | 7 | text | YES | 
public | restaurants | brandColor | 8 | text | YES | 
public | restaurants | createdAt | 9 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | restaurants | updatedAt | 10 | timestamp without time zone | NO | 
public | shopping_list | id | 1 | text | NO | gen_random_uuid()
public | shopping_list | created_at | 2 | timestamp without time zone | YES | now()
public | shopping_list | sales_form_id | 3 | text | YES | 
public | shopping_list | stock_form_id | 4 | text | YES | 
public | shopping_list | rolls_count | 5 | integer | YES | 0
public | shopping_list | meat_weight_grams | 6 | integer | YES | 0
public | shopping_list | drinks_counts | 7 | jsonb | YES | '[]'::jsonb
public | shopping_list | items | 8 | jsonb | YES | '[]'::jsonb
public | shopping_list | total_items | 9 | integer | YES | 0
public | shopping_list | item_name | 10 | character varying | YES | 
public | shopping_list | quantity | 11 | integer | YES | 
public | shopping_list | unit | 12 | character varying | YES | 'unit'::character varying
public | shopping_list | form_id | 13 | integer | YES | 
public | shopping_list | list_date | 14 | timestamp without time zone | YES | 
public | shopping_list | estimated_cost | 15 | numeric | YES | 0
public | shopping_list | supplier | 16 | character varying | YES | ''::character varying
public | shopping_list | price_per_unit | 17 | numeric | YES | 0
public | shopping_list | notes | 18 | character varying | YES | ''::character varying
public | shopping_list | priority | 19 | text | YES | 'medium'::text
public | shopping_list | selected | 20 | boolean | YES | false
public | shopping_list | ai_generated | 21 | boolean | YES | false
public | shopping_list | list_name | 22 | text | YES | 
public | shopping_list | is_completed | 23 | boolean | YES | false
public | shopping_list | completed_at | 24 | timestamp without time zone | YES | 
public | shopping_list | actual_cost | 25 | numeric | YES | 0
public | shopping_list | updated_at | 26 | timestamp without time zone | YES | now()
public | shopping_list_items | id | 1 | integer | NO | nextval('shopping_list_items_id_seq'::regclass)
public | shopping_list_items | shopping_list_id | 2 | text | YES | 
public | shopping_list_items | ingredient_name | 3 | character varying | NO | 
public | shopping_list_items | requested_qty | 4 | numeric | YES | 
public | shopping_list_items | requested_unit | 5 | character varying | YES | 
public | shopping_list_items | notes | 6 | text | YES | 
public | shopping_list_items | created_at | 7 | timestamp without time zone | YES | now()
public | shopping_purchase_v2 | id | 1 | text | NO | 
public | shopping_purchase_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | shopping_purchase_v2 | item | 3 | text | NO | 
public | shopping_purchase_v2 | cost | 4 | integer | NO | 0
public | shopping_purchase_v2 | shop | 5 | text | NO | 
public | shopping_purchase_v2 | salesId | 6 | text | NO | 
public | shopping_purchases | id | 1 | text | NO | 
public | shopping_purchases | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | shopping_purchases | item | 3 | text | NO | 
public | shopping_purchases | cost | 4 | integer | NO | 0
public | shopping_purchases | shop | 5 | text | NO | 
public | shopping_purchases | salesId | 6 | text | NO | 
public | stock_items | id | 1 | integer | NO | nextval('stock_items_id_seq'::regclass)
public | stock_items | name | 2 | text | NO | 
public | stock_items | category | 3 | text | NO | 
public | stock_items | isDrink | 4 | boolean | NO | false
public | stock_items | isExcluded | 5 | boolean | NO | false
public | stock_items | displayOrder | 6 | integer | NO | 0
public | stock_items | createdAt | 7 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | stock_items | updatedAt | 8 | timestamp without time zone | NO | 
public | stock_requests | id | 1 | integer | NO | nextval('stock_requests_id_seq'::regclass)
public | stock_requests | shiftId | 2 | text | NO | 
public | stock_requests | stockItemId | 3 | integer | NO | 
public | stock_requests | requestedQty | 4 | integer | YES | 
public | stock_requests | createdAt | 5 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | stock_requests | updatedAt | 6 | timestamp without time zone | NO | 
public | supplier_defaults | id | 1 | text | NO | gen_random_uuid()
public | supplier_defaults | restaurant_id | 2 | text | NO | 
public | supplier_defaults | supplier | 3 | text | NO | 
public | supplier_defaults | default_category | 4 | text | NO | 
public | supplier_defaults | notes_template | 5 | text | YES | 
public | supplier_defaults | updated_at | 6 | timestamp without time zone | YES | now()
public | suppliers | id | 1 | integer | NO | nextval('suppliers_id_seq'::regclass)
public | suppliers | name | 2 | character varying | NO | 
public | suppliers | contact_info | 3 | text | YES | 
public | suppliers | created_at | 4 | timestamp without time zone | YES | now()
public | wage_entries | id | 1 | text | NO | 
public | wage_entries | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | wage_entries | staff | 3 | text | NO | 
public | wage_entries | amount | 4 | integer | NO | 0
public | wage_entries | type | 5 | text | NO | 
public | wage_entries | salesId | 6 | text | NO | 
public | wage_entry_v2 | id | 1 | text | NO | 
public | wage_entry_v2 | createdAt | 2 | timestamp without time zone | NO | CURRENT_TIMESTAMP
public | wage_entry_v2 | staff | 3 | text | NO | 
public | wage_entry_v2 | amount | 4 | integer | NO | 0
public | wage_entry_v2 | type | 5 | text | NO | 
public | wage_entry_v2 | salesId | 6 | text | NO | 

## Primary Keys
| pg_catalog | pg_aggregate | aggfnoid |
|---|pg_catalog | pg_am | oid
pg_catalog | pg_amop | oid
pg_catalog | pg_amproc | oid
pg_catalog | pg_attrdef | oid
pg_catalog | pg_attribute | attnum
pg_catalog | pg_attribute | attrelid
pg_catalog | pg_auth_members | oid
pg_catalog | pg_authid | oid
pg_catalog | pg_cast | oid
pg_catalog | pg_class | oid
pg_catalog | pg_collation | oid
pg_catalog | pg_constraint | oid
pg_catalog | pg_conversion | oid
pg_catalog | pg_database | oid
pg_catalog | pg_db_role_setting | setdatabase
pg_catalog | pg_db_role_setting | setrole
pg_catalog | pg_default_acl | oid
pg_catalog | pg_description | classoid
pg_catalog | pg_description | objoid
pg_catalog | pg_description | objsubid
pg_catalog | pg_enum | oid
pg_catalog | pg_event_trigger | oid
pg_catalog | pg_extension | oid
pg_catalog | pg_foreign_data_wrapper | oid
pg_catalog | pg_foreign_server | oid
pg_catalog | pg_foreign_table | ftrelid
pg_catalog | pg_index | indexrelid
pg_catalog | pg_inherits | inhrelid
pg_catalog | pg_inherits | inhseqno
pg_catalog | pg_init_privs | classoid
pg_catalog | pg_init_privs | objoid
pg_catalog | pg_init_privs | objsubid
pg_catalog | pg_language | oid
pg_catalog | pg_largeobject | loid
pg_catalog | pg_largeobject | pageno
pg_catalog | pg_largeobject_metadata | oid
pg_catalog | pg_namespace | oid
pg_catalog | pg_opclass | oid
pg_catalog | pg_operator | oid
pg_catalog | pg_opfamily | oid
pg_catalog | pg_parameter_acl | oid
pg_catalog | pg_partitioned_table | partrelid
pg_catalog | pg_policy | oid
pg_catalog | pg_proc | oid
pg_catalog | pg_publication | oid
pg_catalog | pg_publication_namespace | oid
pg_catalog | pg_publication_rel | oid
pg_catalog | pg_range | rngtypid
pg_catalog | pg_replication_origin | roident
pg_catalog | pg_rewrite | oid
pg_catalog | pg_seclabel | classoid
pg_catalog | pg_seclabel | objoid
pg_catalog | pg_seclabel | objsubid
pg_catalog | pg_seclabel | provider
pg_catalog | pg_sequence | seqrelid
pg_catalog | pg_shdescription | classoid
pg_catalog | pg_shdescription | objoid
pg_catalog | pg_shseclabel | classoid
pg_catalog | pg_shseclabel | objoid
pg_catalog | pg_shseclabel | provider
pg_catalog | pg_statistic | staattnum
pg_catalog | pg_statistic | stainherit
pg_catalog | pg_statistic | starelid
pg_catalog | pg_statistic_ext | oid
pg_catalog | pg_statistic_ext_data | stxdinherit
pg_catalog | pg_statistic_ext_data | stxoid
pg_catalog | pg_subscription | oid
pg_catalog | pg_subscription_rel | srrelid
pg_catalog | pg_subscription_rel | srsubid
pg_catalog | pg_tablespace | oid
pg_catalog | pg_transform | oid
pg_catalog | pg_trigger | oid
pg_catalog | pg_ts_config | oid
pg_catalog | pg_ts_config_map | mapcfg
pg_catalog | pg_ts_config_map | mapseqno
pg_catalog | pg_ts_config_map | maptokentype
pg_catalog | pg_ts_dict | oid
pg_catalog | pg_ts_parser | oid
pg_catalog | pg_ts_template | oid
pg_catalog | pg_type | oid
pg_catalog | pg_user_mapping | oid
pg_toast | pg_toast_1040387 | chunk_id
pg_toast | pg_toast_1040387 | chunk_seq
pg_toast | pg_toast_1040505 | chunk_id
pg_toast | pg_toast_1040505 | chunk_seq
pg_toast | pg_toast_1040528 | chunk_id
pg_toast | pg_toast_1040528 | chunk_seq
pg_toast | pg_toast_1040537 | chunk_id
pg_toast | pg_toast_1040537 | chunk_seq
pg_toast | pg_toast_1040546 | chunk_id
pg_toast | pg_toast_1040546 | chunk_seq
pg_toast | pg_toast_1040555 | chunk_id
pg_toast | pg_toast_1040555 | chunk_seq
pg_toast | pg_toast_1040568 | chunk_id
pg_toast | pg_toast_1040568 | chunk_seq
pg_toast | pg_toast_1040578 | chunk_id
pg_toast | pg_toast_1040578 | chunk_seq
pg_toast | pg_toast_1040587 | chunk_id
pg_toast | pg_toast_1040587 | chunk_seq
pg_toast | pg_toast_1040596 | chunk_id
pg_toast | pg_toast_1040596 | chunk_seq
pg_toast | pg_toast_1040603 | chunk_id
pg_toast | pg_toast_1040603 | chunk_seq
pg_toast | pg_toast_1040611 | chunk_id
pg_toast | pg_toast_1040611 | chunk_seq
pg_toast | pg_toast_1040622 | chunk_id
pg_toast | pg_toast_1040622 | chunk_seq
pg_toast | pg_toast_1040630 | chunk_id
pg_toast | pg_toast_1040630 | chunk_seq
pg_toast | pg_toast_1040639 | chunk_id
pg_toast | pg_toast_1040639 | chunk_seq
pg_toast | pg_toast_1040647 | chunk_id
pg_toast | pg_toast_1040647 | chunk_seq
pg_toast | pg_toast_1040657 | chunk_id
pg_toast | pg_toast_1040657 | chunk_seq
pg_toast | pg_toast_1040670 | chunk_id
pg_toast | pg_toast_1040670 | chunk_seq
pg_toast | pg_toast_1040678 | chunk_id
pg_toast | pg_toast_1040678 | chunk_seq
pg_toast | pg_toast_1040690 | chunk_id
pg_toast | pg_toast_1040690 | chunk_seq
pg_toast | pg_toast_1040699 | chunk_id
pg_toast | pg_toast_1040699 | chunk_seq
pg_toast | pg_toast_1040708 | chunk_id
pg_toast | pg_toast_1040708 | chunk_seq
pg_toast | pg_toast_1040717 | chunk_id
pg_toast | pg_toast_1040717 | chunk_seq
pg_toast | pg_toast_1040727 | chunk_id
pg_toast | pg_toast_1040727 | chunk_seq
pg_toast | pg_toast_1040736 | chunk_id
pg_toast | pg_toast_1040736 | chunk_seq
pg_toast | pg_toast_1040743 | chunk_id
pg_toast | pg_toast_1040743 | chunk_seq
pg_toast | pg_toast_1040752 | chunk_id
pg_toast | pg_toast_1040752 | chunk_seq
pg_toast | pg_toast_1040773 | chunk_id
pg_toast | pg_toast_1040773 | chunk_seq
pg_toast | pg_toast_1040782 | chunk_id
pg_toast | pg_toast_1040782 | chunk_seq
pg_toast | pg_toast_1040791 | chunk_id
pg_toast | pg_toast_1040791 | chunk_seq
pg_toast | pg_toast_1040800 | chunk_id
pg_toast | pg_toast_1040800 | chunk_seq
pg_toast | pg_toast_1040810 | chunk_id
pg_toast | pg_toast_1040810 | chunk_seq
pg_toast | pg_toast_1040819 | chunk_id
pg_toast | pg_toast_1040819 | chunk_seq
pg_toast | pg_toast_1040829 | chunk_id
pg_toast | pg_toast_1040829 | chunk_seq
pg_toast | pg_toast_1040837 | chunk_id
pg_toast | pg_toast_1040837 | chunk_seq
pg_toast | pg_toast_1040845 | chunk_id
pg_toast | pg_toast_1040845 | chunk_seq
pg_toast | pg_toast_1040854 | chunk_id
pg_toast | pg_toast_1040854 | chunk_seq
pg_toast | pg_toast_1040863 | chunk_id
pg_toast | pg_toast_1040863 | chunk_seq
pg_toast | pg_toast_1040876 | chunk_id
pg_toast | pg_toast_1040876 | chunk_seq
pg_toast | pg_toast_1040885 | chunk_id
pg_toast | pg_toast_1040885 | chunk_seq
pg_toast | pg_toast_1040893 | chunk_id
pg_toast | pg_toast_1040893 | chunk_seq
pg_toast | pg_toast_1040900 | chunk_id
pg_toast | pg_toast_1040900 | chunk_seq
pg_toast | pg_toast_1040907 | chunk_id
pg_toast | pg_toast_1040907 | chunk_seq
pg_toast | pg_toast_1040914 | chunk_id
pg_toast | pg_toast_1040914 | chunk_seq
pg_toast | pg_toast_1040921 | chunk_id
pg_toast | pg_toast_1040921 | chunk_seq
pg_toast | pg_toast_1040928 | chunk_id
pg_toast | pg_toast_1040928 | chunk_seq
pg_toast | pg_toast_1040937 | chunk_id
pg_toast | pg_toast_1040937 | chunk_seq
pg_toast | pg_toast_1040945 | chunk_id
pg_toast | pg_toast_1040945 | chunk_seq
pg_toast | pg_toast_1048576 | chunk_id
pg_toast | pg_toast_1048576 | chunk_seq
pg_toast | pg_toast_1048585 | chunk_id
pg_toast | pg_toast_1048585 | chunk_seq
pg_toast | pg_toast_1213 | chunk_id
pg_toast | pg_toast_1213 | chunk_seq
pg_toast | pg_toast_1247 | chunk_id
pg_toast | pg_toast_1247 | chunk_seq
pg_toast | pg_toast_1253377 | chunk_id
pg_toast | pg_toast_1253377 | chunk_seq
pg_toast | pg_toast_1253390 | chunk_id
pg_toast | pg_toast_1253390 | chunk_seq
pg_toast | pg_toast_1255 | chunk_id
pg_toast | pg_toast_1255 | chunk_seq
pg_toast | pg_toast_1260 | chunk_id
pg_toast | pg_toast_1260 | chunk_seq
pg_toast | pg_toast_1262 | chunk_id
pg_toast | pg_toast_1262 | chunk_seq
pg_toast | pg_toast_1318912 | chunk_id
pg_toast | pg_toast_1318912 | chunk_seq
pg_toast | pg_toast_13371 | chunk_id
pg_toast | pg_toast_13371 | chunk_seq
pg_toast | pg_toast_13376 | chunk_id
pg_toast | pg_toast_13376 | chunk_seq
pg_toast | pg_toast_13381 | chunk_id
pg_toast | pg_toast_13381 | chunk_seq
pg_toast | pg_toast_13386 | chunk_id
pg_toast | pg_toast_13386 | chunk_seq
pg_toast | pg_toast_1417 | chunk_id
pg_toast | pg_toast_1417 | chunk_seq
pg_toast | pg_toast_1418 | chunk_id
pg_toast | pg_toast_1418 | chunk_seq
pg_toast | pg_toast_1433601 | chunk_id
pg_toast | pg_toast_1433601 | chunk_seq
pg_toast | pg_toast_1433612 | chunk_id
pg_toast | pg_toast_1433612 | chunk_seq
pg_toast | pg_toast_1441792 | chunk_id
pg_toast | pg_toast_1441792 | chunk_seq
pg_toast | pg_toast_1474567 | chunk_id
pg_toast | pg_toast_1474567 | chunk_seq
pg_toast | pg_toast_1474577 | chunk_id
pg_toast | pg_toast_1474577 | chunk_seq
pg_toast | pg_toast_1490944 | chunk_id
pg_toast | pg_toast_1490944 | chunk_seq
pg_toast | pg_toast_1490951 | chunk_id
pg_toast | pg_toast_1490951 | chunk_seq
pg_toast | pg_toast_1589248 | chunk_id
pg_toast | pg_toast_1589248 | chunk_seq
pg_toast | pg_toast_1777689 | chunk_id
pg_toast | pg_toast_1777689 | chunk_seq
pg_toast | pg_toast_1867813 | chunk_id
pg_toast | pg_toast_1867813 | chunk_seq
pg_toast | pg_toast_2097153 | chunk_id
pg_toast | pg_toast_2097153 | chunk_seq
pg_toast | pg_toast_2097166 | chunk_id
pg_toast | pg_toast_2097166 | chunk_seq
pg_toast | pg_toast_2244631 | chunk_id
pg_toast | pg_toast_2244631 | chunk_seq
pg_toast | pg_toast_2244643 | chunk_id
pg_toast | pg_toast_2244643 | chunk_seq
pg_toast | pg_toast_2277377 | chunk_id
pg_toast | pg_toast_2277377 | chunk_seq
pg_toast | pg_toast_2328 | chunk_id
pg_toast | pg_toast_2328 | chunk_seq
pg_toast | pg_toast_2396 | chunk_id
pg_toast | pg_toast_2396 | chunk_seq
pg_toast | pg_toast_2600 | chunk_id
pg_toast | pg_toast_2600 | chunk_seq
pg_toast | pg_toast_2604 | chunk_id
pg_toast | pg_toast_2604 | chunk_seq
pg_toast | pg_toast_2606 | chunk_id
pg_toast | pg_toast_2606 | chunk_seq
pg_toast | pg_toast_2609 | chunk_id
pg_toast | pg_toast_2609 | chunk_seq
pg_toast | pg_toast_2612 | chunk_id
pg_toast | pg_toast_2612 | chunk_seq
pg_toast | pg_toast_2615 | chunk_id
pg_toast | pg_toast_2615 | chunk_seq
pg_toast | pg_toast_2618 | chunk_id
pg_toast | pg_toast_2618 | chunk_seq
pg_toast | pg_toast_2619 | chunk_id
pg_toast | pg_toast_2619 | chunk_seq
pg_toast | pg_toast_2620 | chunk_id
pg_toast | pg_toast_2620 | chunk_seq
pg_toast | pg_toast_2964 | chunk_id
pg_toast | pg_toast_2964 | chunk_seq
pg_toast | pg_toast_3079 | chunk_id
pg_toast | pg_toast_3079 | chunk_seq
pg_toast | pg_toast_3118 | chunk_id
pg_toast | pg_toast_3118 | chunk_seq
pg_toast | pg_toast_3256 | chunk_id
pg_toast | pg_toast_3256 | chunk_seq
pg_toast | pg_toast_3350 | chunk_id
pg_toast | pg_toast_3350 | chunk_seq
pg_toast | pg_toast_3381 | chunk_id
pg_toast | pg_toast_3381 | chunk_seq
pg_toast | pg_toast_3394 | chunk_id
pg_toast | pg_toast_3394 | chunk_seq
pg_toast | pg_toast_3429 | chunk_id
pg_toast | pg_toast_3429 | chunk_seq
pg_toast | pg_toast_3456 | chunk_id
pg_toast | pg_toast_3456 | chunk_seq
pg_toast | pg_toast_3466 | chunk_id
pg_toast | pg_toast_3466 | chunk_seq
pg_toast | pg_toast_3592 | chunk_id
pg_toast | pg_toast_3592 | chunk_seq
pg_toast | pg_toast_3596 | chunk_id
pg_toast | pg_toast_3596 | chunk_seq
pg_toast | pg_toast_3600 | chunk_id
pg_toast | pg_toast_3600 | chunk_seq
pg_toast | pg_toast_6000 | chunk_id
pg_toast | pg_toast_6000 | chunk_seq
pg_toast | pg_toast_6100 | chunk_id
pg_toast | pg_toast_6100 | chunk_seq
pg_toast | pg_toast_6106 | chunk_id
pg_toast | pg_toast_6106 | chunk_seq
pg_toast | pg_toast_6243 | chunk_id
pg_toast | pg_toast_6243 | chunk_seq
pg_toast | pg_toast_826 | chunk_id
pg_toast | pg_toast_826 | chunk_seq
public | BankImportBatch | id
public | BankTxn | id
public | DailySales | id
public | DailyStock | id
public | ExpenseLine | id
public | JussiComparison | id
public | ManagerCheckQuestion | id
public | PaymentBreakdown | id
public | PaymentMethodMap | id
public | PosBatch | id
public | PosPaymentSummary | id
public | PosReceipt | id
public | PosSalesItem | id
public | PosSalesModifier | id
public | PosShiftReport | id
public | RecipeComponent | id
public | RecipeItem | id
public | ShiftSnapshot | id
public | SnapshotItem | id
public | SnapshotModifier | id
public | VendorRule | id
public | _prisma_migrations | id
public | analytics_daily | id
public | checklist_assignments | id
public | cleaning_tasks | id
public | dailyReceiptSummaries | id
public | dailyShiftAnalysis | id
public | daily_sales_v2 | id
public | daily_stock_sales | id
public | daily_stock_v2 | id
public | expenses | id
public | imported_expenses | id
public | ingestion_errors | id
public | ingredient_v2 | id
public | ingredients | id
public | jobs | id
public | loyverse_receipts | shift_date
public | loyverse_shifts | shift_date
public | manager_checklists | id
public | menu_item_v2 | id
public | menu_items | id
public | menu_modifier_v2 | id
public | menu_v2 | id
public | other_expense_v2 | id
public | other_expenses | id
public | partner_statements | id
public | pos_connections | id
public | pos_sync_logs | id
public | purchase_tally | id
public | purchase_tally_drink | id
public | receipt_items | id
public | receipt_payments | id
public | receipts | id
public | recipe_item_v2 | id
public | recipe_lines | id
public | recipe_v2 | id
public | recipes | id
public | restaurants | id
public | shopping_list | id
public | shopping_list_items | id
public | shopping_purchase_v2 | id
public | shopping_purchases | id
public | stock_items | id
public | stock_requests | id
public | supplier_defaults | id
public | suppliers | id
public | wage_entries | id
public | wage_entry_v2 | id

## Foreign Keys
| BankTxn_batchId_fkey | public | BankTxn | batchId | public | BankImportBatch | id | CASCADE | CASCADE |
|---|DailyStock_salesId_fkey | public | DailyStock | salesId | public | DailySales | id | CASCADE | CASCADE
JussiComparison_salesFormId_fkey | public | JussiComparison | salesFormId | public | DailySales | id | CASCADE | SET NULL
JussiComparison_snapshotId_fkey | public | JussiComparison | snapshotId | public | ShiftSnapshot | id | CASCADE | CASCADE
PaymentBreakdown_snapshotId_fkey | public | PaymentBreakdown | snapshotId | public | ShiftSnapshot | id | CASCADE | CASCADE
PosPaymentSummary_batchId_fkey | public | PosPaymentSummary | batchId | public | PosBatch | id | CASCADE | RESTRICT
PosReceipt_batchId_fkey | public | PosReceipt | batchId | public | PosBatch | id | CASCADE | RESTRICT
PosSalesItem_batchId_fkey | public | PosSalesItem | batchId | public | PosBatch | id | CASCADE | RESTRICT
PosSalesModifier_batchId_fkey | public | PosSalesModifier | batchId | public | PosBatch | id | CASCADE | RESTRICT
PosShiftReport_batchId_fkey | public | PosShiftReport | batchId | public | PosBatch | id | CASCADE | RESTRICT
RecipeComponent_recipeItemId_fkey | public | RecipeComponent | recipeItemId | public | RecipeItem | id | CASCADE | CASCADE
ShiftSnapshot_salesFormId_fkey | public | ShiftSnapshot | salesFormId | public | DailySales | id | CASCADE | SET NULL
SnapshotItem_snapshotId_fkey | public | SnapshotItem | snapshotId | public | ShiftSnapshot | id | CASCADE | CASCADE
SnapshotModifier_snapshotId_fkey | public | SnapshotModifier | snapshotId | public | ShiftSnapshot | id | CASCADE | CASCADE
analytics_daily_restaurantId_fkey | public | analytics_daily | restaurantId | public | restaurants | id | CASCADE | RESTRICT
daily_stock_v2_salesId_fkey | public | daily_stock_v2 | salesId | public | daily_sales_v2 | id | CASCADE | CASCADE
expenses_restaurantId_fkey | public | expenses | restaurantId | public | restaurants | id | CASCADE | RESTRICT
ingestion_errors_restaurantId_fkey | public | ingestion_errors | restaurantId | public | restaurants | id | CASCADE | SET NULL
ingredients_supplier_id_fkey | public | ingredients | supplier_id | public | suppliers | id | NO ACTION | NO ACTION
jobs_restaurantId_fkey | public | jobs | restaurantId | public | restaurants | id | CASCADE | SET NULL
menu_item_v2_menuId_fkey | public | menu_item_v2 | menuId | public | menu_v2 | id | CASCADE | CASCADE
menu_items_restaurantId_fkey | public | menu_items | restaurantId | public | restaurants | id | CASCADE | RESTRICT
menu_modifier_v2_itemId_fkey | public | menu_modifier_v2 | itemId | public | menu_item_v2 | id | CASCADE | CASCADE
other_expense_v2_salesId_fkey | public | other_expense_v2 | salesId | public | daily_sales_v2 | id | CASCADE | CASCADE
other_expenses_salesId_fkey | public | other_expenses | salesId | public | DailySales | id | CASCADE | CASCADE
pos_connections_restaurantId_fkey | public | pos_connections | restaurantId | public | restaurants | id | CASCADE | RESTRICT
pos_sync_logs_restaurantId_fkey | public | pos_sync_logs | restaurantId | public | restaurants | id | CASCADE | RESTRICT
purchase_tally_drink_tally_id_fkey | public | purchase_tally_drink | tally_id | public | purchase_tally | id | NO ACTION | CASCADE
receipt_items_receiptId_fkey | public | receipt_items | receiptId | public | receipts | id | CASCADE | RESTRICT
receipt_payments_receiptId_fkey | public | receipt_payments | receiptId | public | receipts | id | CASCADE | RESTRICT
receipts_restaurantId_fkey | public | receipts | restaurantId | public | restaurants | id | CASCADE | RESTRICT
recipe_item_v2_ingredientId_fkey | public | recipe_item_v2 | ingredientId | public | ingredient_v2 | id | CASCADE | RESTRICT
recipe_item_v2_recipeId_fkey | public | recipe_item_v2 | recipeId | public | recipe_v2 | id | CASCADE | CASCADE
recipe_lines_recipe_id_fkey | public | recipe_lines | recipe_id | public | recipes | id | NO ACTION | CASCADE
shopping_list_items_shopping_list_id_fkey | public | shopping_list_items | shopping_list_id | public | shopping_list | id | NO ACTION | CASCADE
shopping_purchase_v2_salesId_fkey | public | shopping_purchase_v2 | salesId | public | daily_sales_v2 | id | CASCADE | CASCADE
shopping_purchases_salesId_fkey | public | shopping_purchases | salesId | public | DailySales | id | CASCADE | CASCADE
stock_requests_stockItemId_fkey | public | stock_requests | stockItemId | public | stock_items | id | CASCADE | RESTRICT
wage_entries_salesId_fkey | public | wage_entries | salesId | public | DailySales | id | CASCADE | CASCADE
wage_entry_v2_salesId_fkey | public | wage_entry_v2 | salesId | public | daily_sales_v2 | id | CASCADE | CASCADE

## Indexes (incl. uniques)
| pg_toast | pg_toast_1040387 | pg_toast_1040387_index | CREATE UNIQUE INDEX pg_toast_1040387_index ON pg_toast.pg_toast_1040387 USING btree (chunk_id, chunk_seq) | t |
|---|pg_toast | pg_toast_1040505 | pg_toast_1040505_index | CREATE UNIQUE INDEX pg_toast_1040505_index ON pg_toast.pg_toast_1040505 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040528 | pg_toast_1040528_index | CREATE UNIQUE INDEX pg_toast_1040528_index ON pg_toast.pg_toast_1040528 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040537 | pg_toast_1040537_index | CREATE UNIQUE INDEX pg_toast_1040537_index ON pg_toast.pg_toast_1040537 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040546 | pg_toast_1040546_index | CREATE UNIQUE INDEX pg_toast_1040546_index ON pg_toast.pg_toast_1040546 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040555 | pg_toast_1040555_index | CREATE UNIQUE INDEX pg_toast_1040555_index ON pg_toast.pg_toast_1040555 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040568 | pg_toast_1040568_index | CREATE UNIQUE INDEX pg_toast_1040568_index ON pg_toast.pg_toast_1040568 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040578 | pg_toast_1040578_index | CREATE UNIQUE INDEX pg_toast_1040578_index ON pg_toast.pg_toast_1040578 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040587 | pg_toast_1040587_index | CREATE UNIQUE INDEX pg_toast_1040587_index ON pg_toast.pg_toast_1040587 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040596 | pg_toast_1040596_index | CREATE UNIQUE INDEX pg_toast_1040596_index ON pg_toast.pg_toast_1040596 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040603 | pg_toast_1040603_index | CREATE UNIQUE INDEX pg_toast_1040603_index ON pg_toast.pg_toast_1040603 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040611 | pg_toast_1040611_index | CREATE UNIQUE INDEX pg_toast_1040611_index ON pg_toast.pg_toast_1040611 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040622 | pg_toast_1040622_index | CREATE UNIQUE INDEX pg_toast_1040622_index ON pg_toast.pg_toast_1040622 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040630 | pg_toast_1040630_index | CREATE UNIQUE INDEX pg_toast_1040630_index ON pg_toast.pg_toast_1040630 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040639 | pg_toast_1040639_index | CREATE UNIQUE INDEX pg_toast_1040639_index ON pg_toast.pg_toast_1040639 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040647 | pg_toast_1040647_index | CREATE UNIQUE INDEX pg_toast_1040647_index ON pg_toast.pg_toast_1040647 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040657 | pg_toast_1040657_index | CREATE UNIQUE INDEX pg_toast_1040657_index ON pg_toast.pg_toast_1040657 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040670 | pg_toast_1040670_index | CREATE UNIQUE INDEX pg_toast_1040670_index ON pg_toast.pg_toast_1040670 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040678 | pg_toast_1040678_index | CREATE UNIQUE INDEX pg_toast_1040678_index ON pg_toast.pg_toast_1040678 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040690 | pg_toast_1040690_index | CREATE UNIQUE INDEX pg_toast_1040690_index ON pg_toast.pg_toast_1040690 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040699 | pg_toast_1040699_index | CREATE UNIQUE INDEX pg_toast_1040699_index ON pg_toast.pg_toast_1040699 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040708 | pg_toast_1040708_index | CREATE UNIQUE INDEX pg_toast_1040708_index ON pg_toast.pg_toast_1040708 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040717 | pg_toast_1040717_index | CREATE UNIQUE INDEX pg_toast_1040717_index ON pg_toast.pg_toast_1040717 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040727 | pg_toast_1040727_index | CREATE UNIQUE INDEX pg_toast_1040727_index ON pg_toast.pg_toast_1040727 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040736 | pg_toast_1040736_index | CREATE UNIQUE INDEX pg_toast_1040736_index ON pg_toast.pg_toast_1040736 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040743 | pg_toast_1040743_index | CREATE UNIQUE INDEX pg_toast_1040743_index ON pg_toast.pg_toast_1040743 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040752 | pg_toast_1040752_index | CREATE UNIQUE INDEX pg_toast_1040752_index ON pg_toast.pg_toast_1040752 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040773 | pg_toast_1040773_index | CREATE UNIQUE INDEX pg_toast_1040773_index ON pg_toast.pg_toast_1040773 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040782 | pg_toast_1040782_index | CREATE UNIQUE INDEX pg_toast_1040782_index ON pg_toast.pg_toast_1040782 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040791 | pg_toast_1040791_index | CREATE UNIQUE INDEX pg_toast_1040791_index ON pg_toast.pg_toast_1040791 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040800 | pg_toast_1040800_index | CREATE UNIQUE INDEX pg_toast_1040800_index ON pg_toast.pg_toast_1040800 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040810 | pg_toast_1040810_index | CREATE UNIQUE INDEX pg_toast_1040810_index ON pg_toast.pg_toast_1040810 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040819 | pg_toast_1040819_index | CREATE UNIQUE INDEX pg_toast_1040819_index ON pg_toast.pg_toast_1040819 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040829 | pg_toast_1040829_index | CREATE UNIQUE INDEX pg_toast_1040829_index ON pg_toast.pg_toast_1040829 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040837 | pg_toast_1040837_index | CREATE UNIQUE INDEX pg_toast_1040837_index ON pg_toast.pg_toast_1040837 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040845 | pg_toast_1040845_index | CREATE UNIQUE INDEX pg_toast_1040845_index ON pg_toast.pg_toast_1040845 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040854 | pg_toast_1040854_index | CREATE UNIQUE INDEX pg_toast_1040854_index ON pg_toast.pg_toast_1040854 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040863 | pg_toast_1040863_index | CREATE UNIQUE INDEX pg_toast_1040863_index ON pg_toast.pg_toast_1040863 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040876 | pg_toast_1040876_index | CREATE UNIQUE INDEX pg_toast_1040876_index ON pg_toast.pg_toast_1040876 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040885 | pg_toast_1040885_index | CREATE UNIQUE INDEX pg_toast_1040885_index ON pg_toast.pg_toast_1040885 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040893 | pg_toast_1040893_index | CREATE UNIQUE INDEX pg_toast_1040893_index ON pg_toast.pg_toast_1040893 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040900 | pg_toast_1040900_index | CREATE UNIQUE INDEX pg_toast_1040900_index ON pg_toast.pg_toast_1040900 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040907 | pg_toast_1040907_index | CREATE UNIQUE INDEX pg_toast_1040907_index ON pg_toast.pg_toast_1040907 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040914 | pg_toast_1040914_index | CREATE UNIQUE INDEX pg_toast_1040914_index ON pg_toast.pg_toast_1040914 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040921 | pg_toast_1040921_index | CREATE UNIQUE INDEX pg_toast_1040921_index ON pg_toast.pg_toast_1040921 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040928 | pg_toast_1040928_index | CREATE UNIQUE INDEX pg_toast_1040928_index ON pg_toast.pg_toast_1040928 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040937 | pg_toast_1040937_index | CREATE UNIQUE INDEX pg_toast_1040937_index ON pg_toast.pg_toast_1040937 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1040945 | pg_toast_1040945_index | CREATE UNIQUE INDEX pg_toast_1040945_index ON pg_toast.pg_toast_1040945 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1048576 | pg_toast_1048576_index | CREATE UNIQUE INDEX pg_toast_1048576_index ON pg_toast.pg_toast_1048576 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1048585 | pg_toast_1048585_index | CREATE UNIQUE INDEX pg_toast_1048585_index ON pg_toast.pg_toast_1048585 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1213 | pg_toast_1213_index | CREATE UNIQUE INDEX pg_toast_1213_index ON pg_toast.pg_toast_1213 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1247 | pg_toast_1247_index | CREATE UNIQUE INDEX pg_toast_1247_index ON pg_toast.pg_toast_1247 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1253377 | pg_toast_1253377_index | CREATE UNIQUE INDEX pg_toast_1253377_index ON pg_toast.pg_toast_1253377 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1253390 | pg_toast_1253390_index | CREATE UNIQUE INDEX pg_toast_1253390_index ON pg_toast.pg_toast_1253390 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1255 | pg_toast_1255_index | CREATE UNIQUE INDEX pg_toast_1255_index ON pg_toast.pg_toast_1255 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1260 | pg_toast_1260_index | CREATE UNIQUE INDEX pg_toast_1260_index ON pg_toast.pg_toast_1260 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1262 | pg_toast_1262_index | CREATE UNIQUE INDEX pg_toast_1262_index ON pg_toast.pg_toast_1262 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1318912 | pg_toast_1318912_index | CREATE UNIQUE INDEX pg_toast_1318912_index ON pg_toast.pg_toast_1318912 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_13371 | pg_toast_13371_index | CREATE UNIQUE INDEX pg_toast_13371_index ON pg_toast.pg_toast_13371 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_13376 | pg_toast_13376_index | CREATE UNIQUE INDEX pg_toast_13376_index ON pg_toast.pg_toast_13376 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_13381 | pg_toast_13381_index | CREATE UNIQUE INDEX pg_toast_13381_index ON pg_toast.pg_toast_13381 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_13386 | pg_toast_13386_index | CREATE UNIQUE INDEX pg_toast_13386_index ON pg_toast.pg_toast_13386 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1417 | pg_toast_1417_index | CREATE UNIQUE INDEX pg_toast_1417_index ON pg_toast.pg_toast_1417 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1418 | pg_toast_1418_index | CREATE UNIQUE INDEX pg_toast_1418_index ON pg_toast.pg_toast_1418 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1433601 | pg_toast_1433601_index | CREATE UNIQUE INDEX pg_toast_1433601_index ON pg_toast.pg_toast_1433601 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1433612 | pg_toast_1433612_index | CREATE UNIQUE INDEX pg_toast_1433612_index ON pg_toast.pg_toast_1433612 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1441792 | pg_toast_1441792_index | CREATE UNIQUE INDEX pg_toast_1441792_index ON pg_toast.pg_toast_1441792 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1474567 | pg_toast_1474567_index | CREATE UNIQUE INDEX pg_toast_1474567_index ON pg_toast.pg_toast_1474567 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1474577 | pg_toast_1474577_index | CREATE UNIQUE INDEX pg_toast_1474577_index ON pg_toast.pg_toast_1474577 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1490944 | pg_toast_1490944_index | CREATE UNIQUE INDEX pg_toast_1490944_index ON pg_toast.pg_toast_1490944 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1490951 | pg_toast_1490951_index | CREATE UNIQUE INDEX pg_toast_1490951_index ON pg_toast.pg_toast_1490951 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1589248 | pg_toast_1589248_index | CREATE UNIQUE INDEX pg_toast_1589248_index ON pg_toast.pg_toast_1589248 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1777689 | pg_toast_1777689_index | CREATE UNIQUE INDEX pg_toast_1777689_index ON pg_toast.pg_toast_1777689 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_1867813 | pg_toast_1867813_index | CREATE UNIQUE INDEX pg_toast_1867813_index ON pg_toast.pg_toast_1867813 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2097153 | pg_toast_2097153_index | CREATE UNIQUE INDEX pg_toast_2097153_index ON pg_toast.pg_toast_2097153 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2097166 | pg_toast_2097166_index | CREATE UNIQUE INDEX pg_toast_2097166_index ON pg_toast.pg_toast_2097166 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2244631 | pg_toast_2244631_index | CREATE UNIQUE INDEX pg_toast_2244631_index ON pg_toast.pg_toast_2244631 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2244643 | pg_toast_2244643_index | CREATE UNIQUE INDEX pg_toast_2244643_index ON pg_toast.pg_toast_2244643 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2277377 | pg_toast_2277377_index | CREATE UNIQUE INDEX pg_toast_2277377_index ON pg_toast.pg_toast_2277377 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2328 | pg_toast_2328_index | CREATE UNIQUE INDEX pg_toast_2328_index ON pg_toast.pg_toast_2328 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2396 | pg_toast_2396_index | CREATE UNIQUE INDEX pg_toast_2396_index ON pg_toast.pg_toast_2396 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2600 | pg_toast_2600_index | CREATE UNIQUE INDEX pg_toast_2600_index ON pg_toast.pg_toast_2600 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2604 | pg_toast_2604_index | CREATE UNIQUE INDEX pg_toast_2604_index ON pg_toast.pg_toast_2604 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2606 | pg_toast_2606_index | CREATE UNIQUE INDEX pg_toast_2606_index ON pg_toast.pg_toast_2606 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2609 | pg_toast_2609_index | CREATE UNIQUE INDEX pg_toast_2609_index ON pg_toast.pg_toast_2609 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2612 | pg_toast_2612_index | CREATE UNIQUE INDEX pg_toast_2612_index ON pg_toast.pg_toast_2612 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2615 | pg_toast_2615_index | CREATE UNIQUE INDEX pg_toast_2615_index ON pg_toast.pg_toast_2615 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2618 | pg_toast_2618_index | CREATE UNIQUE INDEX pg_toast_2618_index ON pg_toast.pg_toast_2618 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2619 | pg_toast_2619_index | CREATE UNIQUE INDEX pg_toast_2619_index ON pg_toast.pg_toast_2619 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2620 | pg_toast_2620_index | CREATE UNIQUE INDEX pg_toast_2620_index ON pg_toast.pg_toast_2620 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_2964 | pg_toast_2964_index | CREATE UNIQUE INDEX pg_toast_2964_index ON pg_toast.pg_toast_2964 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3079 | pg_toast_3079_index | CREATE UNIQUE INDEX pg_toast_3079_index ON pg_toast.pg_toast_3079 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3118 | pg_toast_3118_index | CREATE UNIQUE INDEX pg_toast_3118_index ON pg_toast.pg_toast_3118 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3256 | pg_toast_3256_index | CREATE UNIQUE INDEX pg_toast_3256_index ON pg_toast.pg_toast_3256 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3350 | pg_toast_3350_index | CREATE UNIQUE INDEX pg_toast_3350_index ON pg_toast.pg_toast_3350 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3381 | pg_toast_3381_index | CREATE UNIQUE INDEX pg_toast_3381_index ON pg_toast.pg_toast_3381 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3394 | pg_toast_3394_index | CREATE UNIQUE INDEX pg_toast_3394_index ON pg_toast.pg_toast_3394 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3429 | pg_toast_3429_index | CREATE UNIQUE INDEX pg_toast_3429_index ON pg_toast.pg_toast_3429 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3456 | pg_toast_3456_index | CREATE UNIQUE INDEX pg_toast_3456_index ON pg_toast.pg_toast_3456 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3466 | pg_toast_3466_index | CREATE UNIQUE INDEX pg_toast_3466_index ON pg_toast.pg_toast_3466 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3592 | pg_toast_3592_index | CREATE UNIQUE INDEX pg_toast_3592_index ON pg_toast.pg_toast_3592 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3596 | pg_toast_3596_index | CREATE UNIQUE INDEX pg_toast_3596_index ON pg_toast.pg_toast_3596 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_3600 | pg_toast_3600_index | CREATE UNIQUE INDEX pg_toast_3600_index ON pg_toast.pg_toast_3600 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_6000 | pg_toast_6000_index | CREATE UNIQUE INDEX pg_toast_6000_index ON pg_toast.pg_toast_6000 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_6100 | pg_toast_6100_index | CREATE UNIQUE INDEX pg_toast_6100_index ON pg_toast.pg_toast_6100 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_6106 | pg_toast_6106_index | CREATE UNIQUE INDEX pg_toast_6106_index ON pg_toast.pg_toast_6106 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_6243 | pg_toast_6243_index | CREATE UNIQUE INDEX pg_toast_6243_index ON pg_toast.pg_toast_6243 USING btree (chunk_id, chunk_seq) | t
pg_toast | pg_toast_826 | pg_toast_826_index | CREATE UNIQUE INDEX pg_toast_826_index ON pg_toast.pg_toast_826 USING btree (chunk_id, chunk_seq) | t
public | BankImportBatch | BankImportBatch_pkey | CREATE UNIQUE INDEX "BankImportBatch_pkey" ON public."BankImportBatch" USING btree (id) | t
public | BankTxn | BankTxn_dedupeKey_key | CREATE UNIQUE INDEX "BankTxn_dedupeKey_key" ON public."BankTxn" USING btree ("dedupeKey") | t
public | BankTxn | BankTxn_pkey | CREATE UNIQUE INDEX "BankTxn_pkey" ON public."BankTxn" USING btree (id) | t
public | DailySales | DailySales_pkey | CREATE UNIQUE INDEX "DailySales_pkey" ON public."DailySales" USING btree (id) | t
public | DailyStock | DailyStock_pkey | CREATE UNIQUE INDEX "DailyStock_pkey" ON public."DailyStock" USING btree (id) | t
public | DailyStock | DailyStock_salesId_key | CREATE UNIQUE INDEX "DailyStock_salesId_key" ON public."DailyStock" USING btree ("salesId") | t
public | ExpenseLine | ExpenseLine_pkey | CREATE UNIQUE INDEX "ExpenseLine_pkey" ON public."ExpenseLine" USING btree (id) | t
public | ExpenseLine | ExpenseLine_ingredientId_idx | CREATE INDEX "ExpenseLine_ingredientId_idx" ON public."ExpenseLine" USING btree ("ingredientId") | f
public | JussiComparison | JussiComparison_pkey | CREATE UNIQUE INDEX "JussiComparison_pkey" ON public."JussiComparison" USING btree (id) | t
public | JussiComparison | JussiComparison_salesFormId_idx | CREATE INDEX "JussiComparison_salesFormId_idx" ON public."JussiComparison" USING btree ("salesFormId") | f
public | JussiComparison | JussiComparison_snapshotId_idx | CREATE INDEX "JussiComparison_snapshotId_idx" ON public."JussiComparison" USING btree ("snapshotId") | f
public | ManagerCheckQuestion | ManagerCheckQuestion_pkey | CREATE UNIQUE INDEX "ManagerCheckQuestion_pkey" ON public."ManagerCheckQuestion" USING btree (id) | t
public | PaymentBreakdown | PaymentBreakdown_pkey | CREATE UNIQUE INDEX "PaymentBreakdown_pkey" ON public."PaymentBreakdown" USING btree (id) | t
public | PaymentBreakdown | PaymentBreakdown_snapshotId_channel_key | CREATE UNIQUE INDEX "PaymentBreakdown_snapshotId_channel_key" ON public."PaymentBreakdown" USING btree ("snapshotId", channel) | t
public | PaymentBreakdown | PaymentBreakdown_snapshotId_idx | CREATE INDEX "PaymentBreakdown_snapshotId_idx" ON public."PaymentBreakdown" USING btree ("snapshotId") | f
public | PaymentMethodMap | PaymentMethodMap_pkey | CREATE UNIQUE INDEX "PaymentMethodMap_pkey" ON public."PaymentMethodMap" USING btree (id) | t
public | PaymentMethodMap | PaymentMethodMap_provider_sourceName_key | CREATE UNIQUE INDEX "PaymentMethodMap_provider_sourceName_key" ON public."PaymentMethodMap" USING btree (provider, "sourceName") | t
public | PosBatch | PosBatch_pkey | CREATE UNIQUE INDEX "PosBatch_pkey" ON public."PosBatch" USING btree (id) | t
public | PosPaymentSummary | PosPaymentSummary_pkey | CREATE UNIQUE INDEX "PosPaymentSummary_pkey" ON public."PosPaymentSummary" USING btree (id) | t
public | PosReceipt | PosReceipt_pkey | CREATE UNIQUE INDEX "PosReceipt_pkey" ON public."PosReceipt" USING btree (id) | t
public | PosSalesItem | PosSalesItem_pkey | CREATE UNIQUE INDEX "PosSalesItem_pkey" ON public."PosSalesItem" USING btree (id) | t
public | PosSalesModifier | PosSalesModifier_pkey | CREATE UNIQUE INDEX "PosSalesModifier_pkey" ON public."PosSalesModifier" USING btree (id) | t
public | PosShiftReport | PosShiftReport_batchId_key | CREATE UNIQUE INDEX "PosShiftReport_batchId_key" ON public."PosShiftReport" USING btree ("batchId") | t
public | PosShiftReport | PosShiftReport_pkey | CREATE UNIQUE INDEX "PosShiftReport_pkey" ON public."PosShiftReport" USING btree (id) | t
public | RecipeComponent | RecipeComponent_pkey | CREATE UNIQUE INDEX "RecipeComponent_pkey" ON public."RecipeComponent" USING btree (id) | t
public | RecipeComponent | RecipeComponent_recipeItemId_idx | CREATE INDEX "RecipeComponent_recipeItemId_idx" ON public."RecipeComponent" USING btree ("recipeItemId") | f
public | RecipeItem | RecipeItem_pkey | CREATE UNIQUE INDEX "RecipeItem_pkey" ON public."RecipeItem" USING btree (id) | t
public | RecipeItem | RecipeItem_sku_key | CREATE UNIQUE INDEX "RecipeItem_sku_key" ON public."RecipeItem" USING btree (sku) | t
public | ShiftSnapshot | ShiftSnapshot_pkey | CREATE UNIQUE INDEX "ShiftSnapshot_pkey" ON public."ShiftSnapshot" USING btree (id) | t
public | ShiftSnapshot | ShiftSnapshot_windowStartUTC_windowEndUTC_idx | CREATE INDEX "ShiftSnapshot_windowStartUTC_windowEndUTC_idx" ON public."ShiftSnapshot" USING btree ("windowStartUTC", "windowEndUTC") | f
public | SnapshotItem | SnapshotItem_pkey | CREATE UNIQUE INDEX "SnapshotItem_pkey" ON public."SnapshotItem" USING btree (id) | t
public | SnapshotItem | SnapshotItem_snapshotId_idx | CREATE INDEX "SnapshotItem_snapshotId_idx" ON public."SnapshotItem" USING btree ("snapshotId") | f
public | SnapshotModifier | SnapshotModifier_pkey | CREATE UNIQUE INDEX "SnapshotModifier_pkey" ON public."SnapshotModifier" USING btree (id) | t
public | SnapshotModifier | SnapshotModifier_snapshotId_idx | CREATE INDEX "SnapshotModifier_snapshotId_idx" ON public."SnapshotModifier" USING btree ("snapshotId") | f
public | VendorRule | VendorRule_pkey | CREATE UNIQUE INDEX "VendorRule_pkey" ON public."VendorRule" USING btree (id) | t
public | _prisma_migrations | _prisma_migrations_pkey | CREATE UNIQUE INDEX _prisma_migrations_pkey ON public._prisma_migrations USING btree (id) | t
public | analytics_daily | analytics_daily_pkey | CREATE UNIQUE INDEX analytics_daily_pkey ON public.analytics_daily USING btree (id) | t
public | analytics_daily | analytics_daily_restaurantId_shiftDate_key | CREATE UNIQUE INDEX "analytics_daily_restaurantId_shiftDate_key" ON public.analytics_daily USING btree ("restaurantId", "shiftDate") | t
public | analytics_daily | analytics_daily_restaurantId_shiftDate_idx | CREATE INDEX "analytics_daily_restaurantId_shiftDate_idx" ON public.analytics_daily USING btree ("restaurantId", "shiftDate") | f
public | checklist_assignments | checklist_assignments_pkey | CREATE UNIQUE INDEX checklist_assignments_pkey ON public.checklist_assignments USING btree (id) | t
public | cleaning_tasks | cleaning_tasks_pkey | CREATE UNIQUE INDEX cleaning_tasks_pkey ON public.cleaning_tasks USING btree (id) | t
public | dailyReceiptSummaries | dailyReceiptSummaries_pkey | CREATE UNIQUE INDEX "dailyReceiptSummaries_pkey" ON public."dailyReceiptSummaries" USING btree (id) | t
public | dailyReceiptSummaries | dailyReceiptSummaries_shift_date_key | CREATE UNIQUE INDEX "dailyReceiptSummaries_shift_date_key" ON public."dailyReceiptSummaries" USING btree (shift_date) | t
public | dailyShiftAnalysis | dailyShiftAnalysis_pkey | CREATE UNIQUE INDEX "dailyShiftAnalysis_pkey" ON public."dailyShiftAnalysis" USING btree (id) | t
public | dailyShiftAnalysis | dailyShiftAnalysis_shift_date_key | CREATE UNIQUE INDEX "dailyShiftAnalysis_shift_date_key" ON public."dailyShiftAnalysis" USING btree (shift_date) | t
public | daily_sales_v2 | daily_sales_v2_pkey | CREATE UNIQUE INDEX daily_sales_v2_pkey ON public.daily_sales_v2 USING btree (id) | t
public | daily_sales_v2 | idx_daily_sales_v2_completed_by | CREATE INDEX idx_daily_sales_v2_completed_by ON public.daily_sales_v2 USING btree ("completedBy") | f
public | daily_sales_v2 | idx_daily_sales_v2_created_at | CREATE INDEX idx_daily_sales_v2_created_at ON public.daily_sales_v2 USING btree ("createdAt") | f
public | daily_sales_v2 | idx_daily_sales_v2_shift_date | CREATE INDEX idx_daily_sales_v2_shift_date ON public.daily_sales_v2 USING btree ("shiftDate") | f
public | daily_stock_sales | daily_stock_sales_pkey | CREATE UNIQUE INDEX daily_stock_sales_pkey ON public.daily_stock_sales USING btree (id) | t
public | daily_stock_v2 | daily_stock_v2_pkey | CREATE UNIQUE INDEX daily_stock_v2_pkey ON public.daily_stock_v2 USING btree (id) | t
public | daily_stock_v2 | daily_stock_v2_salesId_key | CREATE UNIQUE INDEX "daily_stock_v2_salesId_key" ON public.daily_stock_v2 USING btree ("salesId") | t
public | expenses | expenses_pkey | CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (id) | t
public | expenses | expenses_restaurantId_shiftDate_idx | CREATE INDEX "expenses_restaurantId_shiftDate_idx" ON public.expenses USING btree ("restaurantId", "shiftDate") | f
public | imported_expenses | imported_expenses_pkey | CREATE UNIQUE INDEX imported_expenses_pkey ON public.imported_expenses USING btree (id) | t
public | ingestion_errors | ingestion_errors_pkey | CREATE UNIQUE INDEX ingestion_errors_pkey ON public.ingestion_errors USING btree (id) | t
public | ingestion_errors | ingestion_errors_restaurantId_provider_createdAt_idx | CREATE INDEX "ingestion_errors_restaurantId_provider_createdAt_idx" ON public.ingestion_errors USING btree ("restaurantId", provider, "createdAt") | f
public | ingredient_v2 | ingredient_v2_name_key | CREATE UNIQUE INDEX ingredient_v2_name_key ON public.ingredient_v2 USING btree (name) | t
public | ingredient_v2 | ingredient_v2_pkey | CREATE UNIQUE INDEX ingredient_v2_pkey ON public.ingredient_v2 USING btree (id) | t
public | ingredients | ingredients_pkey | CREATE UNIQUE INDEX ingredients_pkey ON public.ingredients USING btree (id) | t
public | ingredients | idx_ingredients_category | CREATE INDEX idx_ingredients_category ON public.ingredients USING btree (category) | f
public | ingredients | idx_ingredients_supplier_id | CREATE INDEX idx_ingredients_supplier_id ON public.ingredients USING btree (supplier_id) | f
public | jobs | jobs_pkey | CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (id) | t
public | jobs | jobs_restaurantId_idx | CREATE INDEX "jobs_restaurantId_idx" ON public.jobs USING btree ("restaurantId") | f
public | jobs | jobs_status_runAt_idx | CREATE INDEX "jobs_status_runAt_idx" ON public.jobs USING btree (status, "runAt") | f
public | loyverse_receipts | loyverse_receipts_pkey | CREATE UNIQUE INDEX loyverse_receipts_pkey ON public.loyverse_receipts USING btree (shift_date) | t
public | loyverse_shifts | loyverse_shifts_pkey | CREATE UNIQUE INDEX loyverse_shifts_pkey ON public.loyverse_shifts USING btree (shift_date) | t
public | manager_checklists | manager_checklists_pkey | CREATE UNIQUE INDEX manager_checklists_pkey ON public.manager_checklists USING btree (id) | t
public | menu_item_v2 | menu_item_v2_menuId_name_key | CREATE UNIQUE INDEX "menu_item_v2_menuId_name_key" ON public.menu_item_v2 USING btree ("menuId", name) | t
public | menu_item_v2 | menu_item_v2_pkey | CREATE UNIQUE INDEX menu_item_v2_pkey ON public.menu_item_v2 USING btree (id) | t
public | menu_item_v2 | menu_item_v2_name_idx | CREATE INDEX menu_item_v2_name_idx ON public.menu_item_v2 USING btree (name) | f
public | menu_items | menu_items_pkey | CREATE UNIQUE INDEX menu_items_pkey ON public.menu_items USING btree (id) | t
public | menu_items | menu_items_restaurantId_sku_key | CREATE UNIQUE INDEX "menu_items_restaurantId_sku_key" ON public.menu_items USING btree ("restaurantId", sku) | t
public | menu_items | menu_items_restaurantId_category_idx | CREATE INDEX "menu_items_restaurantId_category_idx" ON public.menu_items USING btree ("restaurantId", category) | f
public | menu_modifier_v2 | menu_modifier_v2_pkey | CREATE UNIQUE INDEX menu_modifier_v2_pkey ON public.menu_modifier_v2 USING btree (id) | t
public | menu_modifier_v2 | menu_modifier_v2_itemId_idx | CREATE INDEX "menu_modifier_v2_itemId_idx" ON public.menu_modifier_v2 USING btree ("itemId") | f
public | menu_v2 | menu_v2_pkey | CREATE UNIQUE INDEX menu_v2_pkey ON public.menu_v2 USING btree (id) | t
public | menu_v2 | menu_v2_source_idx | CREATE INDEX menu_v2_source_idx ON public.menu_v2 USING btree (source) | f
public | other_expense_v2 | other_expense_v2_pkey | CREATE UNIQUE INDEX other_expense_v2_pkey ON public.other_expense_v2 USING btree (id) | t
public | other_expenses | other_expenses_pkey | CREATE UNIQUE INDEX other_expenses_pkey ON public.other_expenses USING btree (id) | t
public | partner_statements | partner_statements_pkey | CREATE UNIQUE INDEX partner_statements_pkey ON public.partner_statements USING btree (id) | t
public | pos_connections | pos_connections_pkey | CREATE UNIQUE INDEX pos_connections_pkey ON public.pos_connections USING btree (id) | t
public | pos_connections | pos_connections_provider_isActive_idx | CREATE INDEX "pos_connections_provider_isActive_idx" ON public.pos_connections USING btree (provider, "isActive") | f
public | pos_connections | pos_connections_restaurantId_idx | CREATE INDEX "pos_connections_restaurantId_idx" ON public.pos_connections USING btree ("restaurantId") | f
public | pos_sync_logs | pos_sync_logs_pkey | CREATE UNIQUE INDEX pos_sync_logs_pkey ON public.pos_sync_logs USING btree (id) | t
public | pos_sync_logs | pos_sync_logs_restaurantId_provider_startedAt_idx | CREATE INDEX "pos_sync_logs_restaurantId_provider_startedAt_idx" ON public.pos_sync_logs USING btree ("restaurantId", provider, "startedAt") | f
public | purchase_tally | purchase_tally_pkey | CREATE UNIQUE INDEX purchase_tally_pkey ON public.purchase_tally USING btree (id) | t
public | purchase_tally_drink | purchase_tally_drink_pkey | CREATE UNIQUE INDEX purchase_tally_drink_pkey ON public.purchase_tally_drink USING btree (id) | t
public | purchase_tally_drink | purchase_tally_drink_item_name_idx | CREATE INDEX purchase_tally_drink_item_name_idx ON public.purchase_tally_drink USING btree (item_name) | f
public | purchase_tally_drink | purchase_tally_drink_tally_id_idx | CREATE INDEX purchase_tally_drink_tally_id_idx ON public.purchase_tally_drink USING btree (tally_id) | f
public | receipt_items | receipt_items_pkey | CREATE UNIQUE INDEX receipt_items_pkey ON public.receipt_items USING btree (id) | t
public | receipt_items | receipt_items_receiptId_idx | CREATE INDEX "receipt_items_receiptId_idx" ON public.receipt_items USING btree ("receiptId") | f
public | receipt_payments | receipt_payments_pkey | CREATE UNIQUE INDEX receipt_payments_pkey ON public.receipt_payments USING btree (id) | t
public | receipt_payments | receipt_payments_receiptId_idx | CREATE INDEX "receipt_payments_receiptId_idx" ON public.receipt_payments USING btree ("receiptId") | f
public | receipts | receipts_pkey | CREATE UNIQUE INDEX receipts_pkey ON public.receipts USING btree (id) | t
public | receipts | receipts_restaurantId_provider_externalId_key | CREATE UNIQUE INDEX "receipts_restaurantId_provider_externalId_key" ON public.receipts USING btree ("restaurantId", provider, "externalId") | t
public | receipts | receipts_restaurantId_createdAtUTC_idx | CREATE INDEX "receipts_restaurantId_createdAtUTC_idx" ON public.receipts USING btree ("restaurantId", "createdAtUTC") | f
public | recipe_item_v2 | recipe_item_v2_pkey | CREATE UNIQUE INDEX recipe_item_v2_pkey ON public.recipe_item_v2 USING btree (id) | t
public | recipe_item_v2 | recipe_item_v2_recipeId_ingredientId_key | CREATE UNIQUE INDEX "recipe_item_v2_recipeId_ingredientId_key" ON public.recipe_item_v2 USING btree ("recipeId", "ingredientId") | t
public | recipe_lines | recipe_lines_pkey | CREATE UNIQUE INDEX recipe_lines_pkey ON public.recipe_lines USING btree (id) | t
public | recipe_v2 | recipe_v2_name_key | CREATE UNIQUE INDEX recipe_v2_name_key ON public.recipe_v2 USING btree (name) | t
public | recipe_v2 | recipe_v2_pkey | CREATE UNIQUE INDEX recipe_v2_pkey ON public.recipe_v2 USING btree (id) | t
public | recipes | recipes_pkey | CREATE UNIQUE INDEX recipes_pkey ON public.recipes USING btree (id) | t
public | restaurants | restaurants_pkey | CREATE UNIQUE INDEX restaurants_pkey ON public.restaurants USING btree (id) | t
public | restaurants | restaurants_slug_key | CREATE UNIQUE INDEX restaurants_slug_key ON public.restaurants USING btree (slug) | t
public | shopping_list | shopping_list_pkey | CREATE UNIQUE INDEX shopping_list_pkey ON public.shopping_list USING btree (id) | t
public | shopping_list_items | shopping_list_items_pkey | CREATE UNIQUE INDEX shopping_list_items_pkey ON public.shopping_list_items USING btree (id) | t
public | shopping_list_items | idx_shopping_list_items_list_id | CREATE INDEX idx_shopping_list_items_list_id ON public.shopping_list_items USING btree (shopping_list_id) | f
public | shopping_purchase_v2 | shopping_purchase_v2_pkey | CREATE UNIQUE INDEX shopping_purchase_v2_pkey ON public.shopping_purchase_v2 USING btree (id) | t
public | shopping_purchases | shopping_purchases_pkey | CREATE UNIQUE INDEX shopping_purchases_pkey ON public.shopping_purchases USING btree (id) | t
public | stock_items | stock_items_pkey | CREATE UNIQUE INDEX stock_items_pkey ON public.stock_items USING btree (id) | t
public | stock_requests | stock_requests_pkey | CREATE UNIQUE INDEX stock_requests_pkey ON public.stock_requests USING btree (id) | t
public | stock_requests | stock_requests_shiftId_stockItemId_key | CREATE UNIQUE INDEX "stock_requests_shiftId_stockItemId_key" ON public.stock_requests USING btree ("shiftId", "stockItemId") | t
public | supplier_defaults | supplier_defaults_pkey | CREATE UNIQUE INDEX supplier_defaults_pkey ON public.supplier_defaults USING btree (id) | t
public | suppliers | suppliers_name_key | CREATE UNIQUE INDEX suppliers_name_key ON public.suppliers USING btree (name) | t
public | suppliers | suppliers_pkey | CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id) | t
public | wage_entries | wage_entries_pkey | CREATE UNIQUE INDEX wage_entries_pkey ON public.wage_entries USING btree (id) | t
public | wage_entry_v2 | wage_entry_v2_pkey | CREATE UNIQUE INDEX wage_entry_v2_pkey ON public.wage_entry_v2 USING btree (id) | t

## Views

## Materialized Views

## Constraints (CHECK, UNIQUE, etc.)
| public | BankImportBatch | 1040386_1040928_1_not_null | CHECK | id IS NOT NULL |
|---|public | BankImportBatch | 1040386_1040928_2_not_null | CHECK | createdAt IS NOT NULL
public | BankImportBatch | 1040386_1040928_3_not_null | CHECK | source IS NOT NULL
public | BankImportBatch | 1040386_1040928_4_not_null | CHECK | filename IS NOT NULL
public | BankImportBatch | 1040386_1040928_5_not_null | CHECK | status IS NOT NULL
public | BankTxn | 1040386_1040937_13_not_null | CHECK | dedupeKey IS NOT NULL
public | BankTxn | 1040386_1040937_1_not_null | CHECK | id IS NOT NULL
public | BankTxn | 1040386_1040937_2_not_null | CHECK | batchId IS NOT NULL
public | BankTxn | 1040386_1040937_3_not_null | CHECK | postedAt IS NOT NULL
public | BankTxn | 1040386_1040937_4_not_null | CHECK | description IS NOT NULL
public | BankTxn | 1040386_1040937_5_not_null | CHECK | amountTHB IS NOT NULL
public | BankTxn | 1040386_1040937_7_not_null | CHECK | raw IS NOT NULL
public | BankTxn | 1040386_1040937_8_not_null | CHECK | status IS NOT NULL
public | DailySales | 1040386_1040505_10_not_null | CHECK | cashBanked IS NOT NULL
public | DailySales | 1040386_1040505_11_not_null | CHECK | cashSales IS NOT NULL
public | DailySales | 1040386_1040505_12_not_null | CHECK | qrSales IS NOT NULL
public | DailySales | 1040386_1040505_13_not_null | CHECK | grabSales IS NOT NULL
public | DailySales | 1040386_1040505_14_not_null | CHECK | aroiSales IS NOT NULL
public | DailySales | 1040386_1040505_15_not_null | CHECK | totalSales IS NOT NULL
public | DailySales | 1040386_1040505_16_not_null | CHECK | shoppingTotal IS NOT NULL
public | DailySales | 1040386_1040505_17_not_null | CHECK | wagesTotal IS NOT NULL
public | DailySales | 1040386_1040505_18_not_null | CHECK | othersTotal IS NOT NULL
public | DailySales | 1040386_1040505_19_not_null | CHECK | totalExpenses IS NOT NULL
public | DailySales | 1040386_1040505_1_not_null | CHECK | id IS NOT NULL
public | DailySales | 1040386_1040505_20_not_null | CHECK | closingCash IS NOT NULL
public | DailySales | 1040386_1040505_21_not_null | CHECK | qrTransfer IS NOT NULL
public | DailySales | 1040386_1040505_2_not_null | CHECK | createdAt IS NOT NULL
public | DailySales | 1040386_1040505_3_not_null | CHECK | updatedAt IS NOT NULL
public | DailySales | 1040386_1040505_4_not_null | CHECK | status IS NOT NULL
public | DailySales | 1040386_1040505_5_not_null | CHECK | shiftDate IS NOT NULL
public | DailySales | 1040386_1040505_7_not_null | CHECK | completedBy IS NOT NULL
public | DailySales | 1040386_1040505_8_not_null | CHECK | startingCash IS NOT NULL
public | DailySales | 1040386_1040505_9_not_null | CHECK | endingCash IS NOT NULL
public | DailyStock | 1040386_1040555_10_not_null | CHECK | status IS NOT NULL
public | DailyStock | 1040386_1040555_12_not_null | CHECK | bunsCount IS NOT NULL
public | DailyStock | 1040386_1040555_13_not_null | CHECK | meatGrams IS NOT NULL
public | DailyStock | 1040386_1040555_1_not_null | CHECK | id IS NOT NULL
public | DailyStock | 1040386_1040555_2_not_null | CHECK | createdAt IS NOT NULL
public | DailyStock | 1040386_1040555_3_not_null | CHECK | updatedAt IS NOT NULL
public | DailyStock | 1040386_1040555_4_not_null | CHECK | salesId IS NOT NULL
public | DailyStock | 1040386_1040555_5_not_null | CHECK | burgerBuns IS NOT NULL
public | DailyStock | 1040386_1040555_6_not_null | CHECK | meatWeightG IS NOT NULL
public | ExpenseLine | 1040386_1040630_10_not_null | CHECK | createdAt IS NOT NULL
public | ExpenseLine | 1040386_1040630_1_not_null | CHECK | id IS NOT NULL
public | ExpenseLine | 1040386_1040630_2_not_null | CHECK | expenseId IS NOT NULL
public | ExpenseLine | 1040386_1040630_4_not_null | CHECK | name IS NOT NULL
public | ExpenseLine | 1040386_1040630_9_not_null | CHECK | type IS NOT NULL
public | JussiComparison | 1040386_1040743_1_not_null | CHECK | id IS NOT NULL
public | JussiComparison | 1040386_1040743_23_not_null | CHECK | state IS NOT NULL
public | JussiComparison | 1040386_1040743_2_not_null | CHECK | snapshotId IS NOT NULL
public | JussiComparison | 1040386_1040743_4_not_null | CHECK | createdAt IS NOT NULL
public | ManagerCheckQuestion | 1040386_2277377_1_not_null | CHECK | id IS NOT NULL
public | ManagerCheckQuestion | 1040386_2277377_2_not_null | CHECK | text IS NOT NULL
public | PaymentBreakdown | 1040386_1040690_1_not_null | CHECK | id IS NOT NULL
public | PaymentBreakdown | 1040386_1040690_2_not_null | CHECK | snapshotId IS NOT NULL
public | PaymentBreakdown | 1040386_1040690_3_not_null | CHECK | channel IS NOT NULL
public | PaymentBreakdown | 1040386_1040690_4_not_null | CHECK | count IS NOT NULL
public | PaymentBreakdown | 1040386_1040690_5_not_null | CHECK | totalSatang IS NOT NULL
public | PaymentMethodMap | 1040386_1040717_1_not_null | CHECK | id IS NOT NULL
public | PaymentMethodMap | 1040386_1040717_2_not_null | CHECK | provider IS NOT NULL
public | PaymentMethodMap | 1040386_1040717_3_not_null | CHECK | sourceName IS NOT NULL
public | PaymentMethodMap | 1040386_1040717_4_not_null | CHECK | channel IS NOT NULL
public | PaymentMethodMap | 1040386_1040717_5_not_null | CHECK | createdAt IS NOT NULL
public | PosBatch | 1040386_1040885_1_not_null | CHECK | id IS NOT NULL
public | PosBatch | 1040386_1040885_2_not_null | CHECK | createdAt IS NOT NULL
public | PosPaymentSummary | 1040386_1040921_1_not_null | CHECK | id IS NOT NULL
public | PosPaymentSummary | 1040386_1040921_2_not_null | CHECK | batchId IS NOT NULL
public | PosPaymentSummary | 1040386_1040921_3_not_null | CHECK | method IS NOT NULL
public | PosPaymentSummary | 1040386_1040921_4_not_null | CHECK | amount IS NOT NULL
public | PosReceipt | 1040386_1040893_1_not_null | CHECK | id IS NOT NULL
public | PosReceipt | 1040386_1040893_2_not_null | CHECK | batchId IS NOT NULL
public | PosReceipt | 1040386_1040893_3_not_null | CHECK | receiptId IS NOT NULL
public | PosReceipt | 1040386_1040893_4_not_null | CHECK | datetime IS NOT NULL
public | PosReceipt | 1040386_1040893_5_not_null | CHECK | total IS NOT NULL
public | PosReceipt | 1040386_1040893_6_not_null | CHECK | itemsJson IS NOT NULL
public | PosSalesItem | 1040386_1040907_1_not_null | CHECK | id IS NOT NULL
public | PosSalesItem | 1040386_1040907_2_not_null | CHECK | batchId IS NOT NULL
public | PosSalesItem | 1040386_1040907_3_not_null | CHECK | name IS NOT NULL
public | PosSalesItem | 1040386_1040907_4_not_null | CHECK | qty IS NOT NULL
public | PosSalesItem | 1040386_1040907_5_not_null | CHECK | net IS NOT NULL
public | PosSalesModifier | 1040386_1040914_1_not_null | CHECK | id IS NOT NULL
public | PosSalesModifier | 1040386_1040914_2_not_null | CHECK | batchId IS NOT NULL
public | PosSalesModifier | 1040386_1040914_3_not_null | CHECK | name IS NOT NULL
public | PosSalesModifier | 1040386_1040914_4_not_null | CHECK | qty IS NOT NULL
public | PosSalesModifier | 1040386_1040914_5_not_null | CHECK | net IS NOT NULL
public | PosShiftReport | 1040386_1040900_10_not_null | CHECK | receiptCount IS NOT NULL
public | PosShiftReport | 1040386_1040900_1_not_null | CHECK | id IS NOT NULL
public | PosShiftReport | 1040386_1040900_2_not_null | CHECK | batchId IS NOT NULL
public | PosShiftReport | 1040386_1040900_3_not_null | CHECK | grossSales IS NOT NULL
public | PosShiftReport | 1040386_1040900_4_not_null | CHECK | discounts IS NOT NULL
public | PosShiftReport | 1040386_1040900_5_not_null | CHECK | netSales IS NOT NULL
public | PosShiftReport | 1040386_1040900_6_not_null | CHECK | cashInDrawer IS NOT NULL
public | PosShiftReport | 1040386_1040900_7_not_null | CHECK | cashSales IS NOT NULL
public | PosShiftReport | 1040386_1040900_8_not_null | CHECK | qrSales IS NOT NULL
public | PosShiftReport | 1040386_1040900_9_not_null | CHECK | otherSales IS NOT NULL
public | RecipeComponent | 1040386_1040736_1_not_null | CHECK | id IS NOT NULL
public | RecipeComponent | 1040386_1040736_2_not_null | CHECK | recipeItemId IS NOT NULL
public | RecipeComponent | 1040386_1040736_3_not_null | CHECK | ingredientId IS NOT NULL
public | RecipeComponent | 1040386_1040736_4_not_null | CHECK | baseQty IS NOT NULL
public | RecipeComponent | 1040386_1040736_5_not_null | CHECK | uom IS NOT NULL
public | RecipeItem | 1040386_1040727_1_not_null | CHECK | id IS NOT NULL
public | RecipeItem | 1040386_1040727_3_not_null | CHECK | name IS NOT NULL
public | RecipeItem | 1040386_1040727_5_not_null | CHECK | isMealDeal IS NOT NULL
public | RecipeItem | 1040386_1040727_6_not_null | CHECK | createdAt IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_10_not_null | CHECK | reconcileState IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_1_not_null | CHECK | id IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_2_not_null | CHECK | provider IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_3_not_null | CHECK | windowStartUTC IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_4_not_null | CHECK | windowEndUTC IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_7_not_null | CHECK | createdAt IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_8_not_null | CHECK | totalReceipts IS NOT NULL
public | ShiftSnapshot | 1040386_1040678_9_not_null | CHECK | totalSalesSatang IS NOT NULL
public | SnapshotItem | 1040386_1040699_1_not_null | CHECK | id IS NOT NULL
public | SnapshotItem | 1040386_1040699_2_not_null | CHECK | snapshotId IS NOT NULL
public | SnapshotItem | 1040386_1040699_3_not_null | CHECK | itemName IS NOT NULL
public | SnapshotItem | 1040386_1040699_6_not_null | CHECK | qty IS NOT NULL
public | SnapshotItem | 1040386_1040699_7_not_null | CHECK | revenueSatang IS NOT NULL
public | SnapshotModifier | 1040386_1040708_1_not_null | CHECK | id IS NOT NULL
public | SnapshotModifier | 1040386_1040708_2_not_null | CHECK | snapshotId IS NOT NULL
public | SnapshotModifier | 1040386_1040708_3_not_null | CHECK | modifierName IS NOT NULL
public | SnapshotModifier | 1040386_1040708_4_not_null | CHECK | lines IS NOT NULL
public | SnapshotModifier | 1040386_1040708_5_not_null | CHECK | revenueSatang IS NOT NULL
public | VendorRule | 1040386_1040945_1_not_null | CHECK | id IS NOT NULL
public | VendorRule | 1040386_1040945_2_not_null | CHECK | createdAt IS NOT NULL
public | VendorRule | 1040386_1040945_3_not_null | CHECK | matchText IS NOT NULL
public | VendorRule | 1040386_1040945_4_not_null | CHECK | category IS NOT NULL
public | VendorRule | 1040386_1040945_5_not_null | CHECK | supplier IS NOT NULL
public | _prisma_migrations | 1040386_1040387_1_not_null | CHECK | id IS NOT NULL
public | _prisma_migrations | 1040386_1040387_2_not_null | CHECK | checksum IS NOT NULL
public | _prisma_migrations | 1040386_1040387_4_not_null | CHECK | migration_name IS NOT NULL
public | _prisma_migrations | 1040386_1040387_7_not_null | CHECK | started_at IS NOT NULL
public | _prisma_migrations | 1040386_1040387_8_not_null | CHECK | applied_steps_count IS NOT NULL
public | analytics_daily | 1040386_1040639_12_not_null | CHECK | createdAt IS NOT NULL
public | analytics_daily | 1040386_1040639_1_not_null | CHECK | id IS NOT NULL
public | analytics_daily | 1040386_1040639_2_not_null | CHECK | restaurantId IS NOT NULL
public | analytics_daily | 1040386_1040639_3_not_null | CHECK | shiftDate IS NOT NULL
public | checklist_assignments | 1040386_1441792_1_not_null | CHECK | id IS NOT NULL
public | checklist_assignments | 1040386_1441792_2_not_null | CHECK | shift_id IS NOT NULL
public | checklist_assignments | 1040386_1441792_3_not_null | CHECK | manager_name IS NOT NULL
public | checklist_assignments | 1040386_1441792_4_not_null | CHECK | assigned_task_ids IS NOT NULL
public | checklist_assignments | 1040386_1441792_6_not_null | CHECK | expires_at IS NOT NULL
public | cleaning_tasks | 1040386_1433601_1_not_null | CHECK | id IS NOT NULL
public | cleaning_tasks | 1040386_1433601_2_not_null | CHECK | taskName IS NOT NULL
public | cleaning_tasks | 1040386_1433601_4_not_null | CHECK | zone IS NOT NULL
public | cleaning_tasks | 1040386_1433601_5_not_null | CHECK | shiftPhase IS NOT NULL
public | dailyReceiptSummaries | 1040386_1777689_1_not_null | CHECK | id IS NOT NULL
public | dailyReceiptSummaries | 1040386_1777689_2_not_null | CHECK | shift_date IS NOT NULL
public | dailyReceiptSummaries | 1040386_1777689_3_not_null | CHECK | data IS NOT NULL
public | dailyReceiptSummaries | dailyReceiptSummaries_shift_date_key | UNIQUE | 
public | dailyShiftAnalysis | 1040386_1867813_1_not_null | CHECK | id IS NOT NULL
public | dailyShiftAnalysis | 1040386_1867813_2_not_null | CHECK | shift_date IS NOT NULL
public | dailyShiftAnalysis | 1040386_1867813_3_not_null | CHECK | analysis IS NOT NULL
public | dailyShiftAnalysis | dailyShiftAnalysis_shift_date_key | UNIQUE | 
public | daily_sales_v2 | 1040386_1040752_10_not_null | CHECK | qrSales IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_11_not_null | CHECK | grabSales IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_12_not_null | CHECK | aroiSales IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_13_not_null | CHECK | totalSales IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_14_not_null | CHECK | shoppingTotal IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_15_not_null | CHECK | wagesTotal IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_16_not_null | CHECK | othersTotal IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_17_not_null | CHECK | totalExpenses IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_18_not_null | CHECK | qrTransfer IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_1_not_null | CHECK | id IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_2_not_null | CHECK | createdAt IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_3_not_null | CHECK | shiftDate IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_4_not_null | CHECK | submittedAtISO IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_5_not_null | CHECK | completedBy IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_6_not_null | CHECK | startingCash IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_7_not_null | CHECK | endingCash IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_8_not_null | CHECK | cashBanked IS NOT NULL
public | daily_sales_v2 | 1040386_1040752_9_not_null | CHECK | cashSales IS NOT NULL
public | daily_stock_sales | 1040386_2097166_1_not_null | CHECK | id IS NOT NULL
public | daily_stock_sales | 1040386_2097166_2_not_null | CHECK | completed_by IS NOT NULL
public | daily_stock_sales | 1040386_2097166_3_not_null | CHECK | shift_type IS NOT NULL
public | daily_stock_sales | 1040386_2097166_4_not_null | CHECK | shift_date IS NOT NULL
public | daily_stock_v2 | 1040386_1040800_1_not_null | CHECK | id IS NOT NULL
public | daily_stock_v2 | 1040386_1040800_2_not_null | CHECK | createdAt IS NOT NULL
public | daily_stock_v2 | 1040386_1040800_3_not_null | CHECK | salesId IS NOT NULL
public | daily_stock_v2 | 1040386_1040800_4_not_null | CHECK | burgerBuns IS NOT NULL
public | daily_stock_v2 | 1040386_1040800_5_not_null | CHECK | meatWeightG IS NOT NULL
public | expenses | 1040386_1040622_1_not_null | CHECK | id IS NOT NULL
public | expenses | 1040386_1040622_2_not_null | CHECK | restaurantId IS NOT NULL
public | expenses | 1040386_1040622_3_not_null | CHECK | shiftDate IS NOT NULL
public | expenses | 1040386_1040622_4_not_null | CHECK | item IS NOT NULL
public | expenses | 1040386_1040622_5_not_null | CHECK | costCents IS NOT NULL
public | expenses | 1040386_1040622_9_not_null | CHECK | createdAt IS NOT NULL
public | imported_expenses | 1040386_1474567_1_not_null | CHECK | id IS NOT NULL
public | imported_expenses | 1040386_1474567_2_not_null | CHECK | restaurant_id IS NOT NULL
public | imported_expenses | 1040386_1474567_3_not_null | CHECK | import_batch_id IS NOT NULL
public | imported_expenses | 1040386_1474567_8_not_null | CHECK | status IS NOT NULL
public | ingestion_errors | 1040386_1040670_1_not_null | CHECK | id IS NOT NULL
public | ingestion_errors | 1040386_1040670_6_not_null | CHECK | errorMessage IS NOT NULL
public | ingestion_errors | 1040386_1040670_8_not_null | CHECK | createdAt IS NOT NULL
public | ingredient_v2 | 1040386_1040810_1_not_null | CHECK | id IS NOT NULL
public | ingredient_v2 | 1040386_1040810_2_not_null | CHECK | createdAt IS NOT NULL
public | ingredient_v2 | 1040386_1040810_3_not_null | CHECK | name IS NOT NULL
public | ingredient_v2 | 1040386_1040810_4_not_null | CHECK | unit IS NOT NULL
public | ingredient_v2 | 1040386_1040810_5_not_null | CHECK | unitCost IS NOT NULL
public | ingredients | 1040386_2097153_10_not_null | CHECK | unit IS NOT NULL
public | ingredients | 1040386_2097153_1_not_null | CHECK | id IS NOT NULL
public | ingredients | 1040386_2097153_2_not_null | CHECK | name IS NOT NULL
public | ingredients | 1040386_2097153_3_not_null | CHECK | category IS NOT NULL
public | ingredients | 1040386_2097153_4_not_null | CHECK | supplier IS NOT NULL
public | ingredients | 1040386_2097153_5_not_null | CHECK | unit_price IS NOT NULL
public | jobs | 1040386_1040647_10_not_null | CHECK | updatedAt IS NOT NULL
public | jobs | 1040386_1040647_1_not_null | CHECK | id IS NOT NULL
public | jobs | 1040386_1040647_3_not_null | CHECK | type IS NOT NULL
public | jobs | 1040386_1040647_5_not_null | CHECK | status IS NOT NULL
public | jobs | 1040386_1040647_7_not_null | CHECK | attempts IS NOT NULL
public | jobs | 1040386_1040647_9_not_null | CHECK | createdAt IS NOT NULL
public | loyverse_receipts | 1040386_1490951_1_not_null | CHECK | shift_date IS NOT NULL
public | loyverse_shifts | 1040386_1490944_1_not_null | CHECK | shift_date IS NOT NULL
public | manager_checklists | 1040386_1433612_1_not_null | CHECK | id IS NOT NULL
public | manager_checklists | 1040386_1433612_2_not_null | CHECK | shiftId IS NOT NULL
public | manager_checklists | 1040386_1433612_3_not_null | CHECK | managerName IS NOT NULL
public | manager_checklists | 1040386_1433612_4_not_null | CHECK | tasksAssigned IS NOT NULL
public | manager_checklists | 1040386_1433612_5_not_null | CHECK | tasksCompleted IS NOT NULL
public | menu_item_v2 | 1040386_1040845_1_not_null | CHECK | id IS NOT NULL
public | menu_item_v2 | 1040386_1040845_2_not_null | CHECK | menuId IS NOT NULL
public | menu_item_v2 | 1040386_1040845_4_not_null | CHECK | name IS NOT NULL
public | menu_item_v2 | 1040386_1040845_6_not_null | CHECK | basePrice IS NOT NULL
public | menu_item_v2 | 1040386_1040845_8_not_null | CHECK | active IS NOT NULL
public | menu_items | 1040386_1040611_11_not_null | CHECK | createdAt IS NOT NULL
public | menu_items | 1040386_1040611_12_not_null | CHECK | updatedAt IS NOT NULL
public | menu_items | 1040386_1040611_1_not_null | CHECK | id IS NOT NULL
public | menu_items | 1040386_1040611_2_not_null | CHECK | restaurantId IS NOT NULL
public | menu_items | 1040386_1040611_3_not_null | CHECK | sku IS NOT NULL
public | menu_items | 1040386_1040611_4_not_null | CHECK | name IS NOT NULL
public | menu_items | 1040386_1040611_5_not_null | CHECK | category IS NOT NULL
public | menu_items | 1040386_1040611_7_not_null | CHECK | isDrink IS NOT NULL
public | menu_items | 1040386_1040611_8_not_null | CHECK | isBurger IS NOT NULL
public | menu_items | 1040386_1040611_9_not_null | CHECK | active IS NOT NULL
public | menu_modifier_v2 | 1040386_1040854_1_not_null | CHECK | id IS NOT NULL
public | menu_modifier_v2 | 1040386_1040854_2_not_null | CHECK | itemId IS NOT NULL
public | menu_modifier_v2 | 1040386_1040854_4_not_null | CHECK | name IS NOT NULL
public | menu_modifier_v2 | 1040386_1040854_5_not_null | CHECK | price IS NOT NULL
public | menu_v2 | 1040386_1040837_1_not_null | CHECK | id IS NOT NULL
public | menu_v2 | 1040386_1040837_2_not_null | CHECK | name IS NOT NULL
public | menu_v2 | 1040386_1040837_3_not_null | CHECK | source IS NOT NULL
public | menu_v2 | 1040386_1040837_4_not_null | CHECK | fileType IS NOT NULL
public | menu_v2 | 1040386_1040837_6_not_null | CHECK | importedAt IS NOT NULL
public | other_expense_v2 | 1040386_1040791_1_not_null | CHECK | id IS NOT NULL
public | other_expense_v2 | 1040386_1040791_2_not_null | CHECK | createdAt IS NOT NULL
public | other_expense_v2 | 1040386_1040791_3_not_null | CHECK | label IS NOT NULL
public | other_expense_v2 | 1040386_1040791_4_not_null | CHECK | amount IS NOT NULL
public | other_expense_v2 | 1040386_1040791_5_not_null | CHECK | salesId IS NOT NULL
public | other_expenses | 1040386_1040546_1_not_null | CHECK | id IS NOT NULL
public | other_expenses | 1040386_1040546_2_not_null | CHECK | createdAt IS NOT NULL
public | other_expenses | 1040386_1040546_3_not_null | CHECK | label IS NOT NULL
public | other_expenses | 1040386_1040546_4_not_null | CHECK | amount IS NOT NULL
public | other_expenses | 1040386_1040546_5_not_null | CHECK | salesId IS NOT NULL
public | partner_statements | 1040386_1474577_10_not_null | CHECK | status IS NOT NULL
public | partner_statements | 1040386_1474577_1_not_null | CHECK | id IS NOT NULL
public | partner_statements | 1040386_1474577_2_not_null | CHECK | restaurant_id IS NOT NULL
public | partner_statements | 1040386_1474577_4_not_null | CHECK | import_batch_id IS NOT NULL
public | pos_connections | 1040386_1040578_10_not_null | CHECK | updatedAt IS NOT NULL
public | pos_connections | 1040386_1040578_1_not_null | CHECK | id IS NOT NULL
public | pos_connections | 1040386_1040578_2_not_null | CHECK | restaurantId IS NOT NULL
public | pos_connections | 1040386_1040578_3_not_null | CHECK | provider IS NOT NULL
public | pos_connections | 1040386_1040578_7_not_null | CHECK | isActive IS NOT NULL
public | pos_connections | 1040386_1040578_9_not_null | CHECK | createdAt IS NOT NULL
public | pos_sync_logs | 1040386_1040657_10_not_null | CHECK | status IS NOT NULL
public | pos_sync_logs | 1040386_1040657_12_not_null | CHECK | createdAt IS NOT NULL
public | pos_sync_logs | 1040386_1040657_1_not_null | CHECK | id IS NOT NULL
public | pos_sync_logs | 1040386_1040657_2_not_null | CHECK | restaurantId IS NOT NULL
public | pos_sync_logs | 1040386_1040657_3_not_null | CHECK | provider IS NOT NULL
public | pos_sync_logs | 1040386_1040657_4_not_null | CHECK | startedAt IS NOT NULL
public | pos_sync_logs | 1040386_1040657_6_not_null | CHECK | mode IS NOT NULL
public | pos_sync_logs | 1040386_1040657_7_not_null | CHECK | receiptsFetched IS NOT NULL
public | pos_sync_logs | 1040386_1040657_8_not_null | CHECK | itemsUpserted IS NOT NULL
public | pos_sync_logs | 1040386_1040657_9_not_null | CHECK | paymentsUpserted IS NOT NULL
public | purchase_tally | 1040386_1048576_1_not_null | CHECK | id IS NOT NULL
public | purchase_tally | 1040386_1048576_2_not_null | CHECK | created_at IS NOT NULL
public | purchase_tally | 1040386_1048576_3_not_null | CHECK | date IS NOT NULL
public | purchase_tally_drink | 1040386_1048585_1_not_null | CHECK | id IS NOT NULL
public | purchase_tally_drink | 1040386_1048585_2_not_null | CHECK | tally_id IS NOT NULL
public | purchase_tally_drink | 1040386_1048585_3_not_null | CHECK | item_name IS NOT NULL
public | purchase_tally_drink | 1040386_1048585_4_not_null | CHECK | qty IS NOT NULL
public | purchase_tally_drink | 1040386_1048585_5_not_null | CHECK | unit IS NOT NULL
public | receipt_items | 1040386_1040596_1_not_null | CHECK | id IS NOT NULL
public | receipt_items | 1040386_1040596_2_not_null | CHECK | receiptId IS NOT NULL
public | receipt_items | 1040386_1040596_5_not_null | CHECK | name IS NOT NULL
public | receipt_items | 1040386_1040596_7_not_null | CHECK | qty IS NOT NULL
public | receipt_items | 1040386_1040596_8_not_null | CHECK | unitPrice IS NOT NULL
public | receipt_items | 1040386_1040596_9_not_null | CHECK | total IS NOT NULL
public | receipt_payments | 1040386_1040603_1_not_null | CHECK | id IS NOT NULL
public | receipt_payments | 1040386_1040603_2_not_null | CHECK | receiptId IS NOT NULL
public | receipt_payments | 1040386_1040603_3_not_null | CHECK | method IS NOT NULL
public | receipt_payments | 1040386_1040603_4_not_null | CHECK | amount IS NOT NULL
public | receipts | 1040386_1040587_10_not_null | CHECK | tax IS NOT NULL
public | receipts | 1040386_1040587_11_not_null | CHECK | discount IS NOT NULL
public | receipts | 1040386_1040587_12_not_null | CHECK | total IS NOT NULL
public | receipts | 1040386_1040587_15_not_null | CHECK | createdAt IS NOT NULL
public | receipts | 1040386_1040587_1_not_null | CHECK | id IS NOT NULL
public | receipts | 1040386_1040587_2_not_null | CHECK | restaurantId IS NOT NULL
public | receipts | 1040386_1040587_3_not_null | CHECK | provider IS NOT NULL
public | receipts | 1040386_1040587_4_not_null | CHECK | externalId IS NOT NULL
public | receipts | 1040386_1040587_6_not_null | CHECK | channel IS NOT NULL
public | receipts | 1040386_1040587_7_not_null | CHECK | createdAtUTC IS NOT NULL
public | receipts | 1040386_1040587_9_not_null | CHECK | subtotal IS NOT NULL
public | recipe_item_v2 | 1040386_1040829_1_not_null | CHECK | id IS NOT NULL
public | recipe_item_v2 | 1040386_1040829_2_not_null | CHECK | recipeId IS NOT NULL
public | recipe_item_v2 | 1040386_1040829_3_not_null | CHECK | ingredientId IS NOT NULL
public | recipe_item_v2 | 1040386_1040829_4_not_null | CHECK | qty IS NOT NULL
public | recipe_lines | 1040386_1253390_1_not_null | CHECK | id IS NOT NULL
public | recipe_lines | 1040386_1253390_4_not_null | CHECK | ingredient_name IS NOT NULL
public | recipe_lines | 1040386_1253390_5_not_null | CHECK | qty IS NOT NULL
public | recipe_lines | 1040386_1253390_6_not_null | CHECK | unit IS NOT NULL
public | recipe_lines | 1040386_1253390_7_not_null | CHECK | unit_cost_thb IS NOT NULL
public | recipe_lines | 1040386_1253390_8_not_null | CHECK | cost_thb IS NOT NULL
public | recipe_v2 | 1040386_1040819_1_not_null | CHECK | id IS NOT NULL
public | recipe_v2 | 1040386_1040819_2_not_null | CHECK | createdAt IS NOT NULL
public | recipe_v2 | 1040386_1040819_3_not_null | CHECK | name IS NOT NULL
public | recipe_v2 | 1040386_1040819_4_not_null | CHECK | yield IS NOT NULL
public | recipe_v2 | 1040386_1040819_5_not_null | CHECK | targetMargin IS NOT NULL
public | recipes | 1040386_1253377_1_not_null | CHECK | id IS NOT NULL
public | recipes | 1040386_1253377_2_not_null | CHECK | name IS NOT NULL
public | restaurants | 1040386_1040568_10_not_null | CHECK | updatedAt IS NOT NULL
public | restaurants | 1040386_1040568_1_not_null | CHECK | id IS NOT NULL
public | restaurants | 1040386_1040568_2_not_null | CHECK | name IS NOT NULL
public | restaurants | 1040386_1040568_3_not_null | CHECK | slug IS NOT NULL
public | restaurants | 1040386_1040568_5_not_null | CHECK | timezone IS NOT NULL
public | restaurants | 1040386_1040568_6_not_null | CHECK | locale IS NOT NULL
public | restaurants | 1040386_1040568_9_not_null | CHECK | createdAt IS NOT NULL
public | shopping_list | 1040386_1318912_1_not_null | CHECK | id IS NOT NULL
public | shopping_list_items | 1040386_2244643_1_not_null | CHECK | id IS NOT NULL
public | shopping_list_items | 1040386_2244643_3_not_null | CHECK | ingredient_name IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_1_not_null | CHECK | id IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_2_not_null | CHECK | createdAt IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_3_not_null | CHECK | item IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_4_not_null | CHECK | cost IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_5_not_null | CHECK | shop IS NOT NULL
public | shopping_purchase_v2 | 1040386_1040773_6_not_null | CHECK | salesId IS NOT NULL
public | shopping_purchases | 1040386_1040528_1_not_null | CHECK | id IS NOT NULL
public | shopping_purchases | 1040386_1040528_2_not_null | CHECK | createdAt IS NOT NULL
public | shopping_purchases | 1040386_1040528_3_not_null | CHECK | item IS NOT NULL
public | shopping_purchases | 1040386_1040528_4_not_null | CHECK | cost IS NOT NULL
public | shopping_purchases | 1040386_1040528_5_not_null | CHECK | shop IS NOT NULL
public | shopping_purchases | 1040386_1040528_6_not_null | CHECK | salesId IS NOT NULL
public | stock_items | 1040386_1040863_1_not_null | CHECK | id IS NOT NULL
public | stock_items | 1040386_1040863_2_not_null | CHECK | name IS NOT NULL
public | stock_items | 1040386_1040863_3_not_null | CHECK | category IS NOT NULL
public | stock_items | 1040386_1040863_4_not_null | CHECK | isDrink IS NOT NULL
public | stock_items | 1040386_1040863_5_not_null | CHECK | isExcluded IS NOT NULL
public | stock_items | 1040386_1040863_6_not_null | CHECK | displayOrder IS NOT NULL
public | stock_items | 1040386_1040863_7_not_null | CHECK | createdAt IS NOT NULL
public | stock_items | 1040386_1040863_8_not_null | CHECK | updatedAt IS NOT NULL
public | stock_requests | 1040386_1040876_1_not_null | CHECK | id IS NOT NULL
public | stock_requests | 1040386_1040876_2_not_null | CHECK | shiftId IS NOT NULL
public | stock_requests | 1040386_1040876_3_not_null | CHECK | stockItemId IS NOT NULL
public | stock_requests | 1040386_1040876_5_not_null | CHECK | createdAt IS NOT NULL
public | stock_requests | 1040386_1040876_6_not_null | CHECK | updatedAt IS NOT NULL
public | supplier_defaults | 1040386_1589248_1_not_null | CHECK | id IS NOT NULL
public | supplier_defaults | 1040386_1589248_2_not_null | CHECK | restaurant_id IS NOT NULL
public | supplier_defaults | 1040386_1589248_3_not_null | CHECK | supplier IS NOT NULL
public | supplier_defaults | 1040386_1589248_4_not_null | CHECK | default_category IS NOT NULL
public | suppliers | 1040386_2244631_1_not_null | CHECK | id IS NOT NULL
public | suppliers | 1040386_2244631_2_not_null | CHECK | name IS NOT NULL
public | suppliers | suppliers_name_key | UNIQUE | 
public | wage_entries | 1040386_1040537_1_not_null | CHECK | id IS NOT NULL
public | wage_entries | 1040386_1040537_2_not_null | CHECK | createdAt IS NOT NULL
public | wage_entries | 1040386_1040537_3_not_null | CHECK | staff IS NOT NULL
public | wage_entries | 1040386_1040537_4_not_null | CHECK | amount IS NOT NULL
public | wage_entries | 1040386_1040537_5_not_null | CHECK | type IS NOT NULL
public | wage_entries | 1040386_1040537_6_not_null | CHECK | salesId IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_1_not_null | CHECK | id IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_2_not_null | CHECK | createdAt IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_3_not_null | CHECK | staff IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_4_not_null | CHECK | amount IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_5_not_null | CHECK | type IS NOT NULL
public | wage_entry_v2 | 1040386_1040782_6_not_null | CHECK | salesId IS NOT NULL

## Sequences
| public | ManagerCheckQuestion_id_seq | integer | 1 | 1 | 2147483647 |
|---|public | cleaning_tasks_id_seq | integer | 1 | 1 | 2147483647
public | dailyReceiptSummaries_id_seq | integer | 1 | 1 | 2147483647
public | dailyShiftAnalysis_id_seq | integer | 1 | 1 | 2147483647
public | daily_stock_sales_id_seq | integer | 1 | 1 | 2147483647
public | ingredients_id_seq | integer | 1 | 1 | 2147483647
public | manager_checklists_id_seq | integer | 1 | 1 | 2147483647
public | recipe_lines_id_seq | bigint | 1 | 1 | 9223372036854775807
public | recipes_id_seq | bigint | 1 | 1 | 9223372036854775807
public | shopping_list_items_id_seq | integer | 1 | 1 | 2147483647
public | stock_items_id_seq | integer | 1 | 1 | 2147483647
public | stock_requests_id_seq | integer | 1 | 1 | 2147483647
public | suppliers_id_seq | integer | 1 | 1 | 2147483647

## Triggers

## Functions and Procedures

## Integrity Sanity Checks

### Tables Without Primary Keys

### Foreign Keys Without Indexes (Performance Risk)
| public | BankTxn | batchId | Missing index on FK column |
|---|public | PosPaymentSummary | batchId | Missing index on FK column
public | PosReceipt | batchId | Missing index on FK column
public | PosSalesItem | batchId | Missing index on FK column
public | PosSalesModifier | batchId | Missing index on FK column
public | ShiftSnapshot | salesFormId | Missing index on FK column
public | other_expense_v2 | salesId | Missing index on FK column
public | other_expenses | salesId | Missing index on FK column
public | recipe_lines | recipe_id | Missing index on FK column
public | shopping_purchase_v2 | salesId | Missing index on FK column
public | shopping_purchases | salesId | Missing index on FK column
public | wage_entries | salesId | Missing index on FK column
public | wage_entry_v2 | salesId | Missing index on FK column

### Tables With Excessive NULL Columns (> 50% nullable)
| public | shopping_list | 25 | 26 | 96.2 |
|---|public | recipes | 24 | 26 | 92.3
public | daily_stock_sales | 39 | 43 | 90.7
public | JussiComparison | 20 | 24 | 83.3
public | ManagerCheckQuestion | 7 | 9 | 77.8
public | ingredients | 18 | 24 | 75.0
public | shopping_list_items | 5 | 7 | 71.4
public | imported_expenses | 10 | 14 | 71.4
public | partner_statements | 9 | 13 | 69.2
public | purchase_tally | 6 | 9 | 66.7
public | analytics_daily | 8 | 12 | 66.7
public | ingestion_errors | 5 | 8 | 62.5
public | PosBatch | 3 | 5 | 60.0
public | ingredient_v2 | 7 | 12 | 58.3

## Database Size Summary
| 16 MB | 6176 kB | 1936 kB |

## Top 10 Largest Tables
| public | receipts | 1696 kB | 1328 kB | 216 kB | 744 |
|---|public | receipt_items | 640 kB | 456 kB | 152 kB | 1490
public | imported_expenses | 552 kB | 456 kB | 56 kB | 464
public | pos_sync_logs | 504 kB | 264 kB | 208 kB | 1669
public | loyverse_receipts | 256 kB | 8192 bytes | 16 kB | 2
public | daily_sales_v2 | 248 kB | 128 kB | 64 kB | 92
public | receipt_payments | 224 kB | 80 kB | 112 kB | 744
public | ingredients | 152 kB | 64 kB | 48 kB | 73
public | expenses | 112 kB | 32 kB | 48 kB | 146
public | loyverse_shifts | 96 kB | 40 kB | 16 kB | 2

## Installed Extensions
| plpgsql | 1.0 |

---

**End of Ground-Zero Schema Report**

Generated by: `make_ground_zero_report.sh`

To regenerate: Ensure PostgreSQL environment variables are set, then run:
```bash
export PGHOST=<host> PGPORT=<port> PGUSER=<user> PGPASSWORD=<password> PGDATABASE=<database>
./make_ground_zero_report.sh
```

