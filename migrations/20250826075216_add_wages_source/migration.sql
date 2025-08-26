-- CreateEnum
CREATE TYPE "public"."POSProvider" AS ENUM ('LOYVERSE', 'TOAST', 'SQUARE', 'LIGHTSPEED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ExpenseType" AS ENUM ('GENERAL', 'PURCHASE', 'WAGE');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'QR', 'WALLET', 'DELIVERY_PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SalesChannel" AS ENUM ('IN_STORE', 'GRAB', 'FOODPANDA', 'LINE_MAN', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('POS_BACKFILL', 'POS_INCREMENTAL_SYNC', 'ANALYTICS_DAILY', 'EMAIL_SUMMARY');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "public"."Provider" AS ENUM ('LOYVERSE');

-- CreateEnum
CREATE TYPE "public"."PaymentChannel" AS ENUM ('CASH', 'QR', 'CARD', 'GRAB', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReconcileState" AS ENUM ('OK', 'MISMATCH', 'MISSING_DATA');

-- CreateEnum
CREATE TYPE "public"."MenuSource" AS ENUM ('house', 'pos', 'grab', 'foodpanda', 'other');

-- CreateTable
CREATE TABLE "public"."DailySales" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shiftDate" TEXT NOT NULL,
    "submittedAtISO" TIMESTAMP(3),
    "completedBy" TEXT NOT NULL,
    "startingCash" INTEGER NOT NULL DEFAULT 0,
    "endingCash" INTEGER NOT NULL DEFAULT 0,
    "cashBanked" INTEGER NOT NULL DEFAULT 0,
    "cashSales" INTEGER NOT NULL DEFAULT 0,
    "qrSales" INTEGER NOT NULL DEFAULT 0,
    "grabSales" INTEGER NOT NULL DEFAULT 0,
    "aroiSales" INTEGER NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "shoppingTotal" INTEGER NOT NULL DEFAULT 0,
    "wagesTotal" INTEGER NOT NULL DEFAULT 0,
    "othersTotal" INTEGER NOT NULL DEFAULT 0,
    "totalExpenses" INTEGER NOT NULL DEFAULT 0,
    "closingCash" INTEGER NOT NULL DEFAULT 0,
    "qrTransfer" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DailySales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shopping_purchases" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "shop" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "shopping_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wage_entries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "wage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_expenses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "other_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyStock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "salesId" TEXT NOT NULL,
    "burgerBuns" INTEGER NOT NULL DEFAULT 0,
    "meatWeightG" INTEGER NOT NULL DEFAULT 0,
    "drinksJson" JSONB,
    "notes" TEXT,
    "purchasingJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "deletedAt" TIMESTAMP(3),
    "bunsCount" INTEGER NOT NULL DEFAULT 0,
    "meatGrams" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "locale" TEXT NOT NULL DEFAULT 'en-TH',
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pos_connections" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" "public"."POSProvider" NOT NULL,
    "apiKey" TEXT,
    "refreshToken" TEXT,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipts" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" "public"."POSProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "channel" "public"."SalesChannel" NOT NULL DEFAULT 'OTHER',
    "createdAtUTC" TIMESTAMP(3) NOT NULL,
    "closedAtUTC" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "notes" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "providerItemId" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "modifiers" JSONB,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipt_payments" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "amount" INTEGER NOT NULL,
    "meta" JSONB,

    CONSTRAINT "receipt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_items" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "portionGrams" INTEGER,
    "isDrink" BOOLEAN NOT NULL DEFAULT false,
    "isBurger" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "item" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "supplier" TEXT,
    "expenseType" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExpenseLine" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION,
    "uom" TEXT,
    "unitPriceTHB" DECIMAL(12,4),
    "lineTotalTHB" DECIMAL(12,2),
    "type" "public"."ExpenseType" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_daily" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "top5ByQty" JSONB,
    "top5ByRevenue" JSONB,
    "expectedBunsUsed" INTEGER,
    "expectedMeatGrams" INTEGER,
    "expectedDrinksUsed" INTEGER,
    "variance" JSONB,
    "shoppingList" JSONB,
    "flags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "type" "public"."JobType" NOT NULL,
    "payload" JSONB,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'QUEUED',
    "runAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pos_sync_logs" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" "public"."POSProvider" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "receiptsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsUpserted" INTEGER NOT NULL DEFAULT 0,
    "paymentsUpserted" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingestion_errors" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "provider" "public"."POSProvider",
    "externalId" TEXT,
    "context" TEXT,
    "errorMessage" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShiftSnapshot" (
    "id" TEXT NOT NULL,
    "provider" "public"."Provider" NOT NULL DEFAULT 'LOYVERSE',
    "windowStartUTC" TIMESTAMP(3) NOT NULL,
    "windowEndUTC" TIMESTAMP(3) NOT NULL,
    "loyverseShiftNumber" INTEGER,
    "salesFormId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalReceipts" INTEGER NOT NULL DEFAULT 0,
    "totalSalesSatang" BIGINT NOT NULL DEFAULT 0,
    "reconcileState" "public"."ReconcileState" NOT NULL DEFAULT 'MISSING_DATA',
    "reconcileNotes" TEXT,

    CONSTRAINT "ShiftSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentBreakdown" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "channel" "public"."PaymentChannel" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "totalSatang" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnapshotItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "revenueSatang" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnapshotModifier" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "modifierName" TEXT NOT NULL,
    "lines" INTEGER NOT NULL DEFAULT 0,
    "revenueSatang" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SnapshotModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentMethodMap" (
    "id" TEXT NOT NULL,
    "provider" "public"."Provider" NOT NULL DEFAULT 'LOYVERSE',
    "sourceName" TEXT NOT NULL,
    "channel" "public"."PaymentChannel" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecipeItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "isMealDeal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecipeComponent" (
    "id" TEXT NOT NULL,
    "recipeItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "baseQty" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,

    CONSTRAINT "RecipeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JussiComparison" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "salesFormId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingBuns" INTEGER,
    "openingMeatGram" INTEGER,
    "openingDrinks" INTEGER,
    "purchasedBuns" INTEGER,
    "purchasedMeatGram" INTEGER,
    "purchasedDrinks" INTEGER,
    "expectedBuns" INTEGER,
    "expectedMeatGram" INTEGER,
    "expectedDrinks" INTEGER,
    "expectedCloseBuns" INTEGER,
    "expectedCloseMeatGram" INTEGER,
    "expectedCloseDrinks" INTEGER,
    "staffBuns" INTEGER,
    "staffMeatGram" INTEGER,
    "staffDrinks" INTEGER,
    "varBuns" INTEGER,
    "varMeatGram" INTEGER,
    "varDrinks" INTEGER,
    "state" "public"."ReconcileState" NOT NULL DEFAULT 'MISSING_DATA',
    "notes" TEXT,

    CONSTRAINT "JussiComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_sales_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftDate" TEXT NOT NULL,
    "submittedAtISO" TIMESTAMP(3) NOT NULL,
    "completedBy" TEXT NOT NULL,
    "startingCash" INTEGER NOT NULL DEFAULT 0,
    "endingCash" INTEGER NOT NULL DEFAULT 0,
    "cashBanked" INTEGER NOT NULL DEFAULT 0,
    "cashSales" INTEGER NOT NULL DEFAULT 0,
    "qrSales" INTEGER NOT NULL DEFAULT 0,
    "grabSales" INTEGER NOT NULL DEFAULT 0,
    "aroiSales" INTEGER NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "shoppingTotal" INTEGER NOT NULL DEFAULT 0,
    "wagesTotal" INTEGER NOT NULL DEFAULT 0,
    "othersTotal" INTEGER NOT NULL DEFAULT 0,
    "totalExpenses" INTEGER NOT NULL DEFAULT 0,
    "qrTransfer" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "daily_sales_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shopping_purchase_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "shop" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "shopping_purchase_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wage_entry_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "wage_entry_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."other_expense_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "salesId" TEXT NOT NULL,

    CONSTRAINT "other_expense_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_stock_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salesId" TEXT NOT NULL,
    "burgerBuns" INTEGER NOT NULL DEFAULT 0,
    "meatWeightG" INTEGER NOT NULL DEFAULT 0,
    "drinksJson" JSONB,
    "purchasingJson" JSONB,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "daily_stock_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredient_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "notes" TEXT,

    CONSTRAINT "ingredient_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipe_v2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "yield" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "targetMargin" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipe_item_v2" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_item_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_v2" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "public"."MenuSource" NOT NULL,
    "fileType" TEXT NOT NULL,
    "version" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "menu_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_item_v2" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "basePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_item_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_modifier_v2" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "groupName" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "menu_modifier_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isDrink" BOOLEAN NOT NULL DEFAULT false,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_requests" (
    "id" SERIAL NOT NULL,
    "shiftId" TEXT NOT NULL,
    "stockItemId" INTEGER NOT NULL,
    "requestedQty" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "shiftStart" TIMESTAMP(3),
    "shiftEnd" TIMESTAMP(3),

    CONSTRAINT "PosBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosReceipt" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "payment" TEXT,

    CONSTRAINT "PosReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosShiftReport" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "grossSales" DECIMAL(10,2) NOT NULL,
    "discounts" DECIMAL(10,2) NOT NULL,
    "netSales" DECIMAL(10,2) NOT NULL,
    "cashInDrawer" DECIMAL(10,2) NOT NULL,
    "cashSales" DECIMAL(10,2) NOT NULL,
    "qrSales" DECIMAL(10,2) NOT NULL,
    "otherSales" DECIMAL(10,2) NOT NULL,
    "receiptCount" INTEGER NOT NULL,

    CONSTRAINT "PosShiftReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosSalesItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "net" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosSalesItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosSalesModifier" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "net" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosSalesModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PosPaymentSummary" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosPaymentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankImportBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BankImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankTxn" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountTHB" DECIMAL(12,2) NOT NULL,
    "ref" TEXT,
    "raw" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "category" TEXT,
    "supplier" TEXT,
    "notes" TEXT,
    "expenseId" TEXT,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "BankTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VendorRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,

    CONSTRAINT "VendorRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStock_salesId_key" ON "public"."DailyStock"("salesId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "public"."restaurants"("slug");

-- CreateIndex
CREATE INDEX "pos_connections_restaurantId_idx" ON "public"."pos_connections"("restaurantId");

-- CreateIndex
CREATE INDEX "pos_connections_provider_isActive_idx" ON "public"."pos_connections"("provider", "isActive");

-- CreateIndex
CREATE INDEX "receipts_restaurantId_createdAtUTC_idx" ON "public"."receipts"("restaurantId", "createdAtUTC");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_restaurantId_provider_externalId_key" ON "public"."receipts"("restaurantId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "receipt_items_receiptId_idx" ON "public"."receipt_items"("receiptId");

-- CreateIndex
CREATE INDEX "receipt_payments_receiptId_idx" ON "public"."receipt_payments"("receiptId");

-- CreateIndex
CREATE INDEX "menu_items_restaurantId_category_idx" ON "public"."menu_items"("restaurantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_restaurantId_sku_key" ON "public"."menu_items"("restaurantId", "sku");

-- CreateIndex
CREATE INDEX "expenses_restaurantId_shiftDate_idx" ON "public"."expenses"("restaurantId", "shiftDate");

-- CreateIndex
CREATE INDEX "ExpenseLine_ingredientId_idx" ON "public"."ExpenseLine"("ingredientId");

-- CreateIndex
CREATE INDEX "analytics_daily_restaurantId_shiftDate_idx" ON "public"."analytics_daily"("restaurantId", "shiftDate");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_restaurantId_shiftDate_key" ON "public"."analytics_daily"("restaurantId", "shiftDate");

-- CreateIndex
CREATE INDEX "jobs_status_runAt_idx" ON "public"."jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "jobs_restaurantId_idx" ON "public"."jobs"("restaurantId");

-- CreateIndex
CREATE INDEX "pos_sync_logs_restaurantId_provider_startedAt_idx" ON "public"."pos_sync_logs"("restaurantId", "provider", "startedAt");

-- CreateIndex
CREATE INDEX "ingestion_errors_restaurantId_provider_createdAt_idx" ON "public"."ingestion_errors"("restaurantId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftSnapshot_windowStartUTC_windowEndUTC_idx" ON "public"."ShiftSnapshot"("windowStartUTC", "windowEndUTC");

-- CreateIndex
CREATE INDEX "PaymentBreakdown_snapshotId_idx" ON "public"."PaymentBreakdown"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBreakdown_snapshotId_channel_key" ON "public"."PaymentBreakdown"("snapshotId", "channel");

-- CreateIndex
CREATE INDEX "SnapshotItem_snapshotId_idx" ON "public"."SnapshotItem"("snapshotId");

-- CreateIndex
CREATE INDEX "SnapshotModifier_snapshotId_idx" ON "public"."SnapshotModifier"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodMap_provider_sourceName_key" ON "public"."PaymentMethodMap"("provider", "sourceName");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_sku_key" ON "public"."RecipeItem"("sku");

-- CreateIndex
CREATE INDEX "RecipeComponent_recipeItemId_idx" ON "public"."RecipeComponent"("recipeItemId");

-- CreateIndex
CREATE INDEX "JussiComparison_snapshotId_idx" ON "public"."JussiComparison"("snapshotId");

-- CreateIndex
CREATE INDEX "JussiComparison_salesFormId_idx" ON "public"."JussiComparison"("salesFormId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stock_v2_salesId_key" ON "public"."daily_stock_v2"("salesId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_v2_name_key" ON "public"."ingredient_v2"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_v2_name_key" ON "public"."recipe_v2"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_item_v2_recipeId_ingredientId_key" ON "public"."recipe_item_v2"("recipeId", "ingredientId");

-- CreateIndex
CREATE INDEX "menu_v2_source_idx" ON "public"."menu_v2"("source");

-- CreateIndex
CREATE INDEX "menu_item_v2_name_idx" ON "public"."menu_item_v2"("name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_v2_menuId_name_key" ON "public"."menu_item_v2"("menuId", "name");

-- CreateIndex
CREATE INDEX "menu_modifier_v2_itemId_idx" ON "public"."menu_modifier_v2"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_requests_shiftId_stockItemId_key" ON "public"."stock_requests"("shiftId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PosShiftReport_batchId_key" ON "public"."PosShiftReport"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTxn_dedupeKey_key" ON "public"."BankTxn"("dedupeKey");

-- AddForeignKey
ALTER TABLE "public"."shopping_purchases" ADD CONSTRAINT "shopping_purchases_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."DailySales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wage_entries" ADD CONSTRAINT "wage_entries_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."DailySales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_expenses" ADD CONSTRAINT "other_expenses_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."DailySales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyStock" ADD CONSTRAINT "DailyStock_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."DailySales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pos_connections" ADD CONSTRAINT "pos_connections_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipt_items" ADD CONSTRAINT "receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipt_payments" ADD CONSTRAINT "receipt_payments_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_daily" ADD CONSTRAINT "analytics_daily_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingestion_errors" ADD CONSTRAINT "ingestion_errors_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSnapshot" ADD CONSTRAINT "ShiftSnapshot_salesFormId_fkey" FOREIGN KEY ("salesFormId") REFERENCES "public"."DailySales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentBreakdown" ADD CONSTRAINT "PaymentBreakdown_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."ShiftSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnapshotItem" ADD CONSTRAINT "SnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."ShiftSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnapshotModifier" ADD CONSTRAINT "SnapshotModifier_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."ShiftSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeComponent" ADD CONSTRAINT "RecipeComponent_recipeItemId_fkey" FOREIGN KEY ("recipeItemId") REFERENCES "public"."RecipeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JussiComparison" ADD CONSTRAINT "JussiComparison_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."ShiftSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JussiComparison" ADD CONSTRAINT "JussiComparison_salesFormId_fkey" FOREIGN KEY ("salesFormId") REFERENCES "public"."DailySales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shopping_purchase_v2" ADD CONSTRAINT "shopping_purchase_v2_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."daily_sales_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wage_entry_v2" ADD CONSTRAINT "wage_entry_v2_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."daily_sales_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_expense_v2" ADD CONSTRAINT "other_expense_v2_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."daily_sales_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_stock_v2" ADD CONSTRAINT "daily_stock_v2_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."daily_sales_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_item_v2" ADD CONSTRAINT "recipe_item_v2_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "public"."recipe_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_item_v2" ADD CONSTRAINT "recipe_item_v2_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "public"."ingredient_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_item_v2" ADD CONSTRAINT "menu_item_v2_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "public"."menu_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_modifier_v2" ADD CONSTRAINT "menu_modifier_v2_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."menu_item_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_requests" ADD CONSTRAINT "stock_requests_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "public"."stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PosReceipt" ADD CONSTRAINT "PosReceipt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PosBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PosShiftReport" ADD CONSTRAINT "PosShiftReport_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PosBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PosSalesItem" ADD CONSTRAINT "PosSalesItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PosBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PosSalesModifier" ADD CONSTRAINT "PosSalesModifier_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PosBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PosPaymentSummary" ADD CONSTRAINT "PosPaymentSummary_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PosBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankTxn" ADD CONSTRAINT "BankTxn_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."BankImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
