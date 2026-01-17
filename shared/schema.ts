import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, date, varchar, uuid, index, pgEnum, unique, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for Shift Sales
export const shiftTimeEnum = pgEnum('shift_time', ['MORNING', 'EVENING', 'LATE']);
export const salesFormStatusEnum = pgEnum('sales_form_status', ['DRAFT', 'SUBMITTED', 'LOCKED']);

// Enums for Bank Import System
export const bankImportStatusEnum = pgEnum('bank_import_status', ['pending', 'partially_approved', 'approved']);
export const bankTxnStatusEnum = pgEnum('bank_txn_status', ['pending', 'approved', 'rejected', 'deleted']);

// Enums for Expenses Import & Approval System - Golden Patch
export const importedExpenseStatusEnum = pgEnum('imported_expense_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const expenseSourceEnum = pgEnum('expense_source', ['BANK_UPLOAD', 'PARTNER_UPLOAD', 'MANUAL_ENTRY']);

// Enum for External SKU Mapping - Sales Channels
export const salesChannelEnum = pgEnum('sales_channel', ['pos', 'grab', 'foodpanda', 'house', 'other']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Daily Sales table
export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull(),
  ordersCount: integer("orders_count").notNull(),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).notNull(),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }).notNull(),
  staffMember: text("staff_member").notNull(),
});


// Daily Stock Sales table - synced with live database
export const dailyStockSales = pgTable("daily_stock_sales", {
  id: serial("id").primaryKey(),

  // Core fields
  completedBy: text("completed_by").notNull(),
  shiftType: text("shift_type").notNull(),
  shiftDate: timestamp("shift_date").notNull(),

  // Sales Data
  startingCash: decimal("starting_cash", { precision: 10, scale: 2 }),
  endingCash: decimal("ending_cash", { precision: 10, scale: 2 }),
  grabSales: decimal("grab_sales", { precision: 10, scale: 2 }),
  foodPandaSales: decimal("food_panda_sales", { precision: 10, scale: 2 }),
  aroiDeeSales: decimal("aroi_dee_sales", { precision: 10, scale: 2 }),
  qrScanSales: decimal("qr_scan_sales", { precision: 10, scale: 2 }),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }),

  // Expenses
  salaryWages: decimal("salary_wages", { precision: 10, scale: 2 }),
  gasExpense: decimal("gas_expense", { precision: 10, scale: 2 }),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }),
  expenseDescription: text("expense_description"),

  // Stock Tracking
  burgerBunsStock: integer("burger_buns_stock"),
  rollsOrderedCount: integer("rolls_ordered_count"),
  meatWeight: decimal("meat_weight", { precision: 10, scale: 2 }),
  drinkStockCount: integer("drink_stock_count"),

  // JSON Data Blocks
  foodItems: jsonb("food_items"),
  drinkStock: jsonb("drink_stock"),
  kitchenItems: jsonb("kitchen_items"),
  packagingItems: jsonb("packaging_items"),
  freshFood: jsonb("fresh_food"),
  frozenFood: jsonb("frozen_food"),
  shelfItems: jsonb("shelf_items"),
  wageEntries: jsonb("wage_entries"),
  shoppingEntries: jsonb("shopping_entries"),

  // Additional fields from database
  rollsOrderedConfirmed: boolean("rolls_ordered_confirmed"),
  wages: jsonb("wages"),
  bankedAmount: decimal("banked_amount", { precision: 10, scale: 2 }),
  purchasedAmounts: jsonb("purchased_amounts"),
  numberNeeded: jsonb("number_needed"),
  shopping: jsonb("shopping"),
  pdfPath: text("pdf_path"),

  // System fields
  isDraft: boolean("is_draft").default(false),
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  status: text("status"),
  notes: text("notes"),
  discrepancyNotes: text("discrepancy_notes"),
});

// Menu Items table
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }).notNull(),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
  houseSku: text("house_sku").unique(), // House SKU for external mapping
});

// Inventory table
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
});

// Shopping List table (enhanced for v2)
export const shoppingList = pgTable("shopping_list", {
  id: text("id").primaryKey().default('gen_random_uuid()'),
  createdAt: timestamp("created_at").defaultNow(),
  salesFormId: text("sales_form_id"),
  stockFormId: text("stock_form_id"),
  rollsCount: integer("rolls_count").default(0),
  meatWeightGrams: integer("meat_weight_grams").default(0),
  drinksCounts: jsonb("drinks_counts").default('[]'), // [{name, qty}]
  items: jsonb("items").default('[]'), // purchase requests
  totalItems: integer("total_items").default(0),
  // Legacy fields for backwards compatibility
  itemName: varchar("item_name", { length: 255 }),
  quantity: integer("quantity"),
  unit: varchar("unit", { length: 50 }).default('unit'),
  formId: integer("form_id"),
  listDate: timestamp("list_date"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }).default('0'),
  supplier: varchar("supplier", { length: 255 }).default(''),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).default('0'),
  notes: varchar("notes", { length: 255 }).default(''),
  priority: text("priority").default('medium'), // 'high', 'medium', 'low'
  selected: boolean("selected").default(false),
  aiGenerated: boolean("ai_generated").default(false),
  listName: text("list_name"), // Name/title for the shopping list
  isCompleted: boolean("is_completed").default(false), // Mark entire list as completed
  completedAt: timestamp("completed_at"), // When the list was completed
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default('0'), // Actual cost when completed
  updatedAt: timestamp("updated_at").defaultNow(),
});



// Receipts table - Enhanced receipt management system
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  receiptId: text("receipt_id").notNull().unique(), // Unique receipt identifier
  items: jsonb("items").$type<string[]>().notNull(), // List of items purchased
  modifiers: jsonb("modifiers").$type<string[]>().default([]), // Item modifiers/customizations
  total: decimal("total", { precision: 10, scale: 2 }).notNull(), // Final total amount
  timestamp: timestamp("timestamp").notNull(), // When receipt was created
  paymentType: text("payment_type"), // Cash, card, etc.
  netSales: decimal("net_sales", { precision: 10, scale: 2 }), // Sales after discounts
  grossSales: decimal("gross_sales", { precision: 10, scale: 2 }), // Sales before discounts
  discounts: decimal("discounts", { precision: 10, scale: 2 }).default('0'), // Total discount amount
  taxes: decimal("taxes", { precision: 10, scale: 2 }).default('0'), // Tax amount
  shiftDate: date("shift_date"), // Which shift this receipt belongs to
  processed: boolean("processed").default(false), // Whether receipt has been processed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Entry table for tracking stock movements
export const stockEntries = pgTable("stock_entries", {
  id: serial("id").primaryKey(),
  rolls: integer("rolls").notNull().default(0),
  meat: decimal("meat", { precision: 8, scale: 2 }).notNull().default('0'), // Weight in kg
  drinks: integer("drinks").notNull().default(0),
  entryDate: timestamp("entry_date").defaultNow(),
  formId: integer("form_id"), // Reference to Daily Stock Sales form
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});



// Legacy expenses table (renamed to preserve existing data)
export const expensesLegacy = pgTable("expenses_legacy", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurantId"),
  shiftDate: timestamp("shiftDate").notNull(),
  item: text("item").notNull(),
  costCents: integer("costCents").notNull(),
  supplier: text("supplier"),
  expenseType: text("expenseType"),
  meta: jsonb("meta"),
  source: text("source"),
  createdAt: timestamp("createdAt").defaultNow(),
  wages: decimal("wages", { precision: 10, scale: 2 }),
});

