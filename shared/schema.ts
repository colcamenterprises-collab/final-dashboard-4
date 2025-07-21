import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Menu Items table
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }).notNull(),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
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

// Shopping List table
export const shoppingList = pgTable("shopping_list", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  supplier: text("supplier").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 2 }).notNull(),
  priority: text("priority").notNull(), // 'high', 'medium', 'low'
  selected: boolean("selected").default(false),
  aiGenerated: boolean("ai_generated").default(false),
  // Enhanced shopping list functionality
  listDate: timestamp("list_date").defaultNow(), // Date when shopping list was generated
  formId: integer("form_id"), // Reference to Daily Stock Sales form that generated this list
  listName: text("list_name"), // Name/title for the shopping list
  isCompleted: boolean("is_completed").default(false), // Mark entire list as completed
  completedAt: timestamp("completed_at"), // When the list was completed
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }).default('0'), // Estimated cost based on ingredient prices
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default('0'), // Actual cost when completed
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



// Expenses table
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default('0'), // For rolls/drinks quantity tracking
  paymentMethod: text("payment_method").notNull(),
  supplier: text("supplier"),
  items: text("items"),
  notes: text("notes"),
  month: integer("month").notNull(), // For month-by-month analysis
  year: integer("year").notNull(),
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

// Daily Stock and Sales Form table
export const dailyStockSales = pgTable("daily_stock_sales", {
  id: serial("id").primaryKey(),
  completedBy: text("completed_by").notNull(),
  shiftType: text("shift_type").notNull(), // Night Shift, Day Shift
  shiftDate: timestamp("shift_date").notNull(),
  
  // Cash Management - Optional
  startingCash: decimal("starting_cash", { precision: 10, scale: 2 }).default('0'),
  endingCash: decimal("ending_cash", { precision: 10, scale: 2 }).default('0'),
  
  // Sales Data - Optional
  grabSales: decimal("grab_sales", { precision: 10, scale: 2 }).default('0'),
  foodPandaSales: decimal("food_panda_sales", { precision: 10, scale: 2 }).default('0'),
  aroiDeeSales: decimal("aroi_dee_sales", { precision: 10, scale: 2 }).default('0'),
  qrScanSales: decimal("qr_scan_sales", { precision: 10, scale: 2 }).default('0'),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).default('0'),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default('0'),
  
  // Expenses - Optional
  salaryWages: decimal("salary_wages", { precision: 10, scale: 2 }).default('0'),
  shopping: decimal("shopping", { precision: 10, scale: 2 }).default('0'),
  gasExpense: decimal("gas_expense", { precision: 10, scale: 2 }).default('0'),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }).default('0'),
  wageEntries: jsonb("wage_entries").notNull().default('[]'), // Array of {name, amount, notes}
  shoppingEntries: jsonb("shopping_entries").notNull().default('[]'), // Array of {item, amount, notes, shop, customShop}
  expenseDescription: text("expense_description"),
  
  // Stock Counts - Optional
  burgerBunsStock: integer("burger_buns_stock").default(0),
  rollsOrderedCount: integer("rolls_ordered_count").default(0),
  meatWeight: decimal("meat_weight", { precision: 10, scale: 2 }).default('0'), // in kg
  drinkStockCount: integer("drink_stock_count").default(0),
  
  // Food Items Required - Optional
  freshFood: jsonb("fresh_food").notNull().default('{}'), // Fresh food items (Salad, Tomatos, etc.) with otherItems array
  frozenFood: jsonb("frozen_food").notNull().default('{}'), // Frozen food items (Bacon, Cheese, etc.)
  shelfItems: jsonb("shelf_items").notNull().default('{}'), // Shelf stable items
  
  // Keep existing food items for backward compatibility - Optional
  foodItems: jsonb("food_items").notNull().default('{}'), // Contains all food item requirements
  drinkStock: jsonb("drink_stock").notNull().default('{}'), // Current drink inventory
  kitchenItems: jsonb("kitchen_items").notNull().default('{}'),
  packagingItems: jsonb("packaging_items").notNull().default('{}'),
  
  // Confirmation - Optional
  rollsOrderedConfirmed: boolean("rolls_ordered_confirmed").default(false),
  

  
  // Draft status
  isDraft: boolean("is_draft").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Ingredients table
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  supplier: text("supplier").notNull(),
  // Legacy fields for backwards compatibility
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  packageSize: text("package_size").notNull(),
  unit: text("unit").notNull(),
  notes: text("notes"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recipes table
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  servingSize: integer("serving_size").notNull(),
  preparationTime: integer("preparation_time"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  // Marketing content fields
  deliveryContent: text("delivery_content"), // JSON string for delivery partner content
  advertisingContent: text("advertising_content"), // JSON string for advertising content
  socialContent: text("social_content"), // JSON string for social media content
  marketingNotes: text("marketing_notes"), // Additional notes for marketing content generation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  isBalanced: z.boolean().optional(),  discrepancyNotes: z.string().optional(),
});
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertShoppingListSchema = createInsertSchema(shoppingList).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true }).extend({
  supplier: z.string().nullable().optional(),
  items: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const insertExpenseSupplierSchema = createInsertSchema(expenseSuppliers).omit({ id: true, createdAt: true });
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true, createdAt: true });
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
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type ExpenseSupplier = typeof expenseSuppliers.$inferSelect;
export type InsertExpenseSupplier = z.infer<typeof insertExpenseSupplierSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
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
export const insertDailyReceiptSummarySchema =
  createInsertSchema(dailyShiftReceiptSummary).omit({ id: true, createdAt: true });

export type DailyShiftReceiptSummary =
  typeof dailyShiftReceiptSummary.$inferSelect;
export type InsertDailyShiftReceiptSummary =
  z.infer<typeof insertDailyReceiptSummarySchema>;

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