// Expense Import Batch table
export const expenseImportBatch = pgTable("expense_import_batch", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // BANK_STATEMENT, CREDIT_CARD, GENERIC
  filename: text("filename").notNull(),
  originalMime: text("original_mime").notNull(),
  rowCount: integer("row_count").notNull(),
  status: text("status").notNull().default('DRAFT'), // DRAFT, REVIEW, COMMITTED, FAILED
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expense Import Line (staging) table
export const expenseImportLine = pgTable("expense_import_line", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => expenseImportBatch.id),
  rowIndex: integer("row_index").notNull(),
  dateRaw: text("date_raw"),
  descriptionRaw: text("description_raw").notNull(),
  amountRaw: text("amount_raw").notNull(),
  currencyRaw: text("currency_raw"),
  parsedOk: boolean("parsed_ok").default(false),
  parseErrors: jsonb("parse_errors"),
  vendorGuess: text("vendor_guess"),
  categoryGuessId: integer("category_guess_id").references(() => categories.id),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.0 to 1.0
  duplicateOfExpenseId: text("duplicate_of_expense_id").references(() => expenses.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  defaultCategoryId: integer("default_category_id").references(() => categories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor Aliases table (for Thai & English variants)
export const vendorAliases = pgTable("vendor_aliases", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  aliasText: text("alias_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // FNB, UTIL, RENT, FUEL, BANK_FEES
  createdAt: timestamp("created_at").defaultNow(),
});

// Expense Suppliers table
export const expenseSuppliers = pgTable("expense_suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expense Categories table
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// New Lookup Tables for Enhanced Expense System
export const expenseTypeLkp = pgTable("expense_type_lkp", {
  id: text("id").primaryKey().default('gen_random_uuid()'),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true),
});

export const supplierLkp = pgTable("supplier_lkp", {
  id: text("id").primaryKey().default('gen_random_uuid()'),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true),
});

// Enhanced Expense Entry table with lookups
export const expenseEntry = pgTable("expense_entry", {
  id: text("id").primaryKey().default('gen_random_uuid()'),
  date: timestamp("date").notNull(),
  typeId: text("type_id").notNull(),
  supplierId: text("supplier_id"),
  label: text("label"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default('0'),
  paid: boolean("paid").default(false),
  method: text("method"),
  reference: text("reference"),
  receiptUrl: text("receipt_url"),
  categoryNote: text("category_note"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dateIdx: index("expense_entry_date_idx").on(table.date),
  typeIdx: index("expense_entry_type_idx").on(table.typeId),
  supplierIdx: index("expense_entry_supplier_idx").on(table.supplierId),
  paidIdx: index("expense_entry_paid_idx").on(table.paid),
}));

// Bank Statements table
export const bankStatements = pgTable("bank_statements", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  fileData: text("file_data").notNull(), // base64 encoded file data
  analysisStatus: text("analysis_status").notNull().default("pending"), // pending, processing, completed, failed
  aiAnalysis: jsonb("ai_analysis").$type<{
    summary: string;
    totalAmount: number;
    transactionCount: number;
    categorizedExpenses: Array<{
      description: string;
      amount: number;
      category: string;
      date: string;
      confidence: number;
    }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  tableNumber: integer("table_number"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  items: jsonb("items").$type<Array<{itemId: number, quantity: number, price: number}>>().notNull(),
  staffMember: text("staff_member").notNull(),
});

// AI Insights table
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'anomaly', 'suggestion', 'alert'
  severity: text("severity").notNull(), // 'low', 'medium', 'high'
  title: text("title").notNull(),
  description: text("description").notNull(),
  data: jsonb("data").$type<Record<string, any>>(),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contactInfo: jsonb("contact_info").$type<{email: string, phone: string, address: string}>().notNull(),
  deliveryTime: text("delivery_time").notNull(),
  status: text("status").notNull(), // 'available', 'unavailable'
});

// Staff Shifts table
export const staffShifts = pgTable("staff_shifts", {
  id: serial("id").primaryKey(),
  staffMember: text("staff_member").notNull(),
  date: timestamp("date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  openingStock: integer("opening_stock").notNull(),
  closingStock: integer("closing_stock").notNull(),
  reportedSales: decimal("reported_sales", { precision: 10, scale: 2 }).notNull(),
});

// Loyverse Receipts table
export const loyverseReceipts = pgTable("loyverse_receipts", {
  id: serial("id").primaryKey(),
  receiptId: text("receipt_id").notNull().unique(),
  receiptNumber: text("receipt_number").notNull(),
  receiptDate: timestamp("receipt_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  customerInfo: jsonb("customer_info"),
  items: jsonb("items").notNull(), // Array of receipt items
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  staffMember: text("staff_member"),
  tableNumber: integer("table_number"),
  shiftDate: timestamp("shift_date").notNull(), // Date of the shift (6pm-3am cycle)
  rawData: jsonb("raw_data"), // Full Loyverse API response
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Loyverse Shift Reports table
export const loyverseShiftReports = pgTable("loyverse_shift_reports", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().unique(),
  shiftDate: timestamp("shift_date").notNull(),
  shiftStart: timestamp("shift_start").notNull(),
  shiftEnd: timestamp("shift_end").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull(),
  totalTransactions: integer("total_transactions").notNull(),
  totalCustomers: integer("total_customers"),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }),
  discounts: decimal("discounts", { precision: 10, scale: 2 }),
  taxes: decimal("taxes", { precision: 10, scale: 2 }),
  staffMembers: jsonb("staff_members"), // Array of staff who worked the shift
  topItems: jsonb("top_items"), // Best selling items for the shift
  reportData: jsonb("report_data").notNull(), // Full shift report data
  completedBy: text("completed_by"), // Staff member who completed the report
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Ingredients table - Enhanced with Full Ingredient Master Patch
// 🔒 PATCH R1: CANONICAL INGREDIENT LAYER
// Recipes calculate ONLY from ingredients (baseUnit + unitCostPerBase)
// Purchasing feeds ingredients ONE-WAY via sync
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(), // Keep existing serial ID for database safety
  name: text("name").notNull(),
  category: text("category"),
  supplier: text("supplier"),
  brand: text("brand"),

  // 🔒 CANONICAL FIELDS (PATCH R1) - Used for recipe cost calculation
  baseUnit: text("base_unit"), // grams | ml | each (canonical unit for recipes)
  unitCostPerBase: decimal("unit_cost_per_base", { precision: 10, scale: 6 }), // cost PER baseUnit (e.g. ฿0.35/gram)
  sourcePurchasingItemId: integer("source_purchasing_item_id"), // link to purchasing_items for sync

  // Purchase (bulk side) - nullable to match DB during backfill
  purchaseQty: decimal("purchase_qty", { precision: 10, scale: 3 }),
  purchaseUnit: text("purchase_unit"),
  purchaseCost: decimal("purchase_cost", { precision: 10, scale: 2 }),

  // Portion (recipe side)
  portionUnit: text("portion_unit"),
  portionsPerPurchase: integer("portions_per_purchase"),
  portionCost: decimal("portion_cost", { precision: 10, scale: 4 }),

  // External mapping for purchasing
  supplierSku: text("supplier_sku"), // Supplier product code (e.g., Makro code)
  supplierBarcode: text("supplier_barcode"), // EAN/UPC barcode

  lastReview: timestamp("last_review").defaultNow(),
  
  // Legacy compatibility fields (kept for migration)
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  packageSize: decimal("package_size", { precision: 10, scale: 2 }),
  portionSize: decimal("portion_size", { precision: 10, scale: 2 }),
  costPerPortion: decimal("cost_per_portion", { precision: 10, scale: 2 }),
  unit: text("unit"),
  notes: text("notes"),
  packagingQty: text("packaging_qty"),
  lastReviewDate: text("last_review_date"),
  source: text("source").default("manual"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").defaultNow(),
  verified: boolean("verified").default(false),
  locked: boolean("locked").default(false),
});

// Recipes table - Market-leading comprehensive recipe management
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Recipe title (e.g., "Smash Burger", "BBQ Sauce")
  description: text("description"), // AI generated for Grab
  category: text("category").notNull(), // Burgers, Side Orders, Sauce, Beverages, Other
  
  // Recipe yield information
  yieldQuantity: decimal("yield_quantity", { precision: 10, scale: 2 }).notNull().default('1'), // How much this recipe makes
  yieldUnit: text("yield_unit").notNull().default('servings'), // kg, litres, pieces, portions, each, etc
  
  // Recipe ingredients with proper measurements
  ingredients: jsonb("ingredients").$type<Array<{
    ingredientId: string;
    portion: number;
    unit: string;
    cost: number;
  }>>().notNull().default(sql`'[]'::jsonb`), // [{ingredientId, portion, unit, cost}]
  
  // Enhanced costing information
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull().default('0'),
  costPerServing: decimal("cost_per_serving", { precision: 10, scale: 2 }).default('0'),
  cogsPercent: decimal("cogs_percent", { precision: 5, scale: 2 }).default('0'), // Cost of Goods Sold %
  suggestedPrice: decimal("suggested_price", { precision: 10, scale: 2 }).default('0'),
  
  // Waste and yield factors
  wasteFactor: decimal("waste_factor", { precision: 3, scale: 2 }).default('0.05'), // Default 5% waste
  yieldEfficiency: decimal("yield_efficiency", { precision: 3, scale: 2 }).default('0.90'), // Default 90% efficiency
  
  // Enhanced recipe details
  imageUrl: text("image_url"), // Uploaded for Grab (800x600)
  instructions: text("instructions"), // Cooking instructions
  notes: text("notes"), // Special instructions
  
  // Enhanced nutritional and allergen info
  allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`), // ['dairy', 'gluten', 'nuts']
  nutritional: jsonb("nutritional").$type<{
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sodium?: number;
  }>().default(sql`'{}'::jsonb`), // {calories: 500, protein: 25}
  
  // Target margin for pricing calculations
  margin: decimal("margin", { precision: 5, scale: 2 }).default('30'), // Target margin %
  
  // Legacy compatibility fields
  totalIngredientCost: decimal("total_ingredient_cost", { precision: 10, scale: 2 }),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  preparationTime: integer("preparation_time"), // in minutes
  servingSize: text("serving_size"), // Description of serving size
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }), // percentage
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  
  // Recipe management
  isActive: boolean("is_active").default(true),
  
  // Version management for recipe cards system
  version: integer("version").default(1), // Recipe version (v1, v2, etc.)
  parentId: integer("parent_id"), // For recipe iterations, references recipes.id
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// Recipe Ingredients junction table
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
});

// Shift-level analytics tables
export const shiftItemSales = pgTable("shift_item_sales", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull(), // Date of the shift (6pm-3am cycle)
  category: text("category").notNull(), // BURGERS, SIDE_ORDERS, DRINKS, BURGER_EXTRAS, OTHER
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  salesTotal: decimal("sales_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const shiftModifierSales = pgTable("shift_modifier_sales", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull(), // Date of the shift (6pm-3am cycle)
  modifierName: text("modifier_name").notNull(),
  quantity: integer("quantity").notNull(),
  salesTotal: decimal("sales_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const shiftSummary = pgTable("shift_summary", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull().unique(), // Date of the shift (6pm-3am cycle)
  burgersSold: integer("burgers_sold").notNull().default(0),
  drinksSold: integer("drinks_sold").notNull().default(0),
  sidesSold: integer("sides_sold").notNull().default(0),
  extrasSold: integer("extras_sold").notNull().default(0),
  otherSold: integer("other_sold").notNull().default(0),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull(),
  totalReceipts: integer("total_receipts").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertDailySalesSchema = createInsertSchema(dailySales).omit({ id: true }).extend({
  isBalanced: z.boolean().optional(),
  discrepancyNotes: z.string().optional(),
});
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertShoppingListSchema = createInsertSchema(shoppingList).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseLegacySchema = createInsertSchema(expensesLegacy).omit({ id: true, createdAt: true }).extend({
  supplier: z.string().nullable().optional(),
  items: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const insertExpenseSupplierSchema = createInsertSchema(expenseSuppliers).omit({ id: true, createdAt: true });
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true, createdAt: true });

// New expense import schemas
export const insertExpenseImportBatchSchema = createInsertSchema(expenseImportBatch).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseImportLineSchema = createInsertSchema(expenseImportLine).omit({ id: true, createdAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const insertVendorAliasSchema = createInsertSchema(vendorAliases).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertStaffShiftSchema = createInsertSchema(staffShifts).omit({ id: true });
export const insertLoyverseReceiptSchema = createInsertSchema(loyverseReceipts).omit({ id: true });
export const insertLoyverseShiftReportSchema = createInsertSchema(loyverseShiftReports).omit({ id: true });
export const insertDailyStockSalesSchema = createInsertSchema(dailyStockSales)
.omit({ id: true })
.extend({
  isBalanced: z.boolean().optional(),
  discrepancyNotes: z.string().optional(),
});
export const insertIngredientSchema = createInsertSchema(ingredients).omit({ id: true, createdAt: true, lastUpdated: true }).extend({
  costPerItem: z.coerce.number().min(0, "Cost per item must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive").optional(),
});
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({ id: true });

// Shift analytics insert schemas  
export const insertShiftItemSalesSchema = createInsertSchema(shiftItemSales).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShiftModifierSalesSchema = createInsertSchema(shiftModifierSales).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShiftSummarySchema = createInsertSchema(shiftSummary).omit({ id: true, createdAt: true, updatedAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DailySales = typeof dailySales.$inferSelect;
export type InsertDailySales = z.infer<typeof insertDailySalesSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type ShoppingList = typeof shoppingList.$inferSelect;
export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type ExpenseLegacy = typeof expensesLegacy.$inferSelect;
export type InsertExpenseLegacy = z.infer<typeof insertExpenseLegacySchema>;
export type ExpenseSupplier = typeof expenseSuppliers.$inferSelect;
export type InsertExpenseSupplier = z.infer<typeof insertExpenseSupplierSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;

// New expense import types

export type ExpenseImportBatch = typeof expenseImportBatch.$inferSelect;
export type InsertExpenseImportBatch = z.infer<typeof insertExpenseImportBatchSchema>;
export type ExpenseImportLine = typeof expenseImportLine.$inferSelect;
export type InsertExpenseImportLine = z.infer<typeof insertExpenseImportLineSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type VendorAlias = typeof vendorAliases.$inferSelect;
export type InsertVendorAlias = z.infer<typeof insertVendorAliasSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type StaffShift = typeof staffShifts.$inferSelect;
export type InsertStaffShift = z.infer<typeof insertStaffShiftSchema>;
export type LoyverseReceipt = typeof loyverseReceipts.$inferSelect;
export type InsertLoyverseReceipt = z.infer<typeof insertLoyverseReceiptSchema>;
export type LoyverseShiftReport = typeof loyverseShiftReports.$inferSelect;
export type InsertLoyverseShiftReport = z.infer<typeof insertLoyverseShiftReportSchema>;
export type DailyStockSales = typeof dailyStockSales.$inferSelect;
export type InsertDailyStockSales = z.infer<typeof insertDailyStockSalesSchema>;
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;

// Shift analytics types
export type ShiftItemSales = typeof shiftItemSales.$inferSelect;
export type InsertShiftItemSales = z.infer<typeof insertShiftItemSalesSchema>;
export type ShiftModifierSales = typeof shiftModifierSales.$inferSelect;
export type InsertShiftModifierSales = z.infer<typeof insertShiftModifierSalesSchema>;
export type ShiftSummary = typeof shiftSummary.$inferSelect;
export type InsertShiftSummary = z.infer<typeof insertShiftSummarySchema>;

// Quick Notes table
export const quickNotes = pgTable("quick_notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  priority: text("priority").notNull(), // 'idea', 'note only', 'implement'
  date: timestamp("date").notNull(),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Marketing Calendar table
export const marketingCalendar = pgTable("marketing_calendar", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventType: text("event_type").notNull(), // 'promotion', 'campaign', 'social_media', 'content', 'other'
  status: text("status").notNull(), // 'upcoming', 'idea', 'in_progress', 'completed'
  googleCalendarId: text("google_calendar_id"), // For Google Calendar sync
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Uploaded Reports table for AI analysis
export const uploadedReports = pgTable("uploaded_reports", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileData: text("file_data").notNull(), // Base64 encoded file data
  shiftDate: timestamp("shift_date").notNull(),
  analysisSummary: jsonb("analysis_summary"),
  compilationSummary: jsonb("compilation_summary"), // Stores items, modifiers, ingredients
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  analyzedAt: timestamp("analyzed_at"),
  isAnalyzed: boolean("is_analyzed").default(false),
});

// Stock Count tables for expense tracking
export const stockPurchaseRolls = pgTable("stock_purchase_rolls", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockPurchaseDrinks = pgTable("stock_purchase_drinks", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull(),
  drinkName: text("drink_name").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockPurchaseMeat = pgTable("stock_purchase_meat", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull(),
  meatType: text("meat_type").notNull(), // 'Topside', 'Chuck', 'Brisket', 'Other'
  weight: decimal("weight", { precision: 8, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 8, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  otherDetails: text("other_details"), // For 'Other' meat type
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertQuickNoteSchema = createInsertSchema(quickNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketingCalendarSchema = createInsertSchema(marketingCalendar).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUploadedReportSchema = createInsertSchema(uploadedReports).omit({ id: true, uploadedAt: true, analyzedAt: true });
export const insertStockPurchaseRollsSchema = createInsertSchema(stockPurchaseRolls).omit({ id: true, createdAt: true });
export const insertStockPurchaseDrinksSchema = createInsertSchema(stockPurchaseDrinks).omit({ id: true, createdAt: true });
export const insertStockPurchaseMeatSchema = createInsertSchema(stockPurchaseMeat).omit({ id: true, createdAt: true });

// ─── NEW TABLE ────────────────────────────────────────────────────────
export const dailyShiftReceiptSummary = pgTable("daily_shift_receipt_summary", {
  id: serial("id").primaryKey(),
  /* shift date is the date that 6 PM belongs to (e.g. 2025-07-12) */
  shiftDate: date("shift_date").notNull().unique(),
  burgersSold: integer("burgers_sold").notNull().default(0),
  drinksSold: integer("drinks_sold").notNull().default(0),
  /* full JSON blobs so we can drill-down later */
  itemsBreakdown: jsonb("items_breakdown")
    .$type<Record<string, { qty: number; sales: number }>>()
    .notNull(),
  modifiersSummary: jsonb("modifiers_summary")
    .$type<Record<string, { qty: number; sales: number }>>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INSERT SCHEMA & TYPES ────────────────────────────────────────────
export const insertDailyShiftReceiptSummarySchema =
  createInsertSchema(dailyShiftReceiptSummary).omit({ id: true, createdAt: true });

export type DailyShiftReceiptSummary =
  typeof dailyShiftReceiptSummary.$inferSelect;
export type InsertDailyShiftReceiptSummary =
  z.infer<typeof insertDailyShiftReceiptSummarySchema>;

// Daily Shift Summary table for burger roll variance tracking
export const dailyShiftSummary = pgTable("daily_shift_summary", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull().unique(), // e.g. 2025-07-11 (5 PM start)
  burgersSold: integer("burgers_sold").notNull(),
  pattiesUsed: integer("patties_used").notNull(),
  rollsStart: integer("rolls_start").notNull(),
  rollsPurchased: integer("rolls_purchased").notNull(),
  rollsExpected: integer("rolls_expected").notNull(),
  rollsActual: integer("rolls_actual").notNull(),
  rollsVariance: integer("rolls_variance").notNull(),
  varianceFlag: boolean("variance_flag").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertDailyShiftSummarySchema = createInsertSchema(dailyShiftSummary);
export type InsertDailyShiftSummary = z.infer<typeof insertDailyShiftSummarySchema>;



// Types
export type QuickNote = typeof quickNotes.$inferSelect;
export type InsertQuickNote = z.infer<typeof insertQuickNoteSchema>;
export type MarketingCalendar = typeof marketingCalendar.$inferSelect;
export type InsertMarketingCalendar = z.infer<typeof insertMarketingCalendarSchema>;
export type UploadedReport = typeof uploadedReports.$inferSelect;
export type InsertUploadedReport = z.infer<typeof insertUploadedReportSchema>;
export type StockPurchaseRolls = typeof stockPurchaseRolls.$inferSelect;
export type InsertStockPurchaseRolls = z.infer<typeof insertStockPurchaseRollsSchema>;
export type StockPurchaseDrinks = typeof stockPurchaseDrinks.$inferSelect;
export type InsertStockPurchaseDrinks = z.infer<typeof insertStockPurchaseDrinksSchema>;
export type StockPurchaseMeat = typeof stockPurchaseMeat.$inferSelect;
export type InsertStockPurchaseMeat = z.infer<typeof insertStockPurchaseMeatSchema>;

// Shift Reports table for automatic daily comparison
export const shiftReports = pgTable('shift_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportDate: date('report_date').notNull(),
  
  // Data availability flags
  hasDailySales: boolean('has_daily_sales').default(false),
  hasShiftReport: boolean('has_shift_report').default(false),
  
  // Raw data storage
  salesData: jsonb('sales_data'),
  shiftData: jsonb('shift_data'),
  
  // Analysis results
  bankingCheck: text('banking_check'), // 'Accurate' | 'Mismatch' | 'Not available'
  anomaliesDetected: text('anomalies_detected').array(),
  shoppingList: jsonb('shopping_list'),
  meatRollsDrinks: jsonb('meat_rolls_drinks'),
  
  // Report management
  pdfUrl: text('pdf_url'),
  status: text('status').default('partial'), // 'complete', 'partial', 'missing', 'manual_review'
  manualReviewNeeded: boolean('manual_review_needed').default(false),
  lastReviewedAt: timestamp('last_reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    reportDateIdx: index('report_date_idx').on(table.reportDate),
  };
});

// Insert schema and types for shift reports
export const insertShiftReportSchema = createInsertSchema(shiftReports).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type ShiftReport = typeof shiftReports.$inferSelect;
export type InsertShiftReport = z.infer<typeof insertShiftReportSchema>;

// Chat logs for agent interactions
export const chatLogs = pgTable('chat_logs', {
  id: serial('id').primaryKey(),
  agentName: varchar('agent_name', { length: 50 }).notNull(),
  userMessage: text('user_message').notNull(),
  agentResponse: text('agent_response').notNull(),
  responseTime: integer('response_time'), // Response time in milliseconds
  createdAt: timestamp('created_at').defaultNow(),
});

// Shopping Master table - CSV-driven stock catalog
export const shoppingMaster = pgTable("shopping_master", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  internalCategory: text("internal_category").notNull(),
  supplier: text("supplier"),
  brand: text("brand"),
  costMinor: integer("cost_minor").notNull(), // cost *100 (THB in satang)
  packagingQty: text("packaging_qty"),
  unitMeasure: text("unit_measure"),
  portionSize: text("portion_size"),
  minStockAmount: text("min_stock_amount"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Shopping Master schema and types
export const insertShoppingMasterSchema = createInsertSchema(shoppingMaster).omit({ 
  id: true, 
  updatedAt: true 
});

export type ShoppingMaster = typeof shoppingMaster.$inferSelect;
export type InsertShoppingMaster = z.infer<typeof insertShoppingMasterSchema>;

export const insertChatLogSchema = createInsertSchema(chatLogs).omit({ 
  id: true, 
  createdAt: true 
});

export type ChatLog = typeof chatLogs.$inferSelect;
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;

// Shift Sales table (Step 1 of 2-step form process)
export const shiftSales = pgTable("shift_sales", {
  id: serial("id").primaryKey(),
  
  // Shift Information
  shiftDate: date("shift_date").notNull(),
  shiftStartUTC: timestamp("shift_start_utc").notNull(),
  shiftEndUTC: timestamp("shift_end_utc").notNull(),
  shiftTime: shiftTimeEnum("shift_time").notNull(),
  completedBy: varchar("completed_by", { length: 64 }).notNull(),
  
  // Money fields in satang (minor units)
  startingCashSatang: integer("starting_cash_satang").notNull(),
  endingCashSatang: integer("ending_cash_satang").notNull(),
  cashBankedSatang: integer("cash_banked_satang").notNull(),
  
  // Sales channels in satang
  cashSatang: integer("cash_satang").notNull().default(0),
  qrSatang: integer("qr_satang").notNull().default(0),
  grabSatang: integer("grab_satang").notNull().default(0),
  aroiDeeSatang: integer("aroi_dee_satang").notNull().default(0),
  cardSatang: integer("card_satang").default(0),
  otherSatang: integer("other_satang").default(0),
  
  // Deductions
  discountsSatang: integer("discounts_satang").default(0),
  refundsSatang: integer("refunds_satang").default(0),
  
  // Other fields
  totalOrders: integer("total_orders"),
  
  // Delivery partner fees (for reconciliation, not P&L)
  grabCommissionSatang: integer("grab_commission_satang").default(0),
  merchantFundedDiscountSatang: integer("merchant_funded_discount_satang").default(0),
  
  // Calculated fields (stored for performance)
  totalShiftPurchasesSatang: integer("total_shift_purchases_satang").default(0),
  
  // Text fields
  notes: text("notes"),
  attachments: jsonb("attachments"),
  
  // Status and admin controls
  status: salesFormStatusEnum("status").default("DRAFT"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by", { length: 64 }),
  dataSource: varchar("data_source", { length: 20 }).default("STAFF_FORM"),
});

// Shift Purchase table (children of shift_sales)
export const shiftPurchases = pgTable("shift_purchases", {
  id: serial("id").primaryKey(),
  shiftSalesId: integer("shift_sales_id").notNull().references(() => shiftSales.id),
  description: text("description").notNull(),
  supplier: text("supplier"),
  amountSatang: integer("amount_satang").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertShiftSalesSchema = createInsertSchema(shiftSales).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertShiftPurchaseSchema = createInsertSchema(shiftPurchases).omit({ 
  id: true, 
  createdAt: true 
});

// Types for new tables
export type ShiftSales = typeof shiftSales.$inferSelect;
export type InsertShiftSales = z.infer<typeof insertShiftSalesSchema>;
export type ShiftPurchase = typeof shiftPurchases.$inferSelect;
export type InsertShiftPurchase = z.infer<typeof insertShiftPurchaseSchema>;

// ✅ Fort Knox Jussi Daily Receipt Summaries - DO NOT MODIFY
export const dailyReceiptSummaries = pgTable("dailyReceiptSummaries", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull().unique(),
  data: jsonb("data").notNull(), // { top5Items, paymentBreakdown, basketBreakdown, ingredientUsage, variances, flags }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDailyReceiptSummarySchema = createInsertSchema(dailyReceiptSummaries).omit({ 
  id: true, 
  createdAt: true 
});

export type DailyReceiptSummary = typeof dailyReceiptSummaries.$inferSelect;
export type InsertDailyReceiptSummary = z.infer<typeof insertDailyReceiptSummarySchema>;

// P&L Finance Tables
export const plRow = pgTable("pl_row", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const plCategoryMap = pgTable("pl_category_map", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  plrowCode: text("plrow_code").notNull().references(() => plRow.code),
});

export const plMonthCache = pgTable("pl_month_cache", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  plrowCode: text("plrow_code").notNull().references(() => plRow.code),
  amountMinor: integer("amount_minor").notNull().default(0),
});

// P&L Schema definitions  
export const insertPLRowSchema = createInsertSchema(plRow);
export const insertPLCategoryMapSchema = createInsertSchema(plCategoryMap);
export const insertPLMonthCacheSchema = createInsertSchema(plMonthCache);

export type PLRow = typeof plRow.$inferSelect;
export type InsertPLRow = z.infer<typeof insertPLRowSchema>;
export type PLCategoryMap = typeof plCategoryMap.$inferSelect;
export type InsertPLCategoryMap = z.infer<typeof insertPLCategoryMapSchema>;
export type PLMonthCache = typeof plMonthCache.$inferSelect;
export type InsertPLMonthCache = z.infer<typeof insertPLMonthCacheSchema>;

// === POS Integration Tables (Start) ===

// Main batch container for POS data imports
export const posBatch = pgTable("pos_batch", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow(),
  title: text("title"),
  shiftStart: timestamp("shift_start"),
  shiftEnd: timestamp("shift_end"),
});

// Individual receipts from POS exports
export const posReceipt = pgTable("pos_receipt", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => posBatch.id),
  receiptId: text("receipt_id").notNull(),
  datetime: timestamp("datetime").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemsJson: jsonb("items_json").default([]), // [{name, qty, price, modifiers:[...]}]
  payment: text("payment"), // "Cash" | "Card" | "QR" | etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Shift summary report from POS
export const posShiftReport = pgTable("pos_shift_report", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().unique().references(() => posBatch.id),
  grossSales: decimal("gross_sales", { precision: 10, scale: 2 }).notNull(),
  discounts: decimal("discounts", { precision: 10, scale: 2 }).notNull(),
  netSales: decimal("net_sales", { precision: 10, scale: 2 }).notNull(),
  cashInDrawer: decimal("cash_in_drawer", { precision: 10, scale: 2 }).notNull(),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).notNull(),
  qrSales: decimal("qr_sales", { precision: 10, scale: 2 }).notNull(),
  otherSales: decimal("other_sales", { precision: 10, scale: 2 }).notNull(),
  receiptCount: integer("receipt_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales breakdown by item from POS
export const posSalesItem = pgTable("pos_sales_item", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => posBatch.id),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  net: decimal("net", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales breakdown by modifier from POS
export const posSalesModifier = pgTable("pos_sales_modifier", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => posBatch.id),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  net: decimal("net", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment method breakdown from POS
export const posPaymentSummary = pgTable("pos_payment_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => posBatch.id),
  method: text("method").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === POS Integration Tables (End) ===

// POS Insert Schemas
export const insertPosBatchSchema = createInsertSchema(posBatch);
export const insertPosReceiptSchema = createInsertSchema(posReceipt);
export const insertPosShiftReportSchema = createInsertSchema(posShiftReport);
export const insertPosSalesItemSchema = createInsertSchema(posSalesItem);
export const insertPosSalesModifierSchema = createInsertSchema(posSalesModifier);
export const insertPosPaymentSummarySchema = createInsertSchema(posPaymentSummary);

// POS Types
export type InsertPosBatch = typeof posBatch.$inferInsert;
export type SelectPosBatch = typeof posBatch.$inferSelect;
export type InsertPosReceipt = typeof posReceipt.$inferInsert;
export type SelectPosReceipt = typeof posReceipt.$inferSelect;
export type InsertPosShiftReport = typeof posShiftReport.$inferInsert;
export type SelectPosShiftReport = typeof posShiftReport.$inferSelect;
export type InsertPosSalesItem = typeof posSalesItem.$inferInsert;
export type SelectPosSalesItem = typeof posSalesItem.$inferSelect;
export type InsertPosSalesModifier = typeof posSalesModifier.$inferInsert;
export type SelectPosSalesModifier = typeof posSalesModifier.$inferSelect;
export type InsertPosPaymentSummary = typeof posPaymentSummary.$inferInsert;
export type SelectPosPaymentSummary = typeof posPaymentSummary.$inferSelect;

// === Purchase Tally Table (Standalone purchase tracking) ===
export const purchaseTally = pgTable("purchase_tally", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  date: date("date").notNull(),
  staff: text("staff"),
  supplier: text("supplier"),
  amountTHB: decimal("amount_thb", { precision: 10, scale: 2 }),
  notes: text("notes"),

  // Purchase quantities
  rollsPcs: integer("rolls_pcs"),
  meatGrams: integer("meat_grams"), 
  // drinksPcs removed - replaced with itemized drinks
});

// Purchase Tally Drinks (itemized by brand)
export const purchaseTallyDrink = pgTable("purchase_tally_drink", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tallyId: varchar("tally_id").notNull().references(() => purchaseTally.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(), // e.g., "Coke 325ml"
  qty: integer("qty").notNull(), // pieces
  unit: text("unit").default("pcs").notNull(),
}, (table) => ({
  tallyIdIdx: index("purchase_tally_drink_tally_id_idx").on(table.tallyId),
  itemNameIdx: index("purchase_tally_drink_item_name_idx").on(table.itemName),
}));

// Purchase Tally insert schema and types
export const insertPurchaseTallySchema = createInsertSchema(purchaseTally);
export const insertPurchaseTallyDrinkSchema = createInsertSchema(purchaseTallyDrink);

export type PurchaseTally = typeof purchaseTally.$inferSelect;
export type PurchaseTallyInsert = typeof purchaseTally.$inferInsert;
export type PurchaseTallyDrink = typeof purchaseTallyDrink.$inferSelect;
export type PurchaseTallyDrinkInsert = typeof purchaseTallyDrink.$inferInsert;

// Drizzle relations for purchase tally
import { relations } from "drizzle-orm";

export const purchaseTallyRelations = relations(purchaseTally, ({ many }) => ({
  drinks: many(purchaseTallyDrink),
}));

export const purchaseTallyDrinkRelations = relations(purchaseTallyDrink, ({ one }) => ({
  tally: one(purchaseTally, {
    fields: [purchaseTallyDrink.tallyId],
    references: [purchaseTally.id],
  }),
}));

// === Bank Import System (CSV bank statement upload & processing) ===

// Bank import batch (one CSV upload creates one batch)
export const bankImportBatch = pgTable("bank_import_batch", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  source: text("source").notNull(), // "KBank", "SCB", "CSV", etc.
  filename: text("filename").notNull(),
  status: bankImportStatusEnum("status").notNull().default('pending'),
});

// Individual bank transactions from CSV
export const bankTxn = pgTable("bank_txn", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => bankImportBatch.id, { onDelete: 'cascade' }),
  
  // Normalized transaction data
  postedAt: timestamp("posted_at").notNull(),
  description: text("description").notNull(),
  amountTHB: decimal("amount_thb", { precision: 12, scale: 2 }).notNull(), // + = outflow (expense), - = inflow/refund
  ref: text("ref"), // bank reference / check number
  raw: jsonb("raw").notNull(), // original CSV row for audit trail
  
  // Review/editing fields
  status: bankTxnStatusEnum("status").notNull().default('pending'),
  category: text("category"), // guessed or user-edited
  supplier: text("supplier"), // guessed or user-edited  
  notes: text("notes"),
  expenseId: varchar("expense_id"), // link to expensesV2 entry once approved
  
  // Deduplication key: source|date|amount|description_prefix
  dedupeKey: text("dedupe_key").notNull().unique(),
});

// Vendor matching rules for smart suggestions
export const vendorRule = pgTable("vendor_rule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  matchText: text("match_text").notNull(), // e.g., "MAKRO", "7-Eleven", "LOTUS" 
  category: text("category").notNull(), // e.g., "Supplies"
  supplier: text("supplier").notNull(), // e.g., "Makro"
});

// Bank Import Insert Schemas
export const insertBankImportBatchSchema = createInsertSchema(bankImportBatch);
export const insertBankTxnSchema = createInsertSchema(bankTxn);
export const insertVendorRuleSchema = createInsertSchema(vendorRule);

// Bank Import Types
export type InsertBankImportBatch = typeof bankImportBatch.$inferInsert;
export type SelectBankImportBatch = typeof bankImportBatch.$inferSelect;
export type InsertBankTxn = typeof bankTxn.$inferInsert;
export type SelectBankTxn = typeof bankTxn.$inferSelect;
export type InsertVendorRule = typeof vendorRule.$inferInsert;
export type SelectVendorRule = typeof vendorRule.$inferSelect;

// Bank Import Relations
export const bankImportBatchRelations = relations(bankImportBatch, ({ many }) => ({
  txns: many(bankTxn),
}));

export const bankTxnRelations = relations(bankTxn, ({ one }) => ({
  batch: one(bankImportBatch, {
    fields: [bankTxn.batchId],
    references: [bankImportBatch.id],
  }),
}));

// === Manager Checklist System ===

// Cleaning Tasks table - stores all possible cleaning tasks
export const cleaningTasks = pgTable("cleaning_tasks", {
  id: serial("id").primaryKey(),
  taskName: text("task_name").notNull(),
  taskDetail: text("task_detail"),
  zone: text("zone").notNull(), // Kitchen, Cashier, Dining, Storage, etc.
  shiftPhase: text("shift_phase").notNull(), // Start, Mid, End
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Manager Checklists table - stores completed checklist records (uses camelCase from Prisma)
export const managerChecklists = pgTable("manager_checklists", {
  id: serial("id").primaryKey(),
  shiftId: text("shiftId").notNull(),
  managerName: text("managerName").notNull(),
  tasksAssigned: jsonb("tasksAssigned").notNull(), // Array of task objects
  tasksCompleted: jsonb("tasksCompleted").notNull(), // Array of completed task objects
  createdAt: timestamp("createdAt").defaultNow(),
  signedAt: timestamp("signedAt").defaultNow(),
});

// === External SKU Mapping System ===
// Maps items/modifiers/ingredients to external channel SKUs (POS, Grab, Foodpanda, etc.)
export const externalSkuMapV2 = pgTable("external_sku_map_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: salesChannelEnum("channel").notNull(), // pos, grab, foodpanda, house, other
  
  // One of these will be set (target entity)
  itemId: integer("item_id"), // Reference to menuItems.id
  modifierId: integer("modifier_id"), // Reference to modifier if exists
  ingredientId: integer("ingredient_id"), // Reference to ingredients.id
  
  // External identifiers
  sku: text("sku"), // External SKU/product code
  externalId: text("external_id"), // External system ID
  barcode: text("barcode"), // EAN/UPC barcode
  variant: text("variant"), // Size/flavor variant code
  
  // Governance
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  effectiveTo: timestamp("effective_to"),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  channelSkuIdx: index("external_sku_map_v2_channel_sku_idx").on(table.channel, table.sku),
  channelExternalIdIdx: index("external_sku_map_v2_channel_external_id_idx").on(table.channel, table.externalId),
  channelBarcodeIdx: index("external_sku_map_v2_channel_barcode_idx").on(table.channel, table.barcode),
  itemIdIdx: index("external_sku_map_v2_item_id_idx").on(table.itemId),
  modifierIdIdx: index("external_sku_map_v2_modifier_id_idx").on(table.modifierId),
  ingredientIdIdx: index("external_sku_map_v2_ingredient_id_idx").on(table.ingredientId),
}));

// === Recipe SKU Mapping (CSV RECIPE MAPPING PATCH) ===
// Simple mapping from external channel SKUs to recipe IDs
export const recipeSkuMap = pgTable("recipe_sku_map", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // LOYVERSE, GRAB, FOODPANDA, etc.
  channelSku: text("channel_sku").notNull(), // External SKU code
  recipeId: integer("recipe_id").notNull(), // Reference to recipes.id
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  channelSkuIdx: index("recipe_sku_map_channel_sku_idx").on(table.channel, table.channelSku),
  recipeIdIdx: index("recipe_sku_map_recipe_id_idx").on(table.recipeId),
}));

export const insertRecipeSkuMapSchema = createInsertSchema(recipeSkuMap).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRecipeSkuMap = z.infer<typeof insertRecipeSkuMapSchema>;
export type SelectRecipeSkuMap = typeof recipeSkuMap.$inferSelect;

// Checklist Assignments table - Fort Knox security for server-side task binding
export const checklistAssignments = pgTable("checklist_assignments", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`), // assignmentId UUID
  shiftId: text("shift_id").notNull(),
  managerName: text("manager_name").notNull(),
  assignedTaskIds: jsonb("assigned_task_ids").notNull(), // Array of task IDs assigned by server
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Assignments expire after a reasonable time
});

// Imported (unapproved) expenses - Golden Patch specification
export const importedExpenses = pgTable("imported_expenses", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id").notNull(),
  date: date("date").notNull(),
  supplier: text("supplier").default("Unknown"),
  category: text("category").default("General"),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(), // always stored in cents
  rawData: jsonb("raw_data"), // original CSV row for debugging
  status: text("status").default("pending"), // pending | approved | rejected
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Approved ledger - Golden Patch specification (EXACT table name as required)
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id").notNull(),
  date: date("date").notNull(),
  supplier: text("supplier").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  source: text("source").default("UPLOAD"), // UPLOAD | SHIFT_FORM | STOCK_LODGMENT
  createdAt: timestamp("created_at").defaultNow(),
});

// Partner Statements table - Golden Patch Partner Analytics (staging only)
export const partnerStatements = pgTable("partner_statements", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id").notNull(),
  partner: text("partner"),
  importBatchId: text("import_batch_id").notNull(),
  statementDate: date("statement_date"),
  grossSalesCents: integer("gross_sales_cents"),
  commissionCents: integer("commission_cents"),
  netPayoutCents: integer("net_payout_cents"),
  rawData: jsonb("raw_data"),
  status: importedExpenseStatusEnum("status").notNull().default('PENDING'),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Supplier Defaults table - stores common biller mappings per restaurant
export const supplierDefaults = pgTable("supplier_defaults", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id").notNull(),
  supplier: text("supplier").notNull(),
  defaultCategory: text("default_category").notNull(),
  notesTemplate: text("notes_template"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loyverse API Integration Tables
export const loyverse_shifts = pgTable('loyverse_shifts', {
  shiftDate: date('shift_date').primaryKey(),
  data: jsonb('data')
});

export const loyverse_receipts = pgTable('loyverse_receipts', {
  shiftDate: date('shift_date').primaryKey(),
  data: jsonb('data')
});

// ✅ Fort Knox: Daily Shift Analysis - DO NOT MODIFY WITHOUT CAM'S APPROVAL
export const dailyShiftAnalysis = pgTable("dailyShiftAnalysis", {
  id: serial("id").primaryKey(),
  shiftDate: date("shift_date").notNull().unique(),
  analysis: jsonb("analysis").notNull(), // structured comparison JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// Manager Checklist Insert Schemas
export const insertCleaningTasksSchema = createInsertSchema(cleaningTasks);
export const insertManagerChecklistsSchema = createInsertSchema(managerChecklists);
export const insertChecklistAssignmentsSchema = createInsertSchema(checklistAssignments);

// Golden Patch Insert Schemas
export const insertImportedExpenseSchema = createInsertSchema(importedExpenses).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertPartnerStatementsSchema = createInsertSchema(partnerStatements).omit({ id: true, createdAt: true });
export const insertSupplierDefaultsSchema = createInsertSchema(supplierDefaults).omit({ id: true, updatedAt: true });

// Manager Checklist Types
export type InsertCleaningTask = typeof cleaningTasks.$inferInsert;
export type SelectCleaningTask = typeof cleaningTasks.$inferSelect;
export type InsertManagerChecklist = typeof managerChecklists.$inferInsert;
export type SelectManagerChecklist = typeof managerChecklists.$inferSelect;

// Golden Patch Types
export type ImportedExpense = typeof importedExpenses.$inferSelect;
export type InsertImportedExpense = z.infer<typeof insertImportedExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type PartnerStatement = typeof partnerStatements.$inferSelect;
export type InsertPartnerStatement = z.infer<typeof insertPartnerStatementsSchema>;
export type SupplierDefault = typeof supplierDefaults.$inferSelect;
export type InsertSupplierDefault = z.infer<typeof insertSupplierDefaultsSchema>;

// --- compat alias for older imports ---
// Note: dailySalesV2 maps to the actual database table daily_sales_v2
export const dailySalesV2 = pgTable("daily_sales_v2", {
  id: text("id").primaryKey(),
  createdAt: timestamp("createdAt"),
  shiftDate: text("shiftDate"),
  submittedAtISO: timestamp("submittedAtISO"),
  completedBy: text("completedBy"),
  startingCash: integer("startingCash"),
  endingCash: integer("endingCash"),
  cashBanked: integer("cashBanked"),
  cashSales: integer("cashSales"),
  qrSales: integer("qrSales"),
  grabSales: integer("grabSales"),
  aroiSales: integer("aroiSales"),
  totalSales: integer("totalSales"),
  shoppingTotal: integer("shoppingTotal"),
  wagesTotal: integer("wagesTotal"),
  othersTotal: integer("othersTotal"),
  totalExpenses: integer("totalExpenses"),
  qrTransfer: integer("qrTransfer"),
  deletedAt: timestamp("deletedAt"),
  staff: text("staff"),
  shift_date: date("shift_date"),
  payload: jsonb("payload"),
});

// Burger Metrics Analytics Tables
export const analyticsShiftBurgerItem = pgTable("analytics_shift_burger_item", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id"),
  shiftDate: date("shift_date").notNull(),
  fromTs: timestamp("from_ts").notNull(),
  toTs: timestamp("to_ts").notNull(),
  normalizedName: text("normalized_name").notNull(),
  qty: integer("qty").notNull().default(0),
  patties: integer("patties").notNull().default(0),
  redMeatG: integer("red_meat_g").notNull().default(0),
  chickenG: integer("chicken_g").notNull().default(0),
  rolls: integer("rolls").notNull().default(0),
  rawHits: jsonb("raw_hits").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const analyticsShiftBurgerSummary = pgTable("analytics_shift_burger_summary", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: text("restaurant_id"),
  shiftDate: date("shift_date").notNull().unique(),
  fromTs: timestamp("from_ts").notNull(),
  toTs: timestamp("to_ts").notNull(),
  burgersTotal: integer("burgers_total").notNull().default(0),
  pattiesTotal: integer("patties_total").notNull().default(0),
  redMeatGTotal: integer("red_meat_g_total").notNull().default(0),
  chickenGTotal: integer("chicken_g_total").notNull().default(0),
  rollsTotal: integer("rolls_total").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Burger Analytics Insert Schemas
export const insertAnalyticsShiftBurgerItemSchema = createInsertSchema(analyticsShiftBurgerItem).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnalyticsShiftBurgerSummarySchema = createInsertSchema(analyticsShiftBurgerSummary).omit({ id: true, createdAt: true, updatedAt: true });

// Burger Analytics Types
export type AnalyticsShiftBurgerItem = typeof analyticsShiftBurgerItem.$inferSelect;
export type InsertAnalyticsShiftBurgerItem = z.infer<typeof insertAnalyticsShiftBurgerItemSchema>;
export type AnalyticsShiftBurgerSummary = typeof analyticsShiftBurgerSummary.$inferSelect;
export type InsertAnalyticsShiftBurgerSummary = z.infer<typeof insertAnalyticsShiftBurgerSummarySchema>;

// Rolls Ledger - Tracks burger bun inventory per shift
export const rollsLedger = pgTable("rolls_ledger", {
  shiftDate: date("shift_date").primaryKey(),
  fromTs: timestamp("from_ts"),
  toTs: timestamp("to_ts"),
  rollsStart: integer("rolls_start").notNull().default(0),
  rollsPurchased: integer("rolls_purchased").notNull().default(0),
  burgersSold: integer("burgers_sold").notNull().default(0),
  estimatedRollsEnd: integer("estimated_rolls_end").notNull().default(0),
  actualRollsEnd: integer("actual_rolls_end"),
  wasteAllowance: integer("waste_allowance"),
  variance: integer("variance").notNull().default(0),
  status: text("status").notNull().default('PENDING'),
  approved: boolean("approved").notNull().default(false),
  sourceStockId: text("source_stock_id"),
  sourceExpenseId: text("source_expense_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRollsLedgerSchema = createInsertSchema(rollsLedger);
export type RollsLedger = typeof rollsLedger.$inferSelect;
export type InsertRollsLedger = z.infer<typeof insertRollsLedgerSchema>;

// Daily Review Manager Comments
export const dailyReviewComments = pgTable("daily_review_comments", {
  id: serial("id").primaryKey(),
  businessDate: date("business_date").notNull().unique(),
  comment: text("comment").notNull(),
  actualAmountBanked: decimal("actual_amount_banked", { precision: 10, scale: 2 }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailyReviewCommentSchema = createInsertSchema(dailyReviewComments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyReviewComment = z.infer<typeof insertDailyReviewCommentSchema>;

// External SKU Mapping Insert Schemas and Types
export const insertExternalSkuMapV2Schema = createInsertSchema(externalSkuMapV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExternalSkuMapV2 = z.infer<typeof insertExternalSkuMapV2Schema>;
export type SelectExternalSkuMapV2 = typeof externalSkuMapV2.$inferSelect;
export type SelectDailyReviewComment = typeof dailyReviewComments.$inferSelect;

// Purchasing Shift Items - Normalized log of quantities per shift per item
export const purchasingShiftItems = pgTable("purchasing_shift_items", {
  id: serial("id").primaryKey(),
  dailyStockId: text("dailyStockId").notNull(),
  purchasingItemId: integer("purchasingItemId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const insertPurchasingShiftItemSchema = createInsertSchema(purchasingShiftItems).omit({ id: true, createdAt: true, updatedAt: true });
export type PurchasingShiftItem = typeof purchasingShiftItems.$inferSelect;
export type InsertPurchasingShiftItem = z.infer<typeof insertPurchasingShiftItemSchema>;

/**
 * 🔒 CANONICAL PURCHASING FLOW (AUTO-SYNC)
 * purchasing_items → Form 2 → purchasing_shift_items → Shopping List
 *
 * RULES:
 * - purchasing_items is the ONLY source of truth
 * - Form 2 auto-loads items (no manual sync)
 * - Shopping List & Shift Log are read-only views
 * - DO NOT duplicate or derive items elsewhere
 */
export const purchasingItems = pgTable("purchasing_items", {
  id: serial("id").primaryKey(),
  item: varchar("item").notNull(),
  category: varchar("category"),
  supplierName: varchar("supplierName"),
  brand: varchar("brand"),
  supplierSku: varchar("supplierSku"),
  orderUnit: varchar("orderUnit"),
  unitDescription: varchar("unitDescription"),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }),
  lastReviewDate: varchar("lastReviewDate"),
  active: boolean("active").notNull().default(true),
  isIngredient: boolean("is_ingredient").notNull().default(false),
  portionUnit: varchar("portion_unit"),
  portionSize: decimal("portion_size", { precision: 10, scale: 3 }),
  yield: decimal("yield", { precision: 5, scale: 2 }),
  // PATCH 1.6.16: Purchase unit quantity - how many base units in one pack (e.g., 2000 for 2kg bag)
  purchaseUnitQty: decimal("purchase_unit_qty", { precision: 10, scale: 2 }),
  // PATCH 1.6.16: Purchase unit label - human-readable pack description
  purchaseUnitLabel: varchar("purchase_unit_label"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Purchasing Field Map - Maps Daily Stock V2 fields to purchasing items
export const purchasingFieldMap = pgTable("purchasing_field_map", {
  id: serial("id").primaryKey(),
  fieldKey: varchar("fieldKey").notNull().unique(), // e.g. "mayoToPurchase"
  purchasingItemId: integer("purchasingItemId").notNull().references(() => purchasingItems.id),
});

// Purchasing Insert Schemas and Types
export const insertPurchasingItemSchema = createInsertSchema(purchasingItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchasingFieldMapSchema = createInsertSchema(purchasingFieldMap).omit({ id: true });

export type PurchasingItem = typeof purchasingItems.$inferSelect;
export type InsertPurchasingItem = z.infer<typeof insertPurchasingItemSchema>;
export type PurchasingFieldMap = typeof purchasingFieldMap.$inferSelect;
export type InsertPurchasingFieldMap = z.infer<typeof insertPurchasingFieldMapSchema>;

// -----------------------------------------------------------------------------
// Shopping List V2 & Purchase Analytics V2
// -----------------------------------------------------------------------------

export const purchaseAnalyticsV2Source = pgEnum('purchase_analytics_v2_source', [
  'requisition',
  'shopping_purchase',
  'stock_logic',
]);

export const shoppingListV2 = pgTable('shopping_list_v2', {
  id: serial('id').primaryKey(),
  shiftDate: text('shiftDate').notNull(),
  dailySalesV2Id: text('daily_sales_v2_id'),
  dailyStockV2Id: text('daily_stock_v2_id'),
  itemsJson: jsonb('items_json'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const purchaseAnalyticsV2 = pgTable('purchase_analytics_v2', {
  id: serial('id').primaryKey(),
  date: date('date'),
  ingredientId: integer('ingredient_id').references(() => ingredients.id),
  itemName: text('item_name'),
  qty: decimal('qty', { precision: 10, scale: 2 }),
  unit: text('unit'),
  source: purchaseAnalyticsV2Source('source'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// Daily Reports V2 — stores the compiled daily report (JSON + reference IDs)
// -----------------------------------------------------------------------------
export const dailyReportsV2 = pgTable('daily_reports_v2', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),                    // shiftDate e.g. 2025-12-08
  salesId: text('sales_id'),                       // FK to dailySalesV2.id
  stockId: text('stock_id'),                       // FK to dailyStockV2.id
  shoppingListId: integer('shopping_list_id'),     // FK to shopping_list_v2.id
  json: jsonb('json').notNull(),                   // full compiled daily summary
  createdAt: timestamp('created_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// Daily Stock V2 — stores end-of-shift stock counts + purchased stock
// -----------------------------------------------------------------------------
export const dailyStockV2 = pgTable('daily_stock_v2', {
  id: serial('id').primaryKey(),
  salesId: text('sales_id'),
  shiftDate: text('shift_date'),

  // Existing fields — end counts
  rollsEnd: integer('rolls_end'),
  meatEndKg: decimal('meat_end_kg', { precision: 10, scale: 2 }),
  drinkStockJson: jsonb('drink_stock_json'),

  // Purchased stock fields (CHUNK 1)
  rollsPurchased: integer('rolls_purchased'),                // units
  meatPurchasedGrams: integer('meat_purchased_grams'),       // stored in grams
  meatPurchasedUnit: text('meat_purchased_unit'),            // "kg" or "g"
  drinksPurchasedJson: jsonb('drinks_purchased_json'),       // { Coke: 24, Sprite: 12, ... }

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// NEW LEDGER TABLE 1: ROLL PURCHASES V2
// -----------------------------------------------------------------------------
export const rollPurchasesV2 = pgTable('roll_purchases_v2', {
  id: serial('id').primaryKey(),
  shiftDate: text('shift_date'),
  salesId: text('sales_id'),
  quantity: integer('quantity'),             // units
  createdAt: timestamp('created_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// NEW LEDGER TABLE 2: MEAT PURCHASES V2
// -----------------------------------------------------------------------------
export const meatPurchasesV2 = pgTable('meat_purchases_v2', {
  id: serial('id').primaryKey(),
  shiftDate: text('shift_date'),
  salesId: text('sales_id'),
  quantityGrams: integer('quantity_grams'),  // stored as grams
  unit: text('unit'),                        // "kg" or "g"
  createdAt: timestamp('created_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// NEW LEDGER TABLE 3: DRINK PURCHASES V2
// -----------------------------------------------------------------------------
export const drinkPurchasesV2 = pgTable('drink_purchases_v2', {
  id: serial('id').primaryKey(),
  shiftDate: text('shift_date'),
  salesId: text('sales_id'),
  sku: text('sku'),                          // "Coke", "Sprite", etc.
  quantity: integer('quantity'),             // units purchased for that SKU
  createdAt: timestamp('created_at').defaultNow(),
});

// -----------------------------------------------------------------------------
// 🔒 FOUNDATION-02: RECIPE AUTHORITY
// Recipe defines how menu items are made and costed
// Ingredients come ONLY from purchasing_items.is_ingredient = true
// -----------------------------------------------------------------------------

export const recipe = pgTable('recipe', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  yieldUnits: decimal('yield_units', { precision: 10, scale: 2 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 🔒 PATCH R1: Recipe ingredients - TRANSITIONAL SCHEMA
// Supports both old (purchasingItemId) and new (ingredientId) systems during migration
// Once migration complete, purchasingItemId + unit columns can be removed
export const recipeIngredient = pgTable('recipe_ingredient', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull().references(() => recipe.id, { onDelete: 'cascade' }),
  // OLD: Purchasing-based (to be deprecated)
  purchasingItemId: integer('purchasing_item_id').references(() => purchasingItems.id),
  quantity: decimal('quantity', { precision: 10, scale: 4 }),
  unit: varchar('unit', { length: 50 }),
  // NEW: Canonical ingredient-based (PATCH R1)
  ingredientId: integer('ingredient_id').references(() => ingredients.id),
  portionQty: decimal('portion_qty', { precision: 10, scale: 4 }), // quantity in ingredient's baseUnit
}, (table) => ({
  // Unique constraint uses whichever ID is present
  uniqueRecipeIngredientOld: unique().on(table.recipeId, table.purchasingItemId),
}));

export const posItemRecipeMap = pgTable('pos_item_recipe_map', {
  id: serial('id').primaryKey(),
  posItemId: varchar('pos_item_id', { length: 255 }).notNull().unique(),
  recipeId: integer('recipe_id').notNull().references(() => recipe.id, { onDelete: 'cascade' }),
});

// FOUNDATION-02 Recipe Insert Schemas and Types
export const insertRecipeV2Schema = createInsertSchema(recipe).omit({ id: true, createdAt: true });
export const insertRecipeIngredientV2Schema = createInsertSchema(recipeIngredient).omit({ id: true });
export const insertPosItemRecipeMapSchema = createInsertSchema(posItemRecipeMap).omit({ id: true });

export type RecipeV2 = typeof recipe.$inferSelect;
export type InsertRecipeV2 = z.infer<typeof insertRecipeV2Schema>;
export type RecipeIngredientV2 = typeof recipeIngredient.$inferSelect;
export type InsertRecipeIngredientV2 = z.infer<typeof insertRecipeIngredientV2Schema>;
export type PosItemRecipeMap = typeof posItemRecipeMap.$inferSelect;
export type InsertPosItemRecipeMap = z.infer<typeof insertPosItemRecipeMapSchema>;

// -----------------------------------------------------------------------------
// 🔒 DERIVED DATA — INGREDIENT USAGE
// DO NOT WRITE MANUALLY
// DO NOT ADD UI
// SOURCE: POS → RECIPES → PURCHASING
// -----------------------------------------------------------------------------

export const ingredientUsage = pgTable('ingredient_usage', {
  id: serial('id').primaryKey(),
  shiftDate: date('shift_date').notNull(),
  receiptId: text('receipt_id').notNull(),
  posItemId: text('pos_item_id').notNull(),
  recipeId: integer('recipe_id').notNull(),
  purchasingItemId: integer('purchasing_item_id').notNull(),
  quantityUsed: decimal('quantity_used', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type IngredientUsage = typeof ingredientUsage.$inferSelect;
export type InsertIngredientUsage = typeof ingredientUsage.$inferInsert;

// -----------------------------------------------------------------------------
// 🔒 PHASE M — RECEIPT BATCH SUMMARY (TRUTH SOURCE)
// Receipts are the single source of truth for all sales data.
// All analysis, reconciliation, and audits must reconcile to this.
// -----------------------------------------------------------------------------

export const receiptBatchSummary = pgTable('receipt_batch_summary', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessDate: date('business_date').notNull().unique(),
  shiftStart: timestamp('shift_start').notNull(),
  shiftEnd: timestamp('shift_end').notNull(),
  receiptCount: integer('receipt_count').notNull(),
  lineItemCount: integer('line_item_count').notNull(),
  grossSales: decimal('gross_sales', { precision: 12, scale: 2 }).notNull(),
  netSales: decimal('net_sales', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const receiptBatchItems = pgTable('receipt_batch_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => receiptBatchSummary.id, { onDelete: 'cascade' }),
  category: text('category'),
  sku: text('sku'),
  itemName: text('item_name'),
  modifiers: text('modifiers'),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  grossSales: decimal('gross_sales', { precision: 12, scale: 2 }).notNull(),
  netSales: decimal('net_sales', { precision: 12, scale: 2 }).notNull(),
});

export const insertReceiptBatchSummarySchema = createInsertSchema(receiptBatchSummary).omit({ id: true, createdAt: true });
export const insertReceiptBatchItemsSchema = createInsertSchema(receiptBatchItems).omit({ id: true });

export type ReceiptBatchSummary = typeof receiptBatchSummary.$inferSelect;
export type InsertReceiptBatchSummary = z.infer<typeof insertReceiptBatchSummarySchema>;
export type ReceiptBatchItems = typeof receiptBatchItems.$inferSelect;
export type InsertReceiptBatchItems = z.infer<typeof insertReceiptBatchItemsSchema>;

// -----------------------------------------------------------------------------
// 🔒 PATCH: SOLD ITEM → RECIPE → INGREDIENT CASCADE
// These tables are DERIVED — only the cascade engine may write here
// DO NOT write from UI — read-only derivation only
// -----------------------------------------------------------------------------

export const soldItemRecipe = pgTable('sold_item_recipe', {
  id: uuid('id').defaultRandom().primaryKey(),
  soldItemId: text('sold_item_id').notNull(),
  recipeId: integer('recipe_id').notNull().references(() => recipe.id),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  soldItemIdx: index('sold_item_recipe_sold_item_idx').on(table.soldItemId),
  recipeIdx: index('sold_item_recipe_recipe_idx').on(table.recipeId),
}));

export const soldItemIngredient = pgTable('sold_item_ingredient', {
  id: uuid('id').defaultRandom().primaryKey(),
  soldItemId: text('sold_item_id').notNull(),
  ingredient: text('ingredient').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  shiftId: text('shift_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  soldItemIdx: index('sold_item_ingredient_sold_item_idx').on(table.soldItemId),
  shiftIdx: index('sold_item_ingredient_shift_idx').on(table.shiftId),
}));

export type SoldItemRecipe = typeof soldItemRecipe.$inferSelect;
export type InsertSoldItemRecipe = typeof soldItemRecipe.$inferInsert;
export type SoldItemIngredient = typeof soldItemIngredient.$inferSelect;
export type InsertSoldItemIngredient = typeof soldItemIngredient.$inferInsert;

// -----------------------------------------------------------------------------
// 🔒 PATCH: INGREDIENT VARIANCE ENGINE
// These tables are DERIVED — only the variance engine may write here
// DO NOT write from UI — read-only derivation only
// -----------------------------------------------------------------------------

export const ingredientExpectedUsage = pgTable('ingredient_expected_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  shiftId: text('shift_id').notNull(),
  ingredient: text('ingredient').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  shiftIdx: index('ingredient_expected_usage_shift_idx').on(table.shiftId),
}));

export const ingredientVariance = pgTable('ingredient_variance', {
  id: uuid('id').defaultRandom().primaryKey(),
  shiftId: text('shift_id').notNull(),
  ingredient: text('ingredient').notNull(),
  expectedQty: decimal('expected_qty', { precision: 12, scale: 4 }).notNull(),
  actualQty: decimal('actual_qty', { precision: 12, scale: 4 }).notNull(),
  varianceQty: decimal('variance_qty', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // OK | WARNING | CRITICAL
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  shiftIdx: index('ingredient_variance_shift_idx').on(table.shiftId),
}));

export type IngredientExpectedUsage = typeof ingredientExpectedUsage.$inferSelect;
export type InsertIngredientExpectedUsage = typeof ingredientExpectedUsage.$inferInsert;
export type IngredientVariance = typeof ingredientVariance.$inferSelect;
export type InsertIngredientVariance = typeof ingredientVariance.$inferInsert;

// -----------------------------------------------------------------------------
// 🔒 PATCH 13: RECEIPT → RECIPE → INGREDIENT TRUTH ENGINE
// Deterministic ingredient usage from receipts with modifier math
// DO NOT WRITE FROM UI — engine-only derivation
// -----------------------------------------------------------------------------

export const modifierIngredientRules = pgTable('modifier_ingredient_rules', {
  id: serial('id').primaryKey(),
  modifierPattern: varchar('modifier_pattern', { length: 255 }).notNull(),
  purchasingItemId: integer('purchasing_item_id').notNull().references(() => purchasingItems.id),
  quantityDelta: decimal('quantity_delta', { precision: 10, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const receiptTruthRun = pgTable('receipt_truth_run', {
  id: serial('id').primaryKey(),
  businessDate: date('business_date').notNull().unique(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  status: varchar('status', { length: 20 }).notNull().default('RUNNING'),
  receiptCount: integer('receipt_count').notNull().default(0),
  lineItemCount: integer('line_item_count').notNull().default(0),
  confidenceScore: integer('confidence_score'),
  notes: text('notes'),
});

export const receiptTruthIngredientUsage = pgTable('receipt_truth_ingredient_usage', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').notNull().references(() => receiptTruthRun.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull(),
  ingredientName: varchar('ingredient_name', { length: 255 }).notNull(),
  quantityUsed: decimal('quantity_used', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  sourceItemCount: integer('source_item_count').notNull().default(0),
  confidence: integer('confidence').notNull().default(100),
});

export const receiptTruthModifierEffect = pgTable('receipt_truth_modifier_effect', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').notNull().references(() => receiptTruthRun.id, { onDelete: 'cascade' }),
  receiptId: text('receipt_id').notNull(),
  posItemName: varchar('pos_item_name', { length: 255 }).notNull(),
  modifierName: varchar('modifier_name', { length: 255 }).notNull(),
  ingredientId: integer('ingredient_id').notNull(),
  ingredientName: varchar('ingredient_name', { length: 255 }).notNull(),
  quantityDelta: decimal('quantity_delta', { precision: 10, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
});

export type ModifierIngredientRule = typeof modifierIngredientRules.$inferSelect;
export type InsertModifierIngredientRule = typeof modifierIngredientRules.$inferInsert;
export type ReceiptTruthRun = typeof receiptTruthRun.$inferSelect;
export type ReceiptTruthIngredientUsage = typeof receiptTruthIngredientUsage.$inferSelect;
export type ReceiptTruthModifierEffect = typeof receiptTruthModifierEffect.$inferSelect;

// -----------------------------------------------------------------------------
// 🔐 PATCH 1.6.18: P&L READ MODEL
// Single source of truth for Profit & Loss calculations
// One row per day — deterministic rebuild from source data
// DO NOT WRITE FROM UI — rebuild service only
// -----------------------------------------------------------------------------

export const pnlReadModel = pgTable("pnl_read_model", {
  date: date("date").primaryKey(),

  grossSales: numeric("gross_sales"),
  discounts: numeric("discounts"),
  refunds: numeric("refunds"),
  netSales: numeric("net_sales"),

  shiftExpenses: numeric("shift_expenses"),
  businessExpenses: numeric("business_expenses"),
  totalExpenses: numeric("total_expenses"),

  grossProfit: numeric("gross_profit"),

  grabGross: numeric("grab_gross"),
  grabNet: numeric("grab_net"),
  grabVariance: numeric("grab_variance"),

  dataStatus: text("data_status"), // OK | PARTIAL | MISSING
  rebuiltAt: timestamp("rebuilt_at").defaultNow(),
});

export type PnlReadModel = typeof pnlReadModel.$inferSelect;
export type InsertPnlReadModel = typeof pnlReadModel.$inferInsert;

// -----------------------------------------------------------------------------
// P&L SNAPSHOT — Canonical Period Summaries with Integrity Checksums
// READ ONLY — DERIVED — NEVER WRITTEN BY UI
// For audit trail and reconciliation
// -----------------------------------------------------------------------------

export const pnlSnapshot = pgTable("pnl_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  revenueTotal: numeric("revenue_total", { precision: 12, scale: 2 }).notNull(),
  expenseTotal: numeric("expense_total", { precision: 12, scale: 2 }).notNull(),
  profitTotal: numeric("profit_total", { precision: 12, scale: 2 }).notNull(),
  
  posReceiptCount: integer("pos_receipt_count").notNull(),
  
  revenueChecksum: text("revenue_checksum").notNull(),
  expenseChecksum: text("expense_checksum").notNull(),
  
  builtAt: timestamp("built_at").defaultNow().notNull(),
});

export type PnlSnapshot = typeof pnlSnapshot.$inferSelect;
export type InsertPnlSnapshot = typeof pnlSnapshot.$inferInsert;

// -----------------------------------------------------------------------------
// MENU MANAGEMENT — Single Source of Truth for Online Ordering
// Links recipes to menu items with price control and image support
// -----------------------------------------------------------------------------

export const menuItemV3 = pgTable("menu_item_v3", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  name: text("name").notNull(),
  category: text("category").notNull(), // burgers | sides | drinks | deals
  
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  
  isActive: boolean("is_active").default(true).notNull(),
  isOnlineEnabled: boolean("is_online_enabled").default(false).notNull(),
  
  imageUrl: text("image_url"), // stored path / CDN URL
  description: text("description"),
  
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const menuItemRecipe = pgTable("menu_item_recipe", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItemV3.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").notNull().references(() => recipe.id, { onDelete: "cascade" }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMenuItemV3Schema = createInsertSchema(menuItemV3).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMenuItemRecipeSchema = createInsertSchema(menuItemRecipe).omit({ id: true, createdAt: true });

export type MenuItemV3 = typeof menuItemV3.$inferSelect;
export type InsertMenuItemV3 = z.infer<typeof insertMenuItemV3Schema>;
export type MenuItemRecipe = typeof menuItemRecipe.$inferSelect;
export type InsertMenuItemRecipe = z.infer<typeof insertMenuItemRecipeSchema>;

// -----------------------------------------------------------------------------
// MODIFIERS SYSTEM — Groups + Ingredient Deltas
// Modifiers only apply via ingredient deltas, never edit recipes
// -----------------------------------------------------------------------------

export const modifierGroup = pgTable("modifier_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g. "Burger Extras"
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItemV3.id, { onDelete: "cascade" }),
  
  isRequired: boolean("is_required").default(false).notNull(),
  minSelect: integer("min_select").default(0).notNull(),
  maxSelect: integer("max_select").default(1).notNull(),
  
  displayOrder: integer("display_order").default(0).notNull(),
});

export const modifier = pgTable("modifier", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  modifierGroupId: uuid("modifier_group_id").notNull().references(() => modifierGroup.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Extra Cheese"
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).default("0").notNull(),
  
  displayOrder: integer("display_order").default(0).notNull(),
});

export const modifierIngredient = pgTable("modifier_ingredient", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  modifierId: uuid("modifier_id").notNull().references(() => modifier.id, { onDelete: "cascade" }),
  purchasingItemId: uuid("purchasing_item_id").notNull(),
  
  deltaQty: numeric("delta_qty", { precision: 10, scale: 4 }).notNull(),
  deltaUnit: text("delta_unit").notNull(), // grams | ml | each
});

export const insertModifierGroupSchema = createInsertSchema(modifierGroup).omit({ id: true });
export const insertModifierSchema = createInsertSchema(modifier).omit({ id: true });
export const insertModifierIngredientSchema = createInsertSchema(modifierIngredient).omit({ id: true });

export type ModifierGroup = typeof modifierGroup.$inferSelect;
export type InsertModifierGroup = z.infer<typeof insertModifierGroupSchema>;
export type Modifier = typeof modifier.$inferSelect;
export type InsertModifier = z.infer<typeof insertModifierSchema>;
export type ModifierIngredient = typeof modifierIngredient.$inferSelect;
export type InsertModifierIngredient = z.infer<typeof insertModifierIngredientSchema>;

// -----------------------------------------------------------------------------
// PATCH P1 — PRODUCT CORE
// Products = sellable items with multi-channel pricing and ingredient-based costing
// -----------------------------------------------------------------------------

export const productChannelEnum = pgEnum('product_channel', ['IN_STORE', 'GRAB', 'ONLINE']);

export const product = pgTable("product", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productMenu = pgTable("product_menu", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  category: text("category"),
  sortOrder: integer("sort_order").default(0).notNull(),
  visibleInStore: boolean("visible_in_store").default(false).notNull(),
  visibleGrab: boolean("visible_grab").default(false).notNull(),
  visibleOnline: boolean("visible_online").default(false).notNull(),
});

export const productRecipe = pgTable("product_recipe", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").notNull().references(() => recipe.id, { onDelete: "cascade" }),
});

export const productIngredient = pgTable("product_ingredient", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  ingredientId: integer("ingredient_id").notNull(),
  portionQty: numeric("portion_qty", { precision: 10, scale: 4 }).notNull(),
});

export const productPrice = pgTable("product_price", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  channel: text("channel").notNull(), // IN_STORE | GRAB | ONLINE
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertProductSchema = createInsertSchema(product).omit({ id: true, createdAt: true });
export const insertProductMenuSchema = createInsertSchema(productMenu).omit({ id: true });
export const insertProductRecipeSchema = createInsertSchema(productRecipe).omit({ id: true });
export const insertProductIngredientSchema = createInsertSchema(productIngredient).omit({ id: true });
export const insertProductPriceSchema = createInsertSchema(productPrice).omit({ id: true });

export type Product = typeof product.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductMenu = typeof productMenu.$inferSelect;
export type InsertProductMenu = z.infer<typeof insertProductMenuSchema>;
export type ProductRecipe = typeof productRecipe.$inferSelect;
export type InsertProductRecipe = z.infer<typeof insertProductRecipeSchema>;
export type ProductIngredient = typeof productIngredient.$inferSelect;
export type InsertProductIngredient = z.infer<typeof insertProductIngredientSchema>;
export type ProductPrice = typeof productPrice.$inferSelect;
export type InsertProductPrice = z.infer<typeof insertProductPriceSchema>;
